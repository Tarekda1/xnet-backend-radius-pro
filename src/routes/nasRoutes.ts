import { Router } from 'express';
import { NasController } from '../controllers/nasController';

const router = Router();

// NAS routes
router.get('/nas', NasController.getNasEntries);
router.get('/nas/:id', NasController.getNasEntry);
router.post('/nas', NasController.createNasEntry);
router.put('/nas/:id', NasController.updateNasEntry);
router.delete('/nas/:id', NasController.deleteNasEntry);


export default router;

