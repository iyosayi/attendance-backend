import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface ICamper extends Document {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  emergencyContact?: IEmergencyContact;
  roomId?: Types.ObjectId;
  status: 'pending' | 'checked-in' | 'checked-out';
  checkInTime?: Date;
  checkOutTime?: Date;
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const camperSchema = new Schema<ICamper>(
  {
    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 120,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'checked-in', 'checked-out'],
      default: 'pending',
      index: true,
    },
    checkInTime: {
      type: Date,
      index: true,
    },
    checkOutTime: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: 1000,
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
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for Performance
camperSchema.index({ firstName: 1, lastName: 1 });
camperSchema.index({ status: 1, isDeleted: 1 });
camperSchema.index({ roomId: 1, status: 1 });
camperSchema.index({ checkInTime: -1 });
camperSchema.index({ email: 1, isDeleted: 1 }, { unique: true });

// Text index for search
camperSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
});

export default mongoose.model<ICamper>('Camper', camperSchema);
