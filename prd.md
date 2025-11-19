# Camp Attendance Management System - Backend API Specification

## Project Overview
A high-performance, scalable REST API built with Node.js, Express, and MongoDB for managing camp attendance, room assignments, and camper information. The system is designed with robust concurrency controls to prevent race conditions, particularly during simultaneous room allocations.

---

## Tech Stack

### Core Technologies
- **Runtime**: Node.js 20+ LTS
- **Framework**: Express.js 4.x
- **Database**: MongoDB 7.x (with Replica Set for transactions)
- **ODM**: Mongoose 8.x
- **Language**: TypeScript 5.x

### Security & Authentication
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Rate Limiting**: express-rate-limit
- **Security Headers**: helmet
- **CORS**: cors middleware
- **Input Validation**: Joi or Zod
- **File Upload Security**: multer with file type validation

### Performance & Optimization
- **Caching**: Redis (for sessions, frequent queries)
- **Query Optimization**: MongoDB indexes, aggregation pipelines
- **Connection Pooling**: Mongoose built-in pooling
- **Compression**: compression middleware
- **Request Logging**: morgan + winston

### File Processing
- **CSV Parsing**: csv-parser, fast-csv
- **CSV Generation**: json2csv
- **File Upload**: multer
- **Stream Processing**: Node.js streams for large files

### Development & Testing
- **Testing**: Jest + Supertest
- **API Documentation**: Swagger/OpenAPI
- **Environment**: dotenv
- **Process Management**: PM2 (production)
- **Code Quality**: ESLint, Prettier

### Monitoring & Logging
- **Logging**: winston with daily rotate
- **Monitoring**: Optional - New Relic, DataDog
- **Health Checks**: express-healthcheck

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── jwt.ts
│   │   └── index.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Camper.ts
│   │   ├── Room.ts
│   │   └── CheckInLog.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── camper.controller.ts
│   │   ├── room.controller.ts
│   │   ├── checkin.controller.ts
│   │   └── export.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── camper.service.ts
│   │   ├── room.service.ts
│   │   ├── checkin.service.ts
│   │   ├── csv.service.ts
│   │   └── cache.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── upload.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── camper.routes.ts
│   │   ├── room.routes.ts
│   │   ├── checkin.routes.ts
│   │   ├── stats.routes.ts
│   │   └── index.ts
│   ├── validators/
│   │   ├── camper.validator.ts
│   │   ├── room.validator.ts
│   │   └── auth.validator.ts
│   ├── utils/
│   │   ├── ApiError.ts
│   │   ├── ApiResponse.ts
│   │   ├── logger.ts
│   │   ├── asyncHandler.ts
│   │   └── helpers.ts
│   ├── types/
│   │   ├── express.d.ts
│   │   └── index.ts
│   ├── constants/
│   │   └── index.ts
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── uploads/ (temporary storage)
├── logs/
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## Database Schema Design

### Users Collection
```typescript
import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  username: string;
  email: string;
  password: string; // hashed
  fullName: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // Don't return password by default
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ username: 1, isActive: 1 });

export default mongoose.model<IUser>('User', userSchema);
```

### Campers Collection
```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

interface ICamper extends Document {
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
  isDeleted: boolean; // Soft delete
}

const camperSchema = new Schema<ICamper>(
  {
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
```

### Rooms Collection
```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

interface IRoom extends Document {
  roomNumber: string;
  roomName?: string;
  capacity: number;
  currentOccupancy: number; // CRITICAL for concurrency control
  floor?: string;
  building?: string;
  leadId?: Types.ObjectId;
  assistantLeadId?: Types.ObjectId;
  camperIds: Types.ObjectId[];
  amenities?: string[];
  notes?: string;
  isActive: boolean;
  version: number; // For optimistic locking
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

// Validation: currentOccupancy cannot exceed capacity
roomSchema.pre('save', function (next) {
  if (this.currentOccupancy > this.capacity) {
    next(new Error('Current occupancy cannot exceed room capacity'));
  } else {
    next();
  }
});

export default mongoose.model<IRoom>('Room', roomSchema);
```

### CheckInLogs Collection (Audit Trail)
```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

interface ICheckInLog extends Document {
  camperId: Types.ObjectId;
  action: 'check-in' | 'check-out';
  timestamp: Date;
  performedBy: Types.ObjectId;
  roomId?: Types.ObjectId;
  notes?: string;
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

// Compound index for queries
checkInLogSchema.index({ camperId: 1, timestamp: -1 });
checkInLogSchema.index({ action: 1, timestamp: -1 });

export default mongoose.model<ICheckInLog>('CheckInLog', checkInLogSchema);
```

