// src/routes/invoice.routes.ts
import { Router } from "express";
import { bulkPayInvoicesHandler, deleteExternalInvoiceHandler, generateInvoicesHandler, getExternalInvoicesHandler, getInvoicesHandler, payExternalInvoiceHandler, payInvoiceHandler, updateExternalInvoiceHandler, uploadExternalInvoiceFile } from "../controllers/invoiceController";
import multer from "multer";
import { authenticateToken } from '../middleware/authMiddleware';
const upload = multer({ dest: "uploads/" }); // temp folder

const router = Router();
router.post("/generate-monthly", generateInvoicesHandler);
router.get("/", getInvoicesHandler);
// Add route for paying a single invoice
router.post("/pay/:invoiceId", payInvoiceHandler);
// Add route for bulk paying invoices
router.post("/bulk-pay", bulkPayInvoicesHandler);
router.post("/upload", upload.single("file"), uploadExternalInvoiceFile);
router.get("/external", getExternalInvoicesHandler);
router.post("/external/pay/:invoiceId",authenticateToken, payExternalInvoiceHandler);
router.put("/external/:invoiceId",authenticateToken, updateExternalInvoiceHandler);
router.delete("/external/:invoiceId", authenticateToken,deleteExternalInvoiceHandler);

export default router;
