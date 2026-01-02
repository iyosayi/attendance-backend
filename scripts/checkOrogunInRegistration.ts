import * as fs from 'fs';
import * as path from 'path';

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
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

async function checkOrogunInRegistration() {
  try {
    const expectedNames = [
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
    console.log('🔍 CHECKING OROGUN DELEGATES IN REGISTRATION.CSV');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    
    if (!fs.existsSync(registrationPath)) {
      console.error('❌ registration.csv not found!');
      return;
    }
    
    const csvContent = fs.readFileSync(registrationPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    const matches: Array<{expected: string, found: any, isTestEntry: boolean}> = [];
    const notFound: string[] = [];
    
    // Parse registration CSV
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
        const regFirstName = parts[1] || '';
        const regLastName = parts[2] || '';
        const regName = `${regFirstName} ${regLastName}`.trim();
        const regEmail = parts[3] || '';
        const regPhone = parts[4] || '';
        const regLocation = parts[9] || '';
        
        // Check each expected name
        const entry = {
          name: regName,
          firstName: regFirstName,
          lastName: regLastName,
          email: regEmail,
          phone: regPhone,
          location: regLocation,
          timestamp: parts[0] || ''
        };
        
        const isTest = isTestEntry({name: regName, email: regEmail, phone: regPhone});
        
        for (const expectedName of expectedNames) {
          if (namesMatch(expectedName, regName)) {
            matches.push({
              expected: expectedName,
              found: entry,
              isTestEntry: isTest
            });
          }
        }
      }
    }
    
    // Separate legitimate matches from test entries
    const legitimateMatches = matches.filter(m => !m.isTestEntry);
    const testMatches = matches.filter(m => m.isTestEntry);
    
    // Get unique expected names that were found (legitimately)
    const foundExpectedNames = new Set(legitimateMatches.map(m => m.expected));
    
    // Find which expected names were not matched (legitimately)
    for (const expectedName of expectedNames) {
      if (!foundExpectedNames.has(expectedName)) {
        notFound.push(expectedName);
      }
    }
    
    // Print results
    console.log(`📋 Total Expected Names: ${expectedNames.length}\n`);
    
    if (legitimateMatches.length > 0) {
      console.log(`✅ LEGITIMATE MATCHES IN REGISTRATION (${legitimateMatches.length}):\n`);
      
      // Group by expected name to show best match
      const matchesByExpected: Record<string, typeof legitimateMatches> = {};
      for (const match of legitimateMatches) {
        if (!matchesByExpected[match.expected]) {
          matchesByExpected[match.expected] = [];
        }
        matchesByExpected[match.expected].push(match);
      }
      
      let index = 1;
      for (const [expectedName, matchList] of Object.entries(matchesByExpected)) {
        // Show the best match (prefer Orogun location)
        const bestMatch = matchList.find(m => 
          m.found.location.toLowerCase().includes('orogun') || 
          m.found.location.toLowerCase().includes('delta')
        ) || matchList[0];
        
        console.log(`${index}. ✅ ${expectedName}`);
        console.log(`   → Found as: ${bestMatch.found.name}`);
        console.log(`   Email: ${bestMatch.found.email || 'N/A'}`);
        console.log(`   Phone: ${bestMatch.found.phone || 'N/A'}`);
        console.log(`   Location: ${bestMatch.found.location || 'N/A'}`);
        console.log(`   Registered: ${bestMatch.found.timestamp || 'N/A'}`);
        if (matchList.length > 1) {
          console.log(`   ⚠️  Note: Found ${matchList.length} registration(s) for this name`);
        }
        console.log('');
        index++;
      }
    }
    
    if (testMatches.length > 0) {
      console.log(`\n⚠️  TEST/FAKE ENTRIES FILTERED OUT (${testMatches.length}):\n`);
      console.log('   (These were excluded as they appear to be test entries)\n');
    }
    
    if (notFound.length > 0) {
      console.log(`\n❌ NOT FOUND IN REGISTRATION (${notFound.length}):\n`);
      notFound.forEach((name, index) => {
        console.log(`${index + 1}. ❌ ${name}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected:           ${expectedNames.length}`);
    console.log(`✅ Legitimately Found:    ${foundExpectedNames.size}`);
    console.log(`❌ Not Found:             ${notFound.length}`);
    console.log(`📈 Match Rate:            ${((foundExpectedNames.size / expectedNames.length) * 100).toFixed(1)}%\n`);
    
    // Export to CSV (only legitimate matches)
    const exportData: any[] = [];
    const processedExpected = new Set<string>();
    for (const match of legitimateMatches) {
      if (!processedExpected.has(match.expected)) {
        exportData.push({
          'Expected Name': match.expected,
          'Found As': match.found.name,
          'Email': match.found.email,
          'Phone': match.found.phone,
          'Location': match.found.location,
          'Registration Timestamp': match.found.timestamp,
          'Status': 'FOUND'
        });
        processedExpected.add(match.expected);
      }
    }
    for (const name of notFound) {
      exportData.push({
        'Expected Name': name,
        'Found As': '',
        'Email': '',
        'Phone': '',
        'Location': '',
        'Registration Timestamp': '',
        'Status': 'NOT FOUND'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `orogun-registration-check-${Date.now()}.csv`);
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

checkOrogunInRegistration();

