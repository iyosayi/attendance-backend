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

async function combineAwkaAnambraOwerri() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 AWKA + ANAMBRA + OWERRI COMBINED TOTALS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Find all Anambra/Awka/Owerri entries
    const anambraRegex = new RegExp('anambra|akwa|awka|owerri', 'i');
    const allAnambraDB = await Camper.find({
      $or: [
        { notes: anambraRegex },
        { email: anambraRegex }
      ],
      isDeleted: false
    }).lean();
    
    // Categorize by specific location
    const awkaDB: any[] = [];
    const anambraDB: any[] = [];
    const owerriDB: any[] = [];
    
    for (const camper of allAnambraDB) {
      const notes = ((camper as any).notes || '').toLowerCase();
      const email = ((camper as any).email || '').toLowerCase();
      const locationStr = notes + ' ' + email;
      
      if (locationStr.includes('owerri')) {
        owerriDB.push(camper);
      } else if (locationStr.includes('awka')) {
        awkaDB.push(camper);
      } else {
        anambraDB.push(camper);
      }
    }
    
    // Expected Anambra names
    const anambraExpected = [
      'Okoli Nnagozie Emmanuel', 'Afam-Nkwoka Ifeanyichukwu', 'Eze Nkechi',
      'Ikechukwu Chukwuebuka', 'Enemuo Jude Chekwube', 'Okoli Divine. C',
      'Victory Ifeanyi David', 'Christian Ebuka ogbaegbe', 'Nezianya Chiagozie Joseph',
      'Nwankwo Sochima', 'Teddy -Austin prisca', 'Mba Queen', 'Desire chinweoke Ogboso',
      'onyeakagbusi Juliet', 'chioma Gloria Odoemenam', 'Major Chibuzor Maxwell',
      'Miracle Onuoha', 'umeh angel', 'nwobodo izunna', 'Delight ogboso',
      'Ebirim Queen Ebubechukwu', 'Nnolika Freeman precious', 'Nnolika freeman peace',
      'Maduelosi Owen', 'ChukwuemekaEmmanel okeke', 'Mmaduakonam Joshua', 'Nnamdi Chidera'
    ];
    
    // Parse registration CSV
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const awkaReg: any[] = [];
    const anambraReg: any[] = [];
    const owerriReg: any[] = [];
    
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
          if (location.includes('anambra') || location.includes('akwa') || location.includes('awka') || location.includes('owerri')) {
            const regEntry: any = {
              name: `${parts[1] || ''} ${parts[2] || ''}`.trim(),
              email: parts[3] || '',
              phone: parts[4] || '',
              location: parts[9] || ''
            };
            
            if (location.includes('owerri')) {
              owerriReg.push(regEntry);
            } else if (location.includes('awka')) {
              awkaReg.push(regEntry);
            } else {
              anambraReg.push(regEntry);
            }
          }
        }
      }
    }
    
    // Parse check-in CSVs
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const checkInFiles = fs.readdirSync(uploadsDir).filter(f => 
      f.includes('checked-in-by-location') && (f.includes('anambra') || f.includes('awka') || f.includes('owerri'))
    );
    
    const awkaCheckIns: any[] = [];
    const anambraCheckIns: any[] = [];
    const owerriCheckIns: any[] = [];
    
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
          
          if (locationStr.includes('owerri')) {
            owerriCheckIns.push(checkInEntry);
          } else if (locationStr.includes('awka')) {
            awkaCheckIns.push(checkInEntry);
          } else {
            anambraCheckIns.push(checkInEntry);
          }
        }
      }
    }
    
    // Calculate statistics
    const awkaCheckedIn = awkaDB.filter((c: any) => c.status === 'checked-in').length;
    const awkaCheckedOut = awkaDB.filter((c: any) => c.status === 'checked-out').length;
    const awkaPending = awkaDB.filter((c: any) => c.status === 'pending').length;
    
    const anambraCheckedIn = anambraDB.filter((c: any) => c.status === 'checked-in').length;
    const anambraCheckedOut = anambraDB.filter((c: any) => c.status === 'checked-out').length;
    const anambraPending = anambraDB.filter((c: any) => c.status === 'pending').length;
    
    const owerriCheckedIn = owerriDB.filter((c: any) => c.status === 'checked-in').length;
    const owerriCheckedOut = owerriDB.filter((c: any) => c.status === 'checked-out').length;
    const owerriPending = owerriDB.filter((c: any) => c.status === 'pending').length;
    
    // Print breakdown
    console.log('📍 AWKA');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${awkaDB.length}`);
    console.log(`  ✅ Checked In:               ${awkaCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${awkaCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${awkaPending}`);
    console.log(`Registration CSV Entries:      ${awkaReg.length}`);
    console.log(`Check-in CSV Entries:          ${awkaCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(awkaDB.length, awkaReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${awkaCheckedIn + awkaCheckedOut}\n`);
    
    console.log('📍 ANAMBRA');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${anambraDB.length}`);
    console.log(`  ✅ Checked In:               ${anambraCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${anambraCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${anambraPending}`);
    console.log(`Registration CSV Entries:      ${anambraReg.length}`);
    console.log(`Check-in CSV Entries:          ${anambraCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(anambraDB.length, anambraReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${anambraCheckedIn + anambraCheckedOut}\n`);
    
    console.log('📍 OWERRI');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Database Entries:              ${owerriDB.length}`);
    console.log(`  ✅ Checked In:               ${owerriCheckedIn}`);
    console.log(`  🚪 Checked Out:              ${owerriCheckedOut}`);
    console.log(`  ⏳ Pending:                  ${owerriPending}`);
    console.log(`Registration CSV Entries:      ${owerriReg.length}`);
    console.log(`Check-in CSV Entries:          ${owerriCheckIns.length}`);
    console.log(`💡 Estimated Total Registered: ${Math.max(owerriDB.length, owerriReg.length)}`);
    console.log(`💡 Estimated Total Attended:   ${owerriCheckedIn + owerriCheckedOut}\n`);
    
    // Combined totals
    const totalDB = awkaDB.length + anambraDB.length + owerriDB.length;
    const totalCheckedIn = awkaCheckedIn + anambraCheckedIn + owerriCheckedIn;
    const totalCheckedOut = awkaCheckedOut + anambraCheckedOut + owerriCheckedOut;
    const totalPending = awkaPending + anambraPending + owerriPending;
    const totalReg = awkaReg.length + anambraReg.length + owerriReg.length;
    const totalCheckIns = awkaCheckIns.length + anambraCheckIns.length + owerriCheckIns.length;
    const totalRegistered = Math.max(totalDB, totalReg);
    const totalAttended = totalCheckedIn + totalCheckedOut;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 COMBINED TOTALS (AWKA + ANAMBRA + OWERRI)');
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
    
    const allRegistrations: any[] = [];
    
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
          const regName = `${parts[1] || ''} ${parts[2] || ''}`.trim();
          const regLocation = (parts[9] || '').toLowerCase();
          
          if (regLocation.includes('anambra') || regLocation.includes('akwa') || regLocation.includes('awka') || regLocation.includes('owerri')) {
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
    
    // Match Anambra expected names
    const anambraMatches: Array<{expected: string, found: any}> = [];
    const anambraNotFound: string[] = [];
    
    for (const expectedName of anambraExpected) {
      const match = allRegistrations.find(reg => namesMatch(expectedName, reg.name));
      if (match) {
        anambraMatches.push({ expected: expectedName, found: match });
      } else {
        anambraNotFound.push(expectedName);
      }
    }
    
    console.log('📍 ANAMBRA EXPECTED NAMES MATCHING:');
    console.log(`   ✅ Found in Registration: ${anambraMatches.length}/${anambraExpected.length} (${((anambraMatches.length / anambraExpected.length) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Not Found: ${anambraNotFound.length}\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 EXPECTED NAMES SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    const totalExpected = anambraExpected.length;
    const totalFound = anambraMatches.length;
    const totalNotFound = anambraNotFound.length;
    console.log(`Total Expected Names (Anambra): ${totalExpected}`);
    console.log(`✅ Found in Registration:      ${totalFound} (${((totalFound / totalExpected) * 100).toFixed(1)}%)`);
    console.log(`❌ Not Found:                  ${totalNotFound}\n`);
    
    // Export to CSV
    const exportData: any[] = [
      {
        'Location': 'Awka',
        'Database Total': awkaDB.length,
        'Checked In': awkaCheckedIn,
        'Checked Out': awkaCheckedOut,
        'Pending': awkaPending,
        'Registration CSV': awkaReg.length,
        'Check-in CSV': awkaCheckIns.length,
        'Estimated Registered': Math.max(awkaDB.length, awkaReg.length),
        'Estimated Attended': awkaCheckedIn + awkaCheckedOut
      },
      {
        'Location': 'Anambra',
        'Database Total': anambraDB.length,
        'Checked In': anambraCheckedIn,
        'Checked Out': anambraCheckedOut,
        'Pending': anambraPending,
        'Registration CSV': anambraReg.length,
        'Check-in CSV': anambraCheckIns.length,
        'Estimated Registered': Math.max(anambraDB.length, anambraReg.length),
        'Estimated Attended': anambraCheckedIn + anambraCheckedOut
      },
      {
        'Location': 'Owerri',
        'Database Total': owerriDB.length,
        'Checked In': owerriCheckedIn,
        'Checked Out': owerriCheckedOut,
        'Pending': owerriPending,
        'Registration CSV': owerriReg.length,
        'Check-in CSV': owerriCheckIns.length,
        'Estimated Registered': Math.max(owerriDB.length, owerriReg.length),
        'Estimated Attended': owerriCheckedIn + owerriCheckedOut
      },
      {
        'Location': 'TOTAL (Awka + Anambra + Owerri)',
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
    
    const csvPath = path.join(__dirname, '..', 'uploads', `awka-anambra-owerri-combined-${Date.now()}.csv`);
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

combineAwkaAnambraOwerri();






