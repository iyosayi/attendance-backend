import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ApiResponse from '../utils/ApiResponse';
import checkinService from '../services/checkin.service';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

export const checkIn = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { notes } = req.body;
  await checkinService.checkIn(req.params.camperId, req.user._id, notes);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Camper checked in successfully')
  );
});

export const checkOut = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { notes } = req.body;
  await checkinService.checkOut(req.params.camperId, req.user._id, notes);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Camper checked out successfully')
  );
});

export const getCheckInLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const logs = await checkinService.getCheckInLogs(req.params.camperId);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { logs }, 'Check-in logs retrieved successfully')
  );
});

// Session-based check-in endpoints
export const checkInSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { session } = req.params;
  const { camperId } = req.params;
  const { busId, location, direction, notes } = req.body;

  if (!['morning', 'afternoon', 'evening', 'night'].includes(session)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Invalid session. Must be morning, afternoon, evening, or night')
    );
    return;
  }

  await checkinService.checkInSession(
    camperId,
    session as 'morning' | 'afternoon' | 'evening' | 'night',
    req.user._id,
    { busId, location, direction, notes }
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, `Camper checked in for ${session} session successfully`)
  );
});

export const checkInBulk = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { session } = req.params;
  const { camperIds, busId, location, direction, notes } = req.body;

  if (!['morning', 'afternoon', 'evening', 'night'].includes(session)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Invalid session. Must be morning, afternoon, evening, or night')
    );
    return;
  }

  if (!Array.isArray(camperIds) || camperIds.length === 0) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'camperIds must be a non-empty array')
    );
    return;
  }

  const result = await checkinService.checkInMultiple(
    camperIds,
    session as 'morning' | 'afternoon' | 'evening' | 'night',
    req.user._id,
    { busId, location, direction, notes }
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, `Bulk check-in for ${session} session completed`)
  );
});

export const checkInByPhone = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phoneNumber, notes } = req.body;

  if (!phoneNumber) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'phoneNumber is required')
    );
    return;
  }

  await checkinService.checkInByPhoneNumber(phoneNumber, 'night', req.user._id, { notes });

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Camper checked in for night session successfully')
  );
});

export const getCamperByPhone = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'phoneNumber query parameter is required')
    );
    return;
  }

  const camper = await checkinService.getCamperByPhoneNumber(phoneNumber);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { camper }, 'Camper retrieved successfully')
  );
});

export const verifyBusTally = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { busId } = req.params;
  const { session, date } = req.query;

  if (!session || !['morning', 'afternoon', 'evening'].includes(session as string)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'session query parameter is required and must be morning, afternoon, or evening')
    );
    return;
  }

  const targetDate = date ? new Date(date as string) : undefined;
  const result = await checkinService.verifyBusTally(
    busId,
    session as 'morning' | 'afternoon' | 'evening',
    targetDate
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Bus tally verified successfully')
  );
});

export const getSessionStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { camperId } = req.params;
  const { date } = req.query;

  const targetDate = date ? new Date(date as string) : undefined;
  const result = await checkinService.getSessionStatus(camperId, targetDate);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Session status retrieved successfully')
  );
});

export const getBusCheckIns = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { busId } = req.params;
  const { session, date } = req.query;

  if (!session || !['morning', 'afternoon', 'evening'].includes(session as string)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'session query parameter is required and must be morning, afternoon, or evening')
    );
    return;
  }

  const targetDate = date ? new Date(date as string) : undefined;
  const checkIns = await checkinService.getBusCheckIns(
    busId,
    session as 'morning' | 'afternoon' | 'evening',
    targetDate
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { checkIns }, 'Bus check-ins retrieved successfully')
  );
});

export const getDailySummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.query;

  const targetDate = date ? new Date(date as string) : undefined;
  // If user is staff, filter by their performedBy ID
  const performedBy = req.user?.role === 'staff' ? req.user._id.toString() : undefined;
  const summary = await checkinService.getDailySessionSummary(targetDate, performedBy);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, summary, 'Daily session summary retrieved successfully')
  );
});

export const getSessionCheckIns = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { session, date } = req.query;

  if (!session || typeof session !== 'string') {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'session query parameter is required')
    );
    return;
  }

  if (!['morning', 'afternoon', 'evening', 'night'].includes(session)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Invalid session. Must be morning, afternoon, evening, or night')
    );
    return;
  }

  const targetDate = date ? new Date(date as string) : undefined;
  const checkIns = await checkinService.getSessionCheckIns(
    session as 'morning' | 'afternoon' | 'evening' | 'night',
    targetDate
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { checkIns }, 'Session check-ins retrieved successfully')
  );
});
