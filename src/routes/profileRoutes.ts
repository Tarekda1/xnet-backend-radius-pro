import { Router } from 'express';
import { ProfileController } from '../controllers/profileController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();

// IMPORTANT: scope auth/RBAC to /profiles only.
// This router is mounted at /api, so an unscoped router.use(...) would
// accidentally protect ALL /api/* routes (including /api/invoices/*).
router.use('/profiles', authenticateToken, authorizePermissions('radius.profiles.view'));
router.get('/profiles', ProfileController.getProfiles);
router.get('/profiles/usage', ProfileController.getProfilesUsage);
router.get('/profiles/:id', ProfileController.getProfile);
router.post('/profiles', ProfileController.createProfile);
router.put('/profiles/:id', ProfileController.updateProfile);
router.delete('/profiles/:id', ProfileController.deleteProfile);

export default router;
