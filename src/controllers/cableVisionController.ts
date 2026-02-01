import { Request, Response } from "express";
import {
  createCableVisionAccount,
  createCableVisionProfile,
  deleteCableVisionAccount,
  deleteCableVisionProfile,
  generateCableVisionMonthlyInvoices,
  listCableVisionAccounts,
  listCableVisionInvoices,
  listCableVisionProfiles,
  payCableVisionInvoice,
  unpayCableVisionInvoice,
  updateCableVisionAccount,
  updateCableVisionProfile,
} from "../services/cableVisionService";

const sendResponse = (res: Response, success: boolean, status: number, message: string, data: any = null) => {
  res.status(status).json({ success, message, data });
};

export async function listAccountsHandler(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || "";
    const billingMonth = (req.query.billingMonth as string) || "";
    const result = await listCableVisionAccounts({ page, limit, search, billingMonth });
    return sendResponse(res, true, 200, "Cable Vision accounts fetched", result);
  } catch (e: any) {
    console.error("Error listing Cable Vision accounts:", e);
    return sendResponse(res, false, 500, "Failed to fetch accounts");
  }
}

export async function createAccountHandler(req: Request, res: Response) {
  try {
    const account = await createCableVisionAccount(req.body || {});
    return sendResponse(res, true, 201, "Cable Vision account created", account);
  } catch (e: any) {
    console.error("Error creating Cable Vision account:", e);
    const msg = String(e?.message || "");
    if (msg.includes("Duplicate") || msg.includes("unique")) return sendResponse(res, false, 400, "Account number already exists");
    return sendResponse(res, false, 500, "Failed to create account");
  }
}

export async function updateAccountHandler(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (!Number.isFinite(accountId)) return sendResponse(res, false, 400, "Invalid accountId");
    const account = await updateCableVisionAccount(accountId, req.body || {});
    return sendResponse(res, true, 200, "Cable Vision account updated", account);
  } catch (e: any) {
    console.error("Error updating Cable Vision account:", e);
    const msg = String(e?.message || "");
    if (msg === "Account not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to update account");
  }
}

export async function deleteAccountHandler(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (!Number.isFinite(accountId)) return sendResponse(res, false, 400, "Invalid accountId");
    const actor = req.user?.username || "system";
    const account = await deleteCableVisionAccount(accountId, actor);
    return sendResponse(res, true, 200, "Cable Vision account deleted", account);
  } catch (e: any) {
    console.error("Error deleting Cable Vision account:", e);
    const msg = String(e?.message || "");
    if (msg === "Account not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to delete account");
  }
}

export async function listProfilesHandler(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (!Number.isFinite(accountId)) return sendResponse(res, false, 400, "Invalid accountId");
    const profiles = await listCableVisionProfiles(accountId);
    return sendResponse(res, true, 200, "Cable Vision profiles fetched", profiles);
  } catch (e: any) {
    console.error("Error listing Cable Vision profiles:", e);
    return sendResponse(res, false, 500, "Failed to fetch profiles");
  }
}

export async function createProfileHandler(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (!Number.isFinite(accountId)) return sendResponse(res, false, 400, "Invalid accountId");
    const profile = await createCableVisionProfile(accountId, req.body || {});
    return sendResponse(res, true, 201, "Cable Vision profile created", profile);
  } catch (e: any) {
    console.error("Error creating Cable Vision profile:", e);
    const msg = String(e?.message || "");
    if (msg.includes("5 profiles")) return sendResponse(res, false, 400, msg);
    if (msg === "Account not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to create profile");
  }
}

export async function updateProfileHandler(req: Request, res: Response) {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    if (!Number.isFinite(profileId)) return sendResponse(res, false, 400, "Invalid profileId");
    const profile = await updateCableVisionProfile(profileId, req.body || {});
    return sendResponse(res, true, 200, "Cable Vision profile updated", profile);
  } catch (e: any) {
    console.error("Error updating Cable Vision profile:", e);
    const msg = String(e?.message || "");
    if (msg === "Profile not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to update profile");
  }
}

export async function deleteProfileHandler(req: Request, res: Response) {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    if (!Number.isFinite(profileId)) return sendResponse(res, false, 400, "Invalid profileId");
    const actor = req.user?.username || "system";
    const profile = await deleteCableVisionProfile(profileId, actor);
    return sendResponse(res, true, 200, "Cable Vision profile deleted", profile);
  } catch (e: any) {
    console.error("Error deleting Cable Vision profile:", e);
    const msg = String(e?.message || "");
    if (msg === "Profile not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to delete profile");
  }
}

export async function listInvoicesHandler(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const accountId = req.query.accountId ? parseInt(req.query.accountId as string, 10) : undefined;
    const profileId = req.query.profileId ? parseInt(req.query.profileId as string, 10) : undefined;
    const billingMonth = (req.query.billingMonth as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const result = await listCableVisionInvoices({ page, limit, accountId, profileId, billingMonth, status });
    return sendResponse(res, true, 200, "Cable Vision invoices fetched", result);
  } catch (e: any) {
    console.error("Error listing Cable Vision invoices:", e);
    return sendResponse(res, false, 500, "Failed to fetch invoices");
  }
}

export async function generateMonthlyInvoicesHandler(req: Request, res: Response) {
  try {
    const billingMonth = (req.body?.billingMonth as string) || (req.query?.billingMonth as string) || undefined;
    const result = await generateCableVisionMonthlyInvoices({ billingMonth });
    return sendResponse(res, true, 200, "Cable Vision monthly invoices generated", result);
  } catch (e: any) {
    console.error("Error generating Cable Vision invoices:", e);
    return sendResponse(res, false, 500, "Failed to generate invoices");
  }
}

export async function payInvoiceHandler(req: Request, res: Response) {
  try {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (!Number.isFinite(invoiceId)) return sendResponse(res, false, 400, "Invalid invoiceId");
    const paymentMethod = (req.body?.paymentMethod || "cash") as "cash" | "pos" | "transfer" | "other";
    const actor = req.user?.username || "system";
    const invoice = await payCableVisionInvoice(invoiceId, actor, paymentMethod);
    return sendResponse(res, true, 200, "Invoice paid", invoice);
  } catch (e: any) {
    console.error("Error paying Cable Vision invoice:", e);
    const msg = String(e?.message || "");
    if (msg === "Invoice not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to pay invoice");
  }
}

export async function unpayInvoiceHandler(req: Request, res: Response) {
  try {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (!Number.isFinite(invoiceId)) return sendResponse(res, false, 400, "Invalid invoiceId");
    const actor = req.user?.username || "system";
    const invoice = await unpayCableVisionInvoice(invoiceId, actor);
    return sendResponse(res, true, 200, "Invoice marked as unpaid", invoice);
  } catch (e: any) {
    console.error("Error unpaying Cable Vision invoice:", e);
    const msg = String(e?.message || "");
    if (msg === "Invoice not found") return sendResponse(res, false, 404, msg);
    return sendResponse(res, false, 500, "Failed to unpay invoice");
  }
}

