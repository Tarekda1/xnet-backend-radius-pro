// src/services/invoice.service.ts
import { AppDataSource } from '../db/config';
import { In } from 'typeorm';
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { Invoices } from "../db/entities/Invoices";
import { startOfMonth } from "date-fns";
import { UserDetails } from '../db/entities/UserDetails';
import { ExternalInvoice } from '../db/entities/ExternalInvoice';
import { invoiceEvents } from '../events/invoiceEvents';

function isYmdOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ymdToLocalDayStart(ymd: string): Date {
    // Interpret YYYY-MM-DD as local/server day start
    return new Date(`${ymd}T00:00:00.000`);
}

function ymdToLocalNextDayStart(ymd: string): Date {
    const d = ymdToLocalDayStart(ymd);
    d.setDate(d.getDate() + 1);
    return d;
}

function parseRangeStart(value: string): Date {
    // If caller passes date-only, interpret as start-of-day in server/local time
    // (avoids UTC shifting which can make "same-day" filters look empty)
    if (isYmdOnly(value)) return ymdToLocalDayStart(value);
    return new Date(value);
}

function parseRangeEnd(value: string): Date {
    // If caller passes date-only, interpret as end-of-day in server/local time (inclusive)
    if (isYmdOnly(value)) return new Date(`${value}T23:59:59.999`);
    return new Date(value);
}

export const generateMonthlyInvoices = async () => {
    const userProfileRepo = AppDataSource.getRepository(Raduserprofile);
    const invoiceRepo = AppDataSource.getRepository(Invoices);
    const userDetailsRepo = AppDataSource.getRepository(UserDetails);

    const userProfiles = await userProfileRepo.find({
        relations: ["profile"],
        where: {
            accountStatus: "active",
        },
    });

    const billingMonth = startOfMonth(new Date()).toISOString();

    for (const user of userProfiles) {
        const exists = await invoiceRepo.findOne({
            where: {
                userProfile: { id: user.id },
                billingMonth,
            },
            relations: ["userProfile"],
        });

        if (!exists) {
            const username = user.username;
            const userDetails = await userDetailsRepo.findOne({ where: { username } }) || new UserDetails();
            const invoice = invoiceRepo.create({
                userDetails,
                userProfile: user,
                billingMonth,
                amount: (user.profile.price || 0),
                status: "unpaid",
            });
            await invoiceRepo.save(invoice);
        }
    }
};

