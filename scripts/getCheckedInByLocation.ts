import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Parser } from 'json2csv';
import Camper from '../src/models/Camper';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

const getCheckedInByLocation = async () => {
  try {
    // Get location from CLI arguments
    const locationArg = process.argv[2];
    
    if (!locationArg) {
      console.error('\n❌ Error: Location argument is required');
      console.log('\nUsage:');
      console.log('  npm run script:get-checked-in-by-location <location>');
      console.log('\nExample:');
      console.log('  npm run script:get-checked-in-by-location Kokori');
      console.log('  npm run script:get-checked-in-by-location "Port Harcourt"');
      process.exit(1);
    }

    const location = locationArg.trim();
    console.log(`\n🔍 Searching for checked-in campers from: "${location}"\n`);

    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);

    logger.info('Connected to MongoDB');
    console.log('✅ Connected to MongoDB\n');

    // Create case-insensitive regex for location search
    // Search in notes field for "City:" or "Location:" followed by the location term
    const locationRegex = new RegExp(location, 'i');

    // Query checked-in campers with location matching in notes
    console.log('📊 Querying checked-in campers...');
    const checkedInCampers = await Camper.find({
      status: 'checked-in',
      isDeleted: false,
      notes: { $regex: locationRegex },
    })
      .sort({ checkInTime: -1 })
      .lean();

    console.log(`   Found ${checkedInCampers.length} checked-in camper(s) matching location\n`);

    if (checkedInCampers.length === 0) {
      console.log('ℹ️  No checked-in campers found matching the location criteria.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Calculate gender breakdown
    const genderCounts = {
      Male: 0,
      Female: 0,
      Other: 0,
      Unknown: 0,
    };

    checkedInCampers.forEach((camper) => {
      const gender = camper.gender || 'Unknown';
      if (gender in genderCounts) {
        genderCounts[gender as keyof typeof genderCounts]++;
      } else {
        genderCounts.Unknown++;
      }
    });

    // Display summary statistics
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY - CHECKED-IN CAMPERS BY LOCATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('SEARCH CRITERIA:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Location:                    ${location}`);
    console.log('───────────────────────────────────────────────────────────\n');

    console.log('TOTALS:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Total checked-in campers:    ${checkedInCampers.length}`);
    console.log('───────────────────────────────────────────────────────────\n');

    console.log('GENDER BREAKDOWN:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Male:                        ${genderCounts.Male}`);
    console.log(`Female:                      ${genderCounts.Female}`);
    if (genderCounts.Other > 0) {
      console.log(`Other:                       ${genderCounts.Other}`);
    }
    if (genderCounts.Unknown > 0) {
      console.log(`Unknown:                     ${genderCounts.Unknown}`);
    }
    console.log('───────────────────────────────────────────────────────────\n');

    // Display sample of campers (first 10)
    if (checkedInCampers.length > 0) {
      console.log('SAMPLE CAMPERS (first 10):');
      console.log('───────────────────────────────────────────────────────────');
      checkedInCampers.slice(0, 10).forEach((camper, index) => {
        console.log(
          `${index + 1}. ${camper.firstName} ${camper.lastName} (${camper.gender || 'Unknown'}) - ${camper.email}`
        );
        if (camper.notes) {
          console.log(`   Notes: ${camper.notes.substring(0, 100)}${camper.notes.length > 100 ? '...' : ''}`);
        }
      });
      if (checkedInCampers.length > 10) {
        console.log(`   ... and ${checkedInCampers.length - 10} more`);
      }
      console.log('───────────────────────────────────────────────────────────\n');
    }

    // Export to CSV
    console.log('💾 Exporting results to CSV...');
    const csvData = checkedInCampers.map((camper) => {
      // Extract location info from notes if available
      let city = '';
      let specificLocation = '';
      
      if (camper.notes) {
        const cityMatch = camper.notes.match(/City:\s*([^|]+)/i);
        const locationMatch = camper.notes.match(/Location:\s*([^|]+)/i);
        
        if (cityMatch) {
          city = cityMatch[1].trim();
        }
        if (locationMatch) {
          specificLocation = locationMatch[1].trim();
        }
      }

      return {
        firstName: camper.firstName || '',
        lastName: camper.lastName || '',
        email: camper.email || '',
        phone: camper.phone || '',
        gender: camper.gender || 'Unknown',
        age: camper.age || '',
        city: city,
        specificLocation: specificLocation,
        checkInTime: camper.checkInTime ? new Date(camper.checkInTime).toISOString() : '',
        roomId: camper.roomId ? camper.roomId.toString() : '',
        notes: camper.notes || '',
        createdAt: camper.createdAt ? new Date(camper.createdAt).toISOString() : '',
      };
    });

    const fields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'gender',
      'age',
      'city',
      'specificLocation',
      'checkInTime',
      'roomId',
      'notes',
      'createdAt',
    ];

    const parser = new Parser({ fields });
    const csvContent = parser.parse(csvData);

    const fileName = `checked-in-by-location-${location.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`;
    const uploadsDir = path.join(__dirname, '../uploads');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, csvContent);

    console.log(`   ✅ Exported to: ${filePath}\n`);

    logger.info('Checked-in campers by location query completed', {
      location,
      totalCount: checkedInCampers.length,
      genderBreakdown: genderCounts,
      csvFile: fileName,
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Query complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Disconnect and exit
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error querying checked-in campers by location:', error);
    console.error('\n❌ Error querying checked-in campers by location:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
getCheckedInByLocation();

