import * as fs from 'fs';
import * as path from 'path';

interface Person {
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  source: string;
  id?: string;
  gender?: string;
  checkInTime?: string;
  notes?: string;
}

interface ExpectedMember {
  original: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

// Normalize name for comparison
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

// Check if two names match
function namesMatch(name1: string, name2: string, strict: boolean = false): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (n1 === n2) return true;
  if (strict) return false;
  
  // Check if one contains the other (for partial matches)
  if (n1.length >= 3 && n2.length >= 3) {
    return n1.includes(n2) || n2.includes(n1);
  }
  return false;
}

// Parse expected Kokori Team list
function parseExpectedKokoriTeam(): ExpectedMember[] {
  const kokoriList = `
1.Pastor kester Kolenda:09075781235
2.Okpeki Betty:08168961052
3.Hither Rukevwe:07089289633
4.Daniel Solomon:09051127097
5.Omokiniovo Onoriode:07013853102
6.Billyyoko Onoriode:09041656858
7.Onoriode Eseoghene Gift:09011893078
8. Abadi loveth:08025749689
9.Gift Mina:09027666077
10.Successful Augustine: 08153151881
11.Junior  fear God:08058333540
12.Joy Anthony 08103094483
13.Peace kokori  08061252991
14.Rukevwe Ezekiel 09041179479
15.Ojijevwe Theophilus 07057541785
16.Ogban Kevwe Samuel 08109940045
17.Friday serome:09124968623
18.Monday Emmanuel:07043454092
19.Joyce OMONIGHO  0803 248 1626
20.Prevail Obavwonvwe 08154452725
21.Ikono God's love 09075781235
22.Destiny ibobo
23.Deborah owebor
24.Ogban Favour
25.Chidi Isaac
26.Chidi Isaac
27.Jennifer Brown 
28.Chukwudi Favour 
29.Sumonu Elo
30.Endurance Omuvi 
31.Good luck Israel
32.Uloh promise:0815 445 3141
33.Abadi Eloho:0815 445 7564
34.Friday serome:09124968623
35.Monday Emmanuel:07043454092
36.Joyce OMONIGHO  0803 248 1626
37.Prevail Obavwonvwe 08154452725
38.Ikono God's love 09075781235
39.Ighoruona Divine 
41.Juliet James 
42.Freeborn Felix 
43.Andrew Brme
44.John obukevwo 
45.Egware festus
46.Akpede Felix 
`.trim();

  const members: ExpectedMember[] = [];
  const seen = new Set<string>();
  
  const lines = kokoriList.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Remove numbering and phone numbers
    let cleanLine = line.replace(/^\d+\./, '').trim();
    
    // Extract phone number
    const phoneMatch = cleanLine.match(/:?(\d[\d\s]{9,})/);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : undefined;
    
    // Remove phone numbers
    cleanLine = cleanLine.replace(/:\d+[\d\s]*/g, '').trim();
    
    // Remove titles
    cleanLine = cleanLine.replace(/^(Pastor|Mr|Mrs|Miss|Dr)\s+/i, '').trim();
    
    if (!cleanLine) continue;
    
    // Create unique key to avoid duplicates
    const key = normalizeName(cleanLine);
    if (seen.has(key)) continue;
    seen.add(key);
    
    // Split name
    const parts = cleanLine.split(/\s+/).filter(p => p);
    
    if (parts.length === 0) continue;
    
    let firstName = '';
    let lastName = '';
    
    if (parts.length === 1) {
      firstName = parts[0];
      lastName = '';
    } else if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else {
      // Multiple parts - take first as first name, rest as last name
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    
    members.push({
      original: cleanLine,
      firstName: firstName,
      lastName: lastName,
      phone: phone
    });
  }

  return members;
}

// Load check-in data from CSV
function loadCheckInData(): Person[] {
  const csvPath = path.join(__dirname, '..', 'uploads', 'checked-in-by-location-kokori-1763796468685.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Check-in CSV not found');
    return [];
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const people: Person[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV (handle quoted fields)
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
      const gender = parts[4]?.replace(/^"|"$/g, '') || '';
      const checkInTime = parts[8]?.replace(/^"|"$/g, '') || '';
      const notes = parts[10]?.replace(/^"|"$/g, '') || '';
      
      people.push({
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        phone,
        email,
        gender,
        checkInTime,
        notes,
        source: 'Check-In'
      });
    }
  }
  
  return people;
}

