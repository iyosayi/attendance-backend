import { Router } from 'express';
import * as roomController from '../controllers/room.controller';
import { validate } from '../middleware/validation.middleware';
import { createRoomSchema, updateRoomSchema, assignCamperSchema, removeCamperSchema } from '../validators/room.validator';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

router.post('/', authorize('admin'), validate(createRoomSchema), roomController.createRoom);
router.get('/', roomController.getAllRooms);
router.get('/available', roomController.getAvailableRooms);
router.get('/:id', roomController.getRoomById);
router.put('/:id', authorize('admin'), validate(updateRoomSchema), roomController.updateRoom);
router.post('/:id/assign', validate(assignCamperSchema), roomController.assignCamperToRoom);
router.post('/:id/remove', validate(removeCamperSchema), roomController.removeCamperFromRoom);
router.delete('/:id', authorize('admin'), roomController.deleteRoom);

export default router;
