import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRoom extends Document {
  roomNumber: string;
  roomName?: string;
  capacity: number;
  currentOccupancy: number;
  floor?: string;
  building?: string;
  leadId?: Types.ObjectId;
  assistantLeadId?: Types.ObjectId;
  camperIds: Types.ObjectId[];
  amenities?: string[];
  notes?: string;
  isActive: boolean;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    roomName: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      index: true,
    },
    currentOccupancy: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      index: true,
    },
    floor: {
      type: String,
      trim: true,
      index: true,
    },
    building: {
      type: String,
      trim: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Camper',
      index: true,
    },
    assistantLeadId: {
      type: Schema.Types.ObjectId,
      ref: 'Camper',
    },
    camperIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Camper',
      },
    ],
    amenities: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: {
      type: String,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes
roomSchema.index({ capacity: 1, currentOccupancy: 1, isActive: 1 });
roomSchema.index({ building: 1, floor: 1, roomNumber: 1 });

// Text index for search
roomSchema.index({
  roomNumber: 'text',
  roomName: 'text',
  building: 'text',
  floor: 'text',
});

// Validation: currentOccupancy cannot exceed capacity
roomSchema.pre('save', function (next) {
  if (this.currentOccupancy > this.capacity) {
    next(new Error('Current occupancy cannot exceed room capacity'));
  } else {
    next();
  }
});

export default mongoose.model<IRoom>('Room', roomSchema);

//checking