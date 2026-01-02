import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Camper from '../src/models/Camper';
import Room from '../src/models/Room';
import User from '../src/models/User';
import logger from '../src/utils/logger';

dotenv.config();

const MONGODB_OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

type CliArgs = {
  apply: boolean;
  prune: boolean;
  confirmProd: boolean;
  allowOverCapacity: boolean;
  adminEmail: string;
  onlyRoomNumber: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  const apply = argv.includes('--apply');
  const prune = argv.includes('--prune');
  const confirmProd = argv.includes('--i-understand-this-is-prod');
  const allowOverCapacity = argv.includes('--allowOverCapacity');

  const adminEmailArg = argv.find((a) => a.startsWith('--adminEmail='));
  const adminEmail = (adminEmailArg?.split('=')[1] || 'admin@camp.com').trim();

  const onlyRoomArg = argv.find((a) => a.startsWith('--roomNumber='));
  const onlyRoomNumber = (onlyRoomArg?.split('=')[1] || '').trim() || null;

  return { apply, prune, confirmProd, allowOverCapacity, adminEmail, onlyRoomNumber };
}

function usage(): void {
  console.log('\nUsage: npm run reconcile:rooms -- [--roomNumber=D404] [--prune] [--apply --i-understand-this-is-prod]\n');
  console.log('Notes:');
  console.log('- Dry-run is the default (no writes).');
  console.log('- To write in prod, you MUST pass both --apply and --i-understand-this-is-prod.');
  console.log('- --prune clears rooms that currently show occupants but have no campers pointing to them.');
  console.log('- Safety: rooms where expected occupancy exceeds capacity are reported and skipped unless --allowOverCapacity is set.\n');
}

function normalizeRoomIdentifier(input: unknown): string | null {
  if (input === undefined || input === null) return null;
  const str = String(input).trim();
  return str ? str : null;
}

