import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { HTTP_STATUS } from '../constants';

const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}`;
    error = new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(', ');
    error = new ApiError(HTTP_STATUS.BAD_REQUEST, message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  // Send response
  res.status(error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
