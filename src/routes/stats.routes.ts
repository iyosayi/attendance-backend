import { Router } from 'express';
import * as statsController from '../controllers/stats.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

router.get('/overview', statsController.getOverview);
router.get('/sessions', statsController.getSessionAttendance);

export default router;
