import { Router } from 'express';
import { NasController } from '../controllers/nasController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();

// NAS routes
// IMPORTANT: scope auth/RBAC to /nas only.
// This router is mounted at /api, so an unscoped router.use(...) would
// accidentally protect ALL /api/* routes (including /api/invoices/*).
router.use('/nas', authenticateToken, authorizePermissions('radius.nas.view'));
router.get('/nas', NasController.getNasEntries);
router.get('/nas/:id', NasController.getNasEntry);
router.post('/nas', NasController.createNasEntry);
router.put('/nas/:id', NasController.updateNasEntry);
router.delete('/nas/:id', NasController.deleteNasEntry);


export default router;

