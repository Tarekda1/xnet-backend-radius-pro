import { Router } from "express";
import { authenticateToken, authorizeAnyPermissions, authorizePermissions } from "../middleware/authMiddleware";
import {
  createAccountHandler,
  createProfileHandler,
  deleteAccountHandler,
  deleteProfileHandler,
  generateMonthlyInvoicesHandler,
  listAccountsHandler,
  listInvoicesHandler,
  listProfilesHandler,
  payInvoiceHandler,
  unpayInvoiceHandler,
  updateAccountHandler,
  updateProfileHandler,
} from "../controllers/cableVisionController";

const router = Router();

// Accounts
router.get(
  "/accounts",
  authenticateToken,
  authorizeAnyPermissions("cablevision.accounts.view", "cablevision.accounts.manage"),
  listAccountsHandler
);
router.post("/accounts", authenticateToken, authorizePermissions("cablevision.accounts.manage"), createAccountHandler);
router.put("/accounts/:accountId", authenticateToken, authorizePermissions("cablevision.accounts.manage"), updateAccountHandler);
router.delete("/accounts/:accountId", authenticateToken, authorizePermissions("cablevision.accounts.manage"), deleteAccountHandler);

// Profiles
router.get(
  "/accounts/:accountId/profiles",
  authenticateToken,
  authorizeAnyPermissions("cablevision.accounts.view", "cablevision.accounts.manage"),
  listProfilesHandler
);
router.post(
  "/accounts/:accountId/profiles",
  authenticateToken,
  authorizePermissions("cablevision.accounts.manage"),
  createProfileHandler
);
router.put("/profiles/:profileId", authenticateToken, authorizePermissions("cablevision.accounts.manage"), updateProfileHandler);
router.delete("/profiles/:profileId", authenticateToken, authorizePermissions("cablevision.accounts.manage"), deleteProfileHandler);

// Invoices
router.get(
  "/invoices",
  authenticateToken,
  authorizeAnyPermissions("cablevision.invoices.view", "cablevision.invoices.pay", "cablevision.invoices.unpay"),
  listInvoicesHandler
);
router.post(
  "/invoices/generate-monthly",
  authenticateToken,
  authorizePermissions("cablevision.invoices.generate"),
  generateMonthlyInvoicesHandler
);
router.post("/invoices/pay/:invoiceId", authenticateToken, authorizePermissions("cablevision.invoices.pay"), payInvoiceHandler);
router.post(
  "/invoices/unpay/:invoiceId",
  authenticateToken,
  authorizePermissions("cablevision.invoices.unpay"),
  unpayInvoiceHandler
);

export default router;

