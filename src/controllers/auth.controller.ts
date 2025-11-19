import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ApiResponse from '../utils/ApiResponse';
import authService from '../services/auth.service';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { user, token } = await authService.register(req.body);

  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, { user, token }, 'User registered successfully')
  );
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  const { user, token } = await authService.login(email, password);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { user, token }, 'Login successful')
  );
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getUserById(req.user._id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { user }, 'User retrieved successfully')
  );
});

export const updatePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.updatePassword(req.user._id, currentPassword, newPassword);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Password updated successfully')
  );
});
