import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Parser } from 'json2csv';
import CheckInLog from '../src/models/CheckInLog';
import User from '../src/models/User';
// Import models needed for Mongoose populate (registration required for populate to work)
import Camper from '../src/models/Camper';
import Room from '../src/models/Room';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

// Target emails to filter by
const TARGET_EMAILS = [
  'judith@helplinenation.org',
  'george@helplinenation.org',
  'godsent@helplinenation.org',
  'dessy@helplinenation.org', // Note: typo in original (helplination vs helplinenation)
];

const filterCheckInLogByEmails = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);

    logger.info('Connected to MongoDB');
    console.log('\n✅ Connected to MongoDB\n');

    // Step 1: Find users by email addresses
    console.log('🔍 Finding users by email addresses...');
    const targetEmailsLower = TARGET_EMAILS.map((email) => email.toLowerCase().trim());
    
    const users = await User.find({
      email: { $in: targetEmailsLower },
      isActive: true,
    }).lean();

    console.log(`   Found ${users.length} user(s) with matching emails:\n`);
    users.forEach((user) => {
      console.log(`   - ${user.fullName} (${user.email})`);
    });
    console.log('');

    if (users.length === 0) {
      console.log('⚠️  No users found with the provided emails. Exiting...\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Check for emails that weren't found
    const foundEmails = new Set(users.map((u) => u.email));
    const missingEmails = targetEmailsLower.filter((email) => !foundEmails.has(email));
    if (missingEmails.length > 0) {
      console.log('⚠️  Warning: The following emails were not found in the database:');
      missingEmails.forEach((email) => {
        console.log(`   - ${email}`);
      });
      console.log('');
    }

    // Step 2: Get user IDs
    const userIds = users.map((user) => user._id);
    console.log(`📋 Using ${userIds.length} user ID(s) to filter check-in logs...\n`);

    // Step 3: Query check-in logs
    console.log('📊 Querying check-in logs...');
    // Reference models to ensure they're registered (required for populate)
    if (false) {
      void Camper;
      void Room;
    }
    const checkInLogs = await CheckInLog.find({
      performedBy: { $in: userIds },
    })
      .populate('performedBy', 'fullName email')
      .populate('camperId', 'firstName lastName email phone')
      .populate('roomId', 'roomNumber roomName')
      .sort({ timestamp: -1 })
      .lean();

    console.log(`   Found ${checkInLogs.length} check-in log record(s)\n`);

    if (checkInLogs.length === 0) {
      console.log('ℹ️  No check-in log records found for the specified users.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Step 4: Generate summary statistics
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY - FILTERED CHECK-IN LOGS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('TARGET EMAILS:');
    console.log('───────────────────────────────────────────────────────────');
    TARGET_EMAILS.forEach((email) => {
      const found = foundEmails.has(email.toLowerCase().trim());
      const status = found ? '✅' : '❌';
      console.log(`   ${status} ${email}`);
    });
    console.log('───────────────────────────────────────────────────────────\n');

    console.log('RECORD COUNTS:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Total records found:           ${checkInLogs.length}`);

    // Count by user
    const countsByUser = new Map<string, { name: string; email: string; count: number }>();
    for (const log of checkInLogs) {
      const performedBy = log.performedBy as any;
      if (performedBy && performedBy.email) {
        const email = performedBy.email;
        const existing = countsByUser.get(email) || {
          name: performedBy.fullName || 'Unknown',
          email,
          count: 0,
        };
        existing.count++;
        countsByUser.set(email, existing);
      }
    }

    console.log(`Records by user:`);
    for (const [email, data] of countsByUser.entries()) {
      console.log(`   - ${data.name} (${email}): ${data.count} record(s)`);
    }
    console.log('───────────────────────────────────────────────────────────\n');

    // Count by action
    const checkInCount = checkInLogs.filter((log) => log.action === 'check-in').length;
    const checkOutCount = checkInLogs.filter((log) => log.action === 'check-out').length;
    console.log('ACTION BREAKDOWN:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Check-ins:                    ${checkInCount}`);
    console.log(`Check-outs:                   ${checkOutCount}`);
    console.log('───────────────────────────────────────────────────────────\n');

    // Count by session
    const sessionCounts = new Map<string, number>();
    for (const log of checkInLogs) {
      const session = log.session || 'none';
      sessionCounts.set(session, (sessionCounts.get(session) || 0) + 1);
    }
    if (sessionCounts.size > 0) {
      console.log('SESSION BREAKDOWN:');
      console.log('───────────────────────────────────────────────────────────');
      for (const [session, count] of Array.from(sessionCounts.entries()).sort()) {
        const displaySession = session === 'none' ? 'No session' : session.charAt(0).toUpperCase() + session.slice(1);
        console.log(`   ${displaySession}:                  ${count}`);
      }
      console.log('───────────────────────────────────────────────────────────\n');
    }

    // Step 5: Export to CSV
    console.log('💾 Exporting results to CSV...');
    const csvData = checkInLogs.map((log) => {
      const performedBy = log.performedBy as any;
      const camper = log.camperId as any;
      const room = log.roomId as any;

      return {
        timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : '',
        action: log.action || '',
        session: log.session || '',
        busId: log.busId || '',
        location: log.location || '',
        direction: log.direction || '',
        performedBy_name: performedBy?.fullName || 'Unknown',
        performedBy_email: performedBy?.email || 'Unknown',
        camper_firstName: camper?.firstName || '',
        camper_lastName: camper?.lastName || '',
        camper_email: camper?.email || '',
        camper_phone: camper?.phone || '',
        room_number: room?.roomNumber || '',
        room_name: room?.roomName || '',
        notes: log.notes || '',
        createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : '',
      };
    });

    const fields = [
      'timestamp',
      'action',
      'session',
      'busId',
      'location',
      'direction',
      'performedBy_name',
      'performedBy_email',
      'camper_firstName',
      'camper_lastName',
      'camper_email',
      'camper_phone',
      'room_number',
      'room_name',
      'notes',
      'createdAt',
    ];

    const parser = new Parser({ fields });
    const csvContent = parser.parse(csvData);

    const fileName = `checkin-log-filtered-${Date.now()}.csv`;
    const uploadsDir = path.join(__dirname, '../uploads');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, csvContent);

    console.log(`   ✅ Exported to: ${filePath}\n`);

    logger.info('Check-in log filter completed', {
      targetEmails: TARGET_EMAILS,
      usersFound: users.length,
      recordsFound: checkInLogs.length,
      csvFile: fileName,
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Filter complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Step 6: Disconnect and exit
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error filtering check-in logs:', error);
    console.error('\n❌ Error filtering check-in logs:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
filterCheckInLogByEmails();

