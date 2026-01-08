import { AppDataSource } from "../db/config";
import { Expense } from "../db/entities/Expense";

export type ExpenseListParams = {
  page: number;
  limit: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  status?: "paid" | "unpaid";
};

export async function listExpenses(params: ExpenseListParams) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const repo = AppDataSource.getRepository(Expense);

  const qb = repo.createQueryBuilder("e").where("e.deletedAt IS NULL");

  if (params.search) {
    qb.andWhere("(e.title LIKE :q OR e.notes LIKE :q)", { q: `%${params.search}%` });
  }
  if (params.category) {
    qb.andWhere("e.category = :category", { category: params.category });
  }
  if (params.status) {
    qb.andWhere("e.status = :status", { status: params.status });
  }
  if (params.dateFrom) {
    qb.andWhere("e.expenseDate >= :dateFrom", { dateFrom: params.dateFrom });
  }
  if (params.dateTo) {
    qb.andWhere("e.expenseDate <= :dateTo", { dateTo: params.dateTo });
  }

  qb.orderBy("e.expenseDate", "DESC").addOrderBy("e.id", "DESC");

  const [data, total] = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return {
    data,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export type CreateExpenseInput = {
  title: string;
  category?: string | null;
  amount: number;
  currency?: string;
  expenseDate: string; // YYYY-MM-DD
  status?: "paid" | "unpaid";
  notes?: string | null;
};

export async function createExpense(input: CreateExpenseInput, actor?: string) {
  const repo = AppDataSource.getRepository(Expense);
  const exp = repo.create({
    title: input.title,
    category: input.category ?? null,
    amount: input.amount,
    currency: input.currency || "USD",
    expenseDate: input.expenseDate,
    status: input.status || "unpaid",
    notes: input.notes ?? null,
    createdBy: actor || null,
    updatedBy: actor || null,
  });
  return await repo.save(exp);
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export async function updateExpense(id: number, input: UpdateExpenseInput, actor?: string) {
  const repo = AppDataSource.getRepository(Expense);
  const existing = await repo.findOne({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new Error("NOT_FOUND");
  }

  if (input.title !== undefined) existing.title = input.title;
  if (input.category !== undefined) existing.category = input.category ?? null;
  if (input.amount !== undefined) existing.amount = input.amount;
  if (input.currency !== undefined) existing.currency = input.currency || existing.currency;
  if (input.expenseDate !== undefined) existing.expenseDate = input.expenseDate;
  if (input.status !== undefined) existing.status = input.status;
  if (input.notes !== undefined) existing.notes = input.notes ?? null;
  existing.updatedBy = actor || existing.updatedBy || null;

  return await repo.save(existing);
}

export async function deleteExpense(id: number, actor?: string) {
  const repo = AppDataSource.getRepository(Expense);
  const existing = await repo.findOne({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new Error("NOT_FOUND");
  }
  existing.updatedBy = actor || existing.updatedBy || null;
  await repo.save(existing);
  await repo.softDelete({ id });
  return { ok: true };
}

export type MonthlyTotalsParams = {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
};

export async function getExpenseMonthlyTotals(params: MonthlyTotalsParams) {
  const repo = AppDataSource.getRepository(Expense);
  const qb = repo
    .createQueryBuilder("e")
    .select("DATE_FORMAT(e.expenseDate, '%Y-%m')", "month")
    .addSelect("SUM(e.amount)", "totalAmount")
    .addSelect("e.currency", "currency")
    .where("e.deletedAt IS NULL");

  if (params.dateFrom) {
    qb.andWhere("e.expenseDate >= :dateFrom", { dateFrom: params.dateFrom });
  }
  if (params.dateTo) {
    qb.andWhere("e.expenseDate <= :dateTo", { dateTo: params.dateTo });
  }

  qb.groupBy("month").addGroupBy("e.currency").orderBy("month", "ASC");

  const rows = await qb.getRawMany<{ month: string; totalAmount: string; currency: string }>();
  return rows.map((r) => ({
    month: r.month,
    totalAmount: Number(r.totalAmount || 0),
    currency: r.currency || "USD",
  }));
}