// Load registration data
function loadRegistrationData(): Person[] {
  const csvPath = path.join(__dirname, '..', 'registration.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Registration CSV not found');
    return [];
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const people: Person[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV
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
      const gender = parts[5] || '';
      const location = parts[9] || '';
      
      // Only include if location contains "Kokori"
      if (location.toLowerCase().includes('kokori')) {
        people.push({
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          phone,
          email,
          gender,
          source: 'Registration',
          notes: `Location: ${location}`
        });
      }
    }
  }
  
  return people;
}

// Load campers data
function loadCampersData(): Person[] {
  const csvPath = path.join(__dirname, '..', 'campers.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Campers CSV not found');
    return [];
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const people: Person[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV
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
      const gender = parts[3] || '';
      const notes = parts[4] || '';
      
      // Check if notes contain "Kokori"
      if (notes.toLowerCase().includes('kokori')) {
        people.push({
          id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          gender,
          notes,
          source: 'Campers'
        });
      }
    }
  }
  
  return people;
}

// Match person to expected member
function matchPersonToExpected(person: Person, expected: ExpectedMember): boolean {
  // Try exact match first
  if (namesMatch(person.firstName, expected.firstName, true) && 
      namesMatch(person.lastName, expected.lastName, true)) {
    return true;
  }
  
  // Try reversed
  if (namesMatch(person.firstName, expected.lastName, true) && 
      namesMatch(person.lastName, expected.firstName, true)) {
    return true;
  }
  
  // Try partial match
  if (namesMatch(person.firstName, expected.firstName) && 
      namesMatch(person.lastName, expected.lastName)) {
    return true;
  }
  
  // Try phone match
  if (person.phone && expected.phone) {
    const p1 = person.phone.replace(/\D/g, '');
    const p2 = expected.phone.replace(/\D/g, '');
    if (p1 && p2 && (p1.includes(p2) || p2.includes(p1))) {
      return true;
    }
  }
  
  // Try full name match
  const personFull = normalizeName(person.fullName);
  const expectedFull = normalizeName(`${expected.firstName} ${expected.lastName}`.trim());
  if (personFull && expectedFull && namesMatch(personFull, expectedFull)) {
    return true;
  }
  
  return false;
}

