import rateLimit from 'express-rate-limit';
import { RATE_LIMIT } from '../constants';

// Skip rate limiting in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
});

export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  max: RATE_LIMIT.AUTH_MAX_REQUESTS,
  message: 'Too many authentication attempts from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isDevelopment,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
});
