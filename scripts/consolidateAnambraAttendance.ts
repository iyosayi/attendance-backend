import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface Person {
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  id?: string;
  status?: string;
  checkInTime?: Date;
  source: string;
  notes?: string;
  registrationLocation?: string;
}

interface ExpectedPerson {
  name: string;
  phone?: string;
  gender?: string;
  location?: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
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

async function consolidateAnambraAttendance() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    // Expected manifest list
    const expectedManifest = [
      { name: 'Okoli Nnagozie Emmanuel', phone: '07048613821', gender: 'male', location: 'Akwa' },
      { name: 'Afam-Nkwoka Ifeanyichukwu', phone: '07043568707', gender: 'male', location: 'Akwa' },
      { name: 'Eze Nkechi', phone: '09077352172', gender: 'Female', location: 'Awka' },
      { name: 'Ikechukwu Chukwuebuka', phone: '09116291415', gender: 'male', location: 'Akwa' },
      { name: 'Enemuo Jude Chekwube', phone: '09123986861', gender: 'male', location: 'Awka' },
      { name: 'Okoli Divine. C', phone: '09160724745', gender: 'male', location: 'Akwa' },
      { name: 'Victory Ifeanyi David', phone: '08080336841', gender: 'male', location: 'Awka' },
      { name: 'Christian Ebuka ogbaegbe', phone: '08168939870', gender: 'male', location: 'Awka' },
      { name: 'Nezianya Chiagozie Joseph', phone: '08061453229', gender: 'male', location: 'Awka' },
      { name: 'Nwankwo Sochima', phone: '07012725047', gender: 'male', location: 'Akwa' },
      { name: 'Teddy -Austin prisca', phone: '08105732406', gender: 'female', location: 'awka' },
      { name: 'Mba Queen', phone: '09049922284', gender: 'Female', location: 'Awka' },
      { name: 'Desire chinweoke Ogboso', phone: '08162832932', gender: 'male', location: 'Akwa' },
      { name: 'onyeakagbusi Juliet', phone: '09161195418', gender: 'female', location: 'awka' },
      { name: 'chioma Gloria Odoemenam', phone: '09036632377', gender: 'female', location: 'Awka' },
      { name: 'Major Chibuzor Maxwell', phone: '09030638196', gender: 'male', location: 'Awka' },
      { name: 'Miracle Onuoha', phone: '09061378070', gender: 'Female', location: 'Awka' },
      { name: 'umeh angel', phone: '08147825024', gender: 'female', location: 'Awka' },
      { name: 'nwobodo izunna', phone: '08107231819', gender: 'male', location: 'awka' },
      { name: 'Delight ogboso', phone: '09044872194', gender: 'male', location: 'awka' },
      { name: 'Ebirim Queen Ebubechukwu', phone: '08067786642', gender: 'Female', location: 'Awka' },
      { name: 'Nnolika Freeman precious', phone: '08164108690', gender: 'female', location: 'Awka' },
      { name: 'Nnolika freeman peace', phone: '09064219554', gender: 'female', location: 'Awka' },
      { name: 'Maduelosi Owen', phone: '09161142515', gender: 'male', location: 'awka' },
      { name: 'ChukwuemekaEmmanel okeke', phone: '08085367700', gender: 'male', location: 'Awka' },
      { name: 'Mmaduakonam Joshua', phone: '09020821297', gender: 'Male', location: 'Awka' },
      { name: 'Nnamdi Chidera', phone: '08117562062', gender: 'Male', location: 'Owerri' }
    ];
    
