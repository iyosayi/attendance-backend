import Joi from 'joi';

export const createRoomSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(20).required().messages({
    'string.min': 'Room number must be at least 1 character',
    'string.max': 'Room number must not exceed 20 characters',
    'any.required': 'Room number is required',
  }),
  roomName: Joi.string().max(100).optional(),
  capacity: Joi.number().min(1).max(50).required().messages({
    'number.min': 'Capacity must be at least 1',
    'number.max': 'Capacity must not exceed 50',
    'any.required': 'Capacity is required',
  }),
  floor: Joi.string().max(20).optional(),
  building: Joi.string().max(50).optional(),
  amenities: Joi.array().items(Joi.string().max(50)).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const updateRoomSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(20).optional(),
  roomName: Joi.string().max(100).optional(),
  capacity: Joi.number().min(1).max(50).optional(),
  floor: Joi.string().max(20).optional(),
  building: Joi.string().max(50).optional(),
  amenities: Joi.array().items(Joi.string().max(50)).optional(),
  notes: Joi.string().max(1000).optional(),
  isActive: Joi.boolean().optional(),
});

export const assignCamperSchema = Joi.object({
  camperId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid camper ID format',
      'any.required': 'Camper ID is required',
    }),
  role: Joi.string().valid('camper', 'lead', 'assistant').default('camper'),
});

export const removeCamperSchema = Joi.object({
  camperId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid camper ID format',
      'any.required': 'Camper ID is required',
    }),
});

export const bulkAssignRoomSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(20).required().messages({
    'string.min': 'Room number must be at least 1 character',
    'string.max': 'Room number must not exceed 20 characters',
    'any.required': 'Room number is required',
  }),
  maxCapacity: Joi.number().min(1).max(50).required().messages({
    'number.min': 'Capacity must be at least 1',
    'number.max': 'Capacity must not exceed 50',
    'any.required': 'Capacity is required',
  }),
  existingCamperIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({ 'string.pattern.base': 'Invalid camper ID format' })
    )
    .default([]),
  newCampers: Joi.array()
    .items(
      Joi.object({
        firstName: Joi.string().min(1).max(100).required(),
        lastName: Joi.string().min(1).max(100).required(),
        phone: Joi.string().min(3).max(30).required(),
        state: Joi.string().min(1).max(100).required(),
        gender: Joi.string().valid('Male', 'Female').required(),
      })
    )
    .default([]),
});
