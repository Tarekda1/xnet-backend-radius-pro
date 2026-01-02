// src/controllers/invoice.controller.ts
import { Request, Response } from "express";
import {
  bulkPayInvoices, generateMonthlyInvoices,
  getAllExternalInvoices, getAllInvoices,
  payInvoice, payExternalInvoice, replaceExternalInvoices,
  updateExternalInvoice,
  deleteExternalInvoice,
  collectInvoice,
  reconcileInvoiceCash,
  getCollectedMetrics,
  getCollectorBreakdown,
  getCollectedInvoicesList
} from "../services/invoiceService";
import * as XLSX from "xlsx";
import fs from "fs";
import { ExternalInvoice } from "../db/entities/ExternalInvoice";
import { invoiceEvents } from "../events/invoiceEvents";
import eventBus from "../bus/eventBusSingleton";
import { AppDataSource } from "../db/config";
import { Invoices } from "../db/entities/Invoices";
import { UserDetails } from "../db/entities/UserDetails";
import { composePaidMessage, sendWhatsAppMessage } from "../services/whatsappService";

const sendResponse = (res: Response, success: boolean, status: number, message: string, data: any = null) => {
  res.status(status).json({ success, message, data });
};


export const generateInvoicesHandler = async (_: Request, res: Response) => {
  try {
    await generateMonthlyInvoices();
    sendResponse(res, true, 200, "Invoices generated successfully");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Invoice generation failed" });
  }
};

export const getInvoicesHandler = async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const limit = parseInt(_req.query.limit as string) || 10;
    const search = (_req.query.search as string) || '';
    const dateFrom = _req.query.dateFrom as string;
    const dateTo = _req.query.dateTo as string;

    const result = await getAllInvoices(page, limit, search, dateFrom, dateTo);
    sendResponse(res, true, 200, "Invoices fetched successfully", result);
  } catch (err) {
    console.error("Error fetching invoices:", err);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
};

export const payInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return sendResponse(res, false, 400, "Invalid invoice ID");
    }

    const invoice = await payInvoice(invoiceId);
    
    // Emit modification event
    await invoiceEvents.emitModification({
      invoiceId: invoice.id || -1,
      username: req.user?.username || 'system',
      action: 'PAID',
      timestamp: new Date(),
    });

    sendResponse(res, true, 200, "Invoice paid successfully", invoice);

    // Fire-and-forget WhatsApp notification (does not block response)
    ;(async () => {
      try {
        const repo = AppDataSource.getRepository(Invoices);
        const inv = await repo.findOne({
          where: { id: invoiceId },
          relations: ["userDetails", "userProfile"],
        });
        const user = inv?.userDetails as UserDetails | undefined;
        const phone = user?.phoneNumber || undefined;
        if (!phone) return;
        const message = composePaidMessage({
          fullName: user?.fullName,
          username: user?.username,
          amount: inv?.amount,
          invoiceId,
        });
        const templateName = user?.fullName || user?.username || 'Customer';
        const amountValue = typeof inv?.amount === 'number' ? inv?.amount.toFixed(2) : String(inv?.amount ?? '');
        await sendWhatsAppMessage({
          to: phone,
          message,
          templateVariables: {
            "1": templateName,
            "2": String(invoiceId),
            "3": amountValue,
          }
        });
      } catch (err) {
        console.warn("Failed to send WhatsApp for internal invoice", err);
      }
    })();
  } catch (error) {
    console.error("Error paying invoice:", error);
    res.status(500).json({ message: "Failed to pay invoice" });
  }
};

export const bulkPayInvoicesHandler = async (req: Request, res: Response) => {
  try {
    const invoiceIds = req.body.invoiceIds;
    if (!Array.isArray(invoiceIds) || invoiceIds.some(isNaN)) {
      return sendResponse(res, false, 400, "Invalid invoice IDs");
    }

    const invoices = await bulkPayInvoices(invoiceIds);
    sendResponse(res, true, 200, "Invoices paid successfully", invoices);
  } catch (error) {
    console.error("Error paying invoices:", error);
    res.status(500).json({ message: "Failed to pay invoices" });
  }
};