function isMongoObjectIdLike(value: string): boolean {
  return MONGODB_OBJECT_ID_REGEX.test(value);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (process.argv.slice(2).includes('--help')) {
    usage();
    process.exit(0);
  }

  if (args.apply && !args.confirmProd) {
    console.error('\n❌ Refusing to write. For prod safety, you must pass --i-understand-this-is-prod along with --apply.\n');
    usage();
    process.exit(1);
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
  await mongoose.connect(mongoURI);
  logger.info('Connected to MongoDB', {
    host: mongoose.connection.host,
    database: mongoose.connection.name,
  });

  const adminUser = await User.findOne({ email: args.adminEmail }).select('_id email').lean();
  if (!adminUser) {
    console.error(`\n❌ Admin user not found for email "${args.adminEmail}". Pass --adminEmail=<email>\n`);
    process.exit(1);
  }

  // 1) Load campers with a roomId
  const campers = await Camper.find({
    isDeleted: false,
    roomId: { $nin: [null, ''] },
  })
    .select('_id roomId')
    .lean();

  // 2) Resolve legacy ObjectId-like roomIds to roomNumbers
  const objectIdLikeRoomIds = Array.from(
    new Set(
      campers
        .map((c: any) => normalizeRoomIdentifier(c.roomId))
        .filter((roomId): roomId is string => typeof roomId === 'string' && isMongoObjectIdLike(roomId))
    )
  );

  const roomIdToNumber = new Map<string, string>();
  if (objectIdLikeRoomIds.length > 0) {
    const rooms = await Room.find({ _id: { $in: objectIdLikeRoomIds } }).select('_id roomNumber').lean();
    rooms.forEach((r: any) => roomIdToNumber.set(String(r._id), String(r.roomNumber)));
  }

  const missingRoomRefs: Array<{ camperId: string; roomId: string }> = [];
  const expectedByRoomNumber = new Map<string, Set<string>>(); // roomNumber -> camperId strings

  for (const camper of campers as any[]) {
    const camperId = String(camper._id);
    const rawRoomId = normalizeRoomIdentifier(camper.roomId);
    if (!rawRoomId) continue;

    const roomNumber = isMongoObjectIdLike(rawRoomId) ? roomIdToNumber.get(rawRoomId) : rawRoomId;
    if (!roomNumber) {
      missingRoomRefs.push({ camperId, roomId: rawRoomId });
      continue;
    }

    if (args.onlyRoomNumber && roomNumber !== args.onlyRoomNumber) continue;

    if (!expectedByRoomNumber.has(roomNumber)) expectedByRoomNumber.set(roomNumber, new Set());
    expectedByRoomNumber.get(roomNumber)!.add(camperId);
  }

  const referencedRoomNumbers = new Set(expectedByRoomNumber.keys());
  const referencedRoomNumbersList = Array.from(referencedRoomNumbers);

  // 3) Fetch referenced rooms and compute diffs
  const referencedRooms = referencedRoomNumbersList.length
    ? await Room.find({ roomNumber: { $in: referencedRoomNumbersList } })
        .select('_id roomNumber capacity currentOccupancy camperIds')
        .lean()
    : [];

  const existingRoomNumberSet = new Set(referencedRooms.map((r: any) => String(r.roomNumber)));
  const missingRooms = referencedRoomNumbersList.filter((n) => !existingRoomNumberSet.has(n));

  const updates: Array<{
    roomId: string;
    roomNumber: string;
    expectedOccupancy: number;
    actualOccupancy: number;
    expectedCamperIds: string[];
    actualCamperIds: string[];
    capacity: number;
  }> = [];

  const overCapacityRooms: Array<{ roomNumber: string; expected: number; capacity: number }> = [];

  for (const room of referencedRooms as any[]) {
    const roomNumber = String(room.roomNumber);
    const expectedSet = expectedByRoomNumber.get(roomNumber) ?? new Set<string>();
    const actualIds: string[] = Array.isArray(room.camperIds) ? room.camperIds.map((id: any) => String(id)) : [];
    const actualSet = new Set<string>(actualIds);

    const expectedIds = Array.from(expectedSet);
    const expectedOccupancy = expectedIds.length;
    const actualOccupancy = Number(room.currentOccupancy ?? 0);
    const capacity = Number(room.capacity ?? 0);

    if (capacity > 0 && expectedOccupancy > capacity) {
      overCapacityRooms.push({ roomNumber, expected: expectedOccupancy, capacity });
      if (!args.allowOverCapacity) continue;
    }

    const needsCamperIdsUpdate = !setsEqual(actualSet, expectedSet);
    const needsOccupancyUpdate = actualOccupancy !== expectedOccupancy;

    if (needsCamperIdsUpdate || needsOccupancyUpdate) {
      updates.push({
        roomId: String(room._id),
        roomNumber,
        expectedOccupancy,
        actualOccupancy,
        expectedCamperIds: expectedIds,
        actualCamperIds: actualIds,
        capacity,
      });
    }
  }

  // 4) Prune rooms that show occupants but have no campers referencing them (optional)
  const pruneTargets: Array<{ roomId: string; roomNumber: string; currentOccupancy: number; camperIdsCount: number }> =
    [];

  if (args.prune) {
    const roomsWithOccupants = await Room.find({
      $or: [{ currentOccupancy: { $gt: 0 } }, { 'camperIds.0': { $exists: true } }],
    })
      .select('_id roomNumber currentOccupancy camperIds')
      .lean();

    for (const room of roomsWithOccupants as any[]) {
      const roomNumber = String(room.roomNumber);
      if (args.onlyRoomNumber && roomNumber !== args.onlyRoomNumber) continue;
      if (referencedRoomNumbers.has(roomNumber)) continue;

      const currentOccupancy = Number(room.currentOccupancy ?? 0);
      const camperIdsCount = Array.isArray(room.camperIds) ? room.camperIds.length : 0;

      // User requested targeting only rooms where occupancy > 0 OR camperIds.length > 0
      if (currentOccupancy <= 0 && camperIdsCount <= 0) continue;

      pruneTargets.push({
        roomId: String(room._id),
        roomNumber,
        currentOccupancy,
        camperIdsCount,
      });
    }
  }

  // 5) Report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Room Reconciliation Summary (Campers.roomId → Rooms)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Mode:                        ${args.apply ? 'APPLY (will write)' : 'DRY-RUN (no writes)'}`);
  console.log(`Prune:                       ${args.prune ? 'YES (will clear unreferenced occupants)' : 'NO'}`);
  console.log(`Scope:                       ${args.onlyRoomNumber ? `roomNumber=${args.onlyRoomNumber}` : 'ALL rooms'}`);
  console.log(`Campers scanned (roomId set): ${campers.length}`);
  console.log(`Referenced roomNumbers:       ${referencedRoomNumbers.size}`);
  console.log(`Rooms to update:              ${updates.length}`);
  console.log(`Rooms to prune:               ${pruneTargets.length}`);
  console.log(`Missing room refs (campers):  ${missingRoomRefs.length}`);
  console.log(`Missing rooms (roomNumbers):  ${missingRooms.length}`);
  console.log(`Over-capacity rooms:          ${overCapacityRooms.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (missingRoomRefs.length > 0) {
    console.log('⚠️ Campers referencing missing/invalid rooms (first 15):');
    missingRoomRefs.slice(0, 15).forEach((m) => console.log(`  camperId=${m.camperId} roomId=${m.roomId}`));
    if (missingRoomRefs.length > 15) console.log(`  ... and ${missingRoomRefs.length - 15} more`);
    console.log('');
  }

  if (missingRooms.length > 0) {
    console.log('⚠️ Missing Room documents for referenced roomNumbers (first 25):');
    missingRooms.slice(0, 25).forEach((n) => console.log(`  roomNumber=${n}`));
    if (missingRooms.length > 25) console.log(`  ... and ${missingRooms.length - 25} more`);
    console.log('');
  }

  if (overCapacityRooms.length > 0) {
    console.log(`⚠️ Over-capacity rooms (skipped unless --allowOverCapacity):`);
    overCapacityRooms.slice(0, 25).forEach((r) => console.log(`  roomNumber=${r.roomNumber} expected=${r.expected} capacity=${r.capacity}`));
    if (overCapacityRooms.length > 25) console.log(`  ... and ${overCapacityRooms.length - 25} more`);
    console.log('');
  }

  if (updates.length > 0) {
    console.log('Rooms needing updates (first 25):');
    updates.slice(0, 25).forEach((u) => {
      console.log(
        `  ${u.roomNumber}: occupancy ${u.actualOccupancy} → ${u.expectedOccupancy} (capacity ${u.capacity}), camperIds ${u.actualCamperIds.length} → ${u.expectedCamperIds.length}`
      );
    });
    if (updates.length > 25) console.log(`  ... and ${updates.length - 25} more`);
    console.log('');
  }

  if (args.prune && pruneTargets.length > 0) {
    console.log('Rooms to prune (first 25):');
    pruneTargets.slice(0, 25).forEach((p) => {
      console.log(`  ${p.roomNumber}: occupancy=${p.currentOccupancy}, camperIds=${p.camperIdsCount} → cleared`);
    });
    if (pruneTargets.length > 25) console.log(`  ... and ${pruneTargets.length - 25} more`);
    console.log('');
  }

  if (!args.apply) {
    console.log('Dry-run complete. Re-run with: --apply --i-understand-this-is-prod (and optionally --prune)\n');
    return;
  }

  // 6) Apply changes
  const adminUserId = String((adminUser as any)._id);

  const updateOps = updates.map((u) => ({
    updateOne: {
      filter: { _id: u.roomId },
      update: {
        $set: {
          camperIds: u.expectedCamperIds.map((id) => new mongoose.Types.ObjectId(id)),
          currentOccupancy: u.expectedOccupancy,
          updatedBy: adminUserId,
        },
        $inc: { version: 1 },
      },
    },
  }));

  const pruneOps = pruneTargets.map((p) => ({
    updateOne: {
      filter: { _id: p.roomId },
      update: {
        $set: {
          camperIds: [],
          currentOccupancy: 0,
          updatedBy: adminUserId,
        },
        $inc: { version: 1 },
      },
    },
  }));

  const allOps = [...updateOps, ...pruneOps];
  if (allOps.length === 0) {
    console.log('Nothing to apply.\n');
    return;
  }

  const result = await Room.bulkWrite(allOps as any, { ordered: false });

  console.log('✅ Reconciliation applied.\n');
  console.log('Bulk write result:', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
  });
  console.log('');
}

main()
  .then(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error('Error reconciling rooms from campers:', err);
    console.error('\n❌ Error reconciling rooms from campers:', err?.message || err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });


