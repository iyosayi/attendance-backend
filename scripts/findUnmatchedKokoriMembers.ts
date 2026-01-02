import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

// Load environment variables
dotenv.config();

interface Person {
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  source: string;
  id?: string;
  gender?: string;
  status?: string;
  checkInTime?: Date | string;
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

// Normalize phone number
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Calculate similarity between two strings (simple Levenshtein-like)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Check word-level matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matches = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 && w1.length >= 3) {
        matches++;
        break;
      }
    }
  }
  
  if (matches > 0) {
    return Math.min(0.7, matches / Math.max(words1.length, words2.length));
  }
  
  return 0;
}

// Check if two names match with various strategies
function matchPersonToExpected(person: Person, expected: ExpectedMember): { matched: boolean; confidence: number; reason: string } {
  // Strategy 1: Exact match
  if (namesMatch(person.firstName, expected.firstName, true) && 
      namesMatch(person.lastName, expected.lastName, true)) {
    return { matched: true, confidence: 1.0, reason: 'Exact name match' };
  }
  
  // Strategy 2: Reversed match
  if (namesMatch(person.firstName, expected.lastName, true) && 
      namesMatch(person.lastName, expected.firstName, true)) {
    return { matched: true, confidence: 0.95, reason: 'Reversed name match' };
  }
  
  // Strategy 3: Phone match (high confidence)
  if (person.phone && expected.phone) {
    const p1 = normalizePhone(person.phone);
    const p2 = normalizePhone(expected.phone);
    if (p1 && p2 && p1 === p2) {
      return { matched: true, confidence: 0.9, reason: 'Phone number match' };
    }
    // Partial phone match (last 6 digits)
    if (p1.length >= 6 && p2.length >= 6) {
      if (p1.slice(-6) === p2.slice(-6)) {
        return { matched: true, confidence: 0.7, reason: 'Partial phone match (last 6 digits)' };
      }
    }
  }
  
  // Strategy 4: Partial name match
  if (namesMatch(person.firstName, expected.firstName) && 
      namesMatch(person.lastName, expected.lastName)) {
    return { matched: true, confidence: 0.6, reason: 'Partial name match' };
  }
  
  // Strategy 5: Full name similarity
  const personFull = normalizeName(person.fullName);
  const expectedFull = normalizeName(`${expected.firstName} ${expected.lastName}`.trim());
  const similarity = calculateSimilarity(personFull, expectedFull);
  if (similarity >= 0.6) {
    return { matched: true, confidence: similarity, reason: `Name similarity: ${(similarity * 100).toFixed(0)}%` };
  }
  
  // Strategy 6: First name match with phone
  if (namesMatch(person.firstName, expected.firstName) && person.phone && expected.phone) {
    const p1 = normalizePhone(person.phone);
    const p2 = normalizePhone(expected.phone);
    if (p1 && p2 && (p1.includes(p2) || p2.includes(p1))) {
      return { matched: true, confidence: 0.65, reason: 'First name + phone match' };
    }
  }
  
  // Strategy 7: Last name match with phone
  if (namesMatch(person.lastName, expected.lastName) && person.phone && expected.phone) {
    const p1 = normalizePhone(person.phone);
    const p2 = normalizePhone(expected.phone);
    if (p1 && p2 && (p1.includes(p2) || p2.includes(p1))) {
      return { matched: true, confidence: 0.65, reason: 'Last name + phone match' };
    }
  }
  
  return { matched: false, confidence: 0, reason: '' };
}

function namesMatch(name1: string, name2: string, strict: boolean = false): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (n1 === n2) return true;
  if (strict) return false;
  
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
    let cleanLine = line.replace(/^\d+\./, '').trim();
    const phoneMatch = cleanLine.match(/:?(\d[\d\s]{9,})/);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : undefined;
    cleanLine = cleanLine.replace(/:\d+[\d\s]*/g, '').trim();
    cleanLine = cleanLine.replace(/^(Pastor|Mr|Mrs|Miss|Dr)\s+/i, '').trim();
    
    if (!cleanLine) continue;
    
    const key = normalizeName(cleanLine);
    if (seen.has(key)) continue;
    seen.add(key);
    
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

