import camperService from '../../src/services/camper.service';
import Room from '../../src/models/Room';
import Camper from '../../src/models/Camper';
import User from '../../src/models/User';
import cacheService from '../../src/services/cache.service';
import mongoose from 'mongoose';

jest.mock('mongoose', () => ({ __esModule: true, default: { startSession: jest.fn() } }));
jest.mock('../../src/models/Room', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/models/Camper', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/models/User', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/services/cache.service', () => ({ __esModule: true, default: { invalidate: jest.fn() } }));

describe('CamperService.updateCamper (room occupancy sync)', () => {
  const userId = '507f1f77bcf86cd799439011';
  const camperId = '507f1f77bcf86cd799439012';
  const oldRoomId = '507f1f77bcf86cd799439013';
  const newRoomId = '507f1f77bcf86cd799439014';

  const fakeSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    (mongoose as any).startSession = jest.fn().mockResolvedValue(fakeSession);

    (Room as any).findOne = jest.fn();
    (Room as any).findOneAndUpdate = jest.fn();

    (Camper as any).findOne = jest.fn();
    (Camper as any).findOneAndUpdate = jest.fn();

    (User as any).findOne = jest.fn();

    (cacheService as any).invalidate = jest.fn();
  });

  it('decrements old room and increments new room when roomId changes', async () => {
    const currentCamper = { _id: camperId, status: 'pending', isDeleted: false };
    const camperInTx = { _id: camperId, status: 'pending', isDeleted: false };

    const oldRoom = { _id: oldRoomId, isActive: true };
    const newRoom = { _id: newRoomId, isActive: true, roomNumber: 'A-101' };

    // initial read (outside tx)
    (Camper as any).findOne.mockResolvedValueOnce(currentCamper);
    // tx read (uses .session)
    (Camper as any).findOne.mockReturnValueOnce({
      session: jest.fn().mockResolvedValue(camperInTx),
    });

    // tx room lookups: current room by camperIds, then destination room by identifier
    (Room as any).findOne
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(oldRoom) })
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(newRoom) });

    // increment destination, then decrement source
    (Room as any).findOneAndUpdate
      .mockResolvedValueOnce({ ...newRoom, currentOccupancy: 1 })
      .mockResolvedValueOnce({ ...oldRoom, currentOccupancy: 0 });

    (Camper as any).findOneAndUpdate.mockResolvedValueOnce({
      _id: camperId,
      status: 'pending',
      roomId: 'A-101',
    });

    const updated = await camperService.updateCamper(camperId, { roomId: newRoomId } as any, userId);

    // Destination increment
    expect((Room as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        _id: newRoomId,
        isActive: true,
        $expr: { $lt: ['$currentOccupancy', '$capacity'] },
      }),
      expect.objectContaining({
        $inc: { currentOccupancy: 1, version: 1 },
      }),
      expect.objectContaining({ session: fakeSession })
    );

    // Source decrement
    expect((Room as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        _id: oldRoomId,
        $expr: { $gte: ['$currentOccupancy', 1] },
      }),
      expect.objectContaining({
        $inc: { currentOccupancy: -1 },
      }),
      expect.objectContaining({ session: fakeSession })
    );

    // Camper stores roomNumber (not mongo room _id)
    expect(updated.roomId).toBe('A-101');

    expect((cacheService as any).invalidate).toHaveBeenCalledWith(`room:${oldRoomId}`);
    expect((cacheService as any).invalidate).toHaveBeenCalledWith(`room:${newRoomId}`);
    expect((cacheService as any).invalidate).toHaveBeenCalledWith('stats:overview');

    expect(fakeSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(fakeSession.abortTransaction).toHaveBeenCalledTimes(0);
  });

  it('blocks assignment when the destination room is full (no changes applied)', async () => {
    const currentCamper = { _id: camperId, status: 'pending', isDeleted: false };
    const camperInTx = { _id: camperId, status: 'pending', isDeleted: false };

    const oldRoom = { _id: oldRoomId, isActive: true };
    const newRoom = { _id: newRoomId, isActive: true, roomNumber: 'A-101' };

    (Camper as any).findOne.mockResolvedValueOnce(currentCamper);
    (Camper as any).findOne.mockReturnValueOnce({
      session: jest.fn().mockResolvedValue(camperInTx),
    });

    (Room as any).findOne
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(oldRoom) })
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(newRoom) });

    // Destination increment fails due to capacity guard
    (Room as any).findOneAndUpdate.mockResolvedValueOnce(null);

    await expect(
      camperService.updateCamper(camperId, { roomId: newRoomId } as any, userId)
    ).rejects.toMatchObject({ statusCode: 409, message: 'ROOM_FULL' });

    // No camper update, no cache invalidations after failure
    expect((Camper as any).findOneAndUpdate).not.toHaveBeenCalled();
    expect((cacheService as any).invalidate).not.toHaveBeenCalled();

    expect(fakeSession.commitTransaction).toHaveBeenCalledTimes(0);
    expect(fakeSession.abortTransaction).toHaveBeenCalledTimes(1);
  });
});


