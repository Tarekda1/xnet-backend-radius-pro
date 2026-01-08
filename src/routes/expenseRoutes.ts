import { Router } from "express";
import {
  createExpenseHandler,
  deleteExpenseHandler,
  expenseMonthlyTotalsHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from "../controllers/expenseController";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();

// View/list
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "manager", "support", "collector"),
  listExpensesHandler
);

// Monthly totals (for dashboard + expenses summary)
router.get(
  "/monthly-totals",
  authenticateToken,
  authorizeRoles("admin", "manager", "support", "collector"),
  expenseMonthlyTotalsHandler
);

// Create
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  createExpenseHandler
);

// Update
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  updateExpenseHandler
);

// Delete (soft delete)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  deleteExpenseHandler
);

export default router;


