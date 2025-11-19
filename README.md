# Camp Attendance Management System - Backend API

A high-performance, scalable REST API built with Node.js, Express, TypeScript, and MongoDB for managing camp attendance, room assignments, and camper information. Features robust concurrency controls to prevent race conditions during simultaneous room allocations.

## Features

- **Secure Authentication** - JWT-based authentication with role-based access control
- **Camper Management** - Full CRUD operations for camper records
- **Room Management** - Room allocation with atomic operations to prevent race conditions
- **Check-in/Check-out** - Track camper attendance with audit logs
- **Statistics** - Real-time overview of camp occupancy and statistics
- **Data Export** - CSV export functionality for campers and rooms
- **Caching** - Redis caching for improved performance
- **Concurrency Control** - Atomic operations with MongoDB transactions

## Tech Stack

- **Runtime**: Node.js 20+ LTS
- **Framework**: Express.js 4.x
- **Database**: MongoDB 7.x (with Replica Set for transactions)
- **ODM**: Mongoose 8.x
- **Language**: TypeScript 5.x
- **Caching**: Redis
- **Authentication**: JWT
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js 20+ and npm
- MongoDB 7.x (with replica set for transactions)
- Redis

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd attendance-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/camp-attendance
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## MongoDB Replica Set Setup (Required for Transactions)

For local development, you need to set up MongoDB as a replica set:

```bash
# Start MongoDB as a replica set
mongod --replSet rs0 --port 27017 --dbpath /data/db1

# In another terminal, initiate the replica set
mongosh
> rs.initiate()
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Run Tests
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/password` - Update password

### Campers
- `POST /api/v1/campers` - Create camper
- `GET /api/v1/campers` - Get all campers (with pagination & filters)
- `GET /api/v1/campers/:id` - Get camper by ID
- `PUT /api/v1/campers/:id` - Update camper
- `DELETE /api/v1/campers/:id` - Delete camper (admin only)

### Rooms
- `POST /api/v1/rooms` - Create room (admin only)
- `GET /api/v1/rooms` - Get all rooms (with pagination & filters)
- `GET /api/v1/rooms/available` - Get available rooms
- `GET /api/v1/rooms/:id` - Get room by ID
- `PUT /api/v1/rooms/:id` - Update room (admin only)
- `POST /api/v1/rooms/:id/assign` - Assign camper to room (with concurrency control)
- `POST /api/v1/rooms/:id/remove` - Remove camper from room
- `DELETE /api/v1/rooms/:id` - Delete room (admin only)

### Check-in/Check-out
- `POST /api/v1/checkin/:camperId/in` - Check in camper
- `POST /api/v1/checkin/:camperId/out` - Check out camper
- `GET /api/v1/checkin/:camperId/logs` - Get check-in logs

### Statistics
- `GET /api/v1/stats/overview` - Get overview statistics (cached)

### Export
- `GET /api/v1/export/campers` - Export campers to CSV
- `GET /api/v1/export/rooms` - Export rooms to CSV

## Concurrency Control

The system implements **atomic operations with conditions** to prevent race conditions during room assignments:

```typescript
// Atomic update with condition check
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
    // ... other updates
  },
  { new: true, session, runValidators: true }
);
```

This ensures that:
- Multiple simultaneous requests cannot over-allocate rooms
- Room capacity is never exceeded
- All updates are transactional

## Project Structure

```
src/
├── config/          # Configuration files (database, redis, jwt)
├── models/          # Mongoose models
├── controllers/     # Request handlers
├── services/        # Business logic
├── middleware/      # Express middleware
├── routes/          # API routes
├── validators/      # Joi validation schemas
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
├── constants/       # Application constants
├── app.ts           # Express app setup
└── server.ts        # Server entry point
```

## Environment Variables

See `.env.example` for all available configuration options.

## Performance Optimizations

- **Database Indexing** - Compound indexes on frequently queried fields
- **Redis Caching** - Caching for statistics and frequently accessed data
- **Connection Pooling** - Optimized MongoDB connection pool
- **Compression** - Response compression middleware
- **Rate Limiting** - Protection against abuse

## Security Features

- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing configuration
- **JWT** - JSON Web Token authentication
- **bcrypt** - Password hashing
- **Rate Limiting** - Request rate limiting
- **Input Validation** - Joi schema validation
- **File Upload Security** - File type and size validation

## Logging

Logs are stored in the `logs/` directory:
- `error-*.log` - Error logs
- `combined-*.log` - All logs
- `exceptions-*.log` - Uncaught exceptions
- `rejections-*.log` - Unhandled promise rejections

## License

MIT

## Author

Your Name
