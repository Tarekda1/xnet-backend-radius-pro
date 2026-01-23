import { Router } from "express";
import { authenticateToken, authorizeAnyPermissions } from "../middleware/authMiddleware";
import { listAudit } from "../controllers/auditController";

const router = Router();

router.get("/audit", authenticateToken, authorizeAnyPermissions("users.view", "reseller.users.view"), listAudit);

export default router;

