import Joi from 'joi';

export const createCamperSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters',
    'string.max': 'First name must not exceed 50 characters',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters',
    'string.max': 'Last name must not exceed 50 characters',
    'any.required': 'Last name is required',
  }),
  email: Joi.string().email().empty('').optional().messages({
    'string.email': 'Please provide a valid email address',
  }),
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required',
    }),
  state: Joi.string().min(2).max(100).required().messages({
    'string.min': 'State must be at least 2 characters',
    'string.max': 'State must not exceed 100 characters',
    'any.required': 'State is required',
  }),
  subRegion: Joi.string().min(2).max(100).empty('').optional().messages({
    'string.min': 'Sub region must be at least 2 characters',
    'string.max': 'Sub region must not exceed 100 characters',
  }),
  age: Joi.number().min(0).max(120).optional(),
  gender: Joi.string().valid('Male', 'Female').optional(),
  isCamping: Joi.boolean().required().messages({
    'any.required': 'isCamping is required',
    'boolean.base': 'isCamping must be a boolean',
  }),
  isHelplineMember: Joi.boolean().optional().default(false).messages({
    'boolean.base': 'isHelplineMember must be a boolean',
  }),
  isNyscCorpMember: Joi.boolean().optional().default(false).messages({
    'boolean.base': 'isNyscCorpMember must be a boolean',
  }),
  status: Joi.string().valid('pending', 'checked-in', 'checked-out').optional().messages({
    'any.only': 'Status must be one of: pending, checked-in, checked-out',
  }),
  roomId: Joi.string().optional().messages({
    'string.base': 'Room ID must be a string',
  }),
  emergencyContact: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string()
      .pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
      .optional(),
    relationship: Joi.string().max(50).optional(),
  }).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const updateCamperSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().empty('').optional(),
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
    .optional(),
  state: Joi.string().min(2).max(100).optional(),
  subRegion: Joi.string().min(2).max(100).empty('').optional().messages({
    'string.min': 'Sub region must be at least 2 characters',
    'string.max': 'Sub region must not exceed 100 characters',
  }),
  age: Joi.number().min(0).max(120).optional(),
  gender: Joi.string().valid('Male', 'Female').optional(),
  isCamping: Joi.boolean().optional(),
  isHelplineMember: Joi.boolean().optional(),
  isNyscCorpMember: Joi.boolean().optional(),
  status: Joi.string().valid('pending', 'checked-in', 'checked-out').optional().messages({
    'any.only': 'Status must be one of: pending, checked-in, checked-out',
  }),
  roomId: Joi.string().optional().messages({
    'string.base': 'Room ID must be a string',
  }),
  emergencyContact: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string()
      .pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
      .optional(),
    relationship: Joi.string().max(50).optional(),
  }).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const checkInSchema = Joi.object({
  notes: Joi.string().max(500).optional(),
});

export const checkOutSchema = Joi.object({
  notes: Joi.string().max(500).optional(),
});

// Session-based check-in validation schemas
export const checkInSessionSchema = Joi.object({
  busId: Joi.string().trim().optional(),
  location: Joi.string().valid('campground', 'bus', 'church').optional(),
  direction: Joi.string().valid('to-church', 'to-campground').optional(),
  notes: Joi.string().max(500).optional(),
});

export const checkInBulkSchema = Joi.object({
  camperIds: Joi.array().items(Joi.string().required()).min(1).required().messages({
    'array.base': 'camperIds must be an array',
    'array.min': 'camperIds must contain at least one camper ID',
    'any.required': 'camperIds is required',
  }),
  busId: Joi.string().trim().optional(),
  location: Joi.string().valid('campground', 'bus', 'church').optional(),
  direction: Joi.string().valid('to-church', 'to-campground').optional(),
  notes: Joi.string().max(500).optional(),
});

export const checkInByPhoneSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'phoneNumber is required',
    }),
  notes: Joi.string().max(500).optional(),
});
