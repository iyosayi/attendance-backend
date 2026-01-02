import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

async function estimateDeltaAttendance() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 DELTA ATTENDANCE ESTIMATE');
    console.log('   (Warri + Kokori + Orogun + Delta)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Count all Delta-related registrations
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    let totalRegistrations = 0;
    const deltaRegistrations: any[] = [];
    
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
          const regLocation = (parts[9] || '').toLowerCase();
          
          if (regLocation.includes('delta') || regLocation.includes('kokori') || regLocation.includes('orogun') || regLocation.includes('warri')) {
            totalRegistrations++;
            deltaRegistrations.push({
              name: `${parts[1] || ''} ${parts[2] || ''}`.trim(),
              location: parts[9] || '',
              phone: parts[4] || '',
              email: parts[3] || ''
            });
          }
        }
      }
    }
    
    // Get actual attendance from database
    const deltaRegex = new RegExp('delta', 'i');
    const allDeltaDB = await Camper.find({
      $or: [
        { notes: deltaRegex },
        { email: deltaRegex }
      ],
      isDeleted: false
    }).lean();
    
    const checkedIn = allDeltaDB.filter((c: any) => c.status === 'checked-in').length;
    const checkedOut = allDeltaDB.filter((c: any) => c.status === 'checked-out').length;
    const pending = allDeltaDB.filter((c: any) => c.status === 'pending').length;
    const totalAttended = checkedIn + checkedOut;
    
    // Calculate attendance rate
    const attendanceRate = totalRegistrations > 0 ? ((totalAttended / totalRegistrations) * 100) : 0;
    
    console.log('📋 REGISTRATION DATA:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Total Delta-Related Registrations: ${totalRegistrations}`);
    console.log(`   (Warri + Kokori + Orogun + Delta)\n`);
    
    console.log('📊 ACTUAL ATTENDANCE (from Database):');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`✅ Checked In:                ${checkedIn}`);
    console.log(`🚪 Checked Out:               ${checkedOut}`);
    console.log(`⏳ Pending (Not Checked In):  ${pending}`);
    console.log(`💡 Total Attended:            ${totalAttended}\n`);
    
    console.log('📈 ESTIMATES:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`📋 Total Registered:          ${totalRegistrations}`);
    console.log(`✅ Actually Attended:         ${totalAttended}`);
    console.log(`📊 Attendance Rate:          ${attendanceRate.toFixed(1)}%\n`);
    
    // Breakdown by location
    const kokoriReg = deltaRegistrations.filter(r => r.location.toLowerCase().includes('kokori')).length;
    const orogunReg = deltaRegistrations.filter(r => r.location.toLowerCase().includes('orogun')).length;
    const warriReg = deltaRegistrations.filter(r => r.location.toLowerCase().includes('warri')).length;
    const otherDeltaReg = totalRegistrations - kokoriReg - orogunReg - warriReg;
    
    console.log('📍 BREAKDOWN BY LOCATION (Registrations):');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Kokori:                       ${kokoriReg}`);
    console.log(`Orogun:                       ${orogunReg}`);
    console.log(`Warri:                        ${warriReg}`);
    console.log(`Other Delta:                  ${otherDeltaReg}`);
    console.log(`Total:                        ${totalRegistrations}\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💡 FINAL ESTIMATE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Based on ${totalRegistrations} total registrations:`);
    console.log(`✅ Estimated Total Attended: ${totalAttended} people`);
    console.log(`📊 Attendance Rate: ${attendanceRate.toFixed(1)}%\n`);
    console.log(`Note: This is based on actual check-in data from the database.\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

estimateDeltaAttendance();







