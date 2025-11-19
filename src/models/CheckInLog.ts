import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICheckInLog extends Document {
  camperId: Types.ObjectId;
  action: 'check-in' | 'check-out'; // Kept for backward compatibility
  session?: 'morning' | 'afternoon' | 'evening' | 'night';
  busId?: string; // Bus identifier (e.g., "Bus-1", "Bus-A")
  location?: 'campground' | 'bus' | 'church';
  direction?: 'to-church' | 'to-campground';
  timestamp: Date;
  performedBy: Types.ObjectId;
  roomId?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const checkInLogSchema = new Schema<ICheckInLog>(
  {
    camperId: {
      type: Schema.Types.ObjectId,
      ref: 'Camper',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['check-in', 'check-out'],
      required: true,
      index: true,
    },
    session: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
      index: true,
    },
    busId: {
      type: String,
      trim: true,
      index: true,
    },
    location: {
      type: String,
      enum: ['campground', 'bus', 'church'],
      index: true,
    },
    direction: {
      type: String,
      enum: ['to-church', 'to-campground'],
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for queries
checkInLogSchema.index({ camperId: 1, timestamp: -1 });
checkInLogSchema.index({ action: 1, timestamp: -1 });
checkInLogSchema.index({ session: 1, timestamp: -1 });
checkInLogSchema.index({ busId: 1, session: 1, timestamp: -1 });
checkInLogSchema.index({ camperId: 1, session: 1, timestamp: -1 });

export default mongoose.model<ICheckInLog>('CheckInLog', checkInLogSchema);
