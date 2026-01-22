import { Router } from 'express';
import { register, login, refreshToken, logout, profile, getAllUsers, updateUser, deleteUser, changePassword, adminResetUserPassword } from '../controllers/authController';
import { mobileLogin, mobileRefresh, mobileLogout } from '../controllers/mobileAuthController';
import { authenticateToken, authorizeAnyPermissions } from '../middleware/authMiddleware';

const router = Router();

// Admin management (requires login + permission)
router.post('/register', authenticateToken, authorizeAnyPermissions("admin.authUsers.manage"), register);
router.get('/users', authenticateToken, authorizeAnyPermissions("admin.authUsers.manage"), getAllUsers);
router.put('/users/:id', authenticateToken, authorizeAnyPermissions("admin.authUsers.manage"), updateUser);
router.post('/users/:id/reset-password', authenticateToken, authorizeAnyPermissions("admin.authUsers.manage"), adminResetUserPassword);
router.delete('/users/:username', authenticateToken, authorizeAnyPermissions("admin.authUsers.manage"), deleteUser);

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/profile', authenticateToken, profile);
router.post('/change-password', authenticateToken, changePassword);

// Mobile auth endpoints
router.post('/mobile/login', mobileLogin);
router.post('/mobile/refresh', mobileRefresh);
router.post('/mobile/logout', mobileLogout);

export default router;
