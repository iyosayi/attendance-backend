import { Types } from 'mongoose';

export const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

export const toObjectId = (id: string): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      sanitized[key] = obj[key];
    }
  }
  
  return sanitized;
};

export const paginate = (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit };
};

export const generatePaginationMeta = (
  totalDocs: number,
  page: number,
  limit: number
) => {
  const totalPages = Math.ceil(totalDocs / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  const nextPage = hasNextPage ? page + 1 : null;
  const prevPage = hasPrevPage ? page - 1 : null;

  return {
    totalDocs,
    totalPages,
    hasPrevPage,
    hasNextPage,
    prevPage,
    nextPage,
    page,
    limit,
  };
};