// Main function
function consolidateKokoriAttendance() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 KOKORI ATTENDANCE CONSOLIDATION REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Load all data sources
  console.log('📂 Loading data sources...\n');
  
  const expectedMembers = parseExpectedKokoriTeam();
  console.log(`✅ Expected Kokori Team: ${expectedMembers.length} members`);
  
  const checkInPeople = loadCheckInData();
  console.log(`✅ Check-In Data: ${checkInPeople.length} people`);
  
  const registrationPeople = loadRegistrationData();
  console.log(`✅ Registration Data: ${registrationPeople.length} people`);
  
  const campersPeople = loadCampersData();
  console.log(`✅ Campers Data: ${campersPeople.length} people`);
  
  // Combine all actual attendees
  const allAttendees = new Map<string, Person>();
  
  // Add check-in people
  for (const person of checkInPeople) {
    const key = normalizeName(person.fullName);
    if (!allAttendees.has(key)) {
      allAttendees.set(key, person);
    } else {
      // Merge sources
      const existing = allAttendees.get(key)!;
      existing.source = `${existing.source}, Check-In`;
    }
  }
  
  // Add registration people
  for (const person of registrationPeople) {
    const key = normalizeName(person.fullName);
    if (!allAttendees.has(key)) {
      allAttendees.set(key, person);
    } else {
      const existing = allAttendees.get(key)!;
      existing.source = `${existing.source}, Registration`;
    }
  }
  
  // Add campers people
  for (const person of campersPeople) {
    const key = normalizeName(person.fullName);
    if (!allAttendees.has(key)) {
      allAttendees.set(key, person);
    } else {
      const existing = allAttendees.get(key)!;
      existing.source = `${existing.source}, Campers`;
    }
  }
  
  console.log(`\n✅ Total Unique Attendees Found: ${allAttendees.size}\n`);
  
  // Match expected vs actual
  const matchedExpected = new Map<string, { expected: ExpectedMember; actual: Person[] }>();
  const unmatchedExpected: ExpectedMember[] = [];
  const unmatchedActual: Person[] = [];
  
  // Check each expected member
  for (const expected of expectedMembers) {
    const matches: Person[] = [];
    
    for (const [, person] of allAttendees.entries()) {
      if (matchPersonToExpected(person, expected)) {
        matches.push(person);
      }
    }
    
    if (matches.length > 0) {
      matchedExpected.set(expected.original, { expected, actual: matches });
    } else {
      unmatchedExpected.push(expected);
    }
  }
  
  // Find unmatched actual attendees
  for (const [, person] of allAttendees.entries()) {
    let matched = false;
    for (const expected of expectedMembers) {
      if (matchPersonToExpected(person, expected)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      unmatchedActual.push(person);
    }
  }
  
  // Print report
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 DETAILED REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('✅ MATCHED EXPECTED MEMBERS:\n');
  let matchCount = 0;
  for (const [original, data] of matchedExpected.entries()) {
    matchCount++;
    console.log(`${matchCount}. ${original}`);
    for (const actual of data.actual) {
      console.log(`   ✓ Found: ${actual.fullName} (${actual.source})`);
      if (actual.phone) console.log(`     Phone: ${actual.phone}`);
      if (actual.email) console.log(`     Email: ${actual.email}`);
    }
    console.log('');
  }
  
  console.log('\n❌ UNMATCHED EXPECTED MEMBERS:\n');
  for (let i = 0; i < unmatchedExpected.length; i++) {
    const member = unmatchedExpected[i];
    console.log(`${i + 1}. ${member.original}${member.phone ? ` (${member.phone})` : ''}`);
  }
  
  console.log('\n\n➕ ADDITIONAL ATTENDEES (Not in Expected List):\n');
  for (let i = 0; i < unmatchedActual.length; i++) {
    const person = unmatchedActual[i];
    console.log(`${i + 1}. ${person.fullName} (${person.source})`);
    if (person.phone) console.log(`   Phone: ${person.phone}`);
    if (person.email) console.log(`   Email: ${person.email}`);
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY STATISTICS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`Expected Kokori Team Members:     ${expectedMembers.length}`);
  console.log(`Matched Expected Members:          ${matchedExpected.size}`);
  console.log(`Unmatched Expected Members:        ${unmatchedExpected.length}`);
  console.log(`Total Actual Attendees Found:      ${allAttendees.size}`);
  console.log(`Additional Attendees (Unexpected): ${unmatchedActual.length}`);
  console.log(`\n✅ FINAL COUNT OF ACTUAL ATTENDEES: ${allAttendees.size}`);
  
  // Export to CSV
  const exportData: any[] = [];
  for (const [, person] of allAttendees.entries()) {
    // Find if this person matches an expected member
    let expectedMatch = '';
    const personKey = normalizeName(person.fullName);
    for (const [original, data] of matchedExpected.entries()) {
      if (data.actual.some(a => normalizeName(a.fullName) === personKey)) {
        expectedMatch = original;
        break;
      }
    }
    
    exportData.push({
      'Expected Member': expectedMatch || 'Not in Expected List',
      'First Name': person.firstName,
      'Last Name': person.lastName,
      'Full Name': person.fullName,
      'Phone': person.phone || '',
      'Email': person.email || '',
      'Gender': person.gender || '',
      'ID': person.id || '',
      'Source': person.source,
      'Check-In Time': person.checkInTime || '',
      'Notes': person.notes || ''
    });
  }
  
  // Write CSV
  const csvPath = path.join(__dirname, '..', 'uploads', `kokori-attendance-consolidated-${Date.now()}.csv`);
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
  console.log(`\n💾 Exported consolidated data to: ${csvPath}\n`);
}

// Run
consolidateKokoriAttendance();

