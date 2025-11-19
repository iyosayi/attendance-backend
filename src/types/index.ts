export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface QueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type UserRole = 'admin' | 'staff';
export type CamperStatus = 'pending' | 'checked-in' | 'checked-out';
export type CamperGender = 'Male' | 'Female' | 'Other';
export type RoomRole = 'camper' | 'lead' | 'assistant';
export type CheckInAction = 'check-in' | 'check-out';