// Load from database
async function loadFromDatabase(): Promise<Person[]> {
  const people: Person[] = [];
  
  // Get all checked-in and checked-out campers
  const campers = await Camper.find({
    status: { $in: ['checked-in', 'checked-out'] },
    isDeleted: false
  }).lean();
  
  for (const camper of campers) {
    // Check if notes contain Kokori
    const notes = (camper.notes || '').toLowerCase();
    if (notes.includes('kokori') || notes.includes('kokori delta')) {
      people.push({
        firstName: camper.firstName,
        lastName: camper.lastName,
        fullName: `${camper.firstName} ${camper.lastName}`.trim(),
        phone: camper.phone,
        email: camper.email,
        id: camper.code || camper._id.toString(),
        gender: camper.gender,
        status: camper.status,
        checkInTime: camper.checkInTime,
        notes: camper.notes,
        source: `Database (${camper.status})`
      });
    }
  }
  
  // Also search by name patterns for the unmatched members
  const unmatchedNames = [
    'Junior', 'fear', 'God', 'Prevail', 'Obavwonvwe', 'Destiny', 'ibobo',
    'Deborah', 'owebor', 'Ogban', 'Favour', 'Chidi', 'Isaac', 'Uloh', 'promise',
    'Abadi', 'Eloho', 'Ighoruona', 'Divine', 'Freeborn', 'Felix', 'John', 'obukevwo',
    'Egware', 'festus', 'Akpede'
  ];
  
  for (const namePart of unmatchedNames) {
    const regex = new RegExp(namePart, 'i');
    const campersByName = await Camper.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { notes: regex }
      ],
      isDeleted: false
    }).lean();
    
    for (const camper of campersByName) {
      const key = normalizeName(`${camper.firstName} ${camper.lastName}`);
      if (!people.some(p => normalizeName(p.fullName) === key)) {
        people.push({
          firstName: camper.firstName,
          lastName: camper.lastName,
          fullName: `${camper.firstName} ${camper.lastName}`.trim(),
          phone: camper.phone,
          email: camper.email,
          id: camper.code || camper._id.toString(),
          gender: camper.gender,
          status: camper.status,
          checkInTime: camper.checkInTime,
          notes: camper.notes,
          source: `Database (name search: ${namePart})`
        });
      }
    }
  }
  
  return people;
}

// Load check-in CSV
function loadCheckInData(): Person[] {
  const csvPath = path.join(__dirname, '..', 'uploads', 'checked-in-by-location-kokori-1763796468685.csv');
  if (!fs.existsSync(csvPath)) return [];
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const people: Person[] = [];
  
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
        source: 'Check-In CSV'
      });
    }
  }
  
  return people;
}

// Load registration CSV
function loadRegistrationData(): Person[] {
  const csvPath = path.join(__dirname, '..', 'registration.csv');
  if (!fs.existsSync(csvPath)) return [];
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const people: Person[] = [];
  
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
      const gender = parts[5] || '';
      const location = parts[9] || '';
      
      // Include if location contains Kokori OR if name matches any expected member
      if (location.toLowerCase().includes('kokori')) {
        people.push({
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          phone,
          email,
          gender,
          source: 'Registration CSV',
          notes: `Location: ${location}`
        });
      }
    }
  }
  
  return people;
}

// Load campers CSV
function loadCampersData(): Person[] {
  const csvPath = path.join(__dirname, '..', 'campers.csv');
  if (!fs.existsSync(csvPath)) return [];
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const people: Person[] = [];
  
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
      const gender = parts[3] || '';
      const notes = parts[4] || '';
      
      // Include all campers (we'll match them)
      people.push({
        id,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        gender,
        notes,
        source: 'Campers CSV'
      });
    }
  }
  
  return people;
}

