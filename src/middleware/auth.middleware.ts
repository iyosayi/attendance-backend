import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import { jwtConfig } from '../config/jwt';
import { HTTP_STATUS } from '../constants';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authorized to access this route');
  }

  try {
    // Verify token
    const decoded: any = jwt.verify(token, jwtConfig.secret);

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User not found');
    }

    if (!user.isActive) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User account is deactivated');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Token expired');
    }
    throw error;
  }
});

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authorized to access this route');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        `User role '${req.user.role}' is not authorized to access this route`
      );
    }

    next();
  };
};
