import * as fs from 'fs';
import * as path from 'path';

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // Split into parts
  const parts1 = n1.split(' ').filter(p => p.length > 0);
  const parts2 = n2.split(' ').filter(p => p.length > 0);
  
  if (parts1.length === 0 || parts2.length === 0) return false;
  
  // Check if all significant parts of name1 are in name2
  const significantParts1 = parts1.filter(p => p.length > 2);
  if (significantParts1.length > 0) {
    const allMatch = significantParts1.every(part => 
      parts2.some(p2 => p2.includes(part) || part.includes(p2))
    );
    if (allMatch) return true;
  }
  
  // Check reversed order (first name/last name swapped)
  if (parts1.length >= 2 && parts2.length >= 2) {
    const reversed1 = [parts1[parts1.length - 1], ...parts1.slice(0, -1)].join(' ');
    if (normalizeName(reversed1) === n2) return true;
    
    const reversed2 = [parts2[parts2.length - 1], ...parts2.slice(0, -1)].join(' ');
    if (n1 === normalizeName(reversed2)) return true;
  }
  
  return false;
}

function isTestEntry(entry: {name: string, email: string, phone: string}): boolean {
  const name = entry.name.toLowerCase().trim();
  const email = entry.email.toLowerCase().trim();
  
  // Filter out obvious test entries
  if (name.length <= 3) return true; // Very short names like "M T"
  if (email.includes('@a.com') || email.includes('@.com') || email.includes('aaaaa.com')) return true;
  if (name.split(' ').length === 1 && name.length <= 2) return true; // Single letter names
  
  return false;
}

