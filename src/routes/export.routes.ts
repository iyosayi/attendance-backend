import { Router } from 'express';
import * as exportController from '../controllers/export.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

router.get('/campers', exportController.exportCampers);
router.get('/rooms', exportController.exportRooms);

export default router;
