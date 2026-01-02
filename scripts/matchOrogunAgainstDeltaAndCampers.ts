import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface MatchResult {
  expectedName: string;
  foundInDeltaRegistration: boolean;
  deltaRegistrationLocation?: string;
  deltaRegistrationPhone?: string;
  deltaRegistrationEmail?: string;
  foundInCampersCSV: boolean;
  campersCSVId?: string;
  campersCSVNotes?: string;
  foundInDatabase: boolean;
  databaseStatus?: string;
  databaseId?: string;
  databasePhone?: string;
  databaseName?: string;
  checkInTime?: Date;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (n1 === n2) return true;
  
  const parts1 = n1.split(/\s+/).filter(p => p.length >= 2);
  const parts2 = n2.split(/\s+/).filter(p => p.length >= 2);
  
  if (parts1.length === 0 || parts2.length === 0) return false;
  
  // Check if all parts match (order independent)
  if (parts1.length === parts2.length) {
    const sorted1 = parts1.sort().join(' ');
    const sorted2 = parts2.sort().join(' ');
    if (sorted1 === sorted2) return true;
  }
  
  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check word-level matches
  let matchCount = 0;
  for (const p1 of parts1) {
    if (p1.length >= 3) {
      for (const p2 of parts2) {
        if (p1 === p2) {
          matchCount++;
          break;
        }
      }
    }
  }
  
  if (matchCount >= 2) return true;
  if (parts1.length >= 2 && parts2.length >= 2 && matchCount === Math.min(parts1.length, parts2.length)) return true;
  
  return false;
}