export const collectInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return sendResponse(res, false, 400, "Invalid invoice ID");
    }
    const paymentMethod = (req.body?.paymentMethod || 'cash') as 'cash' | 'pos' | 'transfer' | 'other';
    const username = req.user?.username || 'system';

    const invoice = await collectInvoice(invoiceId, username, paymentMethod);

    await invoiceEvents.emitModification({
      invoiceId: invoice.id || -1,
      username,
      action: 'COLLECTED',
      timestamp: new Date(),
      data: { paymentMethod }
    });

    sendResponse(res, true, 200, "Invoice collected and marked as paid", invoice);
  } catch (error) {
    console.error("Error collecting invoice:", error);
    res.status(500).json({ message: "Failed to collect invoice" });
  }
};

export const reconcileInvoiceCashHandler = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return sendResponse(res, false, 400, "Invalid invoice ID");
    }
    const username = req.user?.username || 'system';

    const invoice = await reconcileInvoiceCash(invoiceId, username);

    await invoiceEvents.emitModification({
      invoiceId: invoice.id || -1,
      username,
      action: 'RECONCILED',
      timestamp: new Date(),
    });

    sendResponse(res, true, 200, "Invoice cash reconciled", invoice);
  } catch (error) {
    console.error("Error reconciling invoice:", error);
    res.status(500).json({ message: "Failed to reconcile invoice" });
  }
};

export const getCollectedMetricsHandler = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
    const metrics = await getCollectedMetrics(dateFrom, dateTo);
    sendResponse(res, true, 200, "Collected metrics fetched", metrics);
  } catch (error) {
    console.error("Error fetching collected metrics:", error);
    res.status(500).json({ message: "Failed to fetch collected metrics" });
  }
};

export const getCollectorBreakdownHandler = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
    const breakdown = await getCollectorBreakdown(dateFrom, dateTo);
    sendResponse(res, true, 200, "Collector breakdown fetched", breakdown);
  } catch (error) {
    console.error("Error fetching collector breakdown:", error);
    res.status(500).json({ message: "Failed to fetch collector breakdown" });
  }
};

export const getCollectedInvoicesListHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
    const list = await getCollectedInvoicesList(page, limit, dateFrom, dateTo);
    sendResponse(res, true, 200, "Collected invoices fetched", list);
  } catch (error) {
    console.error("Error fetching collected invoices list:", error);
    res.status(500).json({ message: "Failed to fetch collected invoices list" });
  }
};

export const uploadExternalInvoiceFile = async (req: Request, res: Response) => {
  try {
    const filePath = req.file?.path || '';
    if (!filePath || filePath === undefined || filePath === '') res.status(400).json({ message: "File not found" });

    // Optional month override (e.g., '2025-01' or '2025-01-01')
    const requestedMonth = (req.body?.billingMonth as string) || (req.query?.billingMonth as string) || '';
    const normalizeToMonthStart = (value: string): string | null => {
      if (!value) return null;
      // Accept YYYY-MM or YYYY-MM-01 or any parsable date
      let year = 0, month = 0;
      const ymMatch = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value);
      if (ymMatch) {
        year = parseInt(ymMatch[1], 10);
        month = parseInt(ymMatch[2], 10);
      } else {
        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        year = d.getFullYear();
        month = d.getMonth() + 1;
      }
      if (!year || !month || month < 1 || month > 12) return null;
      return `${year}-${String(month).padStart(2,'0')}-01`;
    };
    const monthOverride = normalizeToMonthStart(requestedMonth) || null;

    // Parse Excel
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet);

    // Optional: validate/transform
    const invoices = raw.map((row: any) => {
      console.log(`row: ${JSON.stringify(row)}`);
      
      // Format billing month as YYYY-MM-DD
      let billingDate;
      if (monthOverride) {
        billingDate = monthOverride;
      } else if (row.billingMonth) {
        const date = new Date(row.billingMonth);
        if (isNaN(date.getTime())) {
          // If invalid date, use current month
          const today = new Date();
          billingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        } else {
          billingDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        }
      } else {
        // If no date provided, use current month
        const today = new Date();
        billingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      }
      
      let inv: Partial<ExternalInvoice> = {
        username: row.username,
        fullName: row.fullName,
        email: row.email,
        provider: row.provider,
        phoneNumber: row.phoneNumber,
        address: row.address,
        billingMonth: billingDate,
        amount: parseFloat(row.amount || 30),
        status: row.status || "pending",
        paidAt: row.paidAt ? new Date(row.paidAt) : null,
        modifiedBy: req.user?.username,
        modifiedAt: new Date()||null,
        lastAction: "UPLOAD"
      }
      return inv;
    });

    console.log(`invoices: ${invoices}`); // for validatio
    // Filter out users whose username ends with 'xn' (case-insensitive)
    const filteredInvoices = invoices.filter((inv) => {
      const uname = (inv.fullName ?? '').toString().trim().toLowerCase();
      return !uname.endsWith('xn');
    });
    console.log(`Filtered out ${invoices.length - filteredInvoices.length} invoice(s) ending with 'xn'`);

    await replaceExternalInvoices(filteredInvoices);

    fs.unlinkSync(filePath); // cleanup
    res.status(200).json({ success: true, message: "Invoices uploaded successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: "Failed to upload invoice file" });
  }
};

