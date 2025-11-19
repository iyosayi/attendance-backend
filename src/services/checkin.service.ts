import mongoose from 'mongoose';
import Camper from '../models/Camper';
import CheckInLog from '../models/CheckInLog';
import ApiError from '../utils/ApiError';
import {
  HTTP_STATUS,
  ERROR_CODES,
  CAMPER_STATUS,
  CHECKIN_ACTIONS,
  CHECKIN_SESSIONS,
  CHECKIN_LOCATIONS,
  CHECKIN_DIRECTIONS,
} from '../constants';
import cacheService from './cache.service';
import logger from '../utils/logger';

class CheckInService {
  async checkIn(camperId: string, userId: string, notes?: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const camper = await Camper.findOne({ _id: camperId, isDeleted: false }).session(session);

      if (!camper) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
      }

      if (camper.status === CAMPER_STATUS.CHECKED_IN) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Camper is already checked in');
      }

      // Update camper status
      camper.status = CAMPER_STATUS.CHECKED_IN;
      camper.checkInTime = new Date();
      camper.updatedBy = new mongoose.Types.ObjectId(userId);
      await camper.save({ session });

      // Create check-in log
      await CheckInLog.create(
        [
          {
            camperId,
            action: CHECKIN_ACTIONS.CHECK_IN,
            timestamp: new Date(),
            performedBy: userId,
            roomId: camper.roomId,
            notes,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      await cacheService.invalidate('stats:overview');

      logger.info('Camper checked in', { camperId });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async checkOut(camperId: string, userId: string, notes?: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const camper = await Camper.findOne({ _id: camperId, isDeleted: false }).session(session);

      if (!camper) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
      }

      if (camper.status !== CAMPER_STATUS.CHECKED_IN) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Camper is not checked in');
      }

      // Update camper status
      camper.status = CAMPER_STATUS.CHECKED_OUT;
      camper.checkOutTime = new Date();
      camper.updatedBy = new mongoose.Types.ObjectId(userId);
      await camper.save({ session });

      // Create check-out log
      await CheckInLog.create(
        [
          {
            camperId,
            action: CHECKIN_ACTIONS.CHECK_OUT,
            timestamp: new Date(),
            performedBy: userId,
            roomId: camper.roomId,
            notes,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      await cacheService.invalidate('stats:overview');

      logger.info('Camper checked out', { camperId });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getCheckInLogs(camperId: string): Promise<any[]> {
    const logs = await CheckInLog.find({ camperId })
      .populate('performedBy', 'fullName email')
      .populate('roomId', 'roomNumber roomName')
      .sort({ timestamp: -1 });

    return logs;
  }

  /**
   * Session-based check-in for individual camper
   */
  async checkInSession(
    camperId: string,
    session: 'morning' | 'afternoon' | 'evening' | 'night',
    userId: string,
    options?: {
      busId?: string;
      location?: 'campground' | 'bus' | 'church';
      direction?: 'to-church' | 'to-campground';
      notes?: string;
    }
  ): Promise<void> {
    const dbSession = await mongoose.startSession();

    try {
      dbSession.startTransaction();

      const camper = await Camper.findOne({ _id: camperId, isDeleted: false }).session(dbSession);

      if (!camper) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
      }

      // Determine location and direction based on session if not provided
      let location = options?.location;
      let direction = options?.direction;
      let busId = options?.busId;

      if (session === CHECKIN_SESSIONS.MORNING) {
        location = location || CHECKIN_LOCATIONS.BUS;
        direction = direction || CHECKIN_DIRECTIONS.TO_CHURCH;
        if (!busId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'busId is required for morning session');
        }
      } else if (session === CHECKIN_SESSIONS.AFTERNOON) {
        location = location || CHECKIN_LOCATIONS.BUS;
        direction = direction || CHECKIN_DIRECTIONS.TO_CAMPGROUND;
        if (!busId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'busId is required for afternoon session');
        }
      } else if (session === CHECKIN_SESSIONS.EVENING) {
        location = location || CHECKIN_LOCATIONS.BUS;
        direction = direction || CHECKIN_DIRECTIONS.TO_CHURCH;
        if (!busId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'busId is required for evening session');
        }
      } else if (session === CHECKIN_SESSIONS.NIGHT) {
        location = location || CHECKIN_LOCATIONS.CAMPGROUND;
        // No direction for night session
        // busId not required for night session
      }

      // Check if camper already checked in for this session today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingCheckIn = await CheckInLog.findOne({
        camperId,
        session,
        timestamp: { $gte: today, $lt: tomorrow },
      }).session(dbSession);

      if (existingCheckIn) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          `Camper already checked in for ${session} session today`
        );
      }

      // Update camper status if needed (for overall status tracking)
      if (camper.status === CAMPER_STATUS.PENDING) {
        camper.status = CAMPER_STATUS.CHECKED_IN;
        camper.checkInTime = new Date();
      }
      camper.updatedBy = new mongoose.Types.ObjectId(userId);
      await camper.save({ session: dbSession });

      // Create check-in log
      await CheckInLog.create(
        [
          {
            camperId,
            action: CHECKIN_ACTIONS.CHECK_IN,
            session,
            busId,
            location,
            direction,
            timestamp: new Date(),
            performedBy: userId,
            roomId: camper.roomId,
            notes: options?.notes,
          },
        ],
        { session: dbSession }
      );

      await dbSession.commitTransaction();

      await cacheService.invalidate('stats:overview');

      logger.info('Camper checked in for session', { camperId, session, busId });
    } catch (error) {
      await dbSession.abortTransaction();
      throw error;
    } finally {
      dbSession.endSession();
    }
  }

  /**
   * Bulk check-in for multiple campers (typically for bus sessions)
   */
  async checkInMultiple(
    camperIds: string[],
    session: 'morning' | 'afternoon' | 'evening' | 'night',
    userId: string,
    options?: {
      busId?: string;
      location?: 'campground' | 'bus' | 'church';
      direction?: 'to-church' | 'to-campground';
      notes?: string;
    }
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const dbSession = await mongoose.startSession();
    const results = { success: 0, failed: 0, errors: [] as string[] };

    try {
      dbSession.startTransaction();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Determine location and direction based on session
      let location = options?.location;
      let direction = options?.direction;

      if (session === CHECKIN_SESSIONS.MORNING) {
        location = location || CHECKIN_LOCATIONS.BUS;
        direction = direction || CHECKIN_DIRECTIONS.TO_CHURCH;
        if (!options?.busId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'busId is required for morning session');
        }
      } else if (session === CHECKIN_SESSIONS.AFTERNOON) {
        location = location || CHECKIN_LOCATIONS.BUS;
        direction = direction || CHECKIN_DIRECTIONS.TO_CAMPGROUND;
        if (!options?.busId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'busId is required for afternoon session');
        }
      } else if (session === CHECKIN_SESSIONS.EVENING) {
        location = location || CHECKIN_LOCATIONS.BUS;
        direction = direction || CHECKIN_DIRECTIONS.TO_CHURCH;
        if (!options?.busId) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'busId is required for evening session');
        }
      } else if (session === CHECKIN_SESSIONS.NIGHT) {
        location = location || CHECKIN_LOCATIONS.CAMPGROUND;
      }

      // Get all campers
      const campers = await Camper.find({
        _id: { $in: camperIds },
        isDeleted: false,
      }).session(dbSession);

      // Get existing check-ins for today
      const existingCheckIns = await CheckInLog.find({
        camperId: { $in: camperIds },
        session,
        timestamp: { $gte: today, $lt: tomorrow },
      }).session(dbSession);

      const checkedInIds = new Set(existingCheckIns.map((log) => log.camperId.toString()));

      const logsToCreate: any[] = [];
      const campersToUpdate: typeof campers = [];

      for (const camper of campers) {
        const camperIdStr = camper._id.toString();

        if (checkedInIds.has(camperIdStr)) {
          results.failed++;
          results.errors.push(`Camper ${camper.firstName} ${camper.lastName} already checked in for ${session} session`);
          continue;
        }

        // Update camper status if needed
        if (camper.status === CAMPER_STATUS.PENDING) {
          camper.status = CAMPER_STATUS.CHECKED_IN;
          camper.checkInTime = new Date();
        }
        camper.updatedBy = new mongoose.Types.ObjectId(userId);
        campersToUpdate.push(camper);

        logsToCreate.push({
          camperId: camper._id,
          action: CHECKIN_ACTIONS.CHECK_IN,
          session,
          busId: options?.busId,
          location,
          direction,
          timestamp: new Date(),
          performedBy: userId,
          roomId: camper.roomId,
          notes: options?.notes,
        });
      }

      // Update campers (only those that were successfully checked in)
      for (const camper of campersToUpdate) {
        await camper.save({ session: dbSession });
      }

      // Create check-in logs
      if (logsToCreate.length > 0) {
        await CheckInLog.insertMany(logsToCreate, { session: dbSession });
        results.success = logsToCreate.length;
      }

      // Check for missing campers
      const foundIds = new Set(campers.map((c) => c._id.toString()));
      for (const id of camperIds) {
        if (!foundIds.has(id)) {
          results.failed++;
          results.errors.push(`Camper with ID ${id} not found`);
        }
      }

      await dbSession.commitTransaction();

      await cacheService.invalidate('stats:overview');

      logger.info('Bulk check-in completed', {
        session,
        busId: options?.busId,
        success: results.success,
        failed: results.failed,
      });
    } catch (error) {
      await dbSession.abortTransaction();
      throw error;
    } finally {
      dbSession.endSession();
    }

    return results;
  }

  /**
   * Check-in by phone number (for night session)
   */
  async checkInByPhoneNumber(
    phoneNumber: string,
    session: 'night',
    userId: string,
    options?: {
      notes?: string;
    }
  ): Promise<void> {
    const camper = await Camper.findOne({
      phone: phoneNumber,
      isDeleted: false,
    });

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Camper not found with this phone number');
    }

    await this.checkInSession(camper._id.toString(), session, userId, {
      location: CHECKIN_LOCATIONS.CAMPGROUND,
      notes: options?.notes,
    });
  }

  /**
   * Get camper by phone number
   */
  async getCamperByPhoneNumber(phoneNumber: string): Promise<any> {
    const camper = await Camper.findOne({
      phone: phoneNumber,
      isDeleted: false,
    })
      .select('firstName lastName email phone roomId status')
      .populate('roomId', 'roomNumber roomName');

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Camper not found with this phone number');
    }

    return camper;
  }

  /**
   * Verify bus tally - compare check-ins vs expected campers
   */
  async verifyBusTally(
    busId: string,
    session: 'morning' | 'afternoon' | 'evening',
    date?: Date
  ): Promise<{
    busId: string;
    session: string;
    date: Date;
    checkedInCount: number;
    checkedInCampers: any[];
  }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const checkIns = await CheckInLog.find({
      busId,
      session,
      timestamp: { $gte: startOfDay, $lt: endOfDay },
    })
      .populate('camperId', 'firstName lastName email phone roomId')
      .populate('roomId', 'roomNumber roomName')
      .sort({ timestamp: -1 });

    return {
      busId,
      session,
      date: startOfDay,
      checkedInCount: checkIns.length,
      checkedInCampers: checkIns.map((log) => ({
        camper: log.camperId,
        timestamp: log.timestamp,
        performedBy: log.performedBy,
      })),
    };
  }

  /**
   * Get camper's session status for a specific date
   */
  async getSessionStatus(camperId: string, date?: Date): Promise<{
    camperId: string;
    date: Date;
    sessions: {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
      night: boolean;
    };
    completedSessions: string[];
    missingSessions: string[];
  }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const checkIns = await CheckInLog.find({
      camperId,
      timestamp: { $gte: startOfDay, $lt: endOfDay },
    }).select('session');

    const completedSessions = new Set(
      checkIns
        .map((log) => log.session)
        .filter((session): session is 'morning' | 'afternoon' | 'evening' | 'night' => 
          session !== null && session !== undefined
        )
    );

    const sessions = {
      morning: completedSessions.has(CHECKIN_SESSIONS.MORNING),
      afternoon: completedSessions.has(CHECKIN_SESSIONS.AFTERNOON),
      evening: completedSessions.has(CHECKIN_SESSIONS.EVENING),
      night: completedSessions.has(CHECKIN_SESSIONS.NIGHT),
    };

    const allSessions = [
      CHECKIN_SESSIONS.MORNING,
      CHECKIN_SESSIONS.AFTERNOON,
      CHECKIN_SESSIONS.EVENING,
      CHECKIN_SESSIONS.NIGHT,
    ];
    const missingSessions = allSessions.filter((s) => !completedSessions.has(s));

    return {
      camperId,
      date: startOfDay,
      sessions,
      completedSessions: Array.from(completedSessions) as string[],
      missingSessions,
    };
  }

  /**
   * Get all check-ins for a bus session
   */
  async getBusCheckIns(
    busId: string,
    session: 'morning' | 'afternoon' | 'evening',
    date?: Date
  ): Promise<any[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const checkIns = await CheckInLog.find({
      busId,
      session,
      timestamp: { $gte: startOfDay, $lt: endOfDay },
    })
      .populate('camperId', 'firstName lastName email phone roomId status')
      .populate('performedBy', 'fullName email')
      .populate('roomId', 'roomNumber roomName')
      .sort({ timestamp: -1 });

    return checkIns;
  }

  /**
   * Get daily session summary
   */
  async getDailySessionSummary(date?: Date, performedBy?: string): Promise<{
    date: Date;
    sessions: {
      morning: { total: number; uniqueCampers: number };
      afternoon: { total: number; uniqueCampers: number };
      evening: { total: number; uniqueCampers: number };
      night: { total: number; uniqueCampers: number };
    };
    totalCheckIns: number;
    uniqueCampers: number;
  }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const query: any = {
      timestamp: { $gte: startOfDay, $lt: endOfDay },
      session: { $exists: true, $ne: null },
    };

    if (performedBy) {
      query.performedBy = performedBy;
    }

    const checkIns = await CheckInLog.find(query);

    const sessionStats = {
      morning: { total: 0, uniqueCampers: new Set<string>() },
      afternoon: { total: 0, uniqueCampers: new Set<string>() },
      evening: { total: 0, uniqueCampers: new Set<string>() },
      night: { total: 0, uniqueCampers: new Set<string>() },
    };

    const allCampers = new Set<string>();

    for (const checkIn of checkIns) {
      if (checkIn.session && checkIn.camperId) {
        const camperIdStr = checkIn.camperId.toString();
        allCampers.add(camperIdStr);

        if (checkIn.session === CHECKIN_SESSIONS.MORNING) {
          sessionStats.morning.total++;
          sessionStats.morning.uniqueCampers.add(camperIdStr);
        } else if (checkIn.session === CHECKIN_SESSIONS.AFTERNOON) {
          sessionStats.afternoon.total++;
          sessionStats.afternoon.uniqueCampers.add(camperIdStr);
        } else if (checkIn.session === CHECKIN_SESSIONS.EVENING) {
          sessionStats.evening.total++;
          sessionStats.evening.uniqueCampers.add(camperIdStr);
        } else if (checkIn.session === CHECKIN_SESSIONS.NIGHT) {
          sessionStats.night.total++;
          sessionStats.night.uniqueCampers.add(camperIdStr);
        }
      }
    }

    return {
      date: startOfDay,
      sessions: {
        morning: {
          total: sessionStats.morning.total,
          uniqueCampers: sessionStats.morning.uniqueCampers.size,
        },
        afternoon: {
          total: sessionStats.afternoon.total,
          uniqueCampers: sessionStats.afternoon.uniqueCampers.size,
        },
        evening: {
          total: sessionStats.evening.total,
          uniqueCampers: sessionStats.evening.uniqueCampers.size,
        },
        night: {
          total: sessionStats.night.total,
          uniqueCampers: sessionStats.night.uniqueCampers.size,
        },
      },
      totalCheckIns: checkIns.length,
      uniqueCampers: allCampers.size,
    };
  }
}

export default new CheckInService();
