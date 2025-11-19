import { Router } from 'express';
import authRoutes from './auth.routes';
import camperRoutes from './camper.routes';
import roomRoutes from './room.routes';
import checkinRoutes from './checkin.routes';
import statsRoutes from './stats.routes';
import exportRoutes from './export.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/campers', camperRoutes);
router.use('/rooms', roomRoutes);
router.use('/checkin', checkinRoutes);
router.use('/stats', statsRoutes);
router.use('/export', exportRoutes);

export default router;
