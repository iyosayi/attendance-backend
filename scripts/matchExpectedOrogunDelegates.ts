import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface MatchResult {
  expectedName: string;
  foundInRegistration: boolean;
  registrationLocation?: string;
  registrationPhone?: string;
  registrationEmail?: string;
  foundInDatabase: boolean;
  databaseStatus?: string;
  databaseId?: string;
  databasePhone?: string;
  databaseEmail?: string;
  databaseName?: string;
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
  const parts1 = n1.split(/\s+/).filter(p => p.length >= 2);
  const parts2 = n2.split(/\s+/).filter(p => p.length >= 2);
  
  if (parts1.length === 0 || parts2.length === 0) return false;
  
  // Check if all parts match (order independent)
  if (parts1.length === parts2.length) {
    const sorted1 = parts1.sort().join(' ');
    const sorted2 = parts2.sort().join(' ');
    if (sorted1 === sorted2) return true;
  }
  
  // Check if one contains the other (for partial matches)
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check word-level matches - need at least 2 significant words to match
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
  
  // If at least 2 words match, consider it a match
  // Or if one name has 2+ parts and all match
  if (matchCount >= 2) return true;
  if (parts1.length >= 2 && parts2.length >= 2 && matchCount === Math.min(parts1.length, parts2.length)) return true;
  
  return false;
}

