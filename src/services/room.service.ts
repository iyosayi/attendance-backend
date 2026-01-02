import mongoose from 'mongoose';
import Room, { IRoom } from '../models/Room';
import Camper from '../models/Camper';
import camperService from './camper.service';
import ApiError from '../utils/ApiError';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import cacheService from './cache.service';
import logger from '../utils/logger';

class RoomService {
  async bulkAssignToRoomNumber(
    payload: {
      roomNumber: string;
      maxCapacity: number;
      existingCamperIds: string[];
      newCampers: Array<{
        firstName: string;
        lastName: string;
        phone: string;
        state: string;
        gender: 'Male' | 'Female';
      }>;
    },
    userId: string
  ): Promise<{
    room: { id: string; roomNumber: string; capacity: number };
    assignedCampers: any[];
    createdCampers: any[];
    errors: Array<{
      type: 'existing' | 'new';
      camperId?: string;
      inputIndex?: number;
      message: string;
    }>;
  }> {
    const { roomNumber, maxCapacity, existingCamperIds, newCampers } = payload;

    const errors: Array<{
      type: 'existing' | 'new';
      camperId?: string;
      inputIndex?: number;
      message: string;
    }> = [];
    const assignedCampers: any[] = [];
    const createdCampers: any[] = [];

    // Find or create room by roomNumber (roomNumber is unique)
    let room = await Room.findOne({ roomNumber });
    if (!room) {
      try {
        room = await Room.create({
          roomNumber,
          capacity: maxCapacity,
          createdBy: userId,
          updatedBy: userId,
        });
      } catch (err: any) {
        // Handle create race: if another request created it, re-fetch
        if (err?.code === 11000 || err?.codeName === 'DuplicateKey') {
          room = await Room.findOne({ roomNumber });
        } else {
          throw err;
        }
      }
    }

    if (!room) {
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Unable to create or retrieve room');
    }

    // Ensure requested capacity isn't less than current occupancy
    if (maxCapacity < room.currentOccupancy) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `maxCapacity (${maxCapacity}) cannot be less than current occupancy (${room.currentOccupancy})`
      );
    }

    // Keep room capacity in sync with request
    if (room.capacity !== maxCapacity) {
      const updatedRoom = await Room.findByIdAndUpdate(
        room._id,
        { capacity: maxCapacity, updatedBy: userId },
        { new: true, runValidators: true }
      );
      if (!updatedRoom) {
        throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Unable to update room capacity');
      }
      room = updatedRoom;
    }

    const roomId = room._id.toString();

    // Assign existing campers (best-effort)
    const uniqueExistingIds = Array.from(new Set((existingCamperIds || []).filter(Boolean)));
    for (const camperId of uniqueExistingIds) {
      try {
        await this.assignCamperToRoom(camperId, roomId, 'camper', userId);
        const camper = await Camper.findById(camperId);
        if (camper) assignedCampers.push(camper);
      } catch (err: any) {
        errors.push({
          type: 'existing',
          camperId,
          message: err?.message || 'Failed to assign camper',
        });
      }
    }

    // Create new campers, then assign (best-effort)
    for (let i = 0; i < (newCampers || []).length; i++) {
      const input = newCampers[i];

      try {
        const camper = await camperService.createCamper(
          {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          state: input.state,
          gender: input.gender,
          isCamping: true,
          },
          userId
        );

        createdCampers.push(camper);

        try {
          await this.assignCamperToRoom(camper._id.toString(), roomId, 'camper', userId);
          const refreshed = await Camper.findById(camper._id);
          assignedCampers.push(refreshed || camper);
        } catch (assignErr: any) {
          errors.push({
            type: 'new',
            inputIndex: i,
            camperId: camper._id.toString(),
            message: assignErr?.message || 'Created camper but failed to assign to room',
          });
        }
      } catch (err: any) {
        errors.push({
          type: 'new',
          inputIndex: i,
          message: err?.message || 'Failed to create camper',
        });
      }
    }

    // Invalidate caches impacted by potential assignment changes
    await cacheService.invalidate(`room:${roomId}`);
    await cacheService.invalidate('stats:overview');

    return {
      // Keep the API key (`id`) but return the human room identifier (roomNumber)
      room: { id: room.roomNumber, roomNumber: room.roomNumber, capacity: room.capacity },
      assignedCampers,
      createdCampers,
      errors,
    };
  }

  async createRoom(
    roomData: {
      roomNumber: string;
      roomName?: string;
      capacity: number;
      floor?: string;
      building?: string;
      amenities?: string[];
      notes?: string;
    },
    userId: string
  ): Promise<IRoom> {
    const room = await Room.create({
      ...roomData,
      createdBy: userId,
      updatedBy: userId,
    });

    logger.info('Room created', { roomId: room._id, roomNumber: room.roomNumber });

    return room;
  }

  async getRoomById(roomId: string): Promise<IRoom> {
    const room = await Room.findById(roomId)
      .populate('leadId', 'firstName lastName email')
      .populate('assistantLeadId', 'firstName lastName email')
      .populate('camperIds', 'firstName lastName email status')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!room) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.ROOM_NOT_FOUND);
    }

    return room;
  }

  async getRoomByRoomNumber(roomNumber: string): Promise<IRoom> {
    const room = await Room.findOne({ roomNumber })
      .populate('leadId', 'firstName lastName email')
      .populate('assistantLeadId', 'firstName lastName email')
      .populate('camperIds', 'firstName lastName email status')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!room) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.ROOM_NOT_FOUND);
    }

    return room;
  }

  async getAllRooms(filters: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    building?: string;
    floor?: string;
    search?: string;
  }): Promise<{ rooms: IRoom[]; total: number; page: number; totalPages: number }> {
    const query: any = {};
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.building) query.building = filters.building;
    if (filters.floor) query.floor = filters.floor;
    if (filters.search) {
      // Use regex for flexible search across room fields
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { roomNumber: searchRegex },
        { roomName: searchRegex },
        { building: searchRegex },
        { floor: searchRegex },
      ];
    }

    // When searching, ignore pagination and return all results
    const isSearching = !!filters.search;
    const page = isSearching ? 1 : (filters.page || 1);
    const limit = isSearching ? 0 : (filters.limit || 10);
    const skip = isSearching ? 0 : (page - 1) * limit;

    const roomQuery = Room.find(query)
      .populate('leadId', 'firstName lastName')
      .populate('assistantLeadId', 'firstName lastName')
      .sort({ building: 1, floor: 1, roomNumber: 1 });

    // Only apply skip/limit if not searching
    if (!isSearching) {
      roomQuery.skip(skip).limit(limit);
    }

    const [rooms, total] = await Promise.all([
      roomQuery,
      Room.countDocuments(query),
    ]);

    return {
      rooms,
      total,
      page,
      totalPages: isSearching ? 1 : Math.ceil(total / limit),
    };
  }

  async updateRoom(
    roomId: string,
    updateData: Partial<IRoom>,
    userId: string
  ): Promise<IRoom> {
    const room = await Room.findByIdAndUpdate(
      roomId,
      {
        ...updateData,
        updatedBy: userId,
      },
      { new: true, runValidators: true }
    );

    if (!room) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.ROOM_NOT_FOUND);
    }

    await cacheService.invalidate(`room:${roomId}`);

    logger.info('Room updated', { roomId: room._id });

    return room;
  }

  /**
   * CRITICAL: Assign camper to room with atomic operations to prevent race conditions
   * Strategy 1: Atomic Operations with Conditions (PRIMARY)
   */
  async assignCamperToRoom(
    camperId: string,
    roomId: string,
    role: 'camper' | 'lead' | 'assistant',
    userId: string
  ): Promise<IRoom> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Step 1: Find camper and verify not already assigned
      const camper = await Camper.findById(camperId).session(session);
      if (!camper) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
      }
      if (camper.roomId) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.CAMPER_ALREADY_ASSIGNED
        );
      }

      // Step 2: ATOMIC update with condition check
      // This is the critical line that prevents race conditions
      const updateResult = await Room.findOneAndUpdate(
        {
          _id: roomId,
          isActive: true,
          // CRITICAL: Only update if current occupancy is less than capacity
          $expr: { $lt: ['$currentOccupancy', '$capacity'] },
        },
        {
          $inc: { currentOccupancy: 1, version: 1 }, // Increment atomically
          $push: { camperIds: camperId },
          $set: {
            ...(role === 'lead' && { leadId: camperId }),
            ...(role === 'assistant' && { assistantLeadId: camperId }),
            updatedBy: userId,
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      // Step 3: Check if update succeeded
      if (!updateResult) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Room is full or not available. Please try another room.'
        );
      }

      // Step 4: Update camper record
      await Camper.findByIdAndUpdate(
        camperId,
        {
          // Camper.roomId is a string; we store the human room identifier (roomNumber),
          // not the Mongo room _id, to match API expectations.
          roomId: updateResult.roomNumber,
          updatedBy: userId,
        },
        { session }
      );

      // Step 5: Commit transaction
      await session.commitTransaction();

      // Step 6: Invalidate cache
      await cacheService.invalidate(`room:${roomId}`);
      await cacheService.invalidate('stats:overview');

      logger.info('Camper assigned to room', {
        camperId,
        roomId,
        role,
        currentOccupancy: updateResult.currentOccupancy,
      });

      return updateResult;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async removeCamperFromRoom(
    camperId: string,
    roomId: string,
    userId: string
  ): Promise<IRoom> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Find the room
      const room = await Room.findById(roomId).session(session);
      if (!room) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.ROOM_NOT_FOUND);
      }

      // Check if camper is in the room
      const camperIndex = room.camperIds.findIndex(
        (id) => id.toString() === camperId
      );

      if (camperIndex === -1) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Camper is not in this room');
      }

      // Update room - remove camper
      const updateSet: any = { updatedBy: userId };
      if (room.leadId?.toString() === camperId) updateSet.leadId = null;
      if (room.assistantLeadId?.toString() === camperId) updateSet.assistantLeadId = null;

      const updatedRoom = await Room.findByIdAndUpdate(
        roomId,
        {
          $inc: { currentOccupancy: -1 },
          $pull: { camperIds: camperId },
          $set: updateSet,
        },
        { new: true, session }
      );

      // Update camper - remove room assignment
      await Camper.findByIdAndUpdate(
        camperId,
        {
          roomId: null,
          updatedBy: userId,
        },
        { session }
      );

      await session.commitTransaction();

      await cacheService.invalidate(`room:${roomId}`);
      await cacheService.invalidate('stats:overview');

      logger.info('Camper removed from room', { camperId, roomId });

      return updatedRoom!;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAvailableRooms(): Promise<IRoom[]> {
    const rooms = await Room.find({
      isActive: true,
      $expr: { $lt: ['$currentOccupancy', '$capacity'] },
    })
      .select('roomNumber roomName capacity currentOccupancy building floor')
      .sort({ building: 1, floor: 1, roomNumber: 1 });

    return rooms;
  }

  async deleteRoom(roomId: string): Promise<void> {
    const room = await Room.findById(roomId);

    if (!room) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.ROOM_NOT_FOUND);
    }

    if (room.currentOccupancy > 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot delete room with assigned campers'
      );
    }

    await Room.findByIdAndDelete(roomId);

    await cacheService.invalidate(`room:${roomId}`);

    logger.info('Room deleted', { roomId });
  }
}

export default new RoomService();
