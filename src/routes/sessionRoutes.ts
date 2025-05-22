import { Router } from "express";
import { getOnlineUsersMetrics, getOnlineUsersWithUsage } from "../controllers/sessionController";

const router = Router();

router.get("/online-users", getOnlineUsersWithUsage);
router.get("/online-users-metrics", getOnlineUsersMetrics);


export default router;
