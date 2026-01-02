import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface AttendanceResult {
  expected: string;
  phone?: string;
  status: 'checked-in' | 'checked-out' | 'pending' | 'not-found';
  matches: Array<{
    name: string;
    source: string;
    confidence: string;
    phone?: string;
    email?: string;
    status: string;
    id?: string;
    checkInTime?: Date;
  }>;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function searchMember(expected: { name: string; phone?: string; parts: string[] }): Promise<AttendanceResult> {
  const matches: AttendanceResult['matches'] = [];
  
  // Search by phone (highest confidence)
  if (expected.phone) {
    const normalizedPhone = normalizePhone(expected.phone);
    const phoneResults = await Camper.find({
      $or: [
        { phone: { $regex: normalizedPhone.slice(-6), $options: 'i' } }
      ],
      isDeleted: false
    }).lean();
    
    for (const camper of phoneResults) {
      const fullName = `${camper.firstName} ${camper.lastName}`.trim();
      matches.push({
        name: fullName,
        source: 'Database',
        confidence: 'HIGH',
        phone: camper.phone,
        email: camper.email,
        status: camper.status || 'pending',
        id: camper.code || camper._id.toString(),
        checkInTime: camper.checkInTime
      });
    }
  }
  
  // Search by name parts
  for (const part of expected.parts) {
    if (part.length < 3) continue;
    const regex = new RegExp(part, 'i');
    const nameResults = await Camper.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { notes: regex }
      ],
      isDeleted: false
    }).lean();
    
    for (const camper of nameResults) {
      const fullName = `${camper.firstName} ${camper.lastName}`.trim();
      const normalizedCamper = normalizeName(fullName);
      const normalizedMember = normalizeName(expected.name);
      
      // Check if already added
      if (matches.some(m => m.name === fullName && m.id === (camper.code || camper._id.toString()))) {
        continue;
      }
      
      let confidence = 'MEDIUM';
      if (normalizedCamper.includes(normalizedMember) || normalizedMember.includes(normalizedCamper)) {
        confidence = 'HIGH';
      } else if (expected.parts.some(p => normalizedCamper.includes(normalizeName(p)))) {
        confidence = 'MEDIUM';
      } else {
        confidence = 'LOW';
      }
      
      matches.push({
        name: fullName,
        source: 'Database',
        confidence,
        phone: camper.phone,
        email: camper.email,
        status: camper.status || 'pending',
        id: camper.code || camper._id.toString(),
        checkInTime: camper.checkInTime
      });
    }
  }
  
  // Remove duplicates and sort
  const uniqueMatches = matches.filter((match, index, self) =>
    index === self.findIndex(m => m.name === match.name && m.id === match.id)
  );
  
  // Sort by confidence and status (checked-in first)
  uniqueMatches.sort((a, b) => {
    const confidenceOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    const statusOrder = { 'checked-in': 3, 'checked-out': 2, 'pending': 1 };
    
    if (confidenceOrder[a.confidence as keyof typeof confidenceOrder] !== confidenceOrder[b.confidence as keyof typeof confidenceOrder]) {
      return confidenceOrder[b.confidence as keyof typeof confidenceOrder] - confidenceOrder[a.confidence as keyof typeof confidenceOrder];
    }
    return (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0);
  });
  
  // Determine overall status - prioritize checked-in/checked-out over pending
  const checkedInMatches = uniqueMatches.filter(m => m.status === 'checked-in');
  const checkedOutMatches = uniqueMatches.filter(m => m.status === 'checked-out');
  const pendingMatches = uniqueMatches.filter(m => m.status === 'pending');
  
  let overallStatus: AttendanceResult['status'] = 'not-found';
  if (checkedInMatches.length > 0) {
    overallStatus = 'checked-in';
  } else if (checkedOutMatches.length > 0) {
    overallStatus = 'checked-out';
  } else if (pendingMatches.length > 0) {
    overallStatus = 'pending';
  }
  
  return {
    expected: expected.name,
    phone: expected.phone,
    status: overallStatus,
    matches: uniqueMatches.slice(0, 5) // Top 5 matches (we'll filter by status when displaying)
  };
}