---

## Concurrency Control Strategy

### Problem: Race Conditions in Room Allocation

**Scenario**: Two staff members simultaneously try to assign the last available spot in a room to different campers.

**Without Concurrency Control**:
```
Time    Staff A                          Staff B
----    -------------------------------- --------------------------------
T1      GET room (capacity: 4, occ: 3)   
T2                                       GET room (capacity: 4, occ: 3)
T3      Check: 3 < 4 ✓ (has space)       
T4                                       Check: 3 < 4 ✓ (has space)
T5      UPDATE occ to 4                  
T6                                       UPDATE occ to 4
T7      Room now has 5 campers! ❌
```

### Solution: Multi-Layered Concurrency Control

#### Strategy 1: Atomic Operations with Conditions (PRIMARY)
```typescript
// room.service.ts

async assignCamperToRoom(
  camperId: string,
  roomId: string,
  role: 'camper' | 'lead' | 'assistant',
  userId: string
): Promise<void> {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Step 1: Find camper and verify not already assigned
    const camper = await Camper.findById(camperId).session(session);
    if (!camper) {
      throw new ApiError(404, 'Camper not found');
    }
    if (camper.roomId) {
      throw new ApiError(400, 'Camper already assigned to a room');
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
      throw new ApiError(409, 'Room is full or not available. Please try another room.');
    }

    // Step 4: Update camper record
    await Camper.findByIdAndUpdate(
      camperId,
      {
        roomId: roomId,
        updatedBy: userId,
      },
      { session }
    );

    // Step 5: Commit transaction
    await session.commitTransaction();

    // Step 6: Invalidate cache
    await cacheService.invalidate(`room:${roomId}`);
    await cacheService.invalidate('stats:overview');

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

#### Strategy 2: Optimistic Locking (SECONDARY)
```typescript
// Alternative approach using version field

async assignCamperToRoomOptimistic(
  camperId: string,
  roomId: string,
  role: 'camper' | 'lead' | 'assistant',
  userId: string,
  maxRetries: number = 3
): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Get current room state with version
      const room = await Room.findById(roomId).session(session);
      if (!room) {
        throw new ApiError(404, 'Room not found');
      }

      // Check capacity
      if (room.currentOccupancy >= room.capacity) {
        throw new ApiError(409, 'Room is at full capacity');
      }

      // Store current version
      const currentVersion = room.version;

      // Update with version check (optimistic locking)
      const updateResult = await Room.updateOne(
        {
          _id: roomId,
          version: currentVersion, // Only update if version hasn't changed
          isActive: true,
          $expr: { $lt: ['$currentOccupancy', '$capacity'] },
        },
        {
          $inc: { currentOccupancy: 1, version: 1 },
          $push: { camperIds: camperId },
          $set: {
            ...(role === 'lead' && { leadId: camperId }),
            ...(role === 'assistant' && { assistantLeadId: camperId }),
            updatedBy: userId,
          },
        },
        { session }
      );

      // Check if update was applied
      if (updateResult.modifiedCount === 0) {
        // Version conflict - retry
        throw new Error('VERSION_CONFLICT');
      }

      // Update camper
      await Camper.findByIdAndUpdate(
        camperId,
        { roomId, updatedBy: userId },
        { session }
      );

      await session.commitTransaction();
      
      // Success - break retry loop
      return;

    } catch (error: any) {
      await session.abortTransaction();
      
      if (error.message === 'VERSION_CONFLICT' && retries < maxRetries - 1) {
        retries++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries)));
        continue;
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }

  throw new ApiError(409, 'Failed to assign room due to concurrent updates. Please try again.');
}
```

#### Strategy 3: Redis Distributed Lock (OPTIONAL - for high concurrency)
```typescript
import Redis from 'ioredis';
import Redlock from 'redlock';

const redis = new Redis(process.env.REDIS_URL);
const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 200,
});

