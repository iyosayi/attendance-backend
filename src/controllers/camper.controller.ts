import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ApiResponse from '../utils/ApiResponse';
import camperService from '../services/camper.service';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

export const createCamper = asyncHandler(async (req: AuthRequest, res: Response) => {
  const camper = await camperService.createCamper(req.body, req.user._id);

  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, { camper }, 'Camper created successfully')
  );
});

export const getCamperById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const camper = await camperService.getCamperById(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { camper }, 'Camper retrieved successfully')
  );
});

export const getAllCampers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, status, search } = req.query;
  const result = await camperService.getAllCampers({
    page: Number(page),
    limit: Number(limit),
    status: status as string,
    search: search as string,
  });

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Campers retrieved successfully')
  );
});

export const updateCamper = asyncHandler(async (req: AuthRequest, res: Response) => {
  const camper = await camperService.updateCamper(req.params.id, req.body, req.user._id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { camper }, 'Camper updated successfully')
  );
});

export const deleteCamper = asyncHandler(async (req: AuthRequest, res: Response) => {
  await camperService.deleteCamper(req.params.id, req.user._id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Camper deleted successfully')
  );
});

export const searchCampersByCode = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.query;
  const campers = await camperService.searchCampersByCode(code as string);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { campers, count: campers.length }, 'Campers found successfully')
  );
});
