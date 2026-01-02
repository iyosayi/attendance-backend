import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { Parser } from 'json2csv';
import Camper from '../src/models/Camper';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

interface CsvRow {
  'First Name': string;
  'Last Name (Surname)': string;
  'Email': string;
  'Phone Number(WhatsApp Preffered)': string;
  'Gender': string;
  'Are you camping?': string;
  'If yes to the above, What Day will you be coming ?': string;
  'If yes to the above, What Day will you be checking out ?': string;
  'Are you coming as a group or individual?': string;
  'If group how many persons are in your group?': string;
  'If group who is your Bus Marshal/Leader?': string;
  'What city/state do you stay in?': string;
  'What specific location are you coming from?': string;
  [key: string]: string;
}

interface RegistrationCamper {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string;
  arrivalDay?: string;
  checkoutDay?: string;
  groupType?: string;
  groupSize?: string;
  leader?: string;
  city?: string;
  location?: string;
  fullName: string; // normalized for matching
}

interface AnalysisResult {
  camper: any;
  matched: boolean;
  registrationInfo?: RegistrationCamper;
}

/**
 * Normalize name for matching (trim, lowercase, remove extra spaces)
 */
const normalizeName = (name: string): string => {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Create a full name key for matching
 */
const createNameKey = (firstName: string, lastName: string): string => {
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  return `${normalizedFirst} ${normalizedLast}`;
};

const analyzeCheckedInCampers = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);

    logger.info('Connected to MongoDB');
    console.log('\n✅ Connected to MongoDB\n');

    // Step 1: Query checked-in campers
    console.log('📊 Loading checked-in campers...');
    const checkedInCampers = await Camper.find({
      status: 'checked-in',
      isDeleted: false,
    }).lean();

    console.log(`   Found ${checkedInCampers.length} checked-in campers\n`);

    // Step 2: Parse registration.csv
    console.log('📄 Parsing registration.csv...');
    const csvPath = path.join(__dirname, '../registration.csv');
    const rows: CsvRow[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    console.log(`   Found ${rows.length} rows in registration.csv\n`);

    // Step 3: Filter camping registrations
    console.log('🏕️  Filtering camping registrations...');
    const registrationCampers: RegistrationCamper[] = [];

    for (const row of rows) {
      // Skip empty rows
      if (!row['First Name'] && !row['Last Name (Surname)']) {
        continue;
      }

      // Check if camping
      const isCamping =
        row['Are you camping?'] &&
        row['Are you camping?'].toLowerCase().includes('yes');

      if (isCamping) {
        const firstName = (row['First Name'] || '').trim();
        const lastName = (row['Last Name (Surname)'] || '').trim();

        if (firstName && lastName) {
          registrationCampers.push({
            firstName,
            lastName,
            email: (row['Email'] || '').trim(),
            phone: (row['Phone Number(WhatsApp Preffered)'] || '').trim(),
            gender: row['Gender']?.trim(),
            arrivalDay: row['If yes to the above, What Day will you be coming ?']?.trim(),
            checkoutDay: row['If yes to the above, What Day will you be checking out ?']?.trim(),
            groupType: row['Are you coming as a group or individual?']?.trim(),
            groupSize: row['If group how many persons are in your group?']?.trim(),
            leader: row['If group who is your Bus Marshal/Leader?']?.trim(),
            city: row['What city/state do you stay in?']?.trim(),
            location: row['What specific location are you coming from?']?.trim(),
            fullName: createNameKey(firstName, lastName),
          });
        }
      }
    }

    console.log(`   Found ${registrationCampers.length} registered campers\n`);

    // Step 4: Create a map of registration campers by name key for quick lookup
    const registrationMap = new Map<string, RegistrationCamper>();
    for (const regCamper of registrationCampers) {
      registrationMap.set(regCamper.fullName, regCamper);
    }

    // Step 5: Match checked-in campers with registration
    console.log('🔍 Matching checked-in campers with registration...');
    const results: AnalysisResult[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const camper of checkedInCampers) {
      const nameKey = createNameKey(camper.firstName, camper.lastName);
      const registrationInfo = registrationMap.get(nameKey);

      if (registrationInfo) {
        results.push({
          camper,
          matched: true,
          registrationInfo,
        });
        matchedCount++;
      } else {
        results.push({
          camper,
          matched: false,
        });
        unmatchedCount++;
      }
    }

    console.log(`   Matched: ${matchedCount}`);
    console.log(`   Unmatched: ${unmatchedCount}\n`);

    // Step 6: Generate counts and details
    const totalCheckedIn = checkedInCampers.length;
    const totalRegisteredCampers = registrationCampers.length;
    const actualCampersCheckedIn = matchedCount;
    const checkedInNonCampers = unmatchedCount;

    // Find registered campers not checked in
    const checkedInNameKeys = new Set(
      checkedInCampers.map((c) => createNameKey(c.firstName, c.lastName))
    );
    const registeredNotCheckedIn = registrationCampers.filter(
      (reg) => !checkedInNameKeys.has(reg.fullName)
    );

    // Step 7: Output console report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ANALYSIS REPORT - CHECKED-IN CAMPERS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('COUNT SUMMARY:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Total checked-in campers:           ${totalCheckedIn}`);
    console.log(`Total registered campers (CSV):     ${totalRegisteredCampers}`);
    console.log(`Actual campers checked in:          ${actualCampersCheckedIn}`);
    console.log(`Checked-in non-campers:             ${checkedInNonCampers}`);
    console.log(`Registered campers not checked in:  ${registeredNotCheckedIn.length}`);
    console.log('───────────────────────────────────────────────────────────\n');

    // Show breakdown
    if (unmatchedCount > 0) {
      console.log(`⚠️  ${unmatchedCount} checked-in person(s) are NOT registered campers:`);
      results
        .filter((r) => !r.matched)
        .slice(0, 10)
        .forEach((r) => {
          console.log(
            `   - ${r.camper.firstName} ${r.camper.lastName} (${r.camper.email})`
          );
        });
      if (unmatchedCount > 10) {
        console.log(`   ... and ${unmatchedCount - 10} more`);
      }
      console.log('');
    }

    if (registeredNotCheckedIn.length > 0) {
      console.log(
        `ℹ️  ${registeredNotCheckedIn.length} registered camper(s) are NOT checked in:`
      );
      registeredNotCheckedIn.slice(0, 10).forEach((reg) => {
        console.log(`   - ${reg.firstName} ${reg.lastName} (${reg.email})`);
      });
      if (registeredNotCheckedIn.length > 10) {
        console.log(`   ... and ${registeredNotCheckedIn.length - 10} more`);
      }
      console.log('');
    }

    // Step 8: Export CSV with details
    console.log('💾 Exporting detailed results to CSV...');
    const csvData = results.map((result) => {
      const c = result.camper;
      const reg = result.registrationInfo;

      return {
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        status: result.matched ? 'Matched (Actual Camper)' : 'Unmatched (Non-Camper)',
        registrationEmail: reg?.email || '',
        registrationPhone: reg?.phone || '',
        registrationGender: reg?.gender || '',
        arrivalDay: reg?.arrivalDay || '',
        checkoutDay: reg?.checkoutDay || '',
        groupType: reg?.groupType || '',
        groupSize: reg?.groupSize || '',
        leader: reg?.leader || '',
        city: reg?.city || '',
        location: reg?.location || '',
        checkInTime: c.checkInTime || '',
        roomId: c.roomId || '',
      };
    });

    const fields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'status',
      'registrationEmail',
      'registrationPhone',
      'registrationGender',
      'arrivalDay',
      'checkoutDay',
      'groupType',
      'groupSize',
      'leader',
      'city',
      'location',
      'checkInTime',
      'roomId',
    ];

    const parser = new Parser({ fields });
    const csvContent = parser.parse(csvData);

    const fileName = `camper-analysis-${Date.now()}.csv`;
    const uploadsDir = path.join(__dirname, '../uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, csvContent);

    console.log(`   ✅ Exported to: ${filePath}\n`);

    logger.info('Camper analysis completed', {
      totalCheckedIn,
      totalRegisteredCampers,
      actualCampersCheckedIn,
      checkedInNonCampers,
      registeredNotCheckedIn: registeredNotCheckedIn.length,
      csvFile: fileName,
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Analysis complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Step 9: Disconnect and exit
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error analyzing checked-in campers:', error);
    console.error('\n❌ Error analyzing checked-in campers:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
analyzeCheckedInCampers();

