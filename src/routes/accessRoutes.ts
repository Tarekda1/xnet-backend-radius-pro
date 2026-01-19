import { Router } from "express";

import { listPermissions, searchUsers, listRoles, replaceRolePermissions, getUserOverrides, replaceUserOverrides } from "../controllers/accessController";
import { authenticateToken, authorizePermissions } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticateToken, authorizePermissions("admin.access.manage"));

router.get("/permissions", listPermissions);
router.get("/users", searchUsers);
router.get("/roles", listRoles);
router.put("/roles/:roleKey/permissions", replaceRolePermissions);
router.get("/users/:userId/overrides", getUserOverrides);
router.put("/users/:userId/overrides", replaceUserOverrides);

export default router;

