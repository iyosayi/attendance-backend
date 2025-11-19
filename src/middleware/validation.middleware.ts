import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import ApiError from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorMessage);
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorMessage);
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorMessage);
    }

    req.params = value;
    next();
  };
};