export const getAllInvoices = async (
    page = 1,
    limit = 10,
    search = '',
    dateFrom?: string,
    dateTo?: string
) => {
    const invoiceRepo = AppDataSource.getRepository(Invoices);

    const qb = invoiceRepo.createQueryBuilder("invoice")
        .leftJoinAndSelect("invoice.userProfile", "userProfile")
        .leftJoinAndSelect("userProfile.profile", "profile")
        .leftJoinAndSelect("invoice.userDetails", "userDetails")
        .orderBy("invoice.createdAt", "DESC")
        .skip((page - 1) * limit)
        .take(limit);

    // 🔍 Apply search (username or full name)
    if (search) {
        qb.andWhere(
            "(userProfile.username LIKE :search OR userDetails.fullName LIKE :search)",
            { search: `%${search}%` }
        );
    }

    // 📅 Apply date range
    if (dateFrom && dateTo) {
        qb.andWhere("invoice.billingMonth BETWEEN :from AND :to", {
            from: dateFrom,
            to: dateTo,
        });
    } else if (dateFrom) {
        qb.andWhere("invoice.billingMonth >= :from", { from: dateFrom });
    } else if (dateTo) {
        qb.andWhere("invoice.billingMonth <= :to", { to: dateTo });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
};

export const payInvoice = async (invoiceId: number) => {
    const invoiceRepo = AppDataSource.getRepository(Invoices);

    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date(); // Set paidAt as ISO date string
    await invoiceRepo.save(invoice);

    return invoice;
};

export const collectInvoice = async (invoiceId: number, collectorUsername: string, paymentMethod: 'cash' | 'pos' | 'transfer' | 'other' = 'cash') => {
    const invoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    // Mark as collected and paid in one step
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    (invoice as any).paymentMethod = paymentMethod;
    (invoice as any).collectedBy = collectorUsername;
    (invoice as any).collectedAt = new Date();

    await invoiceRepo.save(invoice);
    return invoice;
};

export const reconcileInvoiceCash = async (
    invoiceId: number,
    reconcilerUsername: string,
    actorRole?: 'admin' | 'manager' | 'support' | 'collector'
) => {
    const invoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    // RBAC: collectors can only reconcile invoices they collected
    // (managers/admins can reconcile any)
    if (actorRole === 'collector' && invoice.collectedBy !== reconcilerUsername) {
        throw new Error('Forbidden');
    }

    if (!invoice.collectedBy) {
        throw new Error('Invoice is not collected');
    }

    if ((invoice as any).paymentMethod !== 'cash') {
        throw new Error('Only cash invoices can be reconciled');
    }

    if ((invoice as any).cashReconciled) {
        return invoice;
    }

    (invoice as any).cashReconciled = true;
    (invoice as any).reconciledBy = reconcilerUsername;
    (invoice as any).reconciledAt = new Date();

    await invoiceRepo.save(invoice);
    return invoice;
};

export const reconcileBulkCash = async (params: {
    dateFrom: string;
    dateTo: string;
    collector?: string;
    actorUsername: string;
}) => {
    const { dateFrom, dateTo, collector, actorUsername } = params;

    const from = parseRangeStart(dateFrom);
    const to = parseRangeEnd(dateTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('Invalid date range');
    }

    const repo = AppDataSource.getRepository(ExternalInvoice);

    const qb = repo.createQueryBuilder('ext')
        .select('ext.id', 'id')
        .where('ext.deletedAt IS NULL')
        .andWhere('ext.cashReconciled = :cashReconciled', { cashReconciled: false })
        .andWhere('ext.paymentMethod = :paymentMethod', { paymentMethod: 'cash' })
        .andWhere('ext.collectedBy IS NOT NULL')
        .andWhere('ext.collectedAt IS NOT NULL');

    // Robust whole-day filtering for YYYY-MM-DD inputs:
    // use [fromStart, nextDayStart) to avoid midnight/precision/timezone edge cases.
    if (isYmdOnly(dateFrom) && isYmdOnly(dateTo)) {
        const fromStart = ymdToLocalDayStart(dateFrom);
        const toExclusive = ymdToLocalNextDayStart(dateTo);
        qb.andWhere('ext.collectedAt >= :from AND ext.collectedAt < :to', { from: fromStart, to: toExclusive });
    } else {
        qb.andWhere('ext.collectedAt BETWEEN :from AND :to', { from, to });
    }

    if (collector) {
        qb.andWhere('ext.collectedBy = :collector', { collector });
    }

    const rows = await qb.getRawMany<{ id: string | number }>();
    const reconciledIds = rows
        .map(r => Number(r.id))
        .filter(n => Number.isFinite(n));

    if (reconciledIds.length === 0) {
        return { reconciledCount: 0, reconciledIds: [] as number[] };
    }

    await repo.createQueryBuilder()
        .update(ExternalInvoice)
        .set({
            cashReconciled: true,
            reconciledBy: actorUsername,
            reconciledAt: new Date(),
        } as any)
        .whereInIds(reconciledIds)
        .execute();

    return { reconciledCount: reconciledIds.length, reconciledIds };
};

export const payExternalInvoice = async (
    invoiceId: number,
    actorUsername: string,
    paymentMethod: 'cash' | 'pos' | 'transfer' | 'other' = 'cash'
) => {
    const invoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    // Mark as paid and also capture collection info for EOD reconciliation
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    (invoice as any).paymentMethod = paymentMethod;
    (invoice as any).collectedBy = actorUsername;
    (invoice as any).collectedAt = new Date();

    await invoiceRepo.save(invoice);

    return invoice;
};

export const unpayExternalInvoice = async (invoiceId: number, actorUsername: string) => {
    const invoiceRepo = AppDataSource.getRepository(ExternalInvoice);
    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    invoice.status = 'unpaid';
    invoice.paidAt = null;
    (invoice as any).paymentMethod = null;
    (invoice as any).collectedBy = null;
    (invoice as any).collectedAt = null;
    (invoice as any).cashReconciled = false;
    (invoice as any).reconciledBy = null;
    (invoice as any).reconciledAt = null;
    (invoice as any).modifiedBy = actorUsername;
    (invoice as any).modifiedAt = new Date();
    (invoice as any).lastAction = 'UNPAY';

    await invoiceRepo.save(invoice);
    return invoice;
};


export const bulkPayInvoices = async (invoiceIds: number[]) => {
    const invoiceRepo = AppDataSource.getRepository(Invoices);

    const invoices = await invoiceRepo.findByIds(invoiceIds);
    if (invoices.length === 0) {
        throw new Error('No invoices found');
    }

    for (const invoice of invoices) {
        invoice.status = 'paid';
    }

    await invoiceRepo.save(invoices);

    return invoices;
};

// 1. Merge A and B
function mergeExternalInvoices(
    source: ExternalInvoice[],
    incoming: Partial<ExternalInvoice>[]
): Partial<ExternalInvoice>[] {
    const sourceMap = new Map(source.map(item => [item.id, item]));
    // Format date as YYYY-MM-DD
    const today = new Date();
    const billingMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    return incoming.map(item => {
        const sourceItem = sourceMap.get(item.id);

        if (sourceItem) {
            // Merge: override identity fields from source
            return {
                ...item,
                username: sourceItem.username,
                fullName: sourceItem.fullName,
                email: sourceItem.email || "",
                // Do NOT inject placeholder phone numbers; keep empty so reminders can fail loudly.
                phoneNumber: sourceItem.phoneNumber || "",
                address: sourceItem.address,
                billingMonth,
                provider: sourceItem.provider,
            };
        }

        // New record — keep as-is
        return { ...item, email: item.email || "", phoneNumber: (item as any).phoneNumber || "", billingMonth };
    });
}


// 2. Update ExternalInvoice Table
export const replaceExternalInvoices = async (incoming: Partial<ExternalInvoice>[]) => {
    const repo = AppDataSource.getRepository(ExternalInvoice);
    const queryRunner = AppDataSource.createQueryRunner();

    try {
        // Start transaction
        await queryRunner.connect();
        await queryRunner.startTransaction();

        console.log(`incoming: ${incoming}`); // log the incoming data

        // Fetch current records from the database
        const current = await repo.find();

        // Merge with incoming
        const merged = mergeExternalInvoices(current, incoming);

        console.log(`merged  ${merged}`); // log the result

        try {
            // Delete all records using DELETE instead of TRUNCATE
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(ExternalInvoice)
                .execute();

            // Insert new merged records
            await queryRunner.manager.save(ExternalInvoice, merged);

            // Commit transaction
            await queryRunner.commitTransaction();
        } catch (err) {
            // Rollback transaction on error
            await queryRunner.rollbackTransaction();
            throw err;
        }

        return merged;
    } catch (error) {
        console.error('Error in replaceExternalInvoices:', error);
        throw error;
    } finally {
        // Release query runner
        await queryRunner.release();
    }
};

export const getAllExternalInvoices = async (
    page = 1,
    limit = 10,
    search = "",
    from?: string,
    to?: string,
    status?: string,
    sortBy: 'createdAt' | 'billingMonth' | 'amount' = 'createdAt',
    sortDir: 'ASC' | 'DESC' = 'DESC',
    includeDeleted = false
) => {
    const externalInvoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const qb = externalInvoiceRepo.createQueryBuilder("externalInvoice")
        .orderBy(`externalInvoice.${sortBy}`, sortDir)
        .skip((page - 1) * limit)
        .take(limit);

    // Only include non-deleted records by default
    if (!includeDeleted) {
        qb.andWhere("externalInvoice.deletedAt IS NULL");
    }

    // Search conditions
    if (search) {
        qb.andWhere(
            "(externalInvoice.username LIKE :search OR externalInvoice.fullName LIKE :search OR externalInvoice.id = :id)",
            {
                search: `%${search}%`,
                id: isNaN(Number(search)) ? 0 : Number(search),
            }
        );
    }

    // Date range filter on billingMonth
    if (from && to) {
        qb.andWhere("externalInvoice.billingMonth BETWEEN :from AND :to", {
            from: from,
            to: to,
        });
    } else if (from) {
        qb.andWhere("externalInvoice.billingMonth >= :from", { from });
    } else if (to) {
        qb.andWhere("externalInvoice.billingMonth <= :to", { to });
    }

    // Status filter
    if (status && status !== 'all') {
        qb.andWhere("externalInvoice.status = :status", { status });
    }

    // Fetch paginated results
    const [data, total] = await qb.getManyAndCount();

    // 🔢 Get Metrics (non-paginated query for totals)
    const baseQb = externalInvoiceRepo.createQueryBuilder("externalInvoice");

    if (!includeDeleted) {
        baseQb.andWhere("externalInvoice.deletedAt IS NULL");
    }

    if (search) {
        baseQb.andWhere(
            "(externalInvoice.username LIKE :search OR externalInvoice.fullName LIKE :search OR externalInvoice.id = :id)",
            {
                search: `%${search}%`,
                id: isNaN(Number(search)) ? 0 : Number(search),
            }
        );
    }

    if (from && to) {
        baseQb.andWhere("externalInvoice.billingMonth BETWEEN :from AND :to", {
            from: from,
            to: to,
        });
    } else if (from) {
        baseQb.andWhere("externalInvoice.billingMonth >= :from", { from });
    } else if (to) {
        baseQb.andWhere("externalInvoice.billingMonth <= :to", { to });
    }

    if (status && status !== 'all') {
        baseQb.andWhere("externalInvoice.status = :status", { status });
    }

    const totalPaid = await baseQb
        .clone()
        .andWhere("externalInvoice.status = 'paid'")
        .getCount();

    const totalUnpaid = await baseQb
        .clone()
        .andWhere("externalInvoice.status = 'unpaid'")
        .getCount();

    const totalPending = await baseQb
        .clone()
        .andWhere("externalInvoice.status = 'pending'")
        .getCount();

    const totalAmount = await baseQb
        .clone()
        .select("SUM(externalInvoice.amount)", "sum")
        .getRawOne<{ sum: string }>();

    return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        metrics: {
            totalInvoices: total,
            totalPaid,
            totalUnpaid,
            totalPending,
            totalAmount: parseFloat(totalAmount?.sum || "0"),
        },
    };
};

