import { Router } from 'express';
import { register, login, refreshToken, logout, profile, getAllUsers, updateUser, deleteUser } from '../controllers/authController';
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

export default router;