// Main function
async function findUnmatchedKokoriMembers() {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 SEARCHING FOR UNMATCHED KOKORI MEMBERS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Connect to database
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    // Load expected members
    const expectedMembers = parseExpectedKokoriTeam();
    const unmatchedExpected = [
      'Junior  fear God',
      'Prevail Obavwonvwe',
      'Destiny ibobo',
      'Deborah owebor',
      'Ogban Favour',
      'Chidi Isaac',
      'Uloh promise',
      'Abadi Eloho',
      'Ighoruona Divine',
      'Freeborn Felix',
      'John obukevwo',
      'Egware festus',
      'Akpede Felix'
    ];
    
    console.log(`📋 Searching for ${unmatchedExpected.length} unmatched members...\n`);
    
    // Parse unmatched members
    const unmatchedMembers: ExpectedMember[] = [];
    for (const name of unmatchedExpected) {
      const member = expectedMembers.find(m => m.original === name);
      if (member) {
        unmatchedMembers.push(member);
      } else {
        // Parse manually
        const parts = name.split(/\s+/);
        unmatchedMembers.push({
          original: name,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          phone: name.match(/:?(\d[\d\s]{9,})/)?.[1]?.replace(/\s+/g, '')
        });
      }
    }
    
    // Load all data sources
    console.log('📂 Loading data sources...\n');
    
    const dbPeople = await loadFromDatabase();
    console.log(`✅ Database: ${dbPeople.length} people`);
    
    const checkInPeople = loadCheckInData();
    console.log(`✅ Check-In CSV: ${checkInPeople.length} people`);
    
    const registrationPeople = loadRegistrationData();
    console.log(`✅ Registration CSV: ${registrationPeople.length} people`);
    
    const campersPeople = loadCampersData();
    console.log(`✅ Campers CSV: ${campersPeople.length} people`);
    
    // Combine all sources
    const allPeople = new Map<string, Person>();
    
    for (const person of [...dbPeople, ...checkInPeople, ...registrationPeople, ...campersPeople]) {
      const key = normalizeName(person.fullName);
      if (!allPeople.has(key)) {
        allPeople.set(key, person);
      } else {
        const existing = allPeople.get(key)!;
        existing.source = `${existing.source}, ${person.source}`;
        // Merge phone/email if missing
        if (!existing.phone && person.phone) existing.phone = person.phone;
        if (!existing.email && person.email) existing.email = person.email;
      }
    }
    
    console.log(`\n✅ Total unique people found: ${allPeople.size}\n`);
    
    // Search for matches
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 SEARCH RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    for (const expected of unmatchedMembers) {
      console.log(`\n🔎 Searching for: "${expected.original}"`);
      if (expected.phone) console.log(`   Phone: ${expected.phone}`);
      
      const matches: Array<{ person: Person; confidence: number; reason: string }> = [];
      
      for (const [, person] of allPeople.entries()) {
        const match = matchPersonToExpected(person, expected);
        if (match.matched) {
          matches.push({
            person,
            confidence: match.confidence,
            reason: match.reason
          });
        }
      }
      
      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);
      
      if (matches.length > 0) {
        console.log(`   ✅ Found ${matches.length} potential match(es):`);
        for (const match of matches.slice(0, 5)) { // Show top 5
          console.log(`      • ${match.person.fullName} (${match.person.source})`);
          console.log(`        Confidence: ${(match.confidence * 100).toFixed(0)}% | ${match.reason}`);
          if (match.person.phone) console.log(`        Phone: ${match.person.phone}`);
          if (match.person.email) console.log(`        Email: ${match.person.email}`);
          if (match.person.status) console.log(`        Status: ${match.person.status}`);
          if (match.person.id) console.log(`        ID: ${match.person.id}`);
        }
      } else {
        console.log(`   ❌ No matches found`);
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run
findUnmatchedKokoriMembers();

