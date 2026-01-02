import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import Room from '../src/models/Room';
import User from '../src/models/User';
import logger from '../src/utils/logger';

dotenv.config();

type RoomCsvRow = {
  roomNumber?: string;
  capacity?: string;
  taken?: string;
  building?: string;
  floor?: string;
  reserved?: string;
  notes?: string;
};

const parseBool = (value: unknown): boolean => {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
};

const parseIntSafe = (value: unknown): number | null => {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const usage = () => {
  // Keep usage text short; this is a CLI tool.
  console.log('\nUsage: npm run import:rooms -- <csvPath> [--apply] [--adminEmail=<email>]\n');
  console.log('Examples:');
  console.log('  npm run import:rooms -- rooms.csv');
  console.log('  npm run import:rooms -- rooms.csv --apply');
  console.log('  npm run import:rooms -- rooms.csv --apply --adminEmail=admin@camp.com\n');
  console.log('CSV columns: roomNumber,capacity,taken,building,floor,reserved,notes');
  console.log('Notes: reserved=true rows are skipped. Dry-run is default unless --apply is passed.\n');
};

const importRooms = async () => {
  const args = process.argv.slice(2);
  const csvArg = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const adminEmailArg = args.find((a) => a.startsWith('--adminEmail='));
  const adminEmail = (adminEmailArg?.split('=')[1] || 'admin@camp.com').trim();

  if (!csvArg) {
    usage();
    process.exit(1);
  }

  const csvPath = path.isAbsolute(csvArg) ? csvArg : path.resolve(process.cwd(), csvArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`\n❌ CSV file not found: ${csvPath}\n`);
    usage();
    process.exit(1);
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
  await mongoose.connect(mongoURI);
  logger.info('Connected to MongoDB');

  const adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    console.error(`\n❌ Admin user not found for email "${adminEmail}". Run \`npm run seed:admin\` or pass --adminEmail=<email>\n`);
    process.exit(1);
  }

  const rows: RoomCsvRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });

  if (rows.length === 0) {
    console.log('\n⚠️  No rows found in CSV.\n');
    process.exit(0);
  }

  // Normalize + validate
  const errors: Array<{ row: number; message: string }> = [];
  const skippedReserved: Array<{ row: number; roomNumber: string }> = [];
  const normalized: Array<{
    roomNumber: string;
    capacity: number;
    currentOccupancy: number;
    building?: string;
    floor?: string;
    notes?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2: header + 0-based

    const roomNumber = String(row.roomNumber ?? '').trim();
    const capacity = parseIntSafe(row.capacity);
    const taken = parseIntSafe(row.taken) ?? 0;
    const reserved = parseBool(row.reserved);
    const building = String(row.building ?? '').trim() || undefined;
    const floor = String(row.floor ?? '').trim() || undefined;
    const notes = String(row.notes ?? '').trim() || undefined;

    if (!roomNumber) {
      errors.push({ row: rowNum, message: 'Missing roomNumber' });
      continue;
    }

    if (reserved) {
      skippedReserved.push({ row: rowNum, roomNumber });
      continue;
    }

    if (capacity === null) {
      errors.push({ row: rowNum, message: `Missing/invalid capacity for roomNumber=${roomNumber}` });
      continue;
    }

    if (capacity < 1 || capacity > 50) {
      errors.push({ row: rowNum, message: `Capacity out of bounds (1-50) for roomNumber=${roomNumber}: ${capacity}` });
      continue;
    }

    if (taken < 0) {
      errors.push({ row: rowNum, message: `Taken cannot be negative for roomNumber=${roomNumber}` });
      continue;
    }

    if (taken > capacity) {
      errors.push({
        row: rowNum,
        message: `Taken (${taken}) exceeds capacity (${capacity}) for roomNumber=${roomNumber}`,
      });
      continue;
    }

    normalized.push({
      roomNumber,
      capacity,
      currentOccupancy: taken,
      building,
      floor,
      notes,
    });
  }

  // Deduplicate within CSV by roomNumber (keep last occurrence)
  const byRoomNumber = new Map<string, (typeof normalized)[number]>();
  for (const r of normalized) byRoomNumber.set(r.roomNumber, r);
  const deduped = Array.from(byRoomNumber.values());

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Rooms Import Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`CSV rows read:              ${rows.length}`);
  console.log(`Valid (non-reserved) rooms: ${deduped.length}`);
  console.log(`Reserved rows skipped:      ${skippedReserved.length}`);
  console.log(`Invalid rows:               ${errors.length}`);
  console.log(`Mode:                       ${apply ? 'APPLY (will write)' : 'DRY-RUN (no writes)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (skippedReserved.length > 0) {
    console.log('Skipped reserved rooms (first 10):');
    skippedReserved.slice(0, 10).forEach((s) => console.log(`  Row ${s.row}: ${s.roomNumber}`));
    if (skippedReserved.length > 10) console.log(`  ... and ${skippedReserved.length - 10} more`);
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ Errors (first 10):');
    errors.slice(0, 10).forEach((e) => console.log(`  Row ${e.row}: ${e.message}`));
    if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
    console.log('');
    // Be strict: do not proceed if there are validation errors.
    process.exit(1);
  }

  // Figure out insert vs update (for better reporting)
  const roomNumbers = deduped.map((r) => r.roomNumber);
  const existing = await Room.find({ roomNumber: { $in: roomNumbers } }).select('roomNumber').lean();
  const existingSet = new Set(existing.map((r: any) => String(r.roomNumber)));
  const willInsert = deduped.filter((r) => !existingSet.has(r.roomNumber));
  const willUpdate = deduped.filter((r) => existingSet.has(r.roomNumber));

  console.log(`Would insert: ${willInsert.length}`);
  console.log(`Would update: ${willUpdate.length}\n`);

  if (!apply) {
    console.log('Dry-run complete. Re-run with --apply to write to the database.\n');
    process.exit(0);
  }

  const nowUserId = adminUser._id;
  const ops = deduped.map((r) => ({
    updateOne: {
      filter: { roomNumber: r.roomNumber },
      update: {
        $setOnInsert: {
          createdBy: nowUserId,
        },
        $set: {
          roomNumber: r.roomNumber,
          capacity: r.capacity,
          currentOccupancy: r.currentOccupancy,
          building: r.building,
          floor: r.floor,
          notes: r.notes,
          isActive: true,
          updatedBy: nowUserId,
        },
      },
      upsert: true,
    },
  }));

  const result = await Room.bulkWrite(ops as any, { ordered: false });
  console.log('✅ Import applied.\n');
  console.log('Bulk write result:', {
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    matched: result.matchedCount,
  });
  console.log('');

  process.exit(0);
};

importRooms().catch(async (err) => {
  logger.error('Error importing rooms:', err);
  console.error('\n❌ Error importing rooms:', err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});