async function matchOrogunAgainstDeltaAndCampers() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    const expectedDelegates = [
      'Emmanuel Jackson opiri',
      'Oghenekaro Helen',
      'Vivian Godwin',
      'Philo adjarho',
      'Stphanie Akpofure',
      'Glory sokodi',
      'Fegiro uloho',
      'Princess ejovwokoghene',
      'Esther Chukwunyere',
      'Oghenerukevwe Rita',
      'Ejeromedoghene Victoria',
      'Stephen Akpojotor',
      'Obas Edwin',
      'Aremu Daniel',
      'Gloria Esanye',
      'Eguono Ejeromedoghene',
      'Daniel Aremu',
      'Godwin Juliet',
      'Richard Akpofure',
      'Diegbe Tracy',
      'Gabriel blessing',
      'Faith Murphy',
      'David Okakuro',
      'Prince umunade',
      'Onya favour',
      'Igoru blessing'
    ];
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 MATCHING OROGUN DELEGATES AGAINST DELTA & CAMPERS.CSV');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected Delegates: ${expectedDelegates.length}\n`);
    
    // Load Delta registrations (any location containing "delta" or "orogun")
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const deltaRegistrations: Array<{ location: string; firstName: string; lastName: string; email: string; phone: string; fullName: string }> = [];
    
    if (fs.existsSync(registrationPath)) {
      const csvContent = fs.readFileSync(registrationPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());
        
        if (parts.length >= 10) {
          const firstName = parts[1] || '';
          const lastName = parts[2] || '';
          const email = parts[3] || '';
          const phone = parts[4] || '';
          const location = parts[9] || '';
          
          // Include if location contains delta or orogun
          if (location.toLowerCase().includes('delta') || location.toLowerCase().includes('orogun')) {
            const fullName = `${firstName} ${lastName}`.trim();
            deltaRegistrations.push({
              location,
              firstName,
              lastName,
              email,
              phone,
              fullName
            });
          }
        }
      }
    }
    
    console.log(`Loaded ${deltaRegistrations.length} Delta/Orogun registrations\n`);
    
    // Load Campers CSV
    const campersPath = path.join(__dirname, '..', 'campers.csv');
    const campersEntries: Array<{ id: string; firstName: string; lastName: string; fullName: string; notes: string }> = [];
    
    if (fs.existsSync(campersPath)) {
      const csvContent = fs.readFileSync(campersPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());
        
        if (parts.length >= 3) {
          const id = parts[0] || '';
          const firstName = parts[1] || '';
          const lastName = parts[2] || '';
          const notes = parts[4] || '';
          
          const fullName = `${firstName} ${lastName}`.trim();
          campersEntries.push({
            id,
            firstName,
            lastName,
            fullName,
            notes
          });
        }
      }
    }
    
    console.log(`Loaded ${campersEntries.length} entries from campers.csv\n`);
    
    const results: MatchResult[] = [];
    
    for (const expectedName of expectedDelegates) {
      const result: MatchResult = {
        expectedName,
        foundInDeltaRegistration: false,
        foundInCampersCSV: false,
        foundInDatabase: false
      };
      
      const normalizedSearchName = normalizeName(expectedName);
      
      // Check Delta registrations
      for (const regEntry of deltaRegistrations) {
        const regFullName = normalizeName(regEntry.fullName);
        const regReversed = normalizeName(`${regEntry.lastName} ${regEntry.firstName}`);
        
        if (namesMatch(normalizedSearchName, regFullName) || 
            namesMatch(normalizedSearchName, regReversed)) {
          result.foundInDeltaRegistration = true;
          result.deltaRegistrationLocation = regEntry.location || '';
          result.deltaRegistrationPhone = regEntry.phone || '';
          result.deltaRegistrationEmail = regEntry.email || '';
          break;
        }
      }
      
      // Check Campers CSV
      for (const camperEntry of campersEntries) {
        const camperFullName = normalizeName(camperEntry.fullName);
        const camperReversed = normalizeName(`${camperEntry.lastName} ${camperEntry.firstName}`);
        
        if (namesMatch(normalizedSearchName, camperFullName) || 
            namesMatch(normalizedSearchName, camperReversed)) {
          result.foundInCampersCSV = true;
          result.campersCSVId = camperEntry.id;
          result.campersCSVNotes = camperEntry.notes;
          break;
        }
      }
      
      // Check Database
      const nameParts = expectedName.split(/\s+/).filter(p => p.length >= 2);
      for (const part of nameParts) {
        const regex = new RegExp(part, 'i');
        const campers = await Camper.find({
          $or: [
            { firstName: regex },
            { lastName: regex },
            { notes: regex }
          ],
          isDeleted: false
        }).lean();
        
        for (const camper of campers) {
          const camperFullName = `${camper.firstName} ${camper.lastName}`.trim();
          if (namesMatch(normalizedSearchName, normalizeName(camperFullName))) {
            result.foundInDatabase = true;
            result.databaseStatus = camper.status || 'pending';
            result.databaseId = camper.code || camper._id.toString();
            result.databasePhone = camper.phone;
            result.databaseName = camperFullName;
            result.checkInTime = camper.checkInTime;
            break;
          }
        }
        if (result.foundInDatabase) break;
      }
      
      results.push(result);
    }
    
    // Print Report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 MATCH RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Found in Delta Registration
    const foundInDelta = results.filter(r => r.foundInDeltaRegistration);
    console.log(`✅ FOUND IN DELTA REGISTRATION: ${foundInDelta.length}\n`);
    for (let i = 0; i < foundInDelta.length; i++) {
      const result = foundInDelta[i];
      console.log(`${i + 1}. ${result.expectedName}`);
      console.log(`   Location: ${result.deltaRegistrationLocation || 'N/A'}`);
      console.log(`   Phone: ${result.deltaRegistrationPhone || 'N/A'}`);
      if (result.foundInDatabase) {
        console.log(`   Database: ${result.databaseStatus || 'pending'} (ID: ${result.databaseId || 'N/A'})`);
        if (result.databaseStatus === 'checked-in') {
          console.log(`   ✅ CHECKED IN`);
        }
      }
      if (result.foundInCampersCSV) {
        console.log(`   Campers CSV: ID ${result.campersCSVId || 'N/A'}`);
      }
      console.log('');
    }
    
    // Found in Campers CSV
    const foundInCampers = results.filter(r => r.foundInCampersCSV);
    console.log(`\n✅ FOUND IN CAMPERS.CSV: ${foundInCampers.length}\n`);
    for (let i = 0; i < foundInCampers.length; i++) {
      const result = foundInCampers[i];
      console.log(`${i + 1}. ${result.expectedName}`);
      console.log(`   Campers CSV ID: ${result.campersCSVId || 'N/A'}`);
      if (result.campersCSVNotes) {
        console.log(`   Notes: ${result.campersCSVNotes.substring(0, 100)}`);
      }
      if (result.foundInDeltaRegistration) {
        console.log(`   Also in Delta Registration: ${result.deltaRegistrationLocation || 'N/A'}`);
      }
      if (result.foundInDatabase) {
        console.log(`   Database: ${result.databaseStatus || 'pending'} (ID: ${result.databaseId || 'N/A'})`);
      }
      console.log('');
    }
    
    // Found in Database
    const foundInDB = results.filter(r => r.foundInDatabase);
    console.log(`\n✅ FOUND IN DATABASE: ${foundInDB.length}\n`);
    for (let i = 0; i < foundInDB.length; i++) {
      const result = foundInDB[i];
      console.log(`${i + 1}. ${result.expectedName}`);
      console.log(`   → Found as: ${result.databaseName || result.expectedName}`);
      console.log(`   Status: ${result.databaseStatus || 'pending'}`);
      console.log(`   ID: ${result.databaseId || 'N/A'} | Phone: ${result.databasePhone || 'N/A'}`);
      if (result.checkInTime) {
        console.log(`   ✅ CHECKED IN: ${result.checkInTime}`);
      }
      if (result.foundInDeltaRegistration) {
        console.log(`   Delta Registration: ${result.deltaRegistrationLocation || 'N/A'}`);
      }
      if (result.foundInCampersCSV) {
        console.log(`   Campers CSV: ID ${result.campersCSVId || 'N/A'}`);
      }
      console.log('');
    }
    
    // Not Found Anywhere
    const notFound = results.filter(r => !r.foundInDeltaRegistration && !r.foundInCampersCSV && !r.foundInDatabase);
    if (notFound.length > 0) {
      console.log(`\n❌ NOT FOUND ANYWHERE: ${notFound.length}\n`);
      for (let i = 0; i < notFound.length; i++) {
        console.log(`${i + 1}. ${notFound[i].expectedName}`);
      }
      console.log('');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const checkedIn = results.filter(r => r.databaseStatus === 'checked-in');
    
    console.log(`Total Expected Delegates: ${results.length}`);
    console.log(`✅ Found in Delta Registration: ${foundInDelta.length}`);
    console.log(`✅ Found in Campers CSV: ${foundInCampers.length}`);
    console.log(`✅ Found in Database: ${foundInDB.length}`);
    console.log(`✅ Actually Checked In: ${checkedIn.length}`);
    console.log(`❌ Not Found Anywhere: ${notFound.length}\n`);
    
    // Export to CSV
    const exportData: any[] = [];
    for (const result of results) {
      exportData.push({
        'Expected Name': result.expectedName,
        'Found in Delta Registration': result.foundInDeltaRegistration ? 'Yes' : 'No',
        'Delta Registration Location': result.deltaRegistrationLocation || '',
        'Delta Registration Phone': result.deltaRegistrationPhone || '',
        'Delta Registration Email': result.deltaRegistrationEmail || '',
        'Found in Campers CSV': result.foundInCampersCSV ? 'Yes' : 'No',
        'Campers CSV ID': result.campersCSVId || '',
        'Campers CSV Notes': result.campersCSVNotes || '',
        'Found in Database': result.foundInDatabase ? 'Yes' : 'No',
        'Database Name': result.databaseName || '',
        'Database Status': result.databaseStatus || '',
        'Database ID': result.databaseId || '',
        'Database Phone': result.databasePhone || '',
        'Check-In Time': result.checkInTime ? new Date(result.checkInTime).toISOString() : '',
        'Found Anywhere': (result.foundInDeltaRegistration || result.foundInCampersCSV || result.foundInDatabase) ? 'Yes' : 'No'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `orogun-delta-campers-match-${Date.now()}.csv`);
    const headers = Object.keys(exportData[0] || {});
    const csvRows = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];
    
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`💾 Exported results to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

matchOrogunAgainstDeltaAndCampers();