async function matchDeltaLocationsAgainstRegistration() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 MATCHING DELTA LOCATIONS AGAINST REGISTRATION.CSV');
    console.log('   (Warri + Kokori + Orogun + Delta)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Expected names lists
    const kokoriExpected = [
      'Pastor kester Kolenda', 'Okpeki Betty', 'Hither Rukevwe', 'Daniel Solomon',
      'Omokiniovo Onoriode', 'Billyyoko Onoriode', 'Onoriode Eseoghene Gift',
      'Abadi loveth', 'Gift Mina', 'Successful Augustine', 'Junior fear God',
      'Joy Anthony', 'Peace kokori', 'Rukevwe Ezekiel', 'Ojijevwe Theophilus',
      'Ogban Kevwe Samuel', 'Friday serome', 'Monday Emmanuel', 'Joyce OMONIGHO',
      'Prevail Obavwonvwe', 'Ikono God\'s love', 'Destiny ibobo', 'Deborah owebor',
      'Ogban Favour', 'Chidi Isaac', 'Jennifer Brown', 'Chukwudi Favour',
      'Sumonu Elo', 'Endurance Omuvi', 'Good luck Israel', 'Uloh promise',
      'Abadi Eloho', 'Ighoruona Divine', 'Juliet James', 'Freeborn Felix',
      'Andrew Brme', 'John obukevwo', 'Egware festus', 'Akpede Felix'
    ];
    
    const orogunExpected = [
      'Emmanuel Jackson opiri', 'Oghenekaro Helen', 'Vivian Godwin', 'Philo adjarho',
      'Stphanie Akpofure', 'Glory sokodi', 'Fegiro uloho', 'Princess ejovwokoghene',
      'Esther Chukwunyere', 'Oghenerukevwe Rita', 'Ejeromedoghene Victoria',
      'Stephen Akpojotor', 'Obas Edwin', 'Aremu Daniel', 'Gloria Esanye',
      'Eguono Ejeromedoghene', 'Daniel Aremu', 'Godwin Juliet', 'Richard Akpofure',
      'Diegbe Tracy', 'Gabriel blessing', 'Faith Murphy', 'David Okakuro',
      'Prince umunade', 'Onya favour', 'Igoru blessing'
    ];
    
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    
    if (!fs.existsSync(registrationPath)) {
      console.error('❌ registration.csv not found!');
      return;
    }
    
    const csvContent = fs.readFileSync(registrationPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Parse all Delta-related registrations
    const allDeltaRegistrations: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else current += char;
      }
      parts.push(current.trim());
      
      if (parts.length >= 10) {
        const regName = `${parts[1] || ''} ${parts[2] || ''}`.trim();
        const regLocation = (parts[9] || '').toLowerCase();
        
        if (regLocation.includes('delta') || regLocation.includes('kokori') || regLocation.includes('orogun') || regLocation.includes('warri')) {
          allDeltaRegistrations.push({
            name: regName,
            firstName: parts[1] || '',
            lastName: parts[2] || '',
            email: parts[3] || '',
            phone: parts[4] || '',
            location: parts[9] || '',
            timestamp: parts[0] || ''
          });
        }
      }
    }
    
    console.log(`📂 Found ${allDeltaRegistrations.length} Delta-related registrations\n`);
    
    // Match Kokori expected names
    const kokoriMatches: Array<{expected: string, found: any, isTestEntry: boolean}> = [];
    const kokoriNotFound: string[] = [];
    
    for (const expectedName of kokoriExpected) {
      const matches = allDeltaRegistrations.filter(reg => namesMatch(expectedName, reg.name));
      if (matches.length > 0) {
        // Filter out test entries
        const legitimateMatches = matches.filter(m => !isTestEntry({name: m.name, email: m.email, phone: m.phone}));
        if (legitimateMatches.length > 0) {
          kokoriMatches.push({ 
            expected: expectedName, 
            found: legitimateMatches[0], // Take first legitimate match
            isTestEntry: false
          });
        } else {
          kokoriMatches.push({ 
            expected: expectedName, 
            found: matches[0], 
            isTestEntry: true
          });
        }
      } else {
        kokoriNotFound.push(expectedName);
      }
    }
    
    // Match Orogun expected names
    const orogunMatches: Array<{expected: string, found: any, isTestEntry: boolean}> = [];
    const orogunNotFound: string[] = [];
    
    for (const expectedName of orogunExpected) {
      const matches = allDeltaRegistrations.filter(reg => namesMatch(expectedName, reg.name));
      if (matches.length > 0) {
        // Filter out test entries
        const legitimateMatches = matches.filter(m => !isTestEntry({name: m.name, email: m.email, phone: m.phone}));
        if (legitimateMatches.length > 0) {
          orogunMatches.push({ 
            expected: expectedName, 
            found: legitimateMatches[0],
            isTestEntry: false
          });
        } else {
          orogunMatches.push({ 
            expected: expectedName, 
            found: matches[0], 
            isTestEntry: true
          });
        }
      } else {
        orogunNotFound.push(expectedName);
      }
    }
    
    // Separate legitimate from test matches
    const kokoriLegitimate = kokoriMatches.filter(m => !m.isTestEntry);
    const orogunLegitimate = orogunMatches.filter(m => !m.isTestEntry);
    
    // Print results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 KOKORI EXPECTED NAMES');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected: ${kokoriExpected.length}`);
    console.log(`✅ Found in Registration: ${kokoriLegitimate.length} (${((kokoriLegitimate.length / kokoriExpected.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Not Found: ${kokoriNotFound.length}\n`);
    
    if (kokoriLegitimate.length > 0) {
      console.log('✅ LEGITIMATE MATCHES:\n');
      kokoriLegitimate.forEach((match, index) => {
        console.log(`${index + 1}. ${match.expected}`);
        console.log(`   → Found as: ${match.found.name}`);
        console.log(`   Location: ${match.found.location || 'N/A'}`);
        console.log(`   Phone: ${match.found.phone || 'N/A'}`);
        console.log(`   Email: ${match.found.email || 'N/A'}\n`);
      });
    }
    
    if (kokoriNotFound.length > 0) {
      console.log('❌ NOT FOUND:\n');
      kokoriNotFound.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
      });
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 OROGUN EXPECTED NAMES');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected: ${orogunExpected.length}`);
    console.log(`✅ Found in Registration: ${orogunLegitimate.length} (${((orogunLegitimate.length / orogunExpected.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Not Found: ${orogunNotFound.length}\n`);
    
    if (orogunLegitimate.length > 0) {
      console.log('✅ LEGITIMATE MATCHES:\n');
      orogunLegitimate.forEach((match, index) => {
        console.log(`${index + 1}. ${match.expected}`);
        console.log(`   → Found as: ${match.found.name}`);
        console.log(`   Location: ${match.found.location || 'N/A'}`);
        console.log(`   Phone: ${match.found.phone || 'N/A'}`);
        console.log(`   Email: ${match.found.email || 'N/A'}\n`);
      });
    }
    
    if (orogunNotFound.length > 0) {
      console.log('❌ NOT FOUND:\n');
      orogunNotFound.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
      });
      console.log('');
    }
    
    // Combined summary
    const totalExpected = kokoriExpected.length + orogunExpected.length;
    const totalFound = kokoriLegitimate.length + orogunLegitimate.length;
    const totalNotFound = kokoriNotFound.length + orogunNotFound.length;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 COMBINED SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected Names:        ${totalExpected}`);
    console.log(`✅ Found in Registration:   ${totalFound} (${((totalFound / totalExpected) * 100).toFixed(1)}%)`);
    console.log(`❌ Not Found:               ${totalNotFound}\n`);
    
    // Export to CSV
    const exportData: any[] = [];
    
    // Kokori matches
    for (const match of kokoriLegitimate) {
      exportData.push({
        'Location': 'Kokori',
        'Expected Name': match.expected,
        'Found As': match.found.name,
        'Email': match.found.email,
        'Phone': match.found.phone,
        'Registration Location': match.found.location,
        'Status': 'FOUND'
      });
    }
    for (const name of kokoriNotFound) {
      exportData.push({
        'Location': 'Kokori',
        'Expected Name': name,
        'Found As': '',
        'Email': '',
        'Phone': '',
        'Registration Location': '',
        'Status': 'NOT FOUND'
      });
    }
    
    // Orogun matches
    for (const match of orogunLegitimate) {
      exportData.push({
        'Location': 'Orogun',
        'Expected Name': match.expected,
        'Found As': match.found.name,
        'Email': match.found.email,
        'Phone': match.found.phone,
        'Registration Location': match.found.location,
        'Status': 'FOUND'
      });
    }
    for (const name of orogunNotFound) {
      exportData.push({
        'Location': 'Orogun',
        'Expected Name': name,
        'Found As': '',
        'Email': '',
        'Phone': '',
        'Registration Location': '',
        'Status': 'NOT FOUND'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `delta-locations-registration-match-${Date.now()}.csv`);
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
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

matchDeltaLocationsAgainstRegistration();

