import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import csvService from '../services/csv.service';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

export const exportCampers = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const filePath = await csvService.exportCampers();

  res.download(filePath, 'campers-export.csv', (err) => {
    if (err) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Error downloading file',
      });
    }
  });
});

export const exportRooms = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const filePath = await csvService.exportRooms();

  res.download(filePath, 'rooms-export.csv', (err) => {
    if (err) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Error downloading file',
      });
    }
  });
});
