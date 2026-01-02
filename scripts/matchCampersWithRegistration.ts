import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Parser } from 'json2csv';

interface CheckInRecord {
  camper_firstName: string;
  camper_lastName: string;
  camper_email: string;
}

interface RegistrationRecord {
  firstName: string;
  lastName: string;
  email: string;
  cityState: string;
  camping: string;
  specificLocation?: string;
}

const readCsvFile = (filePath: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

const matchCampersWithRegistration = async () => {
  try {
    // Read check-in log CSV
    const checkInLogPath = path.join(__dirname, '../uploads/checkin-log-filtered-1763585547886.csv');
    const registrationPath = path.join(__dirname, '../registration.csv');

    console.log('📖 Reading check-in log...');
    const checkInRecords: CheckInRecord[] = await readCsvFile(checkInLogPath);
    console.log(`   Found ${checkInRecords.length} check-in records\n`);

    // Read registration CSV
    console.log('📖 Reading registration data...');
    const registrationRows: any[] = await readCsvFile(registrationPath);
    console.log(`   Found ${registrationRows.length} registration records\n`);

    // Build registration map for quick lookup
    // Use both name and email for matching
    const registrationMap = new Map<string, RegistrationRecord>();
    
    for (const row of registrationRows) {
      const firstName = (row['First Name'] || '').trim();
      const lastName = (row['Last Name (Surname)'] || '').trim();
      const email = (row['Email'] || '').trim().toLowerCase();
      const cityState = (row['What city/state do you stay in?'] || '').trim();
      const camping = (row['Are you camping?'] || '').trim();
      const specificLocation = (row['What specific location are you coming from?'] || '').trim();

      if (!firstName || !lastName) continue; // Skip empty rows

      // Create normalized keys for matching
      const nameKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
      const emailKey = email;

      const record: RegistrationRecord = {
        firstName,
        lastName,
        email,
        cityState,
        camping,
        specificLocation,
      };

      // Store by name
      if (nameKey && nameKey !== '_') {
        registrationMap.set(nameKey, record);
      }
      // Store by email if available
      if (emailKey) {
        registrationMap.set(`email_${emailKey}`, record);
      }
    }

    console.log(`   Built registration map with ${registrationMap.size} entries\n`);

    // Match check-in records with registration
    console.log('🔍 Matching check-in records with registration...\n');
    
    const matches: Array<{
      checkIn: CheckInRecord;
      registration: RegistrationRecord;
      matchType: string;
    }> = [];

    const unmatched: CheckInRecord[] = [];

    for (const checkIn of checkInRecords) {
      const firstName = (checkIn.camper_firstName || '').trim();
      const lastName = (checkIn.camper_lastName || '').trim();
      const email = (checkIn.camper_email || '').trim().toLowerCase();

      const nameKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
      const emailKey = email ? `email_${email}` : null;

      let match: RegistrationRecord | undefined;
      let matchType = '';

      // Try matching by email first (more reliable)
      if (emailKey) {
        match = registrationMap.get(emailKey);
        if (match) {
          matchType = 'email';
        }
      }

      // Try matching by name if email didn't work
      if (!match && nameKey && nameKey !== '_') {
        match = registrationMap.get(nameKey);
        if (match) {
          matchType = 'name';
        }
      }

      if (match) {
        matches.push({ checkIn, registration: match, matchType });
      } else {
        unmatched.push(checkIn);
      }
    }

    console.log(`   Matched: ${matches.length}`);
    console.log(`   Unmatched: ${unmatched.length}\n`);

    // Filter for those who indicated camping AND are outside Benin
    console.log('🎯 Filtering for campers who indicated camping and are outside Benin...\n');

    const targetCampers = matches.filter(({ registration }) => {
      const isCamping = registration.camping.toLowerCase() === 'yes';
      const isOutsideBenin = registration.cityState.toLowerCase() === 'outside benin';
      return isCamping && isOutsideBenin;
    });

    console.log(`   Found ${targetCampers.length} campers who:\n`);
    console.log(`   - Indicated they would be camping (Yes)`);
    console.log(`   - Are located outside Benin\n`);

    // Display results
    if (targetCampers.length > 0) {
      console.log('📋 Results:\n');
      console.log('='.repeat(100));
      
      targetCampers.forEach(({ checkIn, registration, matchType }, index) => {
        console.log(`\n${index + 1}. ${checkIn.camper_firstName} ${checkIn.camper_lastName}`);
        console.log(`   Email: ${checkIn.camper_email}`);
        console.log(`   Matched by: ${matchType}`);
        console.log(`   Registration Location: ${registration.cityState}`);
        console.log(`   Specific Location: ${registration.specificLocation || 'N/A'}`);
        console.log(`   Camping: ${registration.camping}`);
        console.log(`   Registration Email: ${registration.email}`);
      });

      console.log('\n' + '='.repeat(100));
    } else {
      console.log('   No matches found.\n');
    }

    // Generate CSV output
    if (targetCampers.length > 0) {
      const outputData = targetCampers.map(({ checkIn, registration }) => ({
        'Check-In First Name': checkIn.camper_firstName,
        'Check-In Last Name': checkIn.camper_lastName,
        'Check-In Email': checkIn.camper_email,
        'Registration First Name': registration.firstName,
        'Registration Last Name': registration.lastName,
        'Registration Email': registration.email,
        'City/State': registration.cityState,
        'Specific Location': registration.specificLocation || '',
        'Camping': registration.camping,
      }));

      const outputPath = path.join(
        __dirname,
        '../uploads/campers-outside-benin-' + Date.now() + '.csv'
      );

      const parser = new Parser();
      const csvContent = parser.parse(outputData);
      fs.writeFileSync(outputPath, csvContent);

      console.log(`\n💾 Results saved to: ${outputPath}\n`);
    }

    // Summary statistics
    console.log('\n📊 Summary Statistics:\n');
    console.log(`   Total check-in records: ${checkInRecords.length}`);
    console.log(`   Matched with registration: ${matches.length}`);
    console.log(`   Unmatched: ${unmatched.length}`);
    console.log(`   Camping + Outside Benin: ${targetCampers.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Run the script
matchCampersWithRegistration().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

