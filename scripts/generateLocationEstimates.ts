import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface LocationEstimate {
  location: string;
  expectedCount: number;
  registeredCount: number;
  checkedInCount: number;
  checkedOutCount: number;
  pendingCount: number;
  notFoundCount: number;
  estimatedTotalAttended: number;
  estimatedTotalRegistered: number;
  attendanceRate: string;
  registrationRate: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function generateLocationEstimates() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 LOCATION ATTENDANCE ESTIMATES');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // KOKORI DATA
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
    
    // OROGUN/DELTA DATA
    const orogunExpected = [
      'Emmanuel Jackson opiri', 'Oghenekaro Helen', 'Vivian Godwin', 'Philo adjarho',
      'Stphanie Akpofure', 'Glory sokodi', 'Fegiro uloho', 'Princess ejovwokoghene',
      'Esther Chukwunyere', 'Oghenerukevwe Rita', 'Ejeromedoghene Victoria',
      'Stephen Akpojotor', 'Obas Edwin', 'Aremu Daniel', 'Gloria Esanye',
      'Eguono Ejeromedoghene', 'Daniel Aremu', 'Godwin Juliet', 'Richard Akpofure',
      'Diegbe Tracy', 'Gabriel blessing', 'Faith Murphy', 'David Okakuro',
      'Prince umunade', 'Onya favour', 'Igoru blessing'
    ];
    
    // ANAMBRA/AWKA DATA
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
    
    const estimates: LocationEstimate[] = [];
    
    // Process KOKORI
    console.log('📊 Processing KOKORI...\n');
    const kokoriRegex = new RegExp('kokori', 'i');
    const kokoriDB = await Camper.find({
      $or: [
        { notes: kokoriRegex },
        { email: kokoriRegex }
      ],
      isDeleted: false
    }).lean();
    
    const kokoriCheckedIn = kokoriDB.filter((c: any) => c.status === 'checked-in').length;
    const kokoriCheckedOut = kokoriDB.filter((c: any) => c.status === 'checked-out').length;
    const kokoriPending = kokoriDB.filter((c: any) => c.status === 'pending').length;
    
    // Count registrations from registration CSV
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    let kokoriRegistered = 0;
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
          if (location.includes('kokori')) kokoriRegistered++;
        }
      }
    }
    
    const kokoriExpectedCount = kokoriExpected.length;
    const kokoriNotFound = kokoriExpectedCount - kokoriDB.length;
    
    estimates.push({
      location: 'KOKORI',
      expectedCount: kokoriExpectedCount,
      registeredCount: Math.max(kokoriRegistered, kokoriDB.length),
      checkedInCount: kokoriCheckedIn,
      checkedOutCount: kokoriCheckedOut,
      pendingCount: kokoriPending,
      notFoundCount: kokoriNotFound,
      estimatedTotalAttended: kokoriCheckedIn + kokoriCheckedOut,
      estimatedTotalRegistered: Math.max(kokoriRegistered, kokoriDB.length),
      attendanceRate: kokoriRegistered > 0 ? ((kokoriCheckedIn + kokoriCheckedOut) / kokoriRegistered * 100).toFixed(1) + '%' : 'N/A',
      registrationRate: kokoriExpectedCount > 0 ? ((Math.max(kokoriRegistered, kokoriDB.length) / kokoriExpectedCount) * 100).toFixed(1) + '%' : 'N/A'
    });
    
    // Process OROGUN/DELTA
    console.log('📊 Processing OROGUN/DELTA...\n');
    const orogunDeltaRegex = new RegExp('orogun|delta', 'i');
    const orogunDeltaDB = await Camper.find({
      $or: [
        { notes: orogunDeltaRegex },
        { email: orogunDeltaRegex }
      ],
      isDeleted: false
    }).lean();
    
    const orogunDeltaCheckedIn = orogunDeltaDB.filter((c: any) => c.status === 'checked-in').length;
    const orogunDeltaCheckedOut = orogunDeltaDB.filter((c: any) => c.status === 'checked-out').length;
    const orogunDeltaPending = orogunDeltaDB.filter((c: any) => c.status === 'pending').length;
    
    let orogunDeltaRegistered = 0;
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
          if (location.includes('orogun') || location.includes('delta')) {
            // Exclude Kokori Delta State
            if (!location.includes('kokori')) {
              orogunDeltaRegistered++;
            }
          }
        }
      }
    }
    
    const orogunExpectedCount = orogunExpected.length;
    const orogunNotFound = orogunExpectedCount - orogunDeltaDB.filter((c: any) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      return orogunExpected.some(e => name.includes(normalizeName(e).split(' ')[0]));
    }).length;
    
    estimates.push({
      location: 'OROGUN/DELTA',
      expectedCount: orogunExpectedCount,
      registeredCount: Math.max(orogunDeltaRegistered, orogunDeltaDB.length),
      checkedInCount: orogunDeltaCheckedIn,
      checkedOutCount: orogunDeltaCheckedOut,
      pendingCount: orogunDeltaPending,
      notFoundCount: orogunNotFound,
      estimatedTotalAttended: orogunDeltaCheckedIn + orogunDeltaCheckedOut,
      estimatedTotalRegistered: Math.max(orogunDeltaRegistered, orogunDeltaDB.length),
      attendanceRate: orogunDeltaRegistered > 0 ? ((orogunDeltaCheckedIn + orogunDeltaCheckedOut) / orogunDeltaRegistered * 100).toFixed(1) + '%' : 'N/A',
      registrationRate: orogunExpectedCount > 0 ? ((Math.max(orogunDeltaRegistered, orogunDeltaDB.length) / orogunExpectedCount) * 100).toFixed(1) + '%' : 'N/A'
    });
    
    // Process ANAMBRA/AWKA
    console.log('📊 Processing ANAMBRA/AWKA...\n');
    const anambraRegex = new RegExp('anambra|akwa|awka', 'i');
    const anambraDB = await Camper.find({
      $or: [
        { notes: anambraRegex },
        { email: anambraRegex }
      ],
      isDeleted: false
    }).lean();
    
    const anambraCheckedIn = anambraDB.filter((c: any) => c.status === 'checked-in').length;
    const anambraCheckedOut = anambraDB.filter((c: any) => c.status === 'checked-out').length;
    const anambraPending = anambraDB.filter((c: any) => c.status === 'pending').length;
    
    let anambraRegistered = 0;
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
          if (location.includes('anambra') || location.includes('akwa') || location.includes('awka')) {
            anambraRegistered++;
          }
        }
      }
    }
    
    const anambraExpectedCount = anambraExpected.length;
    const anambraNotFound = anambraExpectedCount - anambraDB.filter((c: any) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      return anambraExpected.some(e => name.includes(normalizeName(e).split(' ')[0]));
    }).length;
    
    estimates.push({
      location: 'ANAMBRA/AWKA',
      expectedCount: anambraExpectedCount,
      registeredCount: Math.max(anambraRegistered, anambraDB.length),
      checkedInCount: anambraCheckedIn,
      checkedOutCount: anambraCheckedOut,
      pendingCount: anambraPending,
      notFoundCount: anambraNotFound,
      estimatedTotalAttended: anambraCheckedIn + anambraCheckedOut,
      estimatedTotalRegistered: Math.max(anambraRegistered, anambraDB.length),
      attendanceRate: anambraRegistered > 0 ? ((anambraCheckedIn + anambraCheckedOut) / anambraRegistered * 100).toFixed(1) + '%' : 'N/A',
      registrationRate: anambraExpectedCount > 0 ? ((Math.max(anambraRegistered, anambraDB.length) / anambraExpectedCount) * 100).toFixed(1) + '%' : 'N/A'
    });
    
    // Print Report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 LOCATION ATTENDANCE ESTIMATES');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    for (const estimate of estimates) {
      console.log(`📍 ${estimate.location}`);
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Expected (from lists):           ${estimate.expectedCount}`);
      console.log(`Estimated Registered:            ${estimate.registeredCount}`);
      console.log(`✅ Actually Checked In:          ${estimate.checkedInCount}`);
      console.log(`🚪 Checked Out:                 ${estimate.checkedOutCount}`);
      console.log(`⏳ Registered but NOT Checked In: ${estimate.pendingCount}`);
      console.log(`❌ Not Found in System:          ${estimate.notFoundCount}`);
      console.log(`📈 Registration Rate:            ${estimate.registrationRate}`);
      console.log(`📈 Attendance Rate:              ${estimate.attendanceRate}`);
      console.log(`\n💡 ESTIMATED TOTAL ATTENDED: ${estimate.estimatedTotalAttended}`);
      console.log(`💡 ESTIMATED TOTAL REGISTERED: ${estimate.estimatedTotalRegistered}\n`);
    }
    
    // Grand Total
    const grandTotalExpected = estimates.reduce((sum, e) => sum + e.expectedCount, 0);
    const grandTotalRegistered = estimates.reduce((sum, e) => sum + e.estimatedTotalRegistered, 0);
    const grandTotalAttended = estimates.reduce((sum, e) => sum + e.estimatedTotalAttended, 0);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 GRAND TOTALS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Expected (from lists):      ${grandTotalExpected}`);
    console.log(`Total Estimated Registered:        ${grandTotalRegistered}`);
    console.log(`Total Estimated Attended:          ${grandTotalAttended}`);
    console.log(`Overall Attendance Rate:           ${grandTotalRegistered > 0 ? ((grandTotalAttended / grandTotalRegistered) * 100).toFixed(1) + '%' : 'N/A'}\n`);
    
    // Export to CSV
    const exportData: any[] = [];
    for (const estimate of estimates) {
      exportData.push({
        'Location': estimate.location,
        'Expected Count': estimate.expectedCount,
        'Estimated Registered': estimate.registeredCount,
        'Checked In': estimate.checkedInCount,
        'Checked Out': estimate.checkedOutCount,
        'Pending (Not Checked In)': estimate.pendingCount,
        'Not Found': estimate.notFoundCount,
        'Estimated Total Attended': estimate.estimatedTotalAttended,
        'Estimated Total Registered': estimate.estimatedTotalRegistered,
        'Registration Rate': estimate.registrationRate,
        'Attendance Rate': estimate.attendanceRate
      });
    }
    
    // Add grand totals row
    exportData.push({
      'Location': 'GRAND TOTALS',
      'Expected Count': grandTotalExpected,
      'Estimated Registered': grandTotalRegistered,
      'Checked In': estimates.reduce((sum, e) => sum + e.checkedInCount, 0),
      'Checked Out': estimates.reduce((sum, e) => sum + e.checkedOutCount, 0),
      'Pending (Not Checked In)': estimates.reduce((sum, e) => sum + e.pendingCount, 0),
      'Not Found': estimates.reduce((sum, e) => sum + e.notFoundCount, 0),
      'Estimated Total Attended': grandTotalAttended,
      'Estimated Total Registered': grandTotalRegistered,
      'Registration Rate': grandTotalExpected > 0 ? ((grandTotalRegistered / grandTotalExpected) * 100).toFixed(1) + '%' : 'N/A',
      'Attendance Rate': grandTotalRegistered > 0 ? ((grandTotalAttended / grandTotalRegistered) * 100).toFixed(1) + '%' : 'N/A'
    });
    
    const csvPath = path.join(__dirname, '..', 'uploads', `location-estimates-${Date.now()}.csv`);
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
    console.log(`💾 Exported estimates to: ${csvPath}\n`);
    
    // Create markdown summary
    const markdownPath = path.join(__dirname, '..', 'uploads', `location-estimates-summary-${Date.now()}.md`);
    let markdown = `# Location Attendance Estimates Summary\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `| Location | Expected | Registered | Attended | Attendance Rate |\n`;
    markdown += `|----------|----------|------------|----------|----------------|\n`;
    for (const estimate of estimates) {
      markdown += `| ${estimate.location} | ${estimate.expectedCount} | ${estimate.estimatedTotalRegistered} | ${estimate.estimatedTotalAttended} | ${estimate.attendanceRate} |\n`;
    }
    markdown += `| **TOTAL** | **${grandTotalExpected}** | **${grandTotalRegistered}** | **${grandTotalAttended}** | **${grandTotalRegistered > 0 ? ((grandTotalAttended / grandTotalRegistered) * 100).toFixed(1) + '%' : 'N/A'}** |\n\n`;
    
    markdown += `## Detailed Breakdown\n\n`;
    for (const estimate of estimates) {
      markdown += `### ${estimate.location}\n\n`;
      markdown += `- **Expected:** ${estimate.expectedCount}\n`;
      markdown += `- **Estimated Registered:** ${estimate.estimatedTotalRegistered}\n`;
      markdown += `- **Actually Checked In:** ${estimate.checkedInCount}\n`;
      markdown += `- **Checked Out:** ${estimate.checkedOutCount}\n`;
      markdown += `- **Registered but NOT Checked In:** ${estimate.pendingCount}\n`;
      markdown += `- **Not Found:** ${estimate.notFoundCount}\n`;
      markdown += `- **Registration Rate:** ${estimate.registrationRate}\n`;
      markdown += `- **Attendance Rate:** ${estimate.attendanceRate}\n\n`;
      markdown += `**💡 ESTIMATED TOTAL ATTENDED: ${estimate.estimatedTotalAttended}**\n\n`;
    }
    
    fs.writeFileSync(markdownPath, markdown);
    console.log(`📄 Exported markdown summary to: ${markdownPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

generateLocationEstimates();





