import * as fs from 'fs';
import * as path from 'path';

interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  notes: string;
}

interface KokoriMember {
  original: string;
  firstName: string;
  lastName: string;
}

// Normalize name for comparison (lowercase, trim, remove extra spaces)
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Check if two names match exactly (handles variations)
function namesMatchExact(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  return n1 === n2;
}

// Check if two names match partially (one contains the other, but both must be meaningful)
function namesMatchPartial(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Both must be at least 3 characters to avoid false matches
  if (n1.length < 3 || n2.length < 3) {
    return n1 === n2;
  }
  
  // Exact match
  if (n1 === n2) return true;
  
  // One contains the other (but not just a single character)
  if (n1.length >= 4 && n2.length >= 4) {
    return n1.includes(n2) || n2.includes(n1);
  }
  
  return false;
}

// Check if any word in name1 matches any word in name2
function wordsMatch(name1: string, name2: string): boolean {
  const words1 = normalizeName(name1).split(/\s+/).filter(w => w.length >= 3);
  const words2 = normalizeName(name2).split(/\s+/).filter(w => w.length >= 3);
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || (w1.length >= 4 && w2.length >= 4 && (w1.includes(w2) || w2.includes(w1)))) {
        return true;
      }
    }
  }
  return false;
}

// Parse Kokori Team list
function parseKokoriTeam(): KokoriMember[] {
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

  const members: KokoriMember[] = [];
  const lines = kokoriList.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Remove numbering and phone numbers
    let cleanLine = line.replace(/^\d+\./, '').trim();
    
    // Remove phone numbers (patterns like :09075781235 or 0803 248 1626)
    cleanLine = cleanLine.replace(/:\d+[\d\s]*/g, '').trim();
    
    // Remove titles like "Pastor"
    cleanLine = cleanLine.replace(/^(Pastor|Mr|Mrs|Miss|Dr)\s+/i, '').trim();
    
    if (!cleanLine) continue;
    
    // Split name - try to identify first and last name
    const parts = cleanLine.split(/\s+/).filter(p => p);
    
    if (parts.length === 0) continue;
    
    // Handle special cases
    let firstName = '';
    let lastName = '';
    
    if (parts.length === 1) {
      firstName = parts[0];
      lastName = '';
    } else if (parts.length === 2) {
      // Could be "FirstName LastName" or "LastName FirstName"
      // Try both combinations
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
      lastName: lastName
    });
  }

  return members;
}

// Load campers from CSV
function loadCampers(): Camper[] {
  const csvPath = path.join(__dirname, '..', 'campers.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  const campers: Camper[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line (handle quoted fields)
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
      campers.push({
        id: parts[0] || '',
        firstName: parts[1] || '',
        lastName: parts[2] || '',
        gender: parts[3] || '',
        notes: parts[4] || ''
      });
    }
  }
  
  return campers;
}

