import { AppDataSource } from "../db/config";
import { CableVisionAccount } from "../db/entities/CableVisionAccount";
import { CableVisionProfile } from "../db/entities/CableVisionProfile";
import { CableVisionInvoice } from "../db/entities/CableVisionInvoice";
import { In, type DeepPartial } from "typeorm";
import { startOfMonth } from "date-fns";

function monthStartYmd(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const m = startOfMonth(d);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function listCableVisionAccounts(params: { page?: number; limit?: number; search?: string; billingMonth?: string }) {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Math.min(200, Number(params.limit || 50)));
  const search = String(params.search || "").trim();
  const billingMonth = monthStartYmd(params.billingMonth);

  const repo = AppDataSource.getRepository(CableVisionAccount);
  const qb = repo
    .createQueryBuilder("a")
    .leftJoinAndSelect("a.profiles", "p", "p.deletedAt IS NULL")
    .where("a.deletedAt IS NULL")
    .orderBy("a.createdAt", "DESC")
    .skip((page - 1) * limit)
    .take(limit);

  if (search) {
    qb.andWhere("(a.accountNumber LIKE :s OR a.fullName LIKE :s OR a.phoneNumber LIKE :s)", { s: `%${search}%` });
  }

  const [data, total] = await qb.getManyAndCount();

  const profileIds = data
    .flatMap((a) => a.profiles || [])
    .map((p) => p.id)
    .filter((id): id is number => Number.isFinite(Number(id)));

  const invRepo = AppDataSource.getRepository(CableVisionInvoice);
  const invoices =
    profileIds.length > 0
      ? await invRepo.find({
          where: {
            profileId: In(profileIds) as any,
            billingMonth,
            deletedAt: null as any,
          },
        })
      : [];

  const invoiceByProfileId = new Map<number, CableVisionInvoice>();
  for (const inv of invoices) {
    if (inv.profileId) invoiceByProfileId.set(inv.profileId, inv);
  }

  const enriched = data.map((a) => ({
    ...a,
    profiles: (a.profiles || []).map((p) => ({
      ...p,
      currentInvoice: p.id ? invoiceByProfileId.get(p.id) || null : null,
    })),
  }));

  return {
    data: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    billingMonth,
  };
}

export async function createCableVisionAccount(input: {
  accountNumber: string;
  fullName: string;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: "active" | "suspended" | "cancelled";
}) {
  const repo = AppDataSource.getRepository(CableVisionAccount);
  const account = repo.create({
    accountNumber: String(input.accountNumber || "").trim(),
    fullName: String(input.fullName || "").trim(),
    phoneNumber: input.phoneNumber ? String(input.phoneNumber).trim() : null,
    email: input.email ? String(input.email).trim() : null,
    address: input.address ? String(input.address).trim() : null,
    notes: input.notes ? String(input.notes).trim() : null,
    status: (input.status || "active") as any,
  });
  return await repo.save(account);
}

export async function updateCableVisionAccount(
  accountId: number,
  input: Partial<{
    accountNumber: string;
    fullName: string;
    phoneNumber: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    status: "active" | "suspended" | "cancelled";
  }>
) {
  const repo = AppDataSource.getRepository(CableVisionAccount);
  const account = await repo.findOne({ where: { id: accountId, deletedAt: null as any } as any });
  if (!account) throw new Error("Account not found");

  if (typeof input.accountNumber === "string") account.accountNumber = input.accountNumber.trim();
  if (typeof input.fullName === "string") account.fullName = input.fullName.trim();
  if (typeof input.phoneNumber !== "undefined") account.phoneNumber = input.phoneNumber ? String(input.phoneNumber).trim() : null;
  if (typeof input.email !== "undefined") account.email = input.email ? String(input.email).trim() : null;
  if (typeof input.address !== "undefined") account.address = input.address ? String(input.address).trim() : null;
  if (typeof input.notes !== "undefined") account.notes = input.notes ? String(input.notes).trim() : null;
  if (typeof input.status === "string") account.status = input.status as any;

  return await repo.save(account);
}

