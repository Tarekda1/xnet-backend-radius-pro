import { Request, Response } from "express";
import {
  createExpense,
  deleteExpense,
  getExpenseMonthlyTotals,
  listExpenses,
  updateExpense,
} from "../services/expenseService";

const sendResponse = (
  res: Response,
  success: boolean,
  status: number,
  message: string,
  data: any = null
) => {
  res.status(status).json({ success, message, data });
};

export const listExpensesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || undefined;
    const dateFrom = (req.query.dateFrom as string) || undefined;
    const dateTo = (req.query.dateTo as string) || undefined;
    const category = (req.query.category as string) || undefined;
    const status = (req.query.status as "paid" | "unpaid") || undefined;

    const result = await listExpenses({
      page,
      limit,
      search,
      dateFrom,
      dateTo,
      category,
      status,
    });
    sendResponse(res, true, 200, "Expenses fetched successfully", result);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
};

export const createExpenseHandler = async (req: Request, res: Response) => {
  try {
    const { title, category, amount, currency, expenseDate, status, notes } =
      req.body || {};
    if (!title || typeof title !== "string") {
      return sendResponse(res, false, 400, "title is required");
    }
    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (!Number.isFinite(parsedAmount)) {
      return sendResponse(res, false, 400, "amount is required");
    }
    if (!expenseDate || typeof expenseDate !== "string") {
      return sendResponse(res, false, 400, "expenseDate is required (YYYY-MM-DD)");
    }

    const created = await createExpense(
      {
        title,
        category: category ?? null,
        amount: parsedAmount,
        currency: currency || "USD",
        expenseDate,
        status: status === "paid" ? "paid" : "unpaid",
        notes: notes ?? null,
      },
      req.user?.username
    );

    sendResponse(res, true, 201, "Expense created successfully", created);
  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ message: "Failed to create expense" });
  }
};

export const updateExpenseHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendResponse(res, false, 400, "Invalid expense ID");

    const { title, category, amount, currency, expenseDate, status, notes } =
      req.body || {};

    const payload: any = {};
    if (title !== undefined) payload.title = title;
    if (category !== undefined) payload.category = category;
    if (amount !== undefined) payload.amount = typeof amount === "number" ? amount : parseFloat(amount);
    if (currency !== undefined) payload.currency = currency;
    if (expenseDate !== undefined) payload.expenseDate = expenseDate;
    if (status !== undefined) payload.status = status === "paid" ? "paid" : "unpaid";
    if (notes !== undefined) payload.notes = notes;

    const updated = await updateExpense(id, payload, req.user?.username);
    sendResponse(res, true, 200, "Expense updated successfully", updated);
  } catch (err: any) {
    if (err?.message === "NOT_FOUND") {
      return sendResponse(res, false, 404, "Expense not found");
    }
    console.error("Error updating expense:", err);
    res.status(500).json({ message: "Failed to update expense" });
  }
};

export const deleteExpenseHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendResponse(res, false, 400, "Invalid expense ID");
    const result = await deleteExpense(id, req.user?.username);
    sendResponse(res, true, 200, "Expense deleted successfully", result);
  } catch (err: any) {
    if (err?.message === "NOT_FOUND") {
      return sendResponse(res, false, 404, "Expense not found");
    }
    console.error("Error deleting expense:", err);
    res.status(500).json({ message: "Failed to delete expense" });
  }
};

export const expenseMonthlyTotalsHandler = async (req: Request, res: Response) => {
  try {
    const dateFrom = (req.query.dateFrom as string) || undefined;
    const dateTo = (req.query.dateTo as string) || undefined;
    const totals = await getExpenseMonthlyTotals({ dateFrom, dateTo });
    sendResponse(res, true, 200, "Expense monthly totals fetched", totals);
  } catch (err) {
    console.error("Error fetching expense monthly totals:", err);
    res.status(500).json({ message: "Failed to fetch expense monthly totals" });
  }
};


