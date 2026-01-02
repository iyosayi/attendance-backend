import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface Attendee {
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: 'checked-in' | 'checked-out' | 'pending' | 'not-found';
  id?: string;
  checkInTime?: Date;
  source: string;
  notes?: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

async function consolidateOrogunAttendance() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 OROGUN ATTENDANCE CONSOLIDATION REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allAttendees = new Map<string, Attendee>();
    
    // 1. Load from Database
    console.log('📂 Loading data from Database...');
    const orogunRegex = new RegExp('orogun', 'i');
    const dbCampers = await Camper.find({
      $or: [
        { notes: orogunRegex },
        { email: orogunRegex }
      ],
      isDeleted: false
    }).lean();
    
    console.log(`   Found ${dbCampers.length} campers in database\n`);
    
    for (const camper of dbCampers) {
      const fullName = `${camper.firstName} ${camper.lastName}`.trim();
      const key = normalizeName(fullName);
      
      if (!allAttendees.has(key)) {
        allAttendees.set(key, {
          firstName: camper.firstName,
          lastName: camper.lastName,
          fullName,
          phone: camper.phone,
          email: camper.email,
          status: (camper.status as any) || 'pending',
          id: camper.code || camper._id.toString(),
          checkInTime: camper.checkInTime,
          source: 'Database',
          notes: camper.notes
        });
      } else {
        const existing = allAttendees.get(key)!;
        // Update if we have more complete info
        if (!existing.phone && camper.phone) existing.phone = camper.phone;
        if (!existing.email && camper.email) existing.email = camper.email;
        if (camper.status === 'checked-in' && existing.status !== 'checked-in') {
          existing.status = 'checked-in';
          existing.checkInTime = camper.checkInTime;
        }
        existing.source = `${existing.source}, Database`;
      }
    }
    
    // 2. Load from Registration CSV
    console.log('📂 Loading data from Registration CSV...');
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    if (fs.existsSync(registrationPath)) {
      const csvContent = fs.readFileSync(registrationPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      let regCount = 0;
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
          const location = parts[9] || '';
          
          if (location.toLowerCase().includes('orogun')) {
            regCount++;
            const fullName = `${firstName} ${lastName}`.trim();
            const key = normalizeName(fullName);
            
            if (!allAttendees.has(key)) {
              allAttendees.set(key, {
                firstName,
                lastName,
                fullName,
                phone,
                email,
                status: 'pending',
                source: 'Registration CSV',
                notes: `Location: ${location}`
              });
            } else {
              const existing = allAttendees.get(key)!;
              if (!existing.phone && phone) existing.phone = phone;
              if (!existing.email && email) existing.email = email;
              existing.source = `${existing.source}, Registration CSV`;
            }
          }
        }
      }
      console.log(`   Found ${regCount} registrations\n`);
    } else {
      console.log('   Registration CSV not found\n');
    }
    
    // 3. Load from Campers CSV
    console.log('📂 Loading data from Campers CSV...');
    const campersPath = path.join(__dirname, '..', 'campers.csv');
    if (fs.existsSync(campersPath)) {
      const csvContent = fs.readFileSync(campersPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      let camperCount = 0;
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
        
        if (parts.length >= 4) {
          const id = parts[0] || '';
          const firstName = parts[1] || '';
          const lastName = parts[2] || '';
          const notes = parts[4] || '';
          
          if (notes.toLowerCase().includes('orogun')) {
            camperCount++;
            const fullName = `${firstName} ${lastName}`.trim();
            const key = normalizeName(fullName);
            
            if (!allAttendees.has(key)) {
              allAttendees.set(key, {
                firstName,
                lastName,
                fullName,
                id,
                status: 'pending',
                source: 'Campers CSV',
                notes
              });
            } else {
              const existing = allAttendees.get(key)!;
              if (!existing.id && id) existing.id = id;
              existing.source = `${existing.source}, Campers CSV`;
            }
          }
        }
      }
      console.log(`   Found ${camperCount} entries\n`);
    } else {
      console.log('   Campers CSV not found\n');
    }
    
    // 4. Check for check-in CSV files
    console.log('📂 Checking for check-in CSV files...');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const checkInFiles = files.filter(f => f.toLowerCase().includes('orogun') && f.endsWith('.csv'));
      
      if (checkInFiles.length > 0) {
        console.log(`   Found ${checkInFiles.length} check-in CSV file(s)\n`);
        for (const file of checkInFiles) {
          const filePath = path.join(uploadsDir, file);
          const csvContent = fs.readFileSync(filePath, 'utf-8');
          const lines = csvContent.split('\n').filter(line => line.trim());
          
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
              const checkInTime = parts[8]?.replace(/^"|"$/g, '') || '';
              
              const fullName = `${firstName} ${lastName}`.trim();
              const key = normalizeName(fullName);
              
              if (!allAttendees.has(key)) {
                allAttendees.set(key, {
                  firstName,
                  lastName,
                  fullName,
                  phone,
                  email,
                  status: 'checked-in',
                  source: `Check-In CSV (${file})`,
                  checkInTime: checkInTime ? new Date(checkInTime) : undefined
                });
              } else {
                const existing = allAttendees.get(key)!;
                if (!existing.phone && phone) existing.phone = phone;
                if (!existing.email && email) existing.email = email;
                if (existing.status !== 'checked-in') {
                  existing.status = 'checked-in';
                  existing.checkInTime = checkInTime ? new Date(checkInTime) : undefined;
                }
                existing.source = `${existing.source}, Check-In CSV`;
              }
            }
          }
        }
      } else {
        console.log('   No check-in CSV files found\n');
      }
    }
    
    console.log(`✅ Total Unique Orogun Attendees Found: ${allAttendees.size}\n`);
    
    // Categorize by status
    const checkedIn = Array.from(allAttendees.values()).filter(a => a.status === 'checked-in');
    const checkedOut = Array.from(allAttendees.values()).filter(a => a.status === 'checked-out');
    const pending = Array.from(allAttendees.values()).filter(a => a.status === 'pending');
    
    // Print Report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ACTUALLY CHECKED IN (Attended Camp)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedIn.length > 0) {
      for (let i = 0; i < checkedIn.length; i++) {
        const attendee = checkedIn[i];
        console.log(`${i + 1}. ${attendee.fullName}`);
        console.log(`   ID: ${attendee.id || 'N/A'} | Phone: ${attendee.phone || 'N/A'}`);
        if (attendee.email) console.log(`   Email: ${attendee.email}`);
        if (attendee.checkInTime) console.log(`   Check-in Time: ${attendee.checkInTime}`);
        console.log(`   Source: ${attendee.source}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚪 CHECKED OUT (Attended then Left)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedOut.length > 0) {
      for (let i = 0; i < checkedOut.length; i++) {
        const attendee = checkedOut[i];
        console.log(`${i + 1}. ${attendee.fullName}`);
        console.log(`   ID: ${attendee.id || 'N/A'} | Phone: ${attendee.phone || 'N/A'}`);
        if (attendee.email) console.log(`   Email: ${attendee.email}`);
        console.log(`   Source: ${attendee.source}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⏳ REGISTERED BUT NOT CHECKED IN (Did Not Attend)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (pending.length > 0) {
      for (let i = 0; i < pending.length; i++) {
        const attendee = pending[i];
        console.log(`${i + 1}. ${attendee.fullName}`);
        console.log(`   ID: ${attendee.id || 'N/A'} | Phone: ${attendee.phone || 'N/A'}`);
        if (attendee.email) console.log(`   Email: ${attendee.email}`);
        console.log(`   Source: ${attendee.source}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    // Summary Statistics
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY STATISTICS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const totalFound = allAttendees.size;
    const totalAttended = checkedIn.length + checkedOut.length;
    const totalRegistered = totalFound;
    
    console.log(`Total Unique Orogun Attendees Found:    ${totalFound}`);
    console.log(`✅ Actually Checked In:                  ${checkedIn.length}`);
    console.log(`🚪 Checked Out:                         ${checkedOut.length}`);
    console.log(`⏳ Registered but NOT Checked In:        ${pending.length}\n`);
    
    if (totalRegistered > 0) {
      const attendanceRate = (totalAttended / totalRegistered * 100).toFixed(1);
      console.log(`📈 ATTENDANCE RATE:`);
      console.log(`   ${totalAttended} out of ${totalRegistered} registered = ${attendanceRate}%`);
    }
    
    // Export to CSV
    const exportData: any[] = [];
    for (const attendee of Array.from(allAttendees.values())) {
      exportData.push({
        'First Name': attendee.firstName,
        'Last Name': attendee.lastName,
        'Full Name': attendee.fullName,
        'Phone': attendee.phone || '',
        'Email': attendee.email || '',
        'ID': attendee.id || '',
        'Status': attendee.status,
        'Check-In Time': attendee.checkInTime ? new Date(attendee.checkInTime).toISOString() : '',
        'Source': attendee.source,
        'Notes': attendee.notes || '',
        'Attendance Category': attendee.status === 'checked-in' ? 'ATTENDED' :
                              attendee.status === 'checked-out' ? 'ATTENDED (Left)' :
                              'REGISTERED BUT NOT ATTENDED'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `orogun-attendance-consolidated-${Date.now()}.csv`);
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
    
    // Create markdown summary
    const markdownPath = path.join(__dirname, '..', 'uploads', `orogun-final-summary-${Date.now()}.md`);
    let markdown = `# Orogun Attendance Final Summary\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `## Summary Statistics\n\n`;
    markdown += `- **Total Unique Attendees Found:** ${totalFound}\n`;
    markdown += `- **Actually Checked In:** ${checkedIn.length}\n`;
    markdown += `- **Checked Out:** ${checkedOut.length}\n`;
    markdown += `- **Registered but NOT Checked In:** ${pending.length}\n\n`;
    
    if (totalRegistered > 0) {
      const attendanceRate = (totalAttended / totalRegistered * 100).toFixed(1);
      markdown += `### Attendance Metrics\n\n`;
      markdown += `- **Attendance Rate:** ${attendanceRate}%\n`;
      markdown += `- **Total Attended:** ${totalAttended} out of ${totalRegistered} registered\n\n`;
    }
    
    markdown += `## Actually Checked In (${checkedIn.length})\n\n`;
    for (let i = 0; i < checkedIn.length; i++) {
      const a = checkedIn[i];
      markdown += `${i + 1}. **${a.fullName}**\n`;
      markdown += `   - ID: ${a.id || 'N/A'} | Phone: ${a.phone || 'N/A'}\n`;
      if (a.email) markdown += `   - Email: ${a.email}\n`;
      if (a.checkInTime) markdown += `   - Check-in Time: ${a.checkInTime}\n`;
      markdown += `\n`;
    }
    
    markdown += `\n## Registered but NOT Checked In (${pending.length})\n\n`;
    for (let i = 0; i < pending.length; i++) {
      const a = pending[i];
      markdown += `${i + 1}. **${a.fullName}**\n`;
      markdown += `   - ID: ${a.id || 'N/A'} | Phone: ${a.phone || 'N/A'}\n`;
      if (a.email) markdown += `   - Email: ${a.email}\n`;
      markdown += `\n`;
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

consolidateOrogunAttendance();