export async function deleteCableVisionAccount(accountId: number, actor?: string) {
  const repo = AppDataSource.getRepository(CableVisionAccount);
  const account = await repo.findOne({ where: { id: accountId, deletedAt: null as any } as any });
  if (!account) throw new Error("Account not found");
  account.deletedBy = actor || "system";
  await repo.softRemove(account);
  return account;
}

export async function listCableVisionProfiles(accountId: number) {
  const repo = AppDataSource.getRepository(CableVisionProfile);
  return await repo.find({
    where: { accountId, deletedAt: null as any } as any,
    order: { profileIndex: "ASC" },
  });
}

export async function createCableVisionProfile(
  accountId: number,
  input: {
    profileName: string;
    profileIndex?: number;
    assignedTo?: string | null;
    deviceId?: string | null;
    monthlyFee?: number;
    status?: "active" | "inactive";
  }
) {
  const accountRepo = AppDataSource.getRepository(CableVisionAccount);
  const acc = await accountRepo.findOne({ where: { id: accountId, deletedAt: null as any } as any });
  if (!acc) throw new Error("Account not found");

  const profileRepo = AppDataSource.getRepository(CableVisionProfile);
  const existing = await profileRepo.find({ where: { accountId, deletedAt: null as any } as any });
  if (existing.length >= 5) throw new Error("This account already has 5 profiles");

  const requestedIndex = input.profileIndex ? Number(input.profileIndex) : null;
  let profileIndex = requestedIndex && requestedIndex >= 1 && requestedIndex <= 5 ? requestedIndex : 0;
  if (!profileIndex) {
    const used = new Set(existing.map((p) => p.profileIndex));
    for (let i = 1; i <= 5; i++) {
      if (!used.has(i)) {
        profileIndex = i;
        break;
      }
    }
  }
  if (!profileIndex) throw new Error("No available profile slot (1-5)");

  const profile = profileRepo.create({
    accountId,
    profileIndex,
    profileName: String(input.profileName || "").trim(),
    assignedTo: input.assignedTo ? String(input.assignedTo).trim() : null,
    deviceId: input.deviceId ? String(input.deviceId).trim() : null,
    monthlyFee: Number.isFinite(Number(input.monthlyFee)) ? Number(input.monthlyFee) : 0,
    status: (input.status || "active") as any,
  });
  return await profileRepo.save(profile);
}

export async function updateCableVisionProfile(
  profileId: number,
  input: Partial<{
    profileName: string;
    assignedTo: string | null;
    deviceId: string | null;
    monthlyFee: number;
    status: "active" | "inactive";
  }>
) {
  const repo = AppDataSource.getRepository(CableVisionProfile);
  const profile = await repo.findOne({ where: { id: profileId, deletedAt: null as any } as any });
  if (!profile) throw new Error("Profile not found");

  if (typeof input.profileName === "string") profile.profileName = input.profileName.trim();
  if (typeof input.assignedTo !== "undefined") profile.assignedTo = input.assignedTo ? String(input.assignedTo).trim() : null;
  if (typeof input.deviceId !== "undefined") profile.deviceId = input.deviceId ? String(input.deviceId).trim() : null;
  if (typeof input.monthlyFee !== "undefined" && Number.isFinite(Number(input.monthlyFee))) profile.monthlyFee = Number(input.monthlyFee);
  if (typeof input.status === "string") profile.status = input.status as any;

  return await repo.save(profile);
}

export async function deleteCableVisionProfile(profileId: number, actor?: string) {
  const repo = AppDataSource.getRepository(CableVisionProfile);
  const profile = await repo.findOne({ where: { id: profileId, deletedAt: null as any } as any });
  if (!profile) throw new Error("Profile not found");
  profile.deletedBy = actor || "system";
  await repo.softRemove(profile);
  return profile;
}

