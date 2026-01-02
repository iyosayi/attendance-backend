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

  // Mongoose/MongoDB duplicate key (E11000)
  if (err.code === 11000 || err.codeName === 'DuplicateKey') {
    // Extract field name and value from error
    // Handle both Mongoose and MongoDB driver error structures
    const keyValue = err.keyValue || err.keyPattern || {};
    const keyPattern = err.keyPattern || {};
    
    // Get the first key from keyValue (most reliable), fallback to keyPattern
    const field = Object.keys(keyValue).length > 0 
      ? Object.keys(keyValue)[0] 
      : Object.keys(keyPattern).length > 0 
        ? Object.keys(keyPattern)[0]
        : 'field';
    
    const duplicateValue = keyValue[field];
    
    // Create user-friendly error messages based on the field
    let message = '';
    switch (field) {
      case 'email':
        message = duplicateValue 
          ? `An account with the email "${duplicateValue}" already exists. Please use a different email address.`
          : 'This email address is already registered. Please use a different email address.';
        break;
      case 'code':
        message = duplicateValue
          ? `A camper with the code "${duplicateValue}" already exists.`
          : 'This camper code is already in use.';
        break;
      case 'username':
        message = duplicateValue
          ? `The username "${duplicateValue}" is already taken. Please choose another username.`
          : 'This username is already taken. Please choose another username.';
        break;
      default:
        // Generic message with field name and value if available
        const fieldDisplay = field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1').trim();
        message = duplicateValue
          ? `${fieldDisplay} "${duplicateValue}" is already in use. Please use a different value.`
          : `This ${fieldDisplay.toLowerCase()} is already in use. Please use a different value.`;
    }
    
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
