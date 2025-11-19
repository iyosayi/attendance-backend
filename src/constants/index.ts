export const USER_ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
} as const;

export const CAMPER_STATUS = {
  PENDING: 'pending',
  CHECKED_IN: 'checked-in',
  CHECKED_OUT: 'checked-out',
} as const;

export const CAMPER_GENDER = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
} as const;

export const CHECKIN_ACTIONS = {
  CHECK_IN: 'check-in',
  CHECK_OUT: 'check-out',
} as const;

export const CHECKIN_SESSIONS = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
} as const;

export const CHECKIN_LOCATIONS = {
  CAMPGROUND: 'campground',
  BUS: 'bus',
  CHURCH: 'church',
} as const;

export const CHECKIN_DIRECTIONS = {
  TO_CHURCH: 'to-church',
  TO_CAMPGROUND: 'to-campground',
} as const;

export const ROOM_ROLES = {
  CAMPER: 'camper',
  LEAD: 'lead',
  ASSISTANT: 'assistant',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const CACHE_KEYS = {
  ROOM: (id: string) => `room:${id}`,
  CAMPER: (id: string) => `camper:${id}`,
  STATS_OVERVIEW: 'stats:overview',
  AVAILABLE_ROOMS: 'rooms:available',
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 600, // 10 minutes
  STATS: 120, // 2 minutes
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['text/csv', 'application/vnd.ms-excel'],
} as const;

export const ERROR_CODES = {
  ROOM_FULL: 'ROOM_FULL',
  CAMPER_ALREADY_ASSIGNED: 'CAMPER_ALREADY_ASSIGNED',
  CAMPER_NOT_FOUND: 'CAMPER_NOT_FOUND',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_REQUESTS: 5,
} as const;
