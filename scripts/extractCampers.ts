import fs from 'fs';
import csv from 'csv-parser';
import { writeFileSync } from 'fs';
import { Parser } from 'json2csv';
import path from 'path';

interface CsvRow {
  [key: string]: string;
}

interface ProcessedRow {
  firstName: string;
  lastName: string;
  fullName: string;
  data: CsvRow;
}

const extractCampers = async () => {
  try {
    // Read and parse CSV
    const csvPath = path.join(__dirname, '../12hwj.csv');
    const rows: CsvRow[] = [];

    console.log('📖 Reading CSV file...\n');

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    console.log(`✅ Found ${rows.length} rows in CSV\n`);

    // Separate campers and non-campers
    const campers: ProcessedRow[] = [];
    const nonCampers: ProcessedRow[] = [];
    const seenCampers = new Set<string>();
    const seenNonCampers = new Set<string>();
    const duplicateCampers: string[] = [];
    const duplicateNonCampers: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because CSV has header and arrays are 0-indexed

      // Skip empty rows
      if (!row['First Name'] && !row['Last Name (Surname)']) {
        continue;
      }

      const firstName = (row['First Name'] || '').trim();
      const lastName = (row['Last Name (Surname)'] || '').trim();

      // Skip if no name
      if (!firstName || !lastName) {
        continue;
      }

      const fullName = `${firstName} ${lastName}`;
      const duplicateKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;

      // Check camping status
      const isCamping = (row['Are you camping?'] || '').trim().toLowerCase() === 'yes';

      if (isCamping) {
        // Check for duplicates
        if (seenCampers.has(duplicateKey)) {
          duplicateCampers.push(`Row ${rowNumber}: ${fullName} - duplicate name`);
          continue;
        }
        seenCampers.add(duplicateKey);
        campers.push({
          firstName,
          lastName,
          fullName,
          data: row,
        });
      } else {
        // Check for duplicates
        if (seenNonCampers.has(duplicateKey)) {
          duplicateNonCampers.push(`Row ${rowNumber}: ${fullName} - duplicate name`);
          continue;
        }
        seenNonCampers.add(duplicateKey);
        nonCampers.push({
          firstName,
          lastName,
          fullName,
          data: row,
        });
      }
    }

    // Get headers from first row
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    // Write campers CSV
    if (campers.length > 0) {
      const campersData = campers.map((item) => item.data);
      const parser = new Parser({ fields: headers });
      const campersCsv = parser.parse(campersData);
      const campersPath = path.join(__dirname, '../campers_extracted.csv');
      writeFileSync(campersPath, campersCsv);
      console.log(`✅ Campers: ${campers.length} unique entries saved to campers_extracted.csv`);
    } else {
      console.log('⚠️  No campers found');
    }

    // Write non-campers CSV
    if (nonCampers.length > 0) {
      const nonCampersData = nonCampers.map((item) => item.data);
      const parser = new Parser({ fields: headers });
      const nonCampersCsv = parser.parse(nonCampersData);
      const nonCampersPath = path.join(__dirname, '../non-campers_extracted.csv');
      writeFileSync(nonCampersPath, nonCampersCsv);
      console.log(`✅ Non-Campers: ${nonCampers.length} unique entries saved to non-campers_extracted.csv`);
    } else {
      console.log('⚠️  No non-campers found');
    }

    // Report duplicates
    if (duplicateCampers.length > 0) {
      console.log(`\n⚠️  Found ${duplicateCampers.length} duplicate camper(s) (skipped):`);
      duplicateCampers.forEach((dup) => console.log(`   - ${dup}`));
    }

    if (duplicateNonCampers.length > 0) {
      console.log(`\n⚠️  Found ${duplicateNonCampers.length} duplicate non-camper(s) (skipped):`);
      duplicateNonCampers.forEach((dup) => console.log(`   - ${dup}`));
    }

    console.log('\n✨ Extraction complete!\n');
  } catch (error) {
    console.error('❌ Error extracting campers:', error);
    process.exit(1);
  }
};

// Run the script
extractCampers();