export async function listCableVisionInvoices(params: {
  page?: number;
  limit?: number;
  accountId?: number;
  profileId?: number;
  billingMonth?: string;
  status?: string;
}) {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Math.min(200, Number(params.limit || 50)));

  const repo = AppDataSource.getRepository(CableVisionInvoice);
  const qb = repo
    .createQueryBuilder("i")
    .leftJoinAndSelect("i.profile", "profile")
    .leftJoinAndSelect("i.account", "account")
    .where("i.deletedAt IS NULL")
    .orderBy("i.createdAt", "DESC")
    .skip((page - 1) * limit)
    .take(limit);

  if (Number.isFinite(Number(params.accountId))) qb.andWhere("i.accountId = :accountId", { accountId: Number(params.accountId) });
  if (Number.isFinite(Number(params.profileId))) qb.andWhere("i.profileId = :profileId", { profileId: Number(params.profileId) });
  if (params.billingMonth) qb.andWhere("i.billingMonth = :billingMonth", { billingMonth: monthStartYmd(params.billingMonth) });
  if (params.status && params.status !== "all") qb.andWhere("i.status = :status", { status: String(params.status) });

  const [data, total] = await qb.getManyAndCount();
  return { data, total, page, totalPages: Math.ceil(total / limit) };
}

export async function generateCableVisionMonthlyInvoices(params?: { billingMonth?: string }) {
  const billingMonth = monthStartYmd(params?.billingMonth);
  const profileRepo = AppDataSource.getRepository(CableVisionProfile);
  const invoiceRepo = AppDataSource.getRepository(CableVisionInvoice);

  const profiles = await profileRepo.find({
    where: { deletedAt: null as any, status: "active" as any } as any,
  });

  if (profiles.length === 0) return { createdCount: 0, billingMonth };

  const profileIds = profiles.map((p) => p.id).filter((id): id is number => Number.isFinite(Number(id)));
  const existing = await invoiceRepo.find({
    where: { profileId: In(profileIds) as any, billingMonth, deletedAt: null as any } as any,
  });
  const existingProfileIds = new Set(existing.map((i) => i.profileId).filter((id): id is number => Number.isFinite(Number(id))));

  const toCreate = profiles.filter((p) => p.id && !existingProfileIds.has(p.id));
  if (toCreate.length === 0) return { createdCount: 0, billingMonth };

  // Use DeepPartial[] to avoid TypeORM overload ambiguity (create(...) can return entity OR entity[])
  const invoicesToCreate: DeepPartial<CableVisionInvoice>[] = toCreate.map((p) => ({
    accountId: p.accountId,
    profileId: p.id || null,
    billingMonth,
    amount: Number(p.monthlyFee || 0),
    status: "unpaid",
    paidAt: null,
    paymentMethod: null,
    collectedBy: null,
    collectedAt: null,
    cashReconciled: false,
    reconciledBy: null,
    reconciledAt: null,
    lastAction: "GENERATE_MONTHLY",
    modifiedAt: null,
    modifiedBy: null,
    deletedBy: null,
  }));

  await invoiceRepo.save(invoicesToCreate);
  return { createdCount: invoicesToCreate.length, billingMonth };
}

export async function payCableVisionInvoice(
  invoiceId: number,
  actorUsername: string,
  paymentMethod: "cash" | "pos" | "transfer" | "other" = "cash"
) {
  const repo = AppDataSource.getRepository(CableVisionInvoice);
  const invoice = await repo.findOne({ where: { id: invoiceId, deletedAt: null as any } as any });
  if (!invoice) throw new Error("Invoice not found");

  invoice.status = "paid";
  invoice.paidAt = new Date();
  invoice.paymentMethod = paymentMethod;
  invoice.collectedBy = actorUsername || "system";
  invoice.collectedAt = new Date();
  invoice.modifiedBy = actorUsername || "system";
  invoice.modifiedAt = new Date();
  invoice.lastAction = "PAY";

  await repo.save(invoice);
  return invoice;
}

export async function unpayCableVisionInvoice(invoiceId: number, actorUsername: string) {
  const repo = AppDataSource.getRepository(CableVisionInvoice);
  const invoice = await repo.findOne({ where: { id: invoiceId, deletedAt: null as any } as any });
  if (!invoice) throw new Error("Invoice not found");

  invoice.status = "unpaid";
  invoice.paidAt = null;
  invoice.paymentMethod = null;
  invoice.collectedBy = null;
  invoice.collectedAt = null;
  invoice.cashReconciled = false;
  invoice.reconciledBy = null;
  invoice.reconciledAt = null;
  invoice.modifiedBy = actorUsername || "system";
  invoice.modifiedAt = new Date();
  invoice.lastAction = "UNPAY";

  await repo.save(invoice);
  return invoice;
}

