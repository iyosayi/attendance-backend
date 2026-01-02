import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface FinalAttendee {
  expectedName: string;
  foundName: string;
  phone?: string;
  email?: string;
  status: 'checked-in' | 'checked-out' | 'pending' | 'not-found';
  id?: string;
  checkInTime?: Date;
  source: string;
  confidence: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function generateFinalSummary() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    // Expected Kokori Team members (39 unique after removing duplicates)
    const expectedMembers = [
      { name: 'Pastor kester Kolenda', phone: '09075781235' },
      { name: 'Okpeki Betty', phone: '08168961052' },
      { name: 'Hither Rukevwe', phone: '07089289633' },
      { name: 'Daniel Solomon', phone: '09051127097' },
      { name: 'Omokiniovo Onoriode', phone: '07013853102' },
      { name: 'Billyyoko Onoriode', phone: '09041656858' },
      { name: 'Onoriode Eseoghene Gift', phone: '09011893078' },
      { name: 'Abadi loveth', phone: '08025749689' },
      { name: 'Gift Mina', phone: '09027666077' },
      { name: 'Successful Augustine', phone: '08153151881' },
      { name: 'Junior fear God', phone: '08058333540' },
      { name: 'Joy Anthony', phone: '08103094483' },
      { name: 'Peace kokori', phone: '08061252991' },
      { name: 'Rukevwe Ezekiel', phone: '09041179479' },
      { name: 'Ojijevwe Theophilus', phone: '07057541785' },
      { name: 'Ogban Kevwe Samuel', phone: '08109940045' },
      { name: 'Friday serome', phone: '09124968623' },
      { name: 'Monday Emmanuel', phone: '07043454092' },
      { name: 'Joyce OMONIGHO', phone: '08032481626' },
      { name: 'Prevail Obavwonvwe', phone: '08154452725' },
      { name: 'Ikono God\'s love', phone: '09075781235' },
      { name: 'Destiny ibobo' },
      { name: 'Deborah owebor' },
      { name: 'Ogban Favour' },
      { name: 'Chidi Isaac' },
      { name: 'Jennifer Brown' },
      { name: 'Chukwudi Favour' },
      { name: 'Sumonu Elo' },
      { name: 'Endurance Omuvi' },
      { name: 'Good luck Israel' },
      { name: 'Uloh promise', phone: '08154453141' },
      { name: 'Abadi Eloho', phone: '08154457564' },
      { name: 'Ighoruona Divine' },
      { name: 'Juliet James' },
      { name: 'Freeborn Felix' },
      { name: 'Andrew Brme' },
      { name: 'John obukevwo' },
      { name: 'Egware festus' },
      { name: 'Akpede Felix' }
    ];
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 FINAL KOKORI ATTENDANCE SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allAttendees: FinalAttendee[] = [];
    
    // Search for each expected member
    for (const member of expectedMembers) {
      let found = false;
      let bestMatch: FinalAttendee | null = null;
      
      // Search by phone first (highest confidence)
      if (member.phone) {
        const normalizedPhone = normalizePhone(member.phone);
        const phoneResults = await Camper.find({
          $or: [
            { phone: { $regex: normalizedPhone.slice(-6), $options: 'i' } }
          ],
          isDeleted: false
        }).lean();
        
        for (const camper of phoneResults) {
          const fullName = `${camper.firstName} ${camper.lastName}`.trim();
          const normalizedCamper = normalizeName(fullName);
          const normalizedMember = normalizeName(member.name);
          
          // Check name similarity
          if (normalizedCamper.includes(normalizedMember) || normalizedMember.includes(normalizedCamper) ||
              member.name.split(/\s+/).some(part => normalizedCamper.includes(normalizeName(part)))) {
            found = true;
            bestMatch = {
              expectedName: member.name,
              foundName: fullName,
              phone: camper.phone,
              email: camper.email,
              status: (camper.status as any) || 'pending',
              id: camper.code || camper._id.toString(),
              checkInTime: camper.checkInTime,
              source: 'Database',
              confidence: 'HIGH'
            };
            break;
          }
        }
      }
      
      // If not found by phone, search by name
      if (!found) {
        const nameParts = member.name.split(/\s+/).filter(p => p.length >= 3);
        for (const part of nameParts) {
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
            const normalizedMember = normalizeName(member.name);
            
            // Check if it's a good match
            if (normalizedCamper.includes(normalizedMember) || normalizedMember.includes(normalizedCamper) ||
                member.name.split(/\s+/).some(p => normalizedCamper.includes(normalizeName(p)))) {
              found = true;
              bestMatch = {
                expectedName: member.name,
                foundName: fullName,
                phone: camper.phone,
                email: camper.email,
                status: (camper.status as any) || 'pending',
                id: camper.code || camper._id.toString(),
                checkInTime: camper.checkInTime,
                source: 'Database',
                confidence: 'MEDIUM'
              };
              break;
            }
          }
          if (found) break;
        }
      }
      
      if (found && bestMatch) {
        allAttendees.push(bestMatch);
      } else {
        allAttendees.push({
          expectedName: member.name,
          foundName: 'NOT FOUND',
          phone: member.phone,
          status: 'not-found',
          source: 'N/A',
          confidence: 'N/A'
        });
      }
    }
    
    // Categorize results
    const checkedIn = allAttendees.filter(a => a.status === 'checked-in');
    const checkedOut = allAttendees.filter(a => a.status === 'checked-out');
    const pending = allAttendees.filter(a => a.status === 'pending');
    const notFound = allAttendees.filter(a => a.status === 'not-found');
    
    // Print report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ACTUALLY CHECKED IN (Attended Camp)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedIn.length > 0) {
      for (let i = 0; i < checkedIn.length; i++) {
        const attendee = checkedIn[i];
        console.log(`${i + 1}. ${attendee.expectedName}`);
        console.log(`   → Found as: ${attendee.foundName}`);
        console.log(`   ID: ${attendee.id || 'N/A'} | Phone: ${attendee.phone || 'N/A'}`);
        if (attendee.checkInTime) {
          console.log(`   Check-in Time: ${attendee.checkInTime}`);
        }
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
        console.log(`${i + 1}. ${attendee.expectedName}`);
        console.log(`   → Found as: ${attendee.foundName}`);
        console.log(`   ID: ${attendee.id || 'N/A'} | Phone: ${attendee.phone || 'N/A'}`);
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
        console.log(`${i + 1}. ${attendee.expectedName}`);
        console.log(`   → Found as: ${attendee.foundName}`);
        console.log(`   ID: ${attendee.id || 'N/A'} | Phone: ${attendee.phone || 'N/A'}`);
        console.log(`   Status: Registered but not checked in`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ NOT FOUND (No Registration Record)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (notFound.length > 0) {
      for (let i = 0; i < notFound.length; i++) {
        const attendee = notFound[i];
        console.log(`${i + 1}. ${attendee.expectedName}`);
        if (attendee.phone) console.log(`   Phone: ${attendee.phone}`);
        console.log('');
      }
    } else {
      console.log('None\n');
    }
    
    // Summary Statistics
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY STATISTICS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const totalExpected = expectedMembers.length;
    const totalAttended = checkedIn.length + checkedOut.length;
    const totalRegistered = checkedIn.length + checkedOut.length + pending.length;
    
    console.log(`Total Expected Kokori Team Members:     ${totalExpected}`);
    console.log(`✅ Actually Checked In:                 ${checkedIn.length}`);
    console.log(`🚪 Checked Out:                        ${checkedOut.length}`);
    console.log(`⏳ Registered but NOT Checked In:      ${pending.length}`);
    console.log(`❌ Not Found:                          ${notFound.length}\n`);
    
    console.log(`📈 ATTENDANCE METRICS:`);
    console.log(`   Total Attended: ${totalAttended} out of ${totalExpected} expected`);
    console.log(`   Attendance Rate: ${((totalAttended / totalExpected) * 100).toFixed(1)}%`);
    console.log(`   Registration Rate: ${((totalRegistered / totalExpected) * 100).toFixed(1)}%`);
    if (totalRegistered > 0) {
      console.log(`   Check-in Rate: ${((totalAttended / totalRegistered) * 100).toFixed(1)}% (of those registered)`);
    }
    
    // Export to CSV
    const exportData: any[] = [];
    for (const attendee of allAttendees) {
      exportData.push({
        'Expected Member': attendee.expectedName,
        'Found Name': attendee.foundName,
        'Phone': attendee.phone || '',
        'Email': attendee.email || '',
        'ID': attendee.id || '',
        'Status': attendee.status,
        'Check-In Time': attendee.checkInTime ? new Date(attendee.checkInTime).toISOString() : '',
        'Confidence': attendee.confidence,
        'Source': attendee.source,
        'Attendance Category': attendee.status === 'checked-in' ? 'ATTENDED' :
                              attendee.status === 'checked-out' ? 'ATTENDED (Left)' :
                              attendee.status === 'pending' ? 'REGISTERED BUT NOT ATTENDED' :
                              'NOT FOUND'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `kokori-final-summary-${Date.now()}.csv`);
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
    console.log(`\n💾 Exported final summary to: ${csvPath}\n`);
    
    // Create a markdown summary document
    const markdownPath = path.join(__dirname, '..', 'uploads', `kokori-final-summary-${Date.now()}.md`);
    let markdown = `# Kokori Team Attendance Final Summary\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `## Summary Statistics\n\n`;
    markdown += `- **Total Expected Members:** ${totalExpected}\n`;
    markdown += `- **Actually Checked In:** ${checkedIn.length}\n`;
    markdown += `- **Checked Out:** ${checkedOut.length}\n`;
    markdown += `- **Registered but NOT Checked In:** ${pending.length}\n`;
    markdown += `- **Not Found:** ${notFound.length}\n\n`;
    markdown += `### Attendance Metrics\n\n`;
    markdown += `- **Attendance Rate:** ${((totalAttended / totalExpected) * 100).toFixed(1)}%\n`;
    markdown += `- **Registration Rate:** ${((totalRegistered / totalExpected) * 100).toFixed(1)}%\n`;
    if (totalRegistered > 0) {
      markdown += `- **Check-in Rate:** ${((totalAttended / totalRegistered) * 100).toFixed(1)}% (of those registered)\n`;
    }
    markdown += `\n## Actually Checked In (${checkedIn.length})\n\n`;
    for (let i = 0; i < checkedIn.length; i++) {
      const a = checkedIn[i];
      markdown += `${i + 1}. **${a.expectedName}**\n`;
      markdown += `   - Found as: ${a.foundName}\n`;
      markdown += `   - ID: ${a.id || 'N/A'} | Phone: ${a.phone || 'N/A'}\n`;
      if (a.checkInTime) {
        markdown += `   - Check-in Time: ${a.checkInTime}\n`;
      }
      markdown += `\n`;
    }
    markdown += `\n## Registered but NOT Checked In (${pending.length})\n\n`;
    for (let i = 0; i < pending.length; i++) {
      const a = pending[i];
      markdown += `${i + 1}. **${a.expectedName}**\n`;
      markdown += `   - Found as: ${a.foundName}\n`;
      markdown += `   - ID: ${a.id || 'N/A'} | Phone: ${a.phone || 'N/A'}\n`;
      markdown += `\n`;
    }
    markdown += `\n## Not Found (${notFound.length})\n\n`;
    for (let i = 0; i < notFound.length; i++) {
      const a = notFound[i];
      markdown += `${i + 1}. **${a.expectedName}**`;
      if (a.phone) markdown += ` (Phone: ${a.phone})`;
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

generateFinalSummary();