export const updateExternalInvoice = async (invoiceId: number, updateData: Partial<ExternalInvoice>) => {
    const externalInvoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await externalInvoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('External invoice not found');
    }

    // Track changes
    const changes: Record<string, { from: any; to: any }> = {};
    for (const [key, value] of Object.entries(updateData)) {
        if (key in invoice && invoice[key as keyof ExternalInvoice] !== value) {
            changes[key] = {
                from: invoice[key as keyof ExternalInvoice],
                to: value
            };
        }
    }


    Object.assign(invoice, updateData);
    const updatedInvoice = await externalInvoiceRepo.save(invoice);

    // Emit modification event
    invoiceEvents.emitModification({
        invoiceId: invoice.id || -1,
        username: updateData.modifiedBy || 'system',
        action: 'UPDATED',
        timestamp: new Date(),
        changes
    });

    return updatedInvoice;
};

export const deleteExternalInvoice = async (invoiceId: number, username?: string) => {
    const externalInvoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await externalInvoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('External invoice not found');
    }

    // Set deletion info
    invoice.deletedBy = username || 'system';

    // Use TypeORM's soft delete
    await externalInvoiceRepo.softRemove(invoice);

    // Emit deletion event
    invoiceEvents.emitModification({
        invoiceId: invoice.id || -1,
        username: username || 'system',
        action: 'DELETED',
        timestamp: new Date()
    });

    return invoice;
};

