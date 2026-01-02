import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

async function deepSearchOrogun() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DEEP SEARCH FOR OROGUN ATTENDEES');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Get Orogun emails from registration
    const registrationPath = path.join(__dirname, '..', 'registration.csv');
    const orogunEmails = new Set<string>();
    const orogunPhones = new Set<string>();
    const orogunNames = new Set<string>();
    
    if (fs.existsSync(registrationPath)) {
      const csvContent = fs.readFileSync(registrationPath, 'utf-8');
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
        
        if (parts.length >= 10) {
          const location = parts[9] || '';
          if (location.toLowerCase().includes('orogun')) {
            const firstName = parts[1] || '';
            const lastName = parts[2] || '';
            const email = parts[3] || '';
            const phone = parts[4] || '';
            
            if (email) orogunEmails.add(email.toLowerCase());
            if (phone) orogunPhones.add(phone.replace(/\D/g, ''));
            if (firstName) orogunNames.add(firstName.toLowerCase());
            if (lastName) orogunNames.add(lastName.toLowerCase());
          }
        }
      }
    }
    
    console.log(`Found ${orogunEmails.size} unique emails, ${orogunPhones.size} unique phones, ${orogunNames.size} unique name parts\n`);
    
    // Search database by emails
    console.log('📧 Searching by emails...');
    const emailResults: any[] = [];
    for (const email of orogunEmails) {
      const campers = await Camper.find({
        email: email,
        isDeleted: false
      }).lean();
      emailResults.push(...campers);
    }
    console.log(`   Found ${emailResults.length} campers by email\n`);
    
    // Search database by phones
    console.log('📱 Searching by phones...');
    const phoneResults: any[] = [];
    for (const phone of orogunPhones) {
      if (phone.length < 6) continue;
      const campers = await Camper.find({
        phone: { $regex: phone.slice(-6), $options: 'i' },
        isDeleted: false
      }).lean();
      phoneResults.push(...campers);
    }
    console.log(`   Found ${phoneResults.length} campers by phone\n`);
    
    // Search database by names
    console.log('👤 Searching by names...');
    const nameResults: any[] = [];
    for (const namePart of Array.from(orogunNames).slice(0, 10)) { // Limit to avoid too many queries
      if (namePart.length < 3) continue;
      const regex = new RegExp(namePart, 'i');
      const campers = await Camper.find({
        $or: [
          { firstName: regex },
          { lastName: regex }
        ],
        isDeleted: false
      }).lean();
      nameResults.push(...campers);
    }
    console.log(`   Found ${nameResults.length} campers by name\n`);
    
    // Combine and deduplicate
    const allResults = new Map<string, any>();
    for (const camper of [...emailResults, ...phoneResults, ...nameResults]) {
      const key = camper._id.toString();
      if (!allResults.has(key)) {
        allResults.set(key, camper);
      }
    }
    
    console.log(`✅ Total unique campers found: ${allResults.size}\n`);
    
    // Categorize by status
    const checkedIn = Array.from(allResults.values()).filter((c: any) => c.status === 'checked-in');
    const checkedOut = Array.from(allResults.values()).filter((c: any) => c.status === 'checked-out');
    const pending = Array.from(allResults.values()).filter((c: any) => c.status === 'pending');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CHECKED IN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedIn.length > 0) {
      for (const camper of checkedIn) {
        console.log(`• ${camper.firstName} ${camper.lastName}`);
        console.log(`  ID: ${camper.code || camper._id} | Phone: ${camper.phone} | Email: ${camper.email}`);
        console.log(`  Check-in Time: ${camper.checkInTime || 'N/A'}`);
        if (camper.notes) console.log(`  Notes: ${camper.notes.substring(0, 100)}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⏳ PENDING (Registered but not checked in)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (pending.length > 0) {
      console.log(`Found ${pending.length} pending campers\n`);
      for (let i = 0; i < Math.min(pending.length, 10); i++) {
        const camper = pending[i];
        console.log(`${i + 1}. ${camper.firstName} ${camper.lastName}`);
        console.log(`   ID: ${camper.code || camper._id} | Phone: ${camper.phone} | Email: ${camper.email}`);
        console.log('');
      }
      if (pending.length > 10) {
        console.log(`... and ${pending.length - 10} more\n`);
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total Found: ${allResults.size}`);
    console.log(`✅ Checked In: ${checkedIn.length}`);
    console.log(`🚪 Checked Out: ${checkedOut.length}`);
    console.log(`⏳ Pending: ${pending.length}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

deepSearchOrogun();




