// src/controllers/invoice.controller.ts
import { Request, Response } from "express";
import {
  bulkPayInvoices, generateMonthlyInvoices,
  getAllExternalInvoices, getAllInvoices,
  payInvoice, payExternalInvoice, replaceExternalInvoices,
  updateExternalInvoice,
  deleteExternalInvoice
} from "../services/invoiceService";
import * as XLSX from "xlsx";
import fs from "fs";
import { ExternalInvoice } from "../db/entities/ExternalInvoice";
import { invoiceEvents } from "../events/invoiceEvents";

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
    invoiceEvents.emitModification({
      invoiceId: invoice.id || -1,
      username: req.user?.username || 'system',
      action: 'PAY',
      timestamp: new Date(),
    });

    sendResponse(res, true, 200, "Invoice paid successfully", invoice);
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

export const uploadExternalInvoiceFile = async (req: Request, res: Response) => {
  try {
    const filePath = req.file?.path || '';
    if (!filePath || filePath === undefined || filePath === '') res.status(400).json({ message: "File not found" });

    // Parse Excel
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet);

    // Optional: validate/transform
    const invoices: ExternalInvoice[] = raw.map((row: any) => {
      console.log(`row: ${JSON.stringify(row)}`);
      let inv = {
        username: row.username,
        fullName: row.fullName,
        email: row.email,
        provider: row.provider,
        phoneNumber: row.phoneNumber,
        address: row.address,
        billingMonth: new Date(row.billingMonth),
        amount: parseFloat(row.amount || 30),
        status: row.status || "unpaid",
        paidAt: row.paidAt ? new Date(row.paidAt) : null,
        createdBy: req.user?.username,
        createdAt: new Date(),
        modifiedBy: req.user?.username,
        modifiedAt: new Date(),
        lastAction: "UPLOAD"
      }
      return inv;
    });

    console.log(`invoices: ${invoices}`); // for validatio

    await replaceExternalInvoices(invoices);

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

    const result = await getAllExternalInvoices(page, limit, search);
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

    const invoice = await payExternalInvoice(invoiceId);

    // Emit modification event
    invoiceEvents.emitModification({
      invoiceId: invoice.id || -1,
      username: req.user?.username || 'system',
      action: 'PAY',
      timestamp: new Date(),
    });

    sendResponse(res, true, 200, "Invoice paid successfully", invoice);
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

