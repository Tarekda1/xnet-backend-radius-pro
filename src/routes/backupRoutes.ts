import { Router } from "express";
import { authenticateToken, authorizeAnyPermissions } from "../middleware/authMiddleware";
import { cleanupOldBackups, downloadBackup, listBackups, runDbBackup, runMikrotikBackup } from "../controllers/backupController";

const router = Router();

// All backup actions are admin-only
router.use("/backups", authenticateToken, authorizeAnyPermissions("admin.access.manage"));

router.get("/backups", listBackups);
router.get("/backups/:id/download", downloadBackup);
router.post("/backups/db", runDbBackup);
router.post("/backups/mikrotik", runMikrotikBackup);
router.post("/backups/cleanup", async (_req, res) => {
  await cleanupOldBackups();
  res.status(200).json({ success: true, message: "Cleanup completed" });
});

export default router;

