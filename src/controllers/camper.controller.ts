import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ApiResponse from '../utils/ApiResponse';
import camperService from '../services/camper.service';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

export const signupCamper = asyncHandler(async (req: Request, res: Response) => {
  const camper = await camperService.createCamper(req.body, null);

  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, { camper }, 'Camper signed up successfully')
  );
});

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
  const { page, limit, status, search, isCamping } = req.query;
  
  // Parse isCamping query parameter
  // Handle edge cases: "true", "false", empty string, or undefined
  // Query params come as strings, so we check for string "true" or "false"
  let isCampingFilter: boolean | undefined;
  if (isCamping !== undefined && isCamping !== null) {
    const isCampingStr = String(isCamping).toLowerCase().trim();
    if (isCampingStr === 'true' || isCampingStr === '1') {
      // Explicitly true → return campers
      isCampingFilter = true;
    } else if (isCampingStr === 'false' || isCampingStr === '0' || isCampingStr === '') {
      // Explicitly false or empty → return non-campers
      isCampingFilter = false;
    }
    // If param exists but has invalid value (not true/false/1/0/empty),
    // treat as undefined (will default to false/non-campers in service)
  }
  // If isCamping param is not present at all, isCampingFilter remains undefined
  // which will default to false (non-campers) in the service
  
  const result = await camperService.getAllCampers({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status as string,
    search: search as string,
    isCamping: isCampingFilter,
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
