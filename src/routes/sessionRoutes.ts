import { Router } from "express";
import { getOnlineUsersMetrics, getOnlineUsersWithUsage, disconnectOnlineUser, getAuthFailures, getAuthMetrics, getNocHealth, getNocSnapshot, getUserSessions, getLiveSessionDetail, getUserRejects, getUsageWindow } from "../controllers/sessionController";
import { authenticateToken, authorizeAnyPermissions } from "../middleware/authMiddleware";

const router = Router();

router.get("/online-users", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getOnlineUsersWithUsage);
router.get("/online-users-metrics", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getOnlineUsersMetrics);
router.get("/sessions/live/:username", authenticateToken, authorizeAnyPermissions('users.online.view', 'users.view', 'reseller.users.view'), getLiveSessionDetail);
router.get("/sessions/rejects/:username", authenticateToken, authorizeAnyPermissions('users.online.view', 'users.view', 'reseller.users.view'), getUserRejects);
router.get("/sessions/user/:username", authenticateToken, authorizeAnyPermissions('users.view', 'reseller.users.view'), getUserSessions);
router.get("/usage/window", authenticateToken, authorizeAnyPermissions('users.online.view', 'users.view', 'reseller.users.view'), getUsageWindow);
router.get("/auth-metrics", authenticateToken, authorizeAnyPermissions('dashboard.widget.invoiceCounts', 'admin.analytics.view', 'users.online.view'), getAuthMetrics);
router.get("/noc-snapshot", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getNocSnapshot);
router.get("/noc-health", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getNocHealth);
router.get("/auth-failures", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.view'), getAuthFailures);
router.post("/sessions/disconnect", authenticateToken, authorizeAnyPermissions('users.online.view', 'reseller.users.manage'), disconnectOnlineUser);


export default router;
