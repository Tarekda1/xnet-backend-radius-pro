import { Router } from 'express';
import { register, login, refreshToken, logout, profile, getAllUsers, updateUser, deleteUser, changePassword } from '../controllers/authController';
import { mobileLogin, mobileRefresh, mobileLogout } from '../controllers/mobileAuthController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.put('/users/:id', updateUser);
router.delete('/users/:username', deleteUser);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/users', getAllUsers);
router.get('/profile', authenticateToken, profile);
router.post('/change-password', authenticateToken, changePassword);

// Mobile auth endpoints
router.post('/mobile/login', mobileLogin);
router.post('/mobile/refresh', mobileRefresh);
router.post('/mobile/logout', mobileLogout);

export default router;
