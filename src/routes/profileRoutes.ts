import { Router } from 'express';
import { ProfileController } from '../controllers/profileController';

const router = Router();

router.get('/profiles', ProfileController.getProfiles);
router.get('/profiles/:id', ProfileController.getProfile);
router.post('/profiles', ProfileController.createProfile);
router.put('/profiles/:id', ProfileController.updateProfile);
router.delete('/profiles/:id', ProfileController.deleteProfile);

export default router;
