import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface MatchResult {
  name: string;
  foundInRegistration: boolean;
  registrationLocation?: string;
  foundInDatabase: boolean;
  databaseStatus?: string;
  databaseId?: string;
  databasePhone?: string;
  databaseEmail?: string;
  checkInTime?: Date;
  notes?: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (n1 === n2) return true;
  
  // Split into parts
  const parts1 = n1.split(/\s+/);
  const parts2 = n2.split(/\s+/);
  
  // Check if all parts match (order independent)
  if (parts1.length === parts2.length) {
    const sorted1 = parts1.sort().join(' ');
    const sorted2 = parts2.sort().join(' ');
    if (sorted1 === sorted2) return true;
  }
  
  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check word-level matches
  for (const p1 of parts1) {
    if (p1.length >= 3) {
      for (const p2 of parts2) {
        if (p1 === p2) return true;
      }
    }
  }
  
  return false;
}

async function matchSpecificNames() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    const namesToMatch = [
      'Progress ogodogu',
      'Abadi Elohor',
      'Doren Kingsley',
      'Divine Philip',
      'Frank glory',
      'Egunure Eguono',
      'Shalom Peghe',
      'David oke',
      'Great ariosaere',
      'Egunure suvew',
      'Emele emomotimi',
      'Keren gbolotein',
      'Moses Sarah',
      'Susanna ogbu',
      'Simakmo precious',
      'Ojagbere awe miracle'
    ];
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 MATCHING SPECIFIC NAMES');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Load registration CSV
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const registrationData: Map<string, { location: string; firstName: string; lastName: string; email: string; phone: string }> = new Map();
    
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
          
          const fullName = `${firstName} ${lastName}`.trim();
          const key = normalizeName(fullName);
          
          registrationData.set(key, {
            location,
            firstName,
            lastName,
            email,
            phone
          });
        }
      }
    }
    
    console.log(`Loaded ${registrationData.size} registrations from CSV\n`);
    
    const results: MatchResult[] = [];
    
    for (const nameToMatch of namesToMatch) {
      const result: MatchResult = {
        name: nameToMatch,
        foundInRegistration: false,
        foundInDatabase: false
      };
      
      // Check registration CSV
      const normalizedSearchName = normalizeName(nameToMatch);
      for (const [key, regData] of registrationData.entries()) {
        if (namesMatch(normalizedSearchName, key)) {
          result.foundInRegistration = true;
          result.registrationLocation = regData.location;
          break;
        }
      }
      
      // Check database
      const nameParts = nameToMatch.split(/\s+/).filter(p => p.length >= 2);
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
            result.databaseEmail = camper.email;
            result.checkInTime = camper.checkInTime;
            result.notes = camper.notes;
            break;
          }
        }
        if (result.foundInDatabase) break;
      }
      
      results.push(result);
    }
    
    // Print results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 MATCH RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Checked in
    const checkedIn = results.filter(r => r.databaseStatus === 'checked-in');
    if (checkedIn.length > 0) {
      console.log('✅ CHECKED IN:\n');
      for (const result of checkedIn) {
        console.log(`• ${result.name}`);
        console.log(`  Status: ${result.databaseStatus}`);
        console.log(`  ID: ${result.databaseId || 'N/A'}`);
        console.log(`  Phone: ${result.databasePhone || 'N/A'}`);
        if (result.checkInTime) {
          console.log(`  Check-in Time: ${result.checkInTime}`);
        }
        if (result.foundInRegistration) {
          console.log(`  📍 Registration Location: ${result.registrationLocation || 'N/A'}`);
          if (result.registrationLocation?.toLowerCase().includes('orogun')) {
            console.log(`  ⚠️  FROM OROGUN/DELTA!`);
          }
        }
        console.log('');
      }
    }
    
    // Found in registration but not checked in
    const registeredNotCheckedIn = results.filter(r => 
      r.foundInRegistration && r.databaseStatus !== 'checked-in'
    );
    if (registeredNotCheckedIn.length > 0) {
      console.log('⏳ REGISTERED BUT NOT CHECKED IN:\n');
      for (const result of registeredNotCheckedIn) {
        console.log(`• ${result.name}`);
        console.log(`  📍 Registration Location: ${result.registrationLocation || 'N/A'}`);
        if (result.registrationLocation?.toLowerCase().includes('orogun')) {
          console.log(`  ⚠️  FROM OROGUN/DELTA!`);
        }
        if (result.foundInDatabase) {
          console.log(`  Database Status: ${result.databaseStatus || 'pending'}`);
          console.log(`  ID: ${result.databaseId || 'N/A'}`);
        } else {
          console.log(`  Not found in database`);
        }
        console.log('');
      }
    }
    
    // Not found in registration
    const notInRegistration = results.filter(r => !r.foundInRegistration);
    if (notInRegistration.length > 0) {
      console.log('❌ NOT FOUND IN REGISTRATION:\n');
      for (const result of notInRegistration) {
        console.log(`• ${result.name}`);
        if (result.foundInDatabase) {
          console.log(`  Found in database: ${result.databaseStatus || 'pending'}`);
          console.log(`  ID: ${result.databaseId || 'N/A'}`);
        } else {
          console.log(`  Not found anywhere`);
        }
        console.log('');
      }
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const orogunDelta = results.filter(r => 
      r.registrationLocation?.toLowerCase().includes('orogun') || 
      r.registrationLocation?.toLowerCase().includes('delta')
    );
    
    console.log(`Total Names Searched: ${results.length}`);
    console.log(`✅ Checked In: ${checkedIn.length}`);
    console.log(`⏳ Registered but NOT Checked In: ${registeredNotCheckedIn.length}`);
    console.log(`❌ Not Found in Registration: ${notInRegistration.length}`);
    console.log(`📍 From Orogun/Delta: ${orogunDelta.length}\n`);
    
    if (orogunDelta.length > 0) {
      console.log('⚠️  NAMES FROM OROGUN/DELTA:\n');
      for (const result of orogunDelta) {
        console.log(`• ${result.name}`);
        console.log(`  Location: ${result.registrationLocation}`);
        console.log(`  Status: ${result.databaseStatus || 'Not in database'}`);
        console.log('');
      }
    }
    
    // Export to CSV
    const exportData: any[] = [];
    for (const result of results) {
      exportData.push({
        'Name': result.name,
        'Found in Registration': result.foundInRegistration ? 'Yes' : 'No',
        'Registration Location': result.registrationLocation || '',
        'From Orogun/Delta': (result.registrationLocation?.toLowerCase().includes('orogun') || 
                             result.registrationLocation?.toLowerCase().includes('delta')) ? 'Yes' : 'No',
        'Found in Database': result.foundInDatabase ? 'Yes' : 'No',
        'Database Status': result.databaseStatus || '',
        'Database ID': result.databaseId || '',
        'Phone': result.databasePhone || '',
        'Email': result.databaseEmail || '',
        'Check-In Time': result.checkInTime ? new Date(result.checkInTime).toISOString() : ''
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `specific-names-match-${Date.now()}.csv`);
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

matchSpecificNames();







