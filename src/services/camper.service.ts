import Camper, { ICamper } from '../models/Camper';
import User from '../models/User';
import Room from '../models/Room';
import ApiError from '../utils/ApiError';
import { HTTP_STATUS, ERROR_CODES, CAMPER_STATUS } from '../constants';
import logger from '../utils/logger';
import { generatePaginationMeta } from '../utils/helpers';
import cacheService from './cache.service';

const MONGODB_OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

async function normalizeCamperRoomIdsToRoomNumbers(
  campers: Array<any>
): Promise<void> {
  const objectIdLikeRoomIds = Array.from(
    new Set(
      campers
        .map((c) => c?.roomId)
        .filter((roomId) => typeof roomId === 'string' && MONGODB_OBJECT_ID_REGEX.test(roomId))
    )
  );

  if (objectIdLikeRoomIds.length === 0) return;

  const rooms = await Room.find({ _id: { $in: objectIdLikeRoomIds } })
    .select('_id roomNumber')
    .lean();

  const roomIdToNumber = new Map<string, string>(
    rooms.map((r: any) => [String(r._id), String(r.roomNumber)])
  );

  for (const camper of campers) {
    const current = camper?.roomId;
    if (typeof current !== 'string') continue;
    const roomNumber = roomIdToNumber.get(current);
    if (!roomNumber) continue;
    // Mutate for response serialization (do not change the API field name)
    camper.roomId = roomNumber;
  }
}

class CamperService {
  async createCamper(camperData: Partial<ICamper>, userId: string | null): Promise<ICamper> {
    // If userId is not provided (self-signup), use system admin user
    let finalUserId = userId;
    if (!finalUserId) {
      const adminUser = await User.findOne({ email: 'admin@camp.com' });
      if (!adminUser) {
        throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'System user not found');
      }
      finalUserId = adminUser._id.toString();
    }

    // Prepare camper data
    const camperPayload: any = {
      ...camperData,
      createdBy: finalUserId,
      updatedBy: finalUserId,
    };

    // If isCamping is true and status is not explicitly provided, set status to checked-in
    if (camperData.isCamping === true && camperData.status === undefined) {
      camperPayload.status = CAMPER_STATUS.CHECKED_IN;
      // Set checkInTime when automatically setting status to checked-in
      camperPayload.checkInTime = new Date();
    }

    // Handle roomId - accept as free-form string and trim whitespace
    if (camperData.roomId !== undefined && camperData.roomId !== null && camperData.roomId !== '') {
      camperPayload.roomId = String(camperData.roomId).trim();
    }

    // If status is explicitly set to checked-in, ensure checkInTime is set
    const finalStatus = camperPayload.status || camperData.status || CAMPER_STATUS.PENDING;
    if (finalStatus === CAMPER_STATUS.CHECKED_IN && !camperPayload.checkInTime) {
      camperPayload.checkInTime = new Date();
    }

    const camper = await Camper.create(camperPayload);

    // Invalidate cache since new camper was created
    await cacheService.invalidate('stats:overview');

    logger.info('Camper created', { camperId: camper._id, email: camper.email });