// Match Kokori members against campers
function matchKokoriTeam() {
  const kokoriMembers = parseKokoriTeam();
  const campers = loadCampers();
  
  const matches: Array<{
    kokoriMember: KokoriMember;
    camper: Camper;
    matchType: string;
  }> = [];
  
  for (const member of kokoriMembers) {
    for (const camper of campers) {
      let matched = false;
      let matchType = '';
      
      const memberFullName = `${member.firstName} ${member.lastName}`.trim();
      const camperFullName = `${camper.firstName} ${camper.lastName}`.trim();
      
      // 1. Check exact first name + last name match
      if (member.lastName && camper.lastName) {
        if (namesMatchExact(member.firstName, camper.firstName) && 
            namesMatchExact(member.lastName, camper.lastName)) {
          matched = true;
          matchType = 'Exact First+Last';
        }
        // Check reversed (last name might be first name in CSV)
        else if (namesMatchExact(member.firstName, camper.lastName) && 
                 namesMatchExact(member.lastName, camper.firstName)) {
          matched = true;
          matchType = 'Reversed First+Last';
        }
        // Check partial matches for first+last
        else if (namesMatchPartial(member.firstName, camper.firstName) && 
                 namesMatchPartial(member.lastName, camper.lastName)) {
          matched = true;
          matchType = 'Partial First+Last';
        }
        // Check reversed partial
        else if (namesMatchPartial(member.firstName, camper.lastName) && 
                 namesMatchPartial(member.lastName, camper.firstName)) {
          matched = true;
          matchType = 'Reversed Partial';
        }
      }
      
      // 2. Check full name match
      if (!matched && memberFullName && camperFullName) {
        if (namesMatchExact(memberFullName, camperFullName)) {
          matched = true;
          matchType = 'Exact Full Name';
        } else if (namesMatchPartial(memberFullName, camperFullName)) {
          matched = true;
          matchType = 'Partial Full Name';
        }
      }
      
      // 3. Check first name only (if last name is missing on one side)
      if (!matched && (!member.lastName || !camper.lastName)) {
        if (namesMatchExact(member.firstName, camper.firstName)) {
          matched = true;
          matchType = 'Exact First Name';
        } else if (namesMatchPartial(member.firstName, camper.firstName)) {
          matched = true;
          matchType = 'Partial First Name';
        }
        // Check if member first name matches camper last name
        if (!matched && camper.lastName && namesMatchExact(member.firstName, camper.lastName)) {
          matched = true;
          matchType = 'First matches Last';
        }
      }
      
      // 4. Check word-level matches (at least one meaningful word matches)
      if (!matched && memberFullName && camperFullName) {
        if (wordsMatch(memberFullName, camperFullName)) {
          matched = true;
          matchType = 'Word Match';
        }
      }
      
      if (matched && !matches.some(m => m.kokoriMember.original === member.original && m.camper.id === camper.id)) {
        matches.push({
          kokoriMember: member,
          camper,
          matchType
        });
      }
    }
  }
  
  // Remove duplicates (same Kokori member matched to same camper)
  const uniqueMatches = matches.filter((match, index, self) =>
    index === self.findIndex(m => 
      m.kokoriMember.original === match.kokoriMember.original && 
      m.camper.id === match.camper.id
    )
  );
  
  // Filter out weak matches (common names like Gift, Favour, Promise, etc.)
  const commonNames = new Set(['gift', 'favour', 'favor', 'promise', 'joy', 'peace', 'divine', 'mercy', 'grace', 'blessing', 'success', 'miracle']);
  
  const strongMatches = uniqueMatches.filter(match => {
    const matchType = match.matchType.toLowerCase();
    
    // Keep all exact matches
    if (matchType.includes('exact')) return true;
    
    // Keep reversed matches
    if (matchType.includes('reversed')) return true;
    
    // For word matches, check if it's a meaningful match (not just a common name)
    if (matchType.includes('word')) {
      const memberWords = normalizeName(match.kokoriMember.firstName + ' ' + match.kokoriMember.lastName).split(/\s+/);
      const camperWords = normalizeName(match.camper.firstName + ' ' + match.camper.lastName).split(/\s+/);
      
      // Check if there's a match that's not a common name
      const hasUncommonMatch = memberWords.some(mw => 
        mw.length >= 4 && 
        !commonNames.has(mw) && 
        camperWords.some(cw => mw === cw || (mw.length >= 4 && cw.length >= 4 && (mw.includes(cw) || cw.includes(mw))))
      );
      
      // Also check if both first names match (not common)
      const firstNameMatch = namesMatchExact(match.kokoriMember.firstName, match.camper.firstName) ||
                            namesMatchExact(match.kokoriMember.firstName, match.camper.lastName) ||
                            namesMatchExact(match.kokoriMember.lastName, match.camper.firstName);
      
      return hasUncommonMatch || (firstNameMatch && !commonNames.has(normalizeName(match.kokoriMember.firstName)));
    }
    
    // Keep partial matches
    return true;
  });
  
  // Group by Kokori member
  const matchesByMember = new Map<string, typeof strongMatches>();
  for (const match of strongMatches) {
    const key = match.kokoriMember.original;
    if (!matchesByMember.has(key)) {
      matchesByMember.set(key, []);
    }
    matchesByMember.get(key)!.push(match);
  }
  
  console.log('\n=== KOKORI TEAM MATCHING RESULTS ===\n');
  console.log(`Total Kokori Team members: ${kokoriMembers.length}`);
  console.log(`Strong matches found: ${strongMatches.length}`);
  console.log(`Unique Kokori members matched: ${matchesByMember.size}\n`);
  
  console.log('=== MATCHES ===\n');
  for (const [kokoriName, memberMatches] of matchesByMember.entries()) {
    console.log(`\n"${kokoriName}":`);
    for (const match of memberMatches) {
      console.log(`  ✓ Matched with: ${match.camper.id} - ${match.camper.firstName} ${match.camper.lastName} (${match.matchType})`);
    }
  }
  
  console.log('\n=== UNMATCHED KOKORI MEMBERS ===\n');
  const matchedKokoriNames = new Set(strongMatches.map(m => m.kokoriMember.original));
  const unmatched = kokoriMembers.filter(m => !matchedKokoriNames.has(m.original));
  for (const member of unmatched) {
    console.log(`  - ${member.original}`);
  }
  
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total Kokori Team members: ${kokoriMembers.length}`);
  console.log(`Matched: ${matchesByMember.size}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log(`Total strong match count: ${strongMatches.length}`);
}

// Run the matching
matchKokoriTeam();

