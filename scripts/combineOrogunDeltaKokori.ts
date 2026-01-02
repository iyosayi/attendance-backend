import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

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

async function combineOrogunDeltaKokori() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 WARRI + OROGUN + KOKORI + DELTA COMBINED TOTALS');
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
    
    // Find all Delta State entries (includes Kokori, Orogun, Delta, Waterside, etc.)
    const deltaRegex = new RegExp('delta', 'i');
    const allDeltaDB = await Camper.find({
      $or: [
        { notes: deltaRegex },
        { email: deltaRegex }
      ],
      isDeleted: false
    }).lean();
    
    // Categorize by specific location
    const kokoriDB: any[] = [];
    const orogunDB: any[] = [];
    const warriDB: any[] = [];
    const otherDeltaDB: any[] = [];
    
    for (const camper of allDeltaDB) {
      const notes = ((camper as any).notes || '').toLowerCase();
      const email = ((camper as any).email || '').toLowerCase();
      const locationStr = notes + ' ' + email;
      
      if (locationStr.includes('kokori')) {
        kokoriDB.push(camper);
      } else if (locationStr.includes('orogun')) {
        orogunDB.push(camper);
      } else if (locationStr.includes('warri')) {
        warriDB.push(camper);
      } else {
        otherDeltaDB.push(camper);
      }
    }
    
    // Parse registration CSV
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const kokoriReg: any[] = [];
    const orogunReg: any[] = [];
    const warriReg: any[] = [];
    const otherDeltaReg: any[] = [];
    
    if (fs.existsSync(registrationPath)) {
      const csvContent = fs.readFileSync(registrationPath, 'utf-8');
      const lines = csvContent.split('\n');
      
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
          const location = (parts[9] || '').toLowerCase();
          if (location.includes('delta')) {
            const regEntry: any = {
              name: `${parts[1] || ''} ${parts[2] || ''}`.trim(),
              email: parts[3] || '',
              phone: parts[4] || '',
              location: parts[9] || ''
            };
            
            if (location.includes('kokori')) {
              kokoriReg.push(regEntry);
            } else if (location.includes('orogun')) {
              orogunReg.push(regEntry);
            } else if (location.includes('warri')) {
              warriReg.push(regEntry);
            } else {
              otherDeltaReg.push(regEntry);
            }
          }
        }
      }
    }
    
    // Parse check-in CSVs
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const checkInFiles = fs.readdirSync(uploadsDir).filter(f => 
      f.includes('checked-in-by-location') && (f.includes('delta') || f.includes('kokori') || f.includes('warri'))
    );
    
    const kokoriCheckIns: any[] = [];
    const orogunCheckIns: any[] = [];
    const warriCheckIns: any[] = [];
    const otherDeltaCheckIns: any[] = [];
    
    for (const file of checkInFiles) {
      const filePath = path.join(uploadsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
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
          const location = (parts[7] || '').toLowerCase();
          const notes = (parts[10] || '').toLowerCase();
          const locationStr = location + ' ' + notes;
          
          const checkInEntry: any = {
            firstName: parts[0] || '',
            lastName: parts[1] || '',
            email: parts[2] || '',
            phone: parts[3] || '',
            location: parts[7] || ''
          };
          
          if (locationStr.includes('kokori')) {
            kokoriCheckIns.push(checkInEntry);
          } else if (locationStr.includes('orogun')) {
            orogunCheckIns.push(checkInEntry);
          } else if (locationStr.includes('warri')) {
            warriCheckIns.push(checkInEntry);
          } else {
            otherDeltaCheckIns.push(checkInEntry);
          }
        }
      }
    }
    
    // Calculate statistics
    const kokoriCheckedIn = kokoriDB.filter((c: any) => c.status === 'checked-in').length;
    const kokoriCheckedOut = kokoriDB.filter((c: any) => c.status === 'checked-out').length;
    const kokoriPending = kokoriDB.filter((c: any) => c.status === 'pending').length;
    
    const orogunCheckedIn = orogunDB.filter((c: any) => c.status === 'checked-in').length;
    const orogunCheckedOut = orogunDB.filter((c: any) => c.status === 'checked-out').length;
    const orogunPending = orogunDB.filter((c: any) => c.status === 'pending').length;
    
    const warriCheckedIn = warriDB.filter((c: any) => c.status === 'checked-in').length;
    const warriCheckedOut = warriDB.filter((c: any) => c.status === 'checked-out').length;
    const warriPending = warriDB.filter((c: any) => c.status === 'pending').length;
    
    const otherDeltaCheckedIn = otherDeltaDB.filter((c: any) => c.status === 'checked-in').length;
    const otherDeltaCheckedOut = otherDeltaDB.filter((c: any) => c.status === 'checked-out').length;
    const otherDeltaPending = otherDeltaDB.filter((c: any) => c.status === 'pending').length;
    
    // Print breakdown
    console.log('📍 KOKORI');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${kokoriDB.length}`);
    console.log(`  ✅ Checked In:               ${kokoriCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${kokoriCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${kokoriPending}`);
    console.log(`Registration CSV Entries:      ${kokoriReg.length}`);
    console.log(`Check-in CSV Entries:          ${kokoriCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(kokoriDB.length, kokoriReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${kokoriCheckedIn + kokoriCheckedOut}\n`);
    
    console.log('📍 OROGUN');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${orogunDB.length}`);
    console.log(`  ✅ Checked In:               ${orogunCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${orogunCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${orogunPending}`);
    console.log(`Registration CSV Entries:      ${orogunReg.length}`);
    console.log(`Check-in CSV Entries:          ${orogunCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(orogunDB.length, orogunReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${orogunCheckedIn + orogunCheckedOut}\n`);
    
    console.log('📍 WARRI');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${warriDB.length}`);
    console.log(`  ✅ Checked In:               ${warriCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${warriCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${warriPending}`);
    console.log(`Registration CSV Entries:      ${warriReg.length}`);
    console.log(`Check-in CSV Entries:          ${warriCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(warriDB.length, warriReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${warriCheckedIn + warriCheckedOut}\n`);
    
    console.log('📍 OTHER DELTA');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${otherDeltaDB.length}`);
    console.log(`  ✅ Checked In:               ${otherDeltaCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${otherDeltaCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${otherDeltaPending}`);
    console.log(`Registration CSV Entries:      ${otherDeltaReg.length}`);
    console.log(`Check-in CSV Entries:          ${otherDeltaCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(otherDeltaDB.length, otherDeltaReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${otherDeltaCheckedIn + otherDeltaCheckedOut}\n`);
    
    // Combined totals
    const totalDB = kokoriDB.length + orogunDB.length + warriDB.length + otherDeltaDB.length;
    const totalCheckedIn = kokoriCheckedIn + orogunCheckedIn + warriCheckedIn + otherDeltaCheckedIn;
    const totalCheckedOut = kokoriCheckedOut + orogunCheckedOut + warriCheckedOut + otherDeltaCheckedOut;
    const totalPending = kokoriPending + orogunPending + warriPending + otherDeltaPending;
    const totalReg = kokoriReg.length + orogunReg.length + warriReg.length + otherDeltaReg.length;
    const totalCheckIns = kokoriCheckIns.length + orogunCheckIns.length + warriCheckIns.length + otherDeltaCheckIns.length;
    const totalRegistered = Math.max(totalDB, totalReg);
    const totalAttended = totalCheckedIn + totalCheckedOut;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 COMBINED TOTALS (WARRI + OROGUN + KOKORI + DELTA)');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Database Entries:         ${totalDB}`);
    console.log(`  ✅ Checked In:                ${totalCheckedIn}`);
    console.log(`  🚪 Checked Out:               ${totalCheckedOut}`);
    console.log(`  ⏳ Pending (Not Checked In):  ${totalPending}`);
    console.log(`Total Registration CSV Entries: ${totalReg}`);
    console.log(`Total Check-in CSV Entries:     ${totalCheckIns}`);
    console.log(`\n💡 ESTIMATED TOTAL REGISTERED: ${totalRegistered}`);
    console.log(`💡 ESTIMATED TOTAL ATTENDED:   ${totalAttended}`);
    console.log(`📈 Overall Attendance Rate:     ${totalRegistered > 0 ? ((totalAttended / totalRegistered) * 100).toFixed(1) + '%' : 'N/A'}\n`);
    
    // Match expected names against registration.csv
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 MATCHING EXPECTED NAMES AGAINST REGISTRATION.CSV');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const registrationPath2 = path.join(__dirname, '..', 'registration.csv');
    const allRegistrations: any[] = [];
    
    if (fs.existsSync(registrationPath2)) {
      const csvContent = fs.readFileSync(registrationPath2, 'utf-8');
      const lines = csvContent.split('\n');
      
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
            allRegistrations.push({
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
    }
    
    // Match Kokori expected names
    const kokoriMatches: Array<{expected: string, found: any}> = [];
    const kokoriNotFound: string[] = [];
    
    for (const expectedName of kokoriExpected) {
      const match = allRegistrations.find(reg => namesMatch(expectedName, reg.name));
      if (match) {
        kokoriMatches.push({ expected: expectedName, found: match });
      } else {
        kokoriNotFound.push(expectedName);
      }
    }
    
    // Match Orogun expected names
    const orogunMatches: Array<{expected: string, found: any}> = [];
    const orogunNotFound: string[] = [];
    
    for (const expectedName of orogunExpected) {
      const match = allRegistrations.find(reg => namesMatch(expectedName, reg.name));
      if (match) {
        orogunMatches.push({ expected: expectedName, found: match });
      } else {
        orogunNotFound.push(expectedName);
      }
    }
    
    console.log('📍 KOKORI EXPECTED NAMES MATCHING:');
    console.log(`   ✅ Found in Registration: ${kokoriMatches.length}/${kokoriExpected.length} (${((kokoriMatches.length / kokoriExpected.length) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Not Found: ${kokoriNotFound.length}\n`);
    
    console.log('📍 OROGUN EXPECTED NAMES MATCHING:');
    console.log(`   ✅ Found in Registration: ${orogunMatches.length}/${orogunExpected.length} (${((orogunMatches.length / orogunExpected.length) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Not Found: ${orogunNotFound.length}\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 COMBINED EXPECTED NAMES SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    const totalExpected = kokoriExpected.length + orogunExpected.length;
    const totalFound = kokoriMatches.length + orogunMatches.length;
    const totalNotFound = kokoriNotFound.length + orogunNotFound.length;
    console.log(`Total Expected Names:        ${totalExpected}`);
    console.log(`✅ Found in Registration:   ${totalFound} (${((totalFound / totalExpected) * 100).toFixed(1)}%)`);
    console.log(`❌ Not Found:               ${totalNotFound}\n`);
    
    // Export to CSV
    const exportData: any[] = [
      {
        'Location': 'Kokori',
        'Database Total': kokoriDB.length,
        'Checked In': kokoriCheckedIn,
        'Checked Out': kokoriCheckedOut,
        'Pending': kokoriPending,
        'Registration CSV': kokoriReg.length,
        'Check-in CSV': kokoriCheckIns.length,
        'Estimated Registered': Math.max(kokoriDB.length, kokoriReg.length),
        'Estimated Attended': kokoriCheckedIn + kokoriCheckedOut
      },
      {
        'Location': 'Orogun',
        'Database Total': orogunDB.length,
        'Checked In': orogunCheckedIn,
        'Checked Out': orogunCheckedOut,
        'Pending': orogunPending,
        'Registration CSV': orogunReg.length,
        'Check-in CSV': orogunCheckIns.length,
        'Estimated Registered': Math.max(orogunDB.length, orogunReg.length),
        'Estimated Attended': orogunCheckedIn + orogunCheckedOut
      },
      {
        'Location': 'Warri',
        'Database Total': warriDB.length,
        'Checked In': warriCheckedIn,
        'Checked Out': warriCheckedOut,
        'Pending': warriPending,
        'Registration CSV': warriReg.length,
        'Check-in CSV': warriCheckIns.length,
        'Estimated Registered': Math.max(warriDB.length, warriReg.length),
        'Estimated Attended': warriCheckedIn + warriCheckedOut
      },
      {
        'Location': 'Other Delta',
        'Database Total': otherDeltaDB.length,
        'Checked In': otherDeltaCheckedIn,
        'Checked Out': otherDeltaCheckedOut,
        'Pending': otherDeltaPending,
        'Registration CSV': otherDeltaReg.length,
        'Check-in CSV': otherDeltaCheckIns.length,
        'Estimated Registered': Math.max(otherDeltaDB.length, otherDeltaReg.length),
        'Estimated Attended': otherDeltaCheckedIn + otherDeltaCheckedOut
      },
      {
        'Location': 'TOTAL (Warri + Orogun + Kokori + Delta)',
        'Database Total': totalDB,
        'Checked In': totalCheckedIn,
        'Checked Out': totalCheckedOut,
        'Pending': totalPending,
        'Registration CSV': totalReg,
        'Check-in CSV': totalCheckIns,
        'Estimated Registered': totalRegistered,
        'Estimated Attended': totalAttended
      }
    ];
    
    const csvPath = path.join(__dirname, '..', 'uploads', `warri-orogun-kokori-delta-combined-${Date.now()}.csv`);
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
    console.log(`💾 Exported combined totals to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

combineOrogunDeltaKokori();