export const bulkDeleteExternalInvoices = async (invoiceIds: number[], username?: string) => {
    const externalInvoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const uniqueIds = Array.from(new Set(invoiceIds))
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0);

    if (uniqueIds.length === 0) {
        return { deletedIds: [], failed: [] as Array<{ id: number; reason: string }> };
    }

    // Only non-deleted records will be returned by default; already-deleted IDs will be treated as "not found"
    const invoices = await externalInvoiceRepo.find({
        where: { id: In(uniqueIds) as any },
    });

    const foundIds = new Set(invoices.map((i) => i.id).filter(Boolean) as number[]);
    const failed: Array<{ id: number; reason: string }> = [];
    for (const id of uniqueIds) {
        if (!foundIds.has(id)) {
            failed.push({ id, reason: 'Invoice not found (or already deleted)' });
        }
    }

    // Soft-delete everything found and stamp deletedBy
    for (const inv of invoices) {
        inv.deletedBy = username || 'system';
    }

    if (invoices.length > 0) {
        await externalInvoiceRepo.softRemove(invoices);

        for (const inv of invoices) {
            invoiceEvents.emitModification({
                invoiceId: inv.id || -1,
                username: username || 'system',
                action: 'DELETED',
                timestamp: new Date(),
            });
        }
    }

    const deletedIds = invoices.map((i) => i.id).filter(Boolean) as number[];
    return { deletedIds, failed };
};


