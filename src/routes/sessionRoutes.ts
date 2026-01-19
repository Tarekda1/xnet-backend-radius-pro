import { Router } from "express";
import { getOnlineUsersMetrics, getOnlineUsersWithUsage, disconnectOnlineUser } from "../controllers/sessionController";
import { authenticateToken, authorizeAnyPermissions } from "../middleware/authMiddleware";

const router = Router();

router.get("/online-users", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getOnlineUsersWithUsage);
router.get("/online-users-metrics", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getOnlineUsersMetrics);
router.post("/sessions/disconnect", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.manage'), disconnectOnlineUser);


export default router;
