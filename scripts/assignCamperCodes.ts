import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Camper from '../src/models/Camper';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

const assignCamperCodes = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);

    logger.info('Connected to MongoDB');
    console.log('\n✅ Connected to MongoDB\n');

    // Get all campers sorted by creation date (oldest first)
    const campers = await Camper.find({ isDeleted: false }).sort({ createdAt: 1 });

    console.log(`📊 Found ${campers.length} campers\n`);

    if (campers.length === 0) {
      console.log('⚠️  No campers found in the database');
      process.exit(0);
    }

    // Track progress
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('🔄 Assigning codes to campers...\n');

    // Assign codes starting from 001
    for (let i = 0; i < campers.length; i++) {
      const camper = campers[i];
      const code = String(i + 1).padStart(3, '0'); // 001, 002, 003, etc.

      try {
        // Check if camper already has a code
        if (camper.code) {
          skipped++;
          continue;
        }

        // Update camper with code
        await Camper.findByIdAndUpdate(
          camper._id,
          { code },
          { runValidators: true }
        );

        updated++;

        // Show progress every 100 campers
        if ((i + 1) % 100 === 0) {
          process.stdout.write(`\r   Progress: ${i + 1}/${campers.length} campers processed`);
        }
      } catch (error: any) {
        errors++;
        logger.error('Error assigning code to camper', {
          camperId: camper._id,
          error: error.message,
        });
      }
    }

    console.log(`\n\n✅ Code assignment completed!\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Final Statistics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total campers:        ${campers.length}`);
    console.log(`Codes assigned:       ${updated}`);
    console.log(`Skipped (had code):   ${skipped}`);
    console.log(`Errors:               ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Display sample of assigned codes
    if (updated > 0) {
      console.log('📝 Sample of assigned codes:');
      const sampledCampers = await Camper.find({ code: { $exists: true } })
        .select('code firstName lastName')
        .sort({ code: 1 })
        .limit(10);

      sampledCampers.forEach(c => {
        console.log(`   ${c.code}: ${c.firstName} ${c.lastName}`);
      });

      if (updated > 10) {
        console.log(`   ... and ${updated - 10} more\n`);
      }
    }

    logger.info('Camper code assignment completed', {
      total: campers.length,
      updated,
      skipped,
      errors,
    });

    process.exit(0);
  } catch (error) {
    logger.error('Error assigning camper codes:', error);
    console.error('\n❌ Error assigning camper codes:', error);
    process.exit(1);
  }
};

// Run the script
assignCamperCodes();
