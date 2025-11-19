import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ApiResponse from '../utils/ApiResponse';
import Camper from '../models/Camper';
import Room from '../models/Room';
import { HTTP_STATUS, CACHE_TTL } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';
import cacheService from '../services/cache.service';
import checkinService from '../services/checkin.service';

export const getOverview = asyncHandler(async (_req: AuthRequest, res: Response) => {
  // Try to get from cache
  const cached = await cacheService.get('stats:overview');
  if (cached) {
    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, cached, 'Overview statistics retrieved successfully (cached)')
    );
    return;
  }

  // Aggregate stats
  const [
    totalCampers,
    checkedInCampers,
    checkedOutCampers,
    pendingCampers,
    totalRooms,
    occupiedRooms,
    totalCapacity,
    totalOccupancy,
  ] = await Promise.all([
    Camper.countDocuments({ isDeleted: false }),
    Camper.countDocuments({ isDeleted: false, status: 'checked-in' }),
    Camper.countDocuments({ isDeleted: false, status: 'checked-out' }),
    Camper.countDocuments({ isDeleted: false, status: 'pending' }),
    Room.countDocuments({ isActive: true }),
    Room.countDocuments({ isActive: true, currentOccupancy: { $gt: 0 } }),
    Room.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, total: { $sum: '$capacity' } } }]),
    Room.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, total: { $sum: '$currentOccupancy' } } }]),
  ]);

  const stats = {
    campers: {
      total: totalCampers,
      checkedIn: checkedInCampers,
      checkedOut: checkedOutCampers,
      pending: pendingCampers,
    },
    rooms: {
      total: totalRooms,
      occupied: occupiedRooms,
      available: totalRooms - occupiedRooms,
      totalCapacity: totalCapacity[0]?.total || 0,
      totalOccupancy: totalOccupancy[0]?.total || 0,
      occupancyRate: totalCapacity[0]?.total ? ((totalOccupancy[0]?.total / totalCapacity[0]?.total) * 100).toFixed(2) : 0,
    },
  };

  // Cache the result
  await cacheService.set('stats:overview', stats, CACHE_TTL.STATS);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, stats, 'Overview statistics retrieved successfully')
  );
});

export const getSessionAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.query;

  const targetDate = date ? new Date(date as string) : undefined;
  const summary = await checkinService.getDailySessionSummary(targetDate);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, summary, 'Session attendance statistics retrieved successfully')
  );
});
