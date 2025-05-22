import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

//router.use(authenticateToken);

router.get('/users/search', UserController.searchUsers);
router.get('/users/:id', UserController.getRadUser);
router.put('/users/resetQuota/:username', UserController.resetDailyQuota);
router.put('/users/:username', UserController.updateUser);
router.get('/users', UserController.getRadUsers);
router.post('/users/resetAddress/:username', UserController.resetMacAddress);
router.post('/users', UserController.createUser);
router.delete('/users/:username', UserController.deleteUser);



export default router;