async function matchExpectedOrogunDelegates() {
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
    console.log('🔍 MATCHING EXPECTED OROGUN DELEGATES');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected Delegates: ${expectedDelegates.length}\n`);
    
    // Load registration CSV - store all entries for direct search
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const registrationEntries: Array<{ location: string; firstName: string; lastName: string; email: string; phone: string; fullName: string }> = [];
    
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
          
          registrationEntries.push({
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
    
    console.log(`Loaded ${registrationEntries.length} registrations from CSV\n`);
    
    const results: MatchResult[] = [];
    
    for (const expectedName of expectedDelegates) {
      const result: MatchResult = {
        expectedName,
        foundInRegistration: false,
        foundInDatabase: false
      };
      
      // Check registration CSV - search directly through entries
      const normalizedSearchName = normalizeName(expectedName);
      
      for (const regEntry of registrationEntries) {
        const regFullName = normalizeName(regEntry.fullName);
        const regReversed = normalizeName(`${regEntry.lastName} ${regEntry.firstName}`);
        
        if (namesMatch(normalizedSearchName, regFullName) || 
            namesMatch(normalizedSearchName, regReversed)) {
          result.foundInRegistration = true;
          result.registrationLocation = regEntry.location || '';
          result.registrationPhone = regEntry.phone || '';
          result.registrationEmail = regEntry.email || '';
          break;
        }
      }
      
      // Check database by name
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
            result.databaseEmail = camper.email;
            result.databaseName = camperFullName;
            result.checkInTime = camper.checkInTime;
            result.notes = camper.notes;
            break;
          }
        }
        if (result.foundInDatabase) break;
      }
      
      // Also check by phone if we found registration
      if (result.foundInRegistration && result.registrationPhone && !result.foundInDatabase) {
        const normalizedPhone = result.registrationPhone.replace(/\D/g, '');
        if (normalizedPhone.length >= 6) {
          const phoneCampers = await Camper.find({
            phone: { $regex: normalizedPhone.slice(-6), $options: 'i' },
            isDeleted: false
          }).lean();
          
          for (const camper of phoneCampers) {
            const camperFullName = `${camper.firstName} ${camper.lastName}`.trim();
            if (namesMatch(normalizedSearchName, normalizeName(camperFullName))) {
              result.foundInDatabase = true;
              result.databaseStatus = camper.status || 'pending';
              result.databaseId = camper.code || camper._id.toString();
              result.databasePhone = camper.phone;
              result.databaseEmail = camper.email;
              result.databaseName = camperFullName;
              result.checkInTime = camper.checkInTime;
              result.notes = camper.notes;
              break;
            }
          }
        }
      }
      
      results.push(result);
    }
    
    // Print results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CHECKED IN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const checkedIn = results.filter(r => r.databaseStatus === 'checked-in');
    if (checkedIn.length > 0) {
      for (let i = 0; i < checkedIn.length; i++) {
        const result = checkedIn[i];
        console.log(`${i + 1}. ${result.expectedName}`);
        console.log(`   → Found as: ${result.databaseName || result.expectedName}`);
        console.log(`   ID: ${result.databaseId || 'N/A'} | Phone: ${result.databasePhone || result.registrationPhone || 'N/A'}`);
        if (result.checkInTime) {
          console.log(`   Check-in Time: ${result.checkInTime}`);
        }
        if (result.registrationLocation) {
          console.log(`   Registration Location: ${result.registrationLocation}`);
        }
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⏳ REGISTERED BUT NOT CHECKED IN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const registeredNotCheckedIn = results.filter(r => 
      r.foundInRegistration && r.databaseStatus !== 'checked-in'
    );
    if (registeredNotCheckedIn.length > 0) {
      for (let i = 0; i < registeredNotCheckedIn.length; i++) {
        const result = registeredNotCheckedIn[i];
        console.log(`${i + 1}. ${result.expectedName}`);
        console.log(`   Registration Location: ${result.registrationLocation || 'N/A'}`);
        console.log(`   Phone: ${result.registrationPhone || 'N/A'}`);
        if (result.foundInDatabase) {
          console.log(`   Database Status: ${result.databaseStatus || 'pending'}`);
          console.log(`   ID: ${result.databaseId || 'N/A'}`);
          if (result.databaseName && result.databaseName !== result.expectedName) {
            console.log(`   Found as: ${result.databaseName}`);
          }
        } else {
          console.log(`   Not found in database`);
        }
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ NOT FOUND IN REGISTRATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const notInRegistration = results.filter(r => !r.foundInRegistration);
    if (notInRegistration.length > 0) {
      for (let i = 0; i < notInRegistration.length; i++) {
        const result = notInRegistration[i];
        console.log(`${i + 1}. ${result.expectedName}`);
        if (result.foundInDatabase) {
          console.log(`   Found in database: ${result.databaseStatus || 'pending'}`);
          console.log(`   ID: ${result.databaseId || 'N/A'}`);
          console.log(`   Found as: ${result.databaseName || result.expectedName}`);
        } else {
          console.log(`   Not found anywhere`);
        }
        console.log('');
      }
    } else {
      console.log('None\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const totalExpected = results.length;
    const foundInRegistration = results.filter(r => r.foundInRegistration).length;
    const foundInDatabase = results.filter(r => r.foundInDatabase).length;
    const actuallyCheckedIn = checkedIn.length;
    const registeredNotAttended = registeredNotCheckedIn.length;
    const notFound = notInRegistration.length;
    
    console.log(`Total Expected Delegates: ${totalExpected}`);
    console.log(`✅ Found in Registration: ${foundInRegistration}`);
    console.log(`✅ Found in Database: ${foundInDatabase}`);
    console.log(`✅ Actually Checked In: ${actuallyCheckedIn}`);
    console.log(`⏳ Registered but NOT Checked In: ${registeredNotAttended}`);
    console.log(`❌ Not Found in Registration: ${notFound}\n`);
    
    if (foundInRegistration > 0) {
      const attendanceRate = ((actuallyCheckedIn / foundInRegistration) * 100).toFixed(1);
      console.log(`📈 ATTENDANCE RATE: ${attendanceRate}% (${actuallyCheckedIn} out of ${foundInRegistration} registered)`);
    }
    
    // Export to CSV
    const exportData: any[] = [];
    for (const result of results) {
      exportData.push({
        'Expected Name': result.expectedName,
        'Found in Registration': result.foundInRegistration ? 'Yes' : 'No',
        'Registration Location': result.registrationLocation || '',
        'Registration Phone': result.registrationPhone || '',
        'Registration Email': result.registrationEmail || '',
        'Found in Database': result.foundInDatabase ? 'Yes' : 'No',
        'Database Name': result.databaseName || '',
        'Database Status': result.databaseStatus || '',
        'Database ID': result.databaseId || '',
        'Database Phone': result.databasePhone || '',
        'Database Email': result.databaseEmail || '',
        'Check-In Time': result.checkInTime ? new Date(result.checkInTime).toISOString() : '',
        'Attendance Status': result.databaseStatus === 'checked-in' ? 'ATTENDED' :
                            result.databaseStatus === 'checked-out' ? 'ATTENDED (Left)' :
                            result.foundInRegistration ? 'REGISTERED BUT NOT ATTENDED' :
                            'NOT FOUND'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `expected-orogun-delegates-match-${Date.now()}.csv`);
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
    console.log(`\n💾 Exported results to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

matchExpectedOrogunDelegates();

