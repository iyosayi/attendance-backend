import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ApiResponse from '../utils/ApiResponse';
import roomService from '../services/room.service';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

export const createRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  const room = await roomService.createRoom(req.body, req.user._id);

  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, { room }, 'Room created successfully')
  );
});

export const getRoomById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const room = await roomService.getRoomById(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { room }, 'Room retrieved successfully')
  );
});

export const getAllRooms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, isActive, building, floor, search } = req.query;
  const result = await roomService.getAllRooms({
    page: Number(page),
    limit: Number(limit),
    isActive: isActive === 'true',
    building: building as string,
    floor: floor as string,
    search: search as string,
  });

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Rooms retrieved successfully')
  );
});

export const updateRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  const room = await roomService.updateRoom(req.params.id, req.body, req.user._id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { room }, 'Room updated successfully')
  );
});

export const assignCamperToRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { camperId, role } = req.body;
  const room = await roomService.assignCamperToRoom(
    camperId,
    req.params.id,
    role || 'camper',
    req.user._id
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { room }, 'Camper assigned to room successfully')
  );
});

export const removeCamperFromRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { camperId } = req.body;
  const room = await roomService.removeCamperFromRoom(camperId, req.params.id, req.user._id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { room }, 'Camper removed from room successfully')
  );
});

export const getAvailableRooms = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const rooms = await roomService.getAvailableRooms();

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { rooms }, 'Available rooms retrieved successfully')
  );
});

export const deleteRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  await roomService.deleteRoom(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Room deleted successfully')
  );
});