// ... existing code ...

export const deleteExternalInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return sendResponse(res, false, 400, "Invalid invoice ID");
    }

    const invoice = await deleteExternalInvoice(invoiceId, req.user?.username);
    sendResponse(res, true, 200, "External invoice deleted successfully", invoice);
  } catch (error) {
    console.error("Error deleting external invoice:", error);
    res.status(500).json({ message: "Failed to delete external invoice" });
  }
};

export const getExternalInvoicesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const from = (req.query.from as string) || undefined;
    const to = (req.query.to as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const sortBy = (req.query.sortBy as 'createdAt' | 'billingMonth' | 'amount') || 'createdAt';
    const sortDir = ((req.query.sortDir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';

    const result = await getAllExternalInvoices(page, limit, search, from, to, status, sortBy, sortDir);
    sendResponse(res, true, 200, "External invoices fetched successfully", result);
  } catch (err) {
    console.error("Error fetching external invoices:", err);
    res.status(500).json({ message: "Failed to fetch external invoices" });
  }
};

export const payExternalInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return sendResponse(res, false, 400, "Invalid invoice ID");
    }

    const paymentMethod = (req.body?.paymentMethod || 'cash') as 'cash' | 'pos' | 'transfer' | 'other';
    const actor = req.user?.username || 'system';

    const invoice = await payExternalInvoice(invoiceId, actor, paymentMethod);

    // Emit modification event
    invoiceEvents.emitModification({
      invoiceId: invoice.id || -1,
      username: req.user?.username || 'system',
      action: 'PAID',
      timestamp: new Date(),
      data: invoice
    });

    sendResponse(res, true, 200, "Invoice paid successfully", invoice);

    // Fire-and-forget WhatsApp notification
    ;(async () => {
      try {
        //invoice.phoneNumber
        const phone = '+9613974338';
        if (!phone) {
          console.warn('External invoice has no phone number; skipping WhatsApp', { invoiceId: invoice.id, username: invoice.username });
          return;
        }
        console.log('sending whatsapp message to', phone);
        const message = composePaidMessage({
          fullName: invoice.fullName,
          username: invoice.username,
          amount: invoice.amount,
          invoiceId: invoice.id,
        });
        const templateName = invoice.fullName || invoice.username || 'Customer';
        const amountValue = typeof invoice.amount === 'number' ? invoice.amount.toFixed(2) : String(invoice.amount ?? '');
        await sendWhatsAppMessage({
          to: phone,
          message,
          templateVariables: {
            "1": templateName,
            "2": String(invoice.id ?? ''),
            "3": amountValue,
          }
        });
      } catch (err) {
        console.warn("Failed to send WhatsApp for external invoice", err);
      }
    })();
  } catch (error) {
    console.error("Error paying invoice:", error);
    res.status(500).json({ message: "Failed to pay invoice" });
  }
};

export const updateExternalInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return sendResponse(res, false, 400, "Invalid invoice ID");
    }

    const updateData = {
      ...req.body,
      modifiedBy: req.user?.username,
      modifiedAt: new Date()
    };
    const invoice = await updateExternalInvoice(invoiceId, updateData);
    sendResponse(res, true, 200, "External invoice updated successfully", invoice);
  } catch (error) {
    console.error("Error updating external invoice:", error);
    res.status(500).json({ message: "Failed to update external invoice" });
  }
};

