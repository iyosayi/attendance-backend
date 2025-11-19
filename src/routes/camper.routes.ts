import { Router } from 'express';
import * as camperController from '../controllers/camper.controller';
import { validate } from '../middleware/validation.middleware';
import { createCamperSchema, updateCamperSchema } from '../validators/camper.validator';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

router.post('/', validate(createCamperSchema), camperController.createCamper);
router.get('/search/code', camperController.searchCampersByCode);
router.get('/', camperController.getAllCampers);
router.get('/:id', camperController.getCamperById);
router.put('/:id', validate(updateCamperSchema), camperController.updateCamper);
router.delete('/:id', authorize('admin'), camperController.deleteCamper);

export default router;
