
// src/services/invoice.service.ts
import { AppDataSource } from '../db/config';
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { Invoice } from "../db/entities/Invoice";
import { startOfMonth } from "date-fns";
import { UserDetails } from '../db/entities/UserDetails';
import { ExternalInvoice } from '../db/entities/ExternalInvoice';
import { invoiceEvents } from '../events/invoiceEvents';

export const generateMonthlyInvoices = async () => {
    const userProfileRepo = AppDataSource.getRepository(Raduserprofile);
    const invoiceRepo = AppDataSource.getRepository(Invoice);
    const userDetailsRepo = AppDataSource.getRepository(UserDetails);

    const userProfiles = await userProfileRepo.find({
        relations: ["profile"],
        where: {
            accountStatus: "active",
        },
    });

    const billingMonth = startOfMonth(new Date());

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
    const invoiceRepo = AppDataSource.getRepository(Invoice);

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
    const invoiceRepo = AppDataSource.getRepository(Invoice);

    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date(); // Set paidAt as ISO date string
    await invoiceRepo.save(invoice);

    return invoice;
};

export const payExternalInvoice = async (invoiceId: number) => {
    const invoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    invoice.status = 'paid';
    await invoiceRepo.save(invoice);

    return invoice;
};


export const bulkPayInvoices = async (invoiceIds: number[]) => {
    const invoiceRepo = AppDataSource.getRepository(Invoice);

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
    incoming: ExternalInvoice[]
): ExternalInvoice[] {
    const sourceMap = new Map(source.map(item => [item.id, item]));
    const billingMonth = startOfMonth(new Date());
    return incoming.map(item => {
        const sourceItem = sourceMap.get(item.id);

        if (sourceItem) {
            // Merge: override identity fields from source
            return {
                ...item,
                username: sourceItem.username,
                fullName: sourceItem.fullName,
                email: sourceItem.email || "",
                phoneNumber: sourceItem.phoneNumber || "9613000000",
                address: sourceItem.address,
                billingMonth,
                provider: sourceItem.provider,
            };
        }

        // New record — keep as-is
        return { ...item, email: "", phoneNumber: "9613000000", billingMonth };
    });
}


// 2. Update ExternalInvoice Table
export const replaceExternalInvoices = async (incoming: ExternalInvoice[]) => {
    const repo = AppDataSource.getRepository(ExternalInvoice);

    console.log(`incoming: ${incoming}`); // log the incoming data

    // Fetch current records from the database
    const current = await repo.find();

    // Merge with incoming
    const merged = mergeExternalInvoices(current, incoming);

    console.log(`merged  ${merged}`); // log the result

    // Truncate the table
    await repo.clear(); // equivalent to TRUNCATE, resets auto-increment too

    // Insert new merged records
    await repo.save(merged);

    return merged;
};

export const getAllExternalInvoices = async (
    page = 1,
    limit = 10,
    search = "",
    includeDeleted = false
) => {
    const externalInvoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    const qb = externalInvoiceRepo.createQueryBuilder("externalInvoice")
        .orderBy("externalInvoice.createdAt", "DESC")
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

    // Fetch paginated results
    const [data, total] = await qb.getManyAndCount();

    // 🔢 Get Metrics (non-paginated query for totals)
    const baseQb = externalInvoiceRepo.createQueryBuilder("externalInvoice");

    if (search) {
        baseQb.andWhere(
            "(externalInvoice.username LIKE :search OR externalInvoice.fullName LIKE :search OR externalInvoice.id = :id)",
            {
                search: `%${search}%`,
                id: isNaN(Number(search)) ? 0 : Number(search),
            }
        );
    }

    const totalPaid = await baseQb
        .clone()
        .andWhere("externalInvoice.status = 'paid'")
        .getCount();

    const totalUnpaid = await baseQb
        .clone()
        .andWhere("externalInvoice.status = 'unpaid'")
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
        action: 'UPDATE',
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
        action: 'DELETE',
        timestamp: new Date()
    });

    return invoice;
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
    invoice.deletedAt = undefined;
    invoice.deletedBy = undefined;
    await externalInvoiceRepo.save(invoice);

    // Emit recovery event
    invoiceEvents.emitModification({
        invoiceId: invoice.id || -1,
        username: username || 'system',
        action: 'RECOVER',
        timestamp: new Date()
    });

    return invoice;
};
