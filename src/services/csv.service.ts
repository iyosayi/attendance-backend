import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import Camper from '../models/Camper';
import Room from '../models/Room';
import logger from '../utils/logger';

class CSVService {
  async exportCampers(): Promise<string> {
    try {
      const campers = await Camper.find({ isDeleted: false })
        .populate('roomId', 'roomNumber roomName building floor')
        .lean();

      const fields = [
        'firstName',
        'lastName',
        'email',
        'phone',
        'age',
        'gender',
        'status',
        { label: 'Room Number', value: 'roomId.roomNumber' },
        { label: 'Room Name', value: 'roomId.roomName' },
        { label: 'Building', value: 'roomId.building' },
        { label: 'Floor', value: 'roomId.floor' },
        { label: 'Check In Time', value: 'checkInTime' },
        { label: 'Check Out Time', value: 'checkOutTime' },
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(campers);

      const fileName = `campers-export-${Date.now()}.csv`;
      const filePath = path.join(__dirname, '../../uploads', fileName);

      fs.writeFileSync(filePath, csv);

      logger.info('Campers exported to CSV', { fileName });

      return filePath;
    } catch (error) {
      logger.error('CSV export error:', error);
      throw error;
    }
  }

  async exportRooms(): Promise<string> {
    try {
      const rooms = await Room.find()
        .populate('leadId', 'firstName lastName')
        .populate('assistantLeadId', 'firstName lastName')
        .lean();

      const fields = [
        'roomNumber',
        'roomName',
        'capacity',
        'currentOccupancy',
        'building',
        'floor',
        { label: 'Lead Name', value: (row: any) => row.leadId ? `${row.leadId.firstName} ${row.leadId.lastName}` : '' },
        { label: 'Assistant Lead Name', value: (row: any) => row.assistantLeadId ? `${row.assistantLeadId.firstName} ${row.assistantLeadId.lastName}` : '' },
        'isActive',
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(rooms);

      const fileName = `rooms-export-${Date.now()}.csv`;
      const filePath = path.join(__dirname, '../../uploads', fileName);

      fs.writeFileSync(filePath, csv);

      logger.info('Rooms exported to CSV', { fileName });

      return filePath;
    } catch (error) {
      logger.error('CSV export error:', error);
      throw error;
    }
  }
}

export default new CSVService();
