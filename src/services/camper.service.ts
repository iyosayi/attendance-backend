import Camper, { ICamper } from '../models/Camper';
import ApiError from '../utils/ApiError';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import logger from '../utils/logger';

class CamperService {
  async createCamper(camperData: Partial<ICamper>, userId: string): Promise<ICamper> {
    const camper = await Camper.create({
      ...camperData,
      createdBy: userId,
      updatedBy: userId,
    });

    logger.info('Camper created', { camperId: camper._id, email: camper.email });

    return camper;
  }

  async getCamperById(camperId: string): Promise<ICamper> {
    const camper = await Camper.findOne({ _id: camperId, isDeleted: false })
      .populate('roomId', 'roomNumber roomName building floor')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
    }

    return camper;
  }

  async getAllCampers(filters: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{ campers: ICamper[]; total: number; page: number; totalPages: number }> {
    const query: any = { isDeleted: false };
    // if (filters.status) query.status = filters.status;
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
      .populate('roomId', 'roomNumber roomName')
      .sort({ createdAt: -1 });

    // Only apply skip/limit if not searching
    if (!isSearching) {
      camperQuery.skip(skip).limit(limit);
    }

    const [campers, total] = await Promise.all([
      camperQuery,
      Camper.countDocuments(query),
    ]);

    return {
      campers,
      total,
      page,
      totalPages: isSearching ? 1 : Math.ceil(total / limit),
    };
  }

  async updateCamper(
    camperId: string,
    updateData: Partial<ICamper>,
    userId: string
  ): Promise<ICamper> {
    const camper = await Camper.findOneAndUpdate(
      { _id: camperId, isDeleted: false },
      {
        ...updateData,
        updatedBy: userId,
      },
      { new: true, runValidators: true }
    );

    if (!camper) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.CAMPER_NOT_FOUND);
    }

    logger.info('Camper updated', { camperId: camper._id });

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
      .populate('roomId', 'roomNumber roomName')
      .sort({ createdAt: -1 });

    return campers;
  }
}

export default new CamperService();