async assignCamperToRoomWithLock(
  camperId: string,
  roomId: string,
  role: 'camper' | 'lead' | 'assistant',
  userId: string
): Promise<void> {
  const lockKey = `lock:room:${roomId}`;
  const ttl = 5000; // 5 seconds

  let lock;
  try {
    // Acquire distributed lock
    lock = await redlock.acquire([lockKey], ttl);

    // Now we have exclusive access to this room
    const room = await Room.findById(roomId);
    if (!room) {
      throw new ApiError(404, 'Room not found');
    }

    if (room.currentOccupancy >= room.capacity) {
      throw new ApiError(409, 'Room is at full capacity');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update room
      await Room.findByIdAndUpdate(
        roomId,
        {
          $inc: { currentOccupancy: 1 },
          $push: { camperIds: camperId },
          $set: {
            ...(role === 'lead' && { leadId: camperId }),
            ...(role === 'assistant' && { assistantLeadId: camperId }),
            updatedBy: userId,
          },
        },
        { session }
      );

      // Update camper
      await Camper.findByIdAndUpdate(
        camperId,
        { roomId, updatedBy: userId },
        { session }
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } finally {
    // Always release the lock
    if (lock) {
      await lock.release();
    }
  }
}
```

### Recommended Approach
**Use Strategy 1 (Atomic Operations with Conditions)** as the primary method:
- Most performant
- No additional dependencies
- Native MongoDB support
- Works well for moderate concurrency

**Add Strategy 2 (Optimistic Locking)** for critical sections:
- Better for high-read, low-write scenarios
- Good for version tracking
- Automatic retry logic

**Consider Strategy 3 (Distributed Lock)** only if:
- Extremely high concurrency (100+ simultaneous requests)
- Multi-server deployment
- Need guaranteed serialization

---

## API Endpoints

[View the complete document for all endpoints - Authentication, Campers, Rooms, Check-in/out, Stats, Export, etc.]

### Key Endpoint Example: Room Assignment (with Concurrency Control)

#### POST /api/v1/rooms/:roomId/assign
**Description**: Assign camper to room (WITH CONCURRENCY CONTROL)

**Request Body**:
```json
{
  "camperId": "507f1f77bcf86cd799439013",
  "role": "camper"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Camper assigned to room successfully",
  "data": {
    "room": {
      "id": "507f1f77bcf86cd799439012",
      "roomNumber": "101",
      "currentOccupancy": 3,
      "capacity": 4,
      "availableSpots": 1
    }
  }
}
```

**Error Response** (409 - Conflict):
```json
{
  "success": false,
  "message": "Room is full or not available. Please try another room.",
  "error": {
    "code": "ROOM_FULL"
  }
}
```

---

## Performance Optimization

### 1. Database Indexing
- Compound indexes on frequently queried fields
- Text indexes for search
- Query optimization with `lean()` and `select()`

### 2. Redis Caching
- Stats: 2 minutes TTL
- Room details: 5 minutes TTL
- Cache invalidation on updates

### 3. Streaming for Large Exports
- Handle 100,000+ records
- Constant memory usage
- Uses MongoDB cursors

### 4. Connection Pooling
- Max 10 connections
- Min 2 connections
- Optimal for production load

---

## Environment Variables

```bash
# Server
NODE_ENV=production
PORT=5000

# Database (Replica Set for transactions)
MONGODB_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/camp-attendance?replicaSet=rs0

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=24h

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

---

## Testing Strategy

- **Unit Tests**: Service layer with mocked dependencies
- **Integration Tests**: End-to-end API testing
- **Concurrency Tests**: Verify race condition prevention
- **Load Tests**: Performance benchmarking

---

## Deployment Checklist

### Pre-Deployment
- [ ] MongoDB replica set configured
- [ ] Redis server running
- [ ] All tests passing
- [ ] Environment variables set
- [ ] SSL certificates ready

### Production
- [ ] NODE_ENV=production
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Monitoring tools set up
- [ ] Database backups configured

---

## Performance Benchmarks

| Endpoint | Target Response Time | Concurrent Users |
|----------|---------------------|------------------|
| GET /campers | < 100ms | 50 |
| POST /rooms/assign | < 200ms | 20 |
| GET /stats/overview | < 50ms (cached) | 100 |
| GET /export/campers | < 3s for 10k records | 5 |

---

## Key Success Factors

1. ✅ **Concurrency Handled**: Atomic operations prevent race conditions
2. ✅ **Performance Optimized**: Indexing, caching, streaming
3. ✅ **Scalable**: Ready for high traffic
4. ✅ **Secure**: JWT auth, rate limiting, validation
5. ✅ **Production-Ready**: Logging, monitoring, error handling

---

**This backend specification ensures your camp attendance system can handle concurrent room allocations without race conditions while maintaining high performance!** 🚀