    // Additional names to check
    const additionalNames = [
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
    
    const allExpected: Array<ExpectedPerson & { source: string }> = [
      ...expectedManifest.map(e => ({ ...e, source: 'Manifest' })),
      ...additionalNames.map(n => ({ name: n, phone: undefined, gender: undefined, location: undefined, source: 'Additional List' }))
    ];
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ANAMBRA ATTENDANCE CONSOLIDATION REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allAttendees = new Map<string, Person>();
    
    // 1. Load from Database
    console.log('📂 Loading data from Database...');
    const anambraRegex = new RegExp('anambra|akwa|awka', 'i');
    const dbCampers = await Camper.find({
      $or: [
        { notes: anambraRegex },
        { email: anambraRegex }
      ],
      isDeleted: false
    }).lean();
    
    console.log(`   Found ${dbCampers.length} campers in database\n`);
    
    for (const camper of dbCampers) {
      const fullName = `${camper.firstName} ${camper.lastName}`.trim();
      const key = normalizeName(fullName);
      
      if (!allAttendees.has(key)) {
        allAttendees.set(key, {
          firstName: camper.firstName,
          lastName: camper.lastName,
          fullName,
          phone: camper.phone,
          email: camper.email,
          status: (camper.status as any) || 'pending',
          id: camper.code || camper._id.toString(),
          checkInTime: camper.checkInTime,
          source: 'Database',
          notes: camper.notes
        });
      } else {
        const existing = allAttendees.get(key)!;
        if (camper.status === 'checked-in' && existing.status !== 'checked-in') {
          existing.status = 'checked-in';
          existing.checkInTime = camper.checkInTime;
        }
        existing.source = `${existing.source}, Database`;
      }
    }
    
    // 2. Load from Registration CSV
    console.log('📂 Loading data from Registration CSV...');
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    if (fs.existsSync(registrationPath)) {
      const csvContent = fs.readFileSync(registrationPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      let regCount = 0;
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
          
          if (location.toLowerCase().includes('anambra') || 
              location.toLowerCase().includes('akwa') || 
              location.toLowerCase().includes('awka')) {
            regCount++;
            const fullName = `${firstName} ${lastName}`.trim();
            const key = normalizeName(fullName);
            
            if (!allAttendees.has(key)) {
              allAttendees.set(key, {
                firstName,
                lastName,
                fullName,
                phone,
                email,
                status: 'pending',
                source: 'Registration CSV',
                notes: `Location: ${location}`
              });
            } else {
              const existing = allAttendees.get(key)!;
              if (!existing.phone && phone) existing.phone = phone;
              if (!existing.email && email) existing.email = email;
              if (!existing.registrationLocation && location) existing.registrationLocation = location;
              existing.source = `${existing.source}, Registration CSV`;
            }
          }
        }
      }
      console.log(`   Found ${regCount} registrations\n`);
    }
    
    // 3. Load from Campers CSV
    console.log('📂 Loading data from Campers CSV...');
    const campersPath = path.join(__dirname, '..', 'campers.csv');
    if (fs.existsSync(campersPath)) {
      const csvContent = fs.readFileSync(campersPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      let camperCount = 0;
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
        
        if (parts.length >= 4) {
          const id = parts[0] || '';
          const firstName = parts[1] || '';
          const lastName = parts[2] || '';
          const notes = parts[4] || '';
          
          if (notes.toLowerCase().includes('anambra') || 
              notes.toLowerCase().includes('akwa') || 
              notes.toLowerCase().includes('awka')) {
            camperCount++;
            const fullName = `${firstName} ${lastName}`.trim();
            const key = normalizeName(fullName);
            
            if (!allAttendees.has(key)) {
              allAttendees.set(key, {
                firstName,
                lastName,
                fullName,
                id,
                status: 'pending',
                source: 'Campers CSV',
                notes
              });
            } else {
              const existing = allAttendees.get(key)!;
              if (!existing.id && id) existing.id = id;
              existing.source = `${existing.source}, Campers CSV`;
            }
          }
        }
      }
      console.log(`   Found ${camperCount} entries\n`);
    }
    
