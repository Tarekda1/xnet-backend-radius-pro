import { Router } from "express";
import { getOnlineUsersMetrics, getOnlineUsersWithUsage, disconnectOnlineUser, getAuthMetrics, getUserSessions } from "../controllers/sessionController";
import { authenticateToken, authorizeAnyPermissions } from "../middleware/authMiddleware";

const router = Router();

router.get("/online-users", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getOnlineUsersWithUsage);
router.get("/online-users-metrics", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getOnlineUsersMetrics);
router.get("/sessions/user/:username", authenticateToken, authorizeAnyPermissions('users.view', 'reseller.users.view'), getUserSessions);
router.get("/auth-metrics", authenticateToken, authorizeAnyPermissions('dashboard.widget.invoiceCounts', 'admin.analytics.view', 'users.online.view'), getAuthMetrics);
router.post("/sessions/disconnect", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.manage'), disconnectOnlineUser);


export default router;
