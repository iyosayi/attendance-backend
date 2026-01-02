import camperService from '../../src/services/camper.service';
import Room from '../../src/models/Room';
import Camper from '../../src/models/Camper';
import cacheService from '../../src/services/cache.service';
import mongoose from 'mongoose';

jest.mock('mongoose', () => ({ __esModule: true, default: { startSession: jest.fn() } }));
jest.mock('../../src/models/Room', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/models/Camper', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/services/cache.service', () => ({ __esModule: true, default: { invalidate: jest.fn() } }));

describe('CamperService.createCamper (room occupancy sync)', () => {
  const userId = '507f1f77bcf86cd799439011';
  const roomId = '507f1f77bcf86cd799439012';

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

    (Camper as any).create = jest.fn();
    (Camper as any).findByIdAndUpdate = jest.fn();

    (cacheService as any).invalidate = jest.fn();
  });

  it('increments destination room occupancy and stores roomNumber on camper when roomId is provided', async () => {
    // Camper.create([payload], { session }) returns array docs
    (Camper as any).create.mockResolvedValueOnce([
      { _id: '507f1f77bcf86cd799439099', email: 'test@example.com' },
    ]);

    // Resolve room by identifier (via findOne(...).session(session))
    (Room as any).findOne.mockReturnValueOnce({
      session: jest.fn().mockResolvedValue({ _id: roomId, isActive: true }),
    });

    // Capacity guarded increment
    (Room as any).findOneAndUpdate.mockResolvedValueOnce({
      _id: roomId,
      roomNumber: 'A-101',
      currentOccupancy: 1,
    });

    // Update camper to store roomNumber
    (Camper as any).findByIdAndUpdate.mockResolvedValueOnce({
      _id: '507f1f77bcf86cd799439099',
      roomId: 'A-101',
    });

    const camper = await camperService.createCamper(
      {
        firstName: 'Test',
        lastName: 'User',
        phone: '123',
        state: 'Delta',
        gender: 'Male',
        isCamping: true,
        roomId,
      } as any,
      userId
    );

    expect((Room as any).findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: roomId,
        $expr: { $lt: ['$currentOccupancy', '$capacity'] },
      }),
      expect.objectContaining({
        $inc: { currentOccupancy: 1, version: 1 },
      }),
      expect.objectContaining({ session: fakeSession })
    );

    expect(camper.roomId).toBe('A-101');
    expect((cacheService as any).invalidate).toHaveBeenCalledWith(`room:${roomId}`);
    expect((cacheService as any).invalidate).toHaveBeenCalledWith('stats:overview');
    expect(fakeSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(fakeSession.abortTransaction).toHaveBeenCalledTimes(0);
  });

  it('blocks registration assignment when room is full', async () => {
    (Camper as any).create.mockResolvedValueOnce([
      { _id: '507f1f77bcf86cd799439099', email: 'test@example.com' },
    ]);

    (Room as any).findOne.mockReturnValueOnce({
      session: jest.fn().mockResolvedValue({ _id: roomId, isActive: true }),
    });

    // Capacity guarded increment fails
    (Room as any).findOneAndUpdate.mockResolvedValueOnce(null);

    await expect(
      camperService.createCamper(
        {
          firstName: 'Test',
          lastName: 'User',
          phone: '123',
          state: 'Delta',
          gender: 'Male',
          isCamping: true,
          roomId,
        } as any,
        userId
      )
    ).rejects.toMatchObject({ statusCode: 409, message: 'ROOM_FULL' });

    expect((Camper as any).findByIdAndUpdate).not.toHaveBeenCalled();
    expect((cacheService as any).invalidate).not.toHaveBeenCalled();
    expect(fakeSession.commitTransaction).toHaveBeenCalledTimes(0);
    expect(fakeSession.abortTransaction).toHaveBeenCalledTimes(1);
  });
});


