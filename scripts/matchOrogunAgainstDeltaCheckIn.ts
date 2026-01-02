import * as fs from 'fs';
import * as path from 'path';

interface MatchResult {
  expectedName: string;
  foundInDeltaCheckIn: boolean;
  deltaCheckInName?: string;
  deltaCheckInPhone?: string;
  deltaCheckInEmail?: string;
  deltaCheckInLocation?: string;
  deltaCheckInTime?: string;
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

async function matchOrogunAgainstDeltaCheckIn() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 MATCHING OROGUN DELEGATES AGAINST DELTA CHECK-IN CSV');
    console.log('═══════════════════════════════════════════════════════════\n');
    
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
    
    console.log(`Total Expected Delegates: ${expectedDelegates.length}\n`);
    
    // Load Delta Check-in CSV
    const deltaCheckInPath = path.join(__dirname, '..', 'uploads', 'checked-in-by-location-delta-1763798987858.csv');
    
    if (!fs.existsSync(deltaCheckInPath)) {
      console.log('❌ Delta check-in CSV not found');
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(deltaCheckInPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    const deltaCheckIns: Array<{ firstName: string; lastName: string; fullName: string; phone: string; email: string; location: string; checkInTime: string }> = [];
    
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
      
      if (parts.length >= 9) {
        const firstName = parts[0]?.replace(/^"|"$/g, '') || '';
        const lastName = parts[1]?.replace(/^"|"$/g, '') || '';
        const email = parts[2]?.replace(/^"|"$/g, '') || '';
        const phone = parts[3]?.replace(/^"|"$/g, '') || '';
        const location = parts[7]?.replace(/^"|"$/g, '') || '';
        const checkInTime = parts[8]?.replace(/^"|"$/g, '') || '';
        
        const fullName = `${firstName} ${lastName}`.trim();
        deltaCheckIns.push({
          firstName,
          lastName,
          fullName,
          phone,
          email,
          location,
          checkInTime
        });
      }
    }
    
    console.log(`Loaded ${deltaCheckIns.length} check-ins from Delta CSV\n`);
    
    const results: MatchResult[] = [];
    
    for (const expectedName of expectedDelegates) {
      const result: MatchResult = {
        expectedName,
        foundInDeltaCheckIn: false
      };
      
      const normalizedSearchName = normalizeName(expectedName);
      
      // Check Delta Check-in CSV
      for (const checkIn of deltaCheckIns) {
        const checkInFullName = normalizeName(checkIn.fullName);
        const checkInReversed = normalizeName(`${checkIn.lastName} ${checkIn.firstName}`);
        
        if (namesMatch(normalizedSearchName, checkInFullName) || 
            namesMatch(normalizedSearchName, checkInReversed)) {
          result.foundInDeltaCheckIn = true;
          result.deltaCheckInName = checkIn.fullName;
          result.deltaCheckInPhone = checkIn.phone;
          result.deltaCheckInEmail = checkIn.email;
          result.deltaCheckInLocation = checkIn.location;
          result.deltaCheckInTime = checkIn.checkInTime;
          break;
        }
      }
      
      results.push(result);
    }
    
    // Print Report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ MATCHES FOUND IN DELTA CHECK-IN CSV');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const matches = results.filter(r => r.foundInDeltaCheckIn);
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const result = matches[i];
        console.log(`${i + 1}. Expected: ${result.expectedName}`);
        console.log(`   → Found as: ${result.deltaCheckInName}`);
        console.log(`   Phone: ${result.deltaCheckInPhone || 'N/A'}`);
        console.log(`   Email: ${result.deltaCheckInEmail || 'N/A'}`);
        console.log(`   Location: ${result.deltaCheckInLocation || 'N/A'}`);
        console.log(`   Check-in Time: ${result.deltaCheckInTime || 'N/A'}`);
        console.log('');
      }
    } else {
      console.log('❌ No matches found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ NOT FOUND IN DELTA CHECK-IN CSV');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const notFound = results.filter(r => !r.foundInDeltaCheckIn);
    if (notFound.length > 0) {
      for (let i = 0; i < notFound.length; i++) {
        console.log(`${i + 1}. ${notFound[i].expectedName}`);
      }
      console.log('');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total Expected Delegates: ${results.length}`);
    console.log(`✅ Found in Delta Check-In CSV: ${matches.length}`);
    console.log(`❌ Not Found: ${notFound.length}\n`);
    
    if (matches.length > 0) {
      const matchRate = ((matches.length / results.length) * 100).toFixed(1);
      console.log(`📈 Match Rate: ${matchRate}%`);
    }
    
    // Export to CSV
    const exportData: any[] = [];
    for (const result of results) {
      exportData.push({
        'Expected Name': result.expectedName,
        'Found in Delta Check-In': result.foundInDeltaCheckIn ? 'Yes' : 'No',
        'Delta Check-In Name': result.deltaCheckInName || '',
        'Delta Check-In Phone': result.deltaCheckInPhone || '',
        'Delta Check-In Email': result.deltaCheckInEmail || '',
        'Delta Check-In Location': result.deltaCheckInLocation || '',
        'Delta Check-In Time': result.deltaCheckInTime || ''
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `orogun-delta-checkin-match-${Date.now()}.csv`);
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
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

matchOrogunAgainstDeltaCheckIn();

