import { Router } from 'express';
import * as checkinController from '../controllers/checkin.controller';
import { validate } from '../middleware/validation.middleware';
import {
  checkInSchema,
  checkOutSchema,
  checkInSessionSchema,
  checkInBulkSchema,
  checkInByPhoneSchema,
} from '../validators/camper.validator';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// Legacy endpoints (kept for backward compatibility)
router.post('/:camperId/in', validate(checkInSchema), checkinController.checkIn);
router.post('/:camperId/out', validate(checkOutSchema), checkinController.checkOut);
router.get('/:camperId/logs', checkinController.getCheckInLogs);

// Session-based endpoints
router.post('/session/:session/:camperId', validate(checkInSessionSchema), checkinController.checkInSession);
router.post('/session/:session/bulk', validate(checkInBulkSchema), checkinController.checkInBulk);
router.post('/night/by-phone', validate(checkInByPhoneSchema), checkinController.checkInByPhone);
router.get('/camper/by-phone', checkinController.getCamperByPhone);
router.get('/bus/:busId/verify', checkinController.verifyBusTally);
router.get('/bus/:busId/checkins', checkinController.getBusCheckIns);
router.get('/camper/:camperId/sessions', checkinController.getSessionStatus);
router.get('/summary', checkinController.getDailySummary);
router.get('/session/checkins', authorize('admin'), checkinController.getSessionCheckIns);

export default router;
