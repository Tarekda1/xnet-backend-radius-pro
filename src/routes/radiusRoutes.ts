import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken, authorizeAnyPermissions } from '../middleware/authMiddleware';

const router = Router();

// Protect all radius user APIs
router.use(authenticateToken);

// Read access (view)
router.get('/users/search', authorizeAnyPermissions('users.view', 'reseller.users.view'), UserController.searchUsers);
router.get('/users/quota-exceeded', authorizeAnyPermissions('users.view', 'reseller.users.view'), UserController.getQuotaExceededUsers);
router.get('/users/:id', authorizeAnyPermissions('users.view', 'reseller.users.view'), UserController.getRadUser);
router.get('/users', authorizeAnyPermissions('users.view', 'reseller.users.view'), UserController.getRadUsers);

// Write access (manage)
// Note: admins don't currently have a separate `users.manage` permission, so `users.view` implies manage for admins.
// Resellers must have `reseller.users.manage` for destructive actions.
router.put('/users/resetQuota/:username', authorizeAnyPermissions('users.resetDailyQuota', 'reseller.users.manage'), UserController.resetDailyQuota);
router.put('/users/resetMonthlyQuota/:username', authorizeAnyPermissions('users.resetMonthlyQuota', 'reseller.users.manage'), UserController.resetMonthlyQuota);
router.put('/users/:username', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.updateUser);
router.post('/users/resetAddress/:username', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.resetMacAddress);
router.post('/users/:username/apply-rate-limit', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.applyProfileRateLimitNow);
router.post('/users/bulk/assign-profile', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.bulkAssignProfile);
router.post('/users/bulk/set-status', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.bulkSetStatus);
router.post('/users/bulk/reset-mac', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.bulkResetMac);
router.post('/users/bulk/delete', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.bulkDeleteUsers);
router.post('/users/bulk/create', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.bulkCreateUsers);
router.post('/users', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.createUser);
router.delete('/users/:username', authorizeAnyPermissions('users.view', 'reseller.users.manage'), UserController.deleteUser);



export default router;

