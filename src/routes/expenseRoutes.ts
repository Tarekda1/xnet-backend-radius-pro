import { Router } from "express";
import {
  createExpenseHandler,
  deleteExpenseHandler,
  expenseMonthlyTotalsHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from "../controllers/expenseController";
import { authenticateToken, authorizePermissions, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();

// View/list
router.get(
  "/",
  authenticateToken,
  authorizePermissions("admin.expenses.view"),
  authorizeRoles("admin", "manager", "support", "collector"),
  listExpensesHandler
);

// Monthly totals (for dashboard + expenses summary)
router.get(
  "/monthly-totals",
  authenticateToken,
  authorizePermissions("admin.expenses.view"),
  authorizeRoles("admin", "manager", "support", "collector"),
  expenseMonthlyTotalsHandler
);

// Create
router.post(
  "/",
  authenticateToken,
  authorizePermissions("admin.expenses.view"),
  authorizeRoles("admin", "manager"),
  createExpenseHandler
);

// Update
router.put(
  "/:id",
  authenticateToken,
  authorizePermissions("admin.expenses.view"),
  authorizeRoles("admin", "manager"),
  updateExpenseHandler
);

// Delete (soft delete)
router.delete(
  "/:id",
  authenticateToken,
  authorizePermissions("admin.expenses.view"),
  authorizeRoles("admin", "manager"),
  deleteExpenseHandler
);

export default router;


