// src/routes/invoice.routes.ts
import { Router } from "express";
import { bulkPayInvoicesHandler, deleteExternalInvoiceHandler, generateInvoicesHandler, getExternalInvoicesHandler, getInvoicesHandler, payExternalInvoiceHandler, payInvoiceHandler, updateExternalInvoiceHandler, uploadExternalInvoiceFile, collectInvoiceHandler, reconcileInvoiceCashHandler, getCollectedMetricsHandler, getCollectorBreakdownHandler, getCollectedInvoicesListHandler } from "../controllers/invoiceController";
import multer from "multer";
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';
const upload = multer({ dest: "uploads/" }); // temp folder

const router = Router();
router.post("/generate-monthly", generateInvoicesHandler);
router.get("/", getInvoicesHandler);
// Add route for paying a single invoice
router.post("/pay/:invoiceId", authenticateToken, authorizeRoles('admin','manager','support','collector'), payInvoiceHandler);
router.post("/collect/:invoiceId", authenticateToken, authorizeRoles('collector','manager','admin'), collectInvoiceHandler);
router.post("/reconcile/:invoiceId", authenticateToken, authorizeRoles('manager','admin'), reconcileInvoiceCashHandler);
// Add route for bulk paying invoices
router.post("/bulk-pay", authenticateToken, authorizeRoles('admin','manager'), bulkPayInvoicesHandler);
router.post("/upload", upload.single("file"), uploadExternalInvoiceFile);
router.get("/external", getExternalInvoicesHandler);
router.post("/external/pay/:invoiceId",authenticateToken, payExternalInvoiceHandler);
router.put("/external/:invoiceId",authenticateToken, updateExternalInvoiceHandler);
router.delete("/external/:invoiceId", authenticateToken,deleteExternalInvoiceHandler);

// Collected metrics & drilldowns
router.get('/collected/metrics', authenticateToken, authorizeRoles('admin','manager','support','collector'), getCollectedMetricsHandler);
router.get('/collected/breakdown', authenticateToken, authorizeRoles('admin','manager','support'), getCollectorBreakdownHandler);
router.get('/collected/list', authenticateToken, authorizeRoles('admin','manager','support','collector'), getCollectedInvoicesListHandler);

export default router;