    return camper;
  }

  async getCamperById(camperId: string): Promise<ICamper> {
    const camper = await Camper.findOne({ _id: camperId, isDeleted: false })
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
    }

    await normalizeCamperRoomIdsToRoomNumbers([camper]);

    return camper;
  }

  async getAllCampers(filters: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    isCamping?: boolean;
  }): Promise<{
    docs: ICamper[];
    totalDocs: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
    page: number;
    limit: number;
  }> {
    const query: any = { isDeleted: false };
    
    // Handle isCamping filter
    // If isCamping is explicitly true, return only campers (isCamping = true)
    // If isCamping is false or not provided, return non-campers (isCamping != true, including false, null, undefined)
    if (filters.isCamping === true) {
      query.isCamping = true;
    } else {
      // Default to non-campers: include false, null, and undefined
      // Using $ne: true is simpler and handles all edge cases
      query.isCamping = { $ne: true };
    }
    
    // if (filters.status) query.status = filters.status;
    
    // Handle search filter
    if (filters.search) {
      // Use regex for more flexible search across name, email, phone, and code
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { code: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        // { email: searchRegex },
        // { phone: searchRegex },
      ];
    }

    // When searching, ignore pagination and return all results
    const isSearching = !!filters.search;
    const page = isSearching ? 1 : (filters.page || 1);
    const limit = isSearching ? 0 : Math.min(filters.limit || 10, 100);
    const skip = isSearching ? 0 : (page - 1) * limit;

    const camperQuery = Camper.find(query)
      .sort({ createdAt: -1 });

    // Only apply skip/limit if not searching
    if (!isSearching) {
      camperQuery.skip(skip).limit(limit);
    }

    const [campers, totalDocs] = await Promise.all([
      camperQuery,
      Camper.countDocuments(query),
    ]);

    await normalizeCamperRoomIdsToRoomNumbers(campers as any[]);

    // Generate pagination metadata
    const paginationMeta = isSearching
      ? {
          totalDocs,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
          page: 1,
          limit: totalDocs,
        }
      : generatePaginationMeta(totalDocs, page, limit);

    return {
      docs: campers,
      ...paginationMeta,
    };
  }

  async updateCamper(
    camperId: string,
    updateData: Partial<ICamper>,
    userId: string
  ): Promise<ICamper> {
    // Get current camper to check status changes
    const currentCamper = await Camper.findOne({ _id: camperId, isDeleted: false });
    
    if (!currentCamper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
    }

    // Prepare update object
    const updateObject: any = {
      ...updateData,
      updatedBy: userId,
    };

    // If isCamping is set to true and status is not explicitly provided, set status to checked-in
    if (updateData.isCamping === true && updateData.status === undefined) {
      updateObject.status = CAMPER_STATUS.CHECKED_IN;
    }

    // Handle status changes - update checkInTime and checkOutTime accordingly
    // Check both explicit status and the status set from isCamping logic
    const newStatus = updateObject.status || updateData.status;
    if (newStatus && newStatus !== currentCamper.status) {
      const now = new Date();
      
      if (newStatus === CAMPER_STATUS.CHECKED_IN) {
        // Marking as checked-in: set checkInTime if not already set
        if (!currentCamper.checkInTime) {
          updateObject.checkInTime = now;
        }
        // Clear checkOutTime if previously checked out
        if (currentCamper.checkOutTime) {
          updateObject.checkOutTime = undefined;
        }
      } else if (newStatus === CAMPER_STATUS.CHECKED_OUT) {
        // Marking as checked-out: set checkOutTime if not already set
        if (!currentCamper.checkOutTime) {
          updateObject.checkOutTime = now;
        }
        // Ensure checkInTime is set (should be, but handle edge case)
        if (!currentCamper.checkInTime) {
          updateObject.checkInTime = now;
        }
      } else if (newStatus === CAMPER_STATUS.PENDING) {
        // Resetting to pending: clear check-in/check-out times
        updateObject.checkInTime = undefined;
        updateObject.checkOutTime = undefined;
      }
    }

    // Handle roomId update - accept as free-form string
    if (updateData.roomId !== undefined) {
      // Allow clearing room assignment (null or empty string)
      if (updateData.roomId === null || updateData.roomId === '') {
        updateObject.roomId = null;
      } else {
        // Store as-is (trim whitespace)
        updateObject.roomId = String(updateData.roomId).trim();
      }
    }

    // Perform the update
    const camper = await Camper.findOneAndUpdate(
      { _id: camperId, isDeleted: false },
      updateObject,
      { new: true, runValidators: true }
    );

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
    }

    // Invalidate cache since camper data changed
    await cacheService.invalidate('stats:overview');

    logger.info('Camper updated', {
      camperId: camper._id,
      updatedFields: Object.keys(updateData),
      statusChanged: updateData.status ? updateData.status !== currentCamper.status : false,
    });

    return camper;
  }

  async deleteCamper(camperId: string, userId: string): Promise<void> {
    const camper = await Camper.findOneAndUpdate(
      { _id: camperId, isDeleted: false },
      {
        isDeleted: true,
        updatedBy: userId,
      },
      { new: true }
    );

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
    }

    logger.info('Camper deleted (soft)', { camperId });
  }

  async searchCampersByCode(code: string): Promise<ICamper[]> {
    if (!code || code.trim().length === 0) {
      return [];
    }

    const codeRegex = new RegExp(code.trim(), 'i');
    const campers = await Camper.find({
      code: codeRegex,
      isDeleted: false,
    })
      .sort({ createdAt: -1 });

    return campers;
  }
}

export default new CamperService();