export const recoverExternalInvoice = async (invoiceId: number, username?: string) => {
    const externalInvoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await externalInvoiceRepo.findOne({
        where: { id: invoiceId },
        withDeleted: true // Include soft-deleted records in search
    });

    if (!invoice) {
        throw new Error('External invoice not found');
    }

    if (!invoice.deletedAt) {
        throw new Error('Invoice is not deleted');
    }

    // Clear deletion info
    invoice.deletedAt = null;
    invoice.deletedBy = null;
    await externalInvoiceRepo.save(invoice);

    // Emit recovery event
    invoiceEvents.emitModification({
        invoiceId: invoice.id || -1,
        username: username || 'system',
        action: 'RECOVERED',
        timestamp: new Date()
    });

    return invoice;
};

// Collected metrics and drilldowns
export const getCollectedMetrics = async (dateFrom?: string, dateTo?: string) => {
    const repo = AppDataSource.getRepository(ExternalInvoice);
    const qb = repo.createQueryBuilder('ext')
        .where('ext.collectedBy IS NOT NULL')
        .andWhere('ext.deletedAt IS NULL');

    if (dateFrom && dateTo) {
        if (isYmdOnly(dateFrom) && isYmdOnly(dateTo)) {
            qb.andWhere('ext.collectedAt >= :from AND ext.collectedAt < :to', {
                from: ymdToLocalDayStart(dateFrom),
                to: ymdToLocalNextDayStart(dateTo),
            });
        } else {
            qb.andWhere('ext.collectedAt BETWEEN :from AND :to', {
                from: parseRangeStart(dateFrom),
                to: parseRangeEnd(dateTo)
            });
        }
    } else if (dateFrom) {
        qb.andWhere('ext.collectedAt >= :from', { from: parseRangeStart(dateFrom) });
    } else if (dateTo) {
        if (isYmdOnly(dateTo)) {
            qb.andWhere('ext.collectedAt < :to', { to: ymdToLocalNextDayStart(dateTo) });
        } else {
            qb.andWhere('ext.collectedAt <= :to', { to: parseRangeEnd(dateTo) });
        }
    }

    const totalCollectedInvoices = await qb.clone().getCount();
    const { sum } = await qb.clone()
        .select('SUM(ext.amount)', 'sum')
        .getRawOne<{ sum: string }>() || { sum: '0' };

    return { totalCollectedInvoices, totalCashCollected: parseFloat(sum || '0') };
};