    // 4. Load from Check-in CSV
    console.log('📂 Loading data from Check-in CSV...');
    const checkInPath = path.join(__dirname, '..', 'uploads', 'checked-in-by-location-anambra-1763799165943.csv');
    if (fs.existsSync(checkInPath)) {
      const csvContent = fs.readFileSync(checkInPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      let checkInCount = 0;
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
          const firstName = parts[0]?.replace(/^"|"$/g, '') || '';
          const lastName = parts[1]?.replace(/^"|"$/g, '') || '';
          const email = parts[2]?.replace(/^"|"$/g, '') || '';
          const phone = parts[3]?.replace(/^"|"$/g, '') || '';
          const checkInTime = parts[8]?.replace(/^"|"$/g, '') || '';
          const location = parts[7]?.replace(/^"|"$/g, '') || '';
          
          checkInCount++;
          const fullName = `${firstName} ${lastName}`.trim();
          const key = normalizeName(fullName);
          
          if (!allAttendees.has(key)) {
            allAttendees.set(key, {
              firstName,
              lastName,
              fullName,
              phone,
              email,
              status: 'checked-in',
              checkInTime: checkInTime ? new Date(checkInTime) : undefined,
              source: 'Check-In CSV',
              registrationLocation: location
            });
          } else {
            const existing = allAttendees.get(key)!;
            if (!existing.phone && phone) existing.phone = phone;
            if (!existing.email && email) existing.email = email;
            if (existing.status !== 'checked-in') {
              existing.status = 'checked-in';
              existing.checkInTime = checkInTime ? new Date(checkInTime) : undefined;
            }
            existing.source = `${existing.source}, Check-In CSV`;
          }
        }
      }
      console.log(`   Found ${checkInCount} check-ins\n`);
    } else {
      console.log('   Check-in CSV not found\n');
    }
    
    console.log(`✅ Total Unique Anambra Attendees Found: ${allAttendees.size}\n`);
    
    // Match expected names
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 MATCHING EXPECTED NAMES');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const matchResults: Array<{
      expected: ExpectedPerson & { source: string };
      matched: boolean;
      matches: Person[];
    }> = [];
    
    for (const expected of allExpected) {
      const matches: Person[] = [];
      const normalizedExpected = normalizeName(expected.name);
      
      // Search by name
      for (const [, person] of allAttendees.entries()) {
        const normalizedPerson = normalizeName(person.fullName);
        const reversedPerson = normalizeName(`${person.lastName} ${person.firstName}`);
        
        if (namesMatch(normalizedExpected, normalizedPerson) || 
            namesMatch(normalizedExpected, reversedPerson)) {
          matches.push(person);
        }
      }
      
      // Also search by phone if available
      if (expected.phone && matches.length === 0) {
        const normalizedPhone = normalizePhone(expected.phone);
        for (const [, person] of allAttendees.entries()) {
          if (person.phone) {
            const personPhone = normalizePhone(person.phone);
            if (personPhone.includes(normalizedPhone.slice(-6)) || normalizedPhone.includes(personPhone.slice(-6))) {
              if (!matches.some(m => m.fullName === person.fullName)) {
                matches.push(person);
              }
            }
          }
        }
      }
      
      matchResults.push({
        expected: expected as ExpectedPerson & { source: string },
        matched: matches.length > 0,
        matches
      });
    }
    
    // Print matches
    const manifestMatches = matchResults.filter(r => r.expected.source === 'Manifest');
    const additionalMatches = matchResults.filter(r => r.expected.source === 'Additional List');
    
    console.log('✅ MANIFEST MATCHES:\n');
    let manifestCheckedIn = 0;
    let manifestPending = 0;
    let manifestNotFound = 0;
    
    for (let i = 0; i < manifestMatches.length; i++) {
      const result = manifestMatches[i];
      if (result.matched) {
        const checkedInMatch = result.matches.find(m => m.status === 'checked-in');
        if (checkedInMatch) {
          manifestCheckedIn++;
          console.log(`${i + 1}. ✅ ${result.expected.name}`);
          console.log(`   → Found as: ${checkedInMatch.fullName} (CHECKED IN)`);
          console.log(`   ID: ${checkedInMatch.id || 'N/A'} | Phone: ${checkedInMatch.phone || result.expected.phone || 'N/A'}`);
          if (checkedInMatch.checkInTime) console.log(`   Check-in Time: ${checkedInMatch.checkInTime}`);
        } else {
          manifestPending++;
          const match = result.matches[0];
          console.log(`${i + 1}. ⏳ ${result.expected.name}`);
          console.log(`   → Found as: ${match.fullName} (Registered but NOT checked in)`);
          console.log(`   ID: ${match.id || 'N/A'} | Phone: ${match.phone || result.expected.phone || 'N/A'}`);
          console.log(`   Status: ${match.status || 'pending'}`);
        }
      } else {
        manifestNotFound++;
        console.log(`${i + 1}. ❌ ${result.expected.name}`);
        if (result.expected.phone) console.log(`   Phone: ${result.expected.phone}`);
      }
      console.log('');
    }
    
    console.log('\n✅ ADDITIONAL NAMES MATCHES:\n');
    let additionalCheckedIn = 0;
    let additionalPending = 0;
    let additionalNotFound = 0;
    
    for (let i = 0; i < additionalMatches.length; i++) {
      const result = additionalMatches[i];
      if (result.matched) {
        const checkedInMatch = result.matches.find(m => m.status === 'checked-in');
        if (checkedInMatch) {
          additionalCheckedIn++;
          console.log(`${i + 1}. ✅ ${result.expected.name}`);
          console.log(`   → Found as: ${checkedInMatch.fullName} (CHECKED IN)`);
          console.log(`   ID: ${checkedInMatch.id || 'N/A'} | Phone: ${checkedInMatch.phone || 'N/A'}`);
          if (checkedInMatch.checkInTime) console.log(`   Check-in Time: ${checkedInMatch.checkInTime}`);
        } else {
          additionalPending++;
          const match = result.matches[0];
          console.log(`${i + 1}. ⏳ ${result.expected.name}`);
          console.log(`   → Found as: ${match.fullName} (Registered but NOT checked in)`);
          console.log(`   ID: ${match.id || 'N/A'} | Phone: ${match.phone || 'N/A'}`);
          console.log(`   Status: ${match.status || 'pending'}`);
        }
      } else {
        additionalNotFound++;
        console.log(`${i + 1}. ❌ ${result.expected.name} - Not found`);
      }
      console.log('');
    }
    
    // Categorize all attendees
    const checkedIn = Array.from(allAttendees.values()).filter(a => a.status === 'checked-in');
    const checkedOut = Array.from(allAttendees.values()).filter(a => a.status === 'checked-out');
    const pending = Array.from(allAttendees.values()).filter(a => a.status === 'pending' || !a.status);
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY STATISTICS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total Unique Anambra Attendees Found:    ${allAttendees.size}`);
    console.log(`✅ Actually Checked In:                  ${checkedIn.length}`);
    console.log(`🚪 Checked Out:                         ${checkedOut.length}`);
    console.log(`⏳ Registered but NOT Checked In:        ${pending.length}\n`);
    
    console.log(`📋 MANIFEST LIST (${manifestMatches.length} names):`);
    console.log(`   ✅ Checked In: ${manifestCheckedIn}`);
    console.log(`   ⏳ Registered but NOT Checked In: ${manifestPending}`);
    console.log(`   ❌ Not Found: ${manifestNotFound}\n`);
    
    console.log(`📋 ADDITIONAL NAMES LIST (${additionalMatches.length} names):`);
    console.log(`   ✅ Checked In: ${additionalCheckedIn}`);
    console.log(`   ⏳ Registered but NOT Checked In: ${additionalPending}`);
    console.log(`   ❌ Not Found: ${additionalNotFound}\n`);
    
    if (allAttendees.size > 0) {
      const attendanceRate = (checkedIn.length / allAttendees.size * 100).toFixed(1);
      console.log(`📈 OVERALL ATTENDANCE RATE: ${attendanceRate}%`);
    }
    
    // Export to CSV
    const exportData: any[] = [];
    
    // Export all attendees
    for (const person of Array.from(allAttendees.values())) {
      // Find if this person matches an expected name
      let expectedMatch = '';
      let expectedSource = '';
      for (const result of matchResults) {
        if (result.matches.some(m => normalizeName(m.fullName) === normalizeName(person.fullName))) {
          expectedMatch = result.expected.name;
          expectedSource = result.expected.source;
          break;
        }
      }
      
      exportData.push({
        'Expected Name': expectedMatch || '',
        'Expected Source': expectedSource || '',
        'First Name': person.firstName,
        'Last Name': person.lastName,
        'Full Name': person.fullName,
        'Phone': person.phone || '',
        'Email': person.email || '',
        'ID': person.id || '',
        'Status': person.status || 'pending',
        'Check-In Time': person.checkInTime ? new Date(person.checkInTime).toISOString() : '',
        'Registration Location': person.registrationLocation || '',
        'Source': person.source,
        'Notes': person.notes || '',
        'Attendance Category': person.status === 'checked-in' ? 'ATTENDED' :
                              person.status === 'checked-out' ? 'ATTENDED (Left)' :
                              'REGISTERED BUT NOT ATTENDED'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `anambra-attendance-consolidated-${Date.now()}.csv`);
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
    console.log(`💾 Exported consolidated data to: ${csvPath}\n`);
    
    // Export match results
    const matchExportData: any[] = [];
    for (const result of matchResults) {
      if (result.matched && result.matches.length > 0) {
        for (const match of result.matches) {
          matchExportData.push({
            'Expected Name': result.expected.name,
            'Expected Phone': result.expected.phone || '',
            'Expected Location': result.expected.location || '',
            'Expected Source': result.expected.source,
            'Found Name': match.fullName,
            'Found Phone': match.phone || '',
            'Found ID': match.id || '',
            'Status': match.status || 'pending',
            'Check-In Time': match.checkInTime ? new Date(match.checkInTime).toISOString() : '',
            'Source': match.source,
            'Attendance Status': match.status === 'checked-in' ? 'ATTENDED' :
                               match.status === 'checked-out' ? 'ATTENDED (Left)' :
                               'REGISTERED BUT NOT ATTENDED'
          });
        }
      } else {
        matchExportData.push({
          'Expected Name': result.expected.name,
          'Expected Phone': result.expected.phone || '',
          'Expected Location': result.expected.location || '',
          'Expected Source': result.expected.source,
          'Found Name': 'NOT FOUND',
          'Found Phone': '',
          'Found ID': '',
          'Status': '',
          'Check-In Time': '',
          'Source': '',
          'Attendance Status': 'NOT FOUND'
        });
      }
    }
    
    const matchCsvPath = path.join(__dirname, '..', 'uploads', `anambra-expected-names-match-${Date.now()}.csv`);
    const matchHeaders = Object.keys(matchExportData[0] || {});
    const matchCsvRows = [
      matchHeaders.join(','),
      ...matchExportData.map(row => 
        matchHeaders.map(header => {
          const value = row[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];
    
    fs.writeFileSync(matchCsvPath, matchCsvRows.join('\n'));
    console.log(`💾 Exported match results to: ${matchCsvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

consolidateAnambraAttendance();

