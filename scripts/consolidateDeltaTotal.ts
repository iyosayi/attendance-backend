import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface DeltaLocation {
  name: string;
  checkedIn: number;
  checkedOut: number;
  pending: number;
  total: number;
}

async function consolidateDeltaTotal() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 DELTA STATE TOTAL CONSOLIDATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Find all Delta State entries in database
    const deltaRegex = new RegExp('delta', 'i');
    const allDeltaDB = await Camper.find({
      $or: [
        { notes: deltaRegex },
        { email: deltaRegex }
      ],
      isDeleted: false
    }).lean();
    
    console.log(`📂 Found ${allDeltaDB.length} Delta entries in database\n`);
    
    // Parse registration CSV
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const deltaRegistrations: any[] = [];
    const locationBreakdown: Record<string, any[]> = {};
    
    if (fs.existsSync(registrationPath)) {
      const csvContent = fs.readFileSync(registrationPath, 'utf-8');
      const lines = csvContent.split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        // Parse CSV with proper quote handling
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
              timestamp: parts[0] || '',
              name: parts[1] || '',
              email: parts[2] || '',
              phone: parts[3] || '',
              gender: parts[4] || '',
              attendanceOption: parts[5] || '',
              city: parts[8] || '',
              location: parts[9] || '',
              notes: parts[10] || ''
            };
            deltaRegistrations.push(regEntry);
            
            // Categorize by specific location
            let locationKey = 'Other Delta';
            if (location.includes('kokori')) locationKey = 'Kokori';
            else if (location.includes('orogun')) locationKey = 'Orogun';
            else if (location.includes('waterside')) locationKey = 'Waterside';
            
            if (!locationBreakdown[locationKey]) {
              locationBreakdown[locationKey] = [];
            }
            locationBreakdown[locationKey].push(regEntry);
          }
        }
      }
    }
    
    console.log(`📂 Found ${deltaRegistrations.length} Delta registrations in CSV\n`);
    
    // Parse check-in CSVs
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const checkInFiles = fs.readdirSync(uploadsDir).filter(f => 
      f.includes('checked-in-by-location') && (f.includes('delta') || f.includes('kokori'))
    );
    
    const deltaCheckIns: any[] = [];
    const checkInByLocation: Record<string, any[]> = {};
    
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
          
          // Categorize by actual location field, not filename
          let locationKey = 'Other Delta';
          if (locationStr.includes('kokori')) locationKey = 'Kokori';
          else if (locationStr.includes('orogun')) locationKey = 'Orogun';
          else if (locationStr.includes('waterside')) locationKey = 'Waterside';
          
          if (!checkInByLocation[locationKey]) {
            checkInByLocation[locationKey] = [];
          }
          
          const checkInEntry: any = {
            firstName: parts[0] || '',
            lastName: parts[1] || '',
            email: parts[2] || '',
            phone: parts[3] || '',
            gender: parts[4] || '',
            location: parts[7] || '',
            checkInTime: parts[8] || ''
          };
          deltaCheckIns.push(checkInEntry);
          checkInByLocation[locationKey].push(checkInEntry);
        }
      }
    }
    
    console.log(`📂 Found ${deltaCheckIns.length} Delta check-ins from CSV files\n`);
    
    // Categorize database entries by location
    const dbByLocation: Record<string, any[]> = {
      'Kokori': [],
      'Orogun': [],
      'Waterside': [],
      'Other Delta': []
    };
    
    for (const camper of allDeltaDB) {
      const notes = ((camper as any).notes || '').toLowerCase();
      const email = ((camper as any).email || '').toLowerCase();
      const locationStr = notes + ' ' + email;
      
      let locationKey = 'Other Delta';
      if (locationStr.includes('kokori')) locationKey = 'Kokori';
      else if (locationStr.includes('orogun')) locationKey = 'Orogun';
      else if (locationStr.includes('waterside')) locationKey = 'Waterside';
      
      dbByLocation[locationKey].push(camper);
    }
    
    // Calculate statistics by location
    const locationStats: Record<string, DeltaLocation> = {
      'Kokori': { name: 'Kokori', checkedIn: 0, checkedOut: 0, pending: 0, total: 0 },
      'Orogun': { name: 'Orogun', checkedIn: 0, checkedOut: 0, pending: 0, total: 0 },
      'Waterside': { name: 'Waterside', checkedIn: 0, checkedOut: 0, pending: 0, total: 0 },
      'Other Delta': { name: 'Other Delta', checkedIn: 0, checkedOut: 0, pending: 0, total: 0 }
    };
    
    for (const [locationKey, campers] of Object.entries(dbByLocation)) {
      const stats = locationStats[locationKey];
      for (const camper of campers) {
        const status = (camper as any).status || 'pending';
        if (status === 'checked-in') stats.checkedIn++;
        else if (status === 'checked-out') stats.checkedOut++;
        else stats.pending++;
        stats.total++;
      }
    }
    
    // Print breakdown by location
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 DELTA STATE BREAKDOWN BY LOCATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let grandTotalCheckedIn = 0;
    let grandTotalCheckedOut = 0;
    let grandTotalPending = 0;
    let grandTotal = 0;
    
    for (const [locationKey, stats] of Object.entries(locationStats)) {
      const regCount = locationBreakdown[locationKey]?.length || 0;
      const checkInCount = checkInByLocation[locationKey]?.length || 0;
      
      console.log(`📍 ${locationKey.toUpperCase()}`);
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Database Entries:              ${stats.total}`);
      console.log(`  ✅ Checked In:               ${stats.checkedIn}`);
      console.log(`  🚪 Checked Out:              ${stats.checkedOut}`);
      console.log(`  ⏳ Pending (Not Checked In): ${stats.pending}`);
      console.log(`Registration CSV Entries:      ${regCount}`);
      console.log(`Check-in CSV Entries:          ${checkInCount}`);
      console.log(`💡 Estimated Total Registered: ${Math.max(stats.total, regCount)}`);
      console.log(`💡 Estimated Total Attended:   ${stats.checkedIn + stats.checkedOut}`);
      console.log(`📈 Attendance Rate:            ${Math.max(stats.total, regCount) > 0 ? (((stats.checkedIn + stats.checkedOut) / Math.max(stats.total, regCount)) * 100).toFixed(1) + '%' : 'N/A'}\n`);
      
      grandTotalCheckedIn += stats.checkedIn;
      grandTotalCheckedOut += stats.checkedOut;
      grandTotalPending += stats.pending;
      grandTotal += stats.total;
    }
    
    // Grand totals
    const totalRegistered = Math.max(
      grandTotal,
      deltaRegistrations.length
    );
    const totalAttended = grandTotalCheckedIn + grandTotalCheckedOut;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 DELTA STATE GRAND TOTALS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Database Entries:         ${grandTotal}`);
    console.log(`  ✅ Checked In:                ${grandTotalCheckedIn}`);
    console.log(`  🚪 Checked Out:               ${grandTotalCheckedOut}`);
    console.log(`  ⏳ Pending (Not Checked In):  ${grandTotalPending}`);
    console.log(`Total Registration CSV Entries: ${deltaRegistrations.length}`);
    console.log(`Total Check-in CSV Entries:     ${deltaCheckIns.length}`);
    console.log(`\n💡 ESTIMATED TOTAL REGISTERED: ${totalRegistered}`);
    console.log(`💡 ESTIMATED TOTAL ATTENDED:   ${totalAttended}`);
    console.log(`📈 Overall Attendance Rate:     ${totalRegistered > 0 ? ((totalAttended / totalRegistered) * 100).toFixed(1) + '%' : 'N/A'}\n`);
    
    // Export to CSV
    const exportData: any[] = [];
    for (const [locationKey, stats] of Object.entries(locationStats)) {
      const regCount = locationBreakdown[locationKey]?.length || 0;
      const checkInCount = checkInByLocation[locationKey]?.length || 0;
      const estimatedRegistered = Math.max(stats.total, regCount);
      const estimatedAttended = stats.checkedIn + stats.checkedOut;
      
      exportData.push({
        'Location': locationKey,
        'Database Total': stats.total,
        'Checked In': stats.checkedIn,
        'Checked Out': stats.checkedOut,
        'Pending': stats.pending,
        'Registration CSV Count': regCount,
        'Check-in CSV Count': checkInCount,
        'Estimated Registered': estimatedRegistered,
        'Estimated Attended': estimatedAttended,
        'Attendance Rate': estimatedRegistered > 0 ? ((estimatedAttended / estimatedRegistered) * 100).toFixed(1) + '%' : 'N/A'
      });
    }
    
    // Add grand totals row
    exportData.push({
      'Location': 'DELTA STATE TOTAL',
      'Database Total': grandTotal,
      'Checked In': grandTotalCheckedIn,
      'Checked Out': grandTotalCheckedOut,
      'Pending': grandTotalPending,
      'Registration CSV Count': deltaRegistrations.length,
      'Check-in CSV Count': deltaCheckIns.length,
      'Estimated Registered': totalRegistered,
      'Estimated Attended': totalAttended,
      'Attendance Rate': totalRegistered > 0 ? ((totalAttended / totalRegistered) * 100).toFixed(1) + '%' : 'N/A'
    });
    
    const csvPath = path.join(__dirname, '..', 'uploads', `delta-state-total-${Date.now()}.csv`);
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
    console.log(`💾 Exported Delta State totals to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

consolidateDeltaTotal();

