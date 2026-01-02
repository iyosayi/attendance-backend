import roomService from '../../src/services/room.service';
import Room from '../../src/models/Room';
import Camper from '../../src/models/Camper';
import camperService from '../../src/services/camper.service';
import cacheService from '../../src/services/cache.service';

jest.mock('../../src/models/Room', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/models/Camper', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/services/camper.service', () => ({ __esModule: true, default: { createCamper: jest.fn() } }));
jest.mock('../../src/services/cache.service', () => ({ __esModule: true, default: { invalidate: jest.fn() } }));

describe('RoomService.bulkAssignToRoomNumber', () => {
  const userId = '507f1f77bcf86cd799439011';

  const roomId = '507f1f77bcf86cd799439012';
  const baseRoom = {
    _id: roomId,
    roomNumber: 'A-101',
    capacity: 4,
    currentOccupancy: 0,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    (Room as any).findOne = jest.fn();
    (Room as any).create = jest.fn();
    (Room as any).findByIdAndUpdate = jest.fn();

    (Camper as any).findById = jest.fn();

    (camperService as any).createCamper = jest.fn();
    (cacheService as any).invalidate = jest.fn();
  });

  it('creates room if missing, assigns existing campers, creates new campers, and returns errors for failures', async () => {
    // Room missing -> create
    (Room as any).findOne.mockResolvedValueOnce(null);
    (Room as any).create.mockResolvedValueOnce({ ...baseRoom, capacity: 2 });

    // Capacity update to 3
    (Room as any).findByIdAndUpdate.mockResolvedValueOnce({ ...baseRoom, capacity: 3 });

    const assignSpy = jest
      .spyOn(roomService as any, 'assignCamperToRoom')
      .mockResolvedValueOnce({} as any) // existing camper ok
      .mockRejectedValueOnce(new Error('Camper already assigned')) // existing camper fail
      .mockResolvedValueOnce({} as any) // new camper assign ok
      .mockRejectedValueOnce(new Error('Room is full')); // new camper assign fail

    // Camper lookup for assigned existing camper
    (Camper as any).findById.mockResolvedValueOnce({ _id: '507f1f77bcf86cd799439013', firstName: 'Old', lastName: 'Camper' });

    // Create 2 new campers
    (camperService as any).createCamper
      .mockResolvedValueOnce({ _id: '507f1f77bcf86cd799439014', firstName: 'New', lastName: 'One' })
      .mockResolvedValueOnce({ _id: '507f1f77bcf86cd799439015', firstName: 'New', lastName: 'Two' });

    // Refetch assigned new camper
    (Camper as any).findById.mockResolvedValueOnce({ _id: '507f1f77bcf86cd799439014', firstName: 'New', lastName: 'One' });

    const result = await roomService.bulkAssignToRoomNumber(
      {
        roomNumber: 'A-101',
        maxCapacity: 3,
        existingCamperIds: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439016'],
        newCampers: [
          { firstName: 'New', lastName: 'One', phone: '123', state: 'Delta', gender: 'Male' },
          { firstName: 'New', lastName: 'Two', phone: '456', state: 'Delta', gender: 'Female' },
        ],
      },
      userId
    );

    expect((Room as any).create).toHaveBeenCalledTimes(1);
    expect((Room as any).findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledTimes(4);

    expect(result.room).toEqual({ id: 'A-101', roomNumber: 'A-101', capacity: 3 });
    expect(result.createdCampers).toHaveLength(2);
    expect(result.assignedCampers).toHaveLength(2);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'existing', camperId: '507f1f77bcf86cd799439016', message: 'Camper already assigned' }),
        expect.objectContaining({ type: 'new', inputIndex: 1, camperId: '507f1f77bcf86cd799439015', message: 'Room is full' }),
      ])
    );

    expect((cacheService as any).invalidate).toHaveBeenCalledWith(`room:${roomId}`);
    expect((cacheService as any).invalidate).toHaveBeenCalledWith('stats:overview');
  });

  it('throws 400 if maxCapacity is less than current occupancy', async () => {
    (Room as any).findOne.mockResolvedValueOnce({ ...baseRoom, currentOccupancy: 5, capacity: 5 });

    await expect(
      roomService.bulkAssignToRoomNumber(
        { roomNumber: 'A-101', maxCapacity: 4, existingCamperIds: [], newCampers: [] },
        userId
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});