async function generateActualAttendanceReport() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    const unmatchedMembers = [
      { name: 'Junior  fear God', phone: '08058333540', parts: ['Junior', 'fear', 'God'] },
      { name: 'Prevail Obavwonvwe', phone: '08154452725', parts: ['Prevail', 'Obavwonvwe'] },
      { name: 'Destiny ibobo', phone: undefined, parts: ['Destiny', 'ibobo'] },
      { name: 'Deborah owebor', phone: undefined, parts: ['Deborah', 'owebor'] },
      { name: 'Ogban Favour', phone: undefined, parts: ['Ogban', 'Favour'] },
      { name: 'Chidi Isaac', phone: undefined, parts: ['Chidi', 'Isaac'] },
      { name: 'Uloh promise', phone: '08154453141', parts: ['Uloh', 'promise'] },
      { name: 'Abadi Eloho', phone: '08154457564', parts: ['Abadi', 'Eloho'] },
      { name: 'Ighoruona Divine', phone: undefined, parts: ['Ighoruona', 'Divine'] },
      { name: 'Freeborn Felix', phone: undefined, parts: ['Freeborn', 'Felix'] },
      { name: 'John obukevwo', phone: undefined, parts: ['John', 'obukevwo'] },
      { name: 'Egware festus', phone: undefined, parts: ['Egware', 'festus'] },
      { name: 'Akpede Felix', phone: undefined, parts: ['Akpede', 'Felix'] }
    ];
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 KOKORI ACTUAL ATTENDANCE REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Note: "pending" status = Registered but NOT checked in\n');
    
    const results: AttendanceResult[] = [];
    
    for (const member of unmatchedMembers) {
      const result = await searchMember(member);
      results.push(result);
    }
    
    // Categorize results - only count if they have actual checked-in matches
    const checkedIn = results.filter(r => {
      return r.status === 'checked-in' && r.matches.some(m => m.status === 'checked-in');
    });
    const checkedOut = results.filter(r => {
      return r.status === 'checked-out' && r.matches.some(m => m.status === 'checked-out');
    });
    const pending = results.filter(r => {
      return r.status === 'pending' && r.matches.some(m => m.status === 'pending');
    });
    const notFound = results.filter(r => r.status === 'not-found');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ACTUALLY CHECKED IN (Attended)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedIn.length > 0) {
      for (const result of checkedIn) {
        const checkedInMatches = result.matches.filter(m => m.status === 'checked-in');
        if (checkedInMatches.length > 0) {
          const bestMatch = checkedInMatches[0];
          console.log(`✓ ${result.expected}`);
          console.log(`  → ${bestMatch.name} (ID: ${bestMatch.id})`);
          console.log(`  Phone: ${bestMatch.phone || 'N/A'}`);
          if (bestMatch.checkInTime) {
            console.log(`  Check-in Time: ${bestMatch.checkInTime}`);
          }
          console.log('');
        } else {
          // Status says checked-in but no checked-in matches - might be misclassified
          console.log(`⚠️  ${result.expected} - Status mismatch (marked as checked-in but no checked-in matches found)`);
          console.log('');
        }
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚪 CHECKED OUT (Attended then left)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedOut.length > 0) {
      for (const result of checkedOut) {
        const bestMatch = result.matches.find(m => m.status === 'checked-out') || result.matches[0];
        console.log(`✓ ${result.expected}`);
        console.log(`  → ${bestMatch.name} (ID: ${bestMatch.id})`);
        console.log(`  Phone: ${bestMatch.phone || 'N/A'}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⏳ REGISTERED BUT NOT CHECKED IN (Did not attend)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (pending.length > 0) {
      for (const result of pending) {
        const pendingMatches = result.matches.filter(m => m.status === 'pending');
        if (pendingMatches.length > 0) {
          const bestMatch = pendingMatches[0];
          console.log(`⚠️  ${result.expected}`);
          console.log(`  → ${bestMatch.name} (ID: ${bestMatch.id})`);
          console.log(`  Phone: ${bestMatch.phone || 'N/A'}`);
          console.log(`  Status: ${bestMatch.status} (Registered but not checked in)`);
          console.log('');
        } else {
          console.log(`⚠️  ${result.expected} - Status mismatch`);
          console.log('');
        }
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ NOT FOUND (No registration or attendance record)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (notFound.length > 0) {
      for (const result of notFound) {
        console.log(`❌ ${result.expected}`);
        if (result.phone) console.log(`  Phone: ${result.phone}`);
        console.log('');
      }
    } else {
      console.log('None\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total Unmatched Members: ${results.length}`);
    console.log(`✅ Actually Checked In: ${checkedIn.length}`);
    console.log(`🚪 Checked Out: ${checkedOut.length}`);
    console.log(`⏳ Registered but NOT Checked In: ${pending.length}`);
    console.log(`❌ Not Found: ${notFound.length}\n`);
    
    console.log(`📈 ACTUAL ATTENDANCE RATE:`);
    const totalAttended = checkedIn.length + checkedOut.length;
    const totalRegistered = checkedIn.length + checkedOut.length + pending.length;
    if (totalRegistered > 0) {
      const attendanceRate = (totalAttended / totalRegistered * 100).toFixed(1);
      console.log(`   ${totalAttended} out of ${totalRegistered} registered = ${attendanceRate}% attendance rate`);
    }
    
    // Export detailed results
    const exportData: any[] = [];
    for (const result of results) {
      if (result.matches.length > 0) {
        for (const match of result.matches) {
          // Determine attendance status based on actual match status, not overall result status
          let attendanceStatus = 'NOT FOUND';
          if (match.status === 'checked-in') {
            attendanceStatus = 'ATTENDED';
          } else if (match.status === 'checked-out') {
            attendanceStatus = 'ATTENDED (Left)';
          } else if (match.status === 'pending') {
            attendanceStatus = 'REGISTERED BUT NOT ATTENDED';
          }
          
          exportData.push({
            'Expected Member': result.expected,
            'Phone': result.phone || '',
            'Found Name': match.name,
            'Confidence': match.confidence,
            'Status': match.status,
            'Phone Found': match.phone || '',
            'Email': match.email || '',
            'ID': match.id || '',
            'Check-In Time': match.checkInTime ? new Date(match.checkInTime).toISOString() : '',
            'Source': match.source,
            'Attendance Status': attendanceStatus
          });
        }
      } else {
        exportData.push({
          'Expected Member': result.expected,
          'Phone': result.phone || '',
          'Found Name': 'NOT FOUND',
          'Confidence': '',
          'Status': '',
          'Phone Found': '',
          'Email': '',
          'ID': '',
          'Check-In Time': '',
          'Source': '',
          'Attendance Status': 'NOT FOUND'
        });
      }
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `kokori-actual-attendance-${Date.now()}.csv`);
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
    console.log(`\n💾 Exported detailed results to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

generateActualAttendanceReport();