export const getCollectorBreakdown = async (dateFrom?: string, dateTo?: string) => {
    const repo = AppDataSource.getRepository(ExternalInvoice);
    const qb = repo.createQueryBuilder('ext')
        .select('ext.collectedBy', 'collector')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(ext.amount)', 'totalAmount')
        .where('ext.collectedBy IS NOT NULL')
        .andWhere('ext.deletedAt IS NULL')
        .groupBy('ext.collectedBy')
        .orderBy('totalAmount', 'DESC');

    if (dateFrom && dateTo) {
        if (isYmdOnly(dateFrom) && isYmdOnly(dateTo)) {
            qb.andWhere('ext.collectedAt >= :from AND ext.collectedAt < :to', {
                from: ymdToLocalDayStart(dateFrom),
                to: ymdToLocalNextDayStart(dateTo),
            });
        } else {
            qb.andWhere('ext.collectedAt BETWEEN :from AND :to', {
                from: parseRangeStart(dateFrom),
                to: parseRangeEnd(dateTo)
            });
        }
    } else if (dateFrom) {
        qb.andWhere('ext.collectedAt >= :from', { from: parseRangeStart(dateFrom) });
    } else if (dateTo) {
        if (isYmdOnly(dateTo)) {
            qb.andWhere('ext.collectedAt < :to', { to: ymdToLocalNextDayStart(dateTo) });
        } else {
            qb.andWhere('ext.collectedAt <= :to', { to: parseRangeEnd(dateTo) });
        }
    }

    const rows = await qb.getRawMany<{ collector: string; count: string; totalAmount: string }>();
    return rows.map(r => ({
        collector: r.collector,
        count: parseInt(r.count, 10) || 0,
        totalAmount: parseFloat(r.totalAmount || '0')
    }));
};

export const getCollectedInvoicesList = async (
    page = 1,
    limit = 10,
    dateFrom?: string,
    dateTo?: string
) => {
    const repo = AppDataSource.getRepository(ExternalInvoice);
    const qb = repo.createQueryBuilder('ext')
        .where('ext.collectedBy IS NOT NULL')
        .andWhere('ext.deletedAt IS NULL')
        .orderBy('ext.collectedAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

    if (dateFrom && dateTo) {
        if (isYmdOnly(dateFrom) && isYmdOnly(dateTo)) {
            qb.andWhere('ext.collectedAt >= :from AND ext.collectedAt < :to', {
                from: ymdToLocalDayStart(dateFrom),
                to: ymdToLocalNextDayStart(dateTo),
            });
        } else {
            qb.andWhere('ext.collectedAt BETWEEN :from AND :to', {
                from: parseRangeStart(dateFrom),
                to: parseRangeEnd(dateTo)
            });
        }
    } else if (dateFrom) {
        qb.andWhere('ext.collectedAt >= :from', { from: parseRangeStart(dateFrom) });
    } else if (dateTo) {
        if (isYmdOnly(dateTo)) {
            qb.andWhere('ext.collectedAt < :to', { to: ymdToLocalNextDayStart(dateTo) });
        } else {
            qb.andWhere('ext.collectedAt <= :to', { to: parseRangeEnd(dateTo) });
        }
    }

    const [data, total] = await qb.getManyAndCount();
    const totalAmount = data.reduce((acc, inv) => acc + (inv.amount || 0), 0);

    return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        pageTotalAmount: totalAmount
    };
};
