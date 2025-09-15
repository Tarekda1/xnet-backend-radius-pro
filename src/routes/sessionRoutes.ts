import { Router } from "express";
import { getOnlineUsersMetrics, getOnlineUsersWithUsage, disconnectOnlineUser } from "../controllers/sessionController";

const router = Router();

router.get("/online-users", getOnlineUsersWithUsage);
router.get("/online-users-metrics", getOnlineUsersMetrics);
router.post("/sessions/disconnect", disconnectOnlineUser);


export default router;
