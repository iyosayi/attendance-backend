import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface Person {
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  id?: string;
  status?: string;
  checkInTime?: Date;
  source: string;
  notes?: string;
  registrationLocation?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function findOrogunGroupPhone() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/camp-attendance';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');
    
    const groupPhone = '08165172546';
    const normalizedGroupPhone = normalizePhone(groupPhone);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🔍 FINDING ALL PEOPLE WITH GROUP PHONE: ${groupPhone}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allPeople = new Map<string, Person>();
    
    // 1. Search Database by phone
    console.log('📂 Searching Database by phone...');
    const dbCampers = await Camper.find({
      phone: { $regex: normalizedGroupPhone.slice(-6), $options: 'i' },
      isDeleted: false
    }).lean();
    
    console.log(`   Found ${dbCampers.length} campers in database\n`);
    
    for (const camper of dbCampers) {
      const fullName = `${camper.firstName} ${camper.lastName}`.trim();
      const key = normalizeName(fullName);
      
      if (!allPeople.has(key)) {
        allPeople.set(key, {
          firstName: camper.firstName,
          lastName: camper.lastName,
          fullName,
          phone: camper.phone,
          email: camper.email,
          id: camper.code || camper._id.toString(),
          status: camper.status || 'pending',
          checkInTime: camper.checkInTime,
          source: 'Database',
          notes: camper.notes
        });
      } else {
        const existing = allPeople.get(key)!;
        // Update if we have more complete info
        if (camper.status === 'checked-in' && existing.status !== 'checked-in') {
          existing.status = 'checked-in';
          existing.checkInTime = camper.checkInTime;
        }
        existing.source = `${existing.source}, Database`;
      }
    }
    
    // 2. Search Registration CSV
    console.log('📂 Searching Registration CSV...');
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
          
          const normalizedPhone = normalizePhone(phone);
          if (normalizedPhone && normalizedPhone.includes(normalizedGroupPhone.slice(-6))) {
            regCount++;
            const fullName = `${firstName} ${lastName}`.trim();
            const key = normalizeName(fullName);
            
            if (!allPeople.has(key)) {
              allPeople.set(key, {
                firstName,
                lastName,
                fullName,
                phone,
                email,
                registrationLocation: location,
                status: 'pending',
                source: 'Registration CSV'
              });
            } else {
              const existing = allPeople.get(key)!;
              if (!existing.phone && phone) existing.phone = phone;
              if (!existing.email && email) existing.email = email;
              if (!existing.registrationLocation && location) existing.registrationLocation = location;
              existing.source = `${existing.source}, Registration CSV`;
            }
          }
        }
      }
      console.log(`   Found ${regCount} registrations\n`);
    }
    
    // 3. Search Campers CSV
    console.log('📂 Searching Campers CSV...');
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
        
        if (parts.length >= 3) {
          const id = parts[0] || '';
          const firstName = parts[1] || '';
          const lastName = parts[2] || '';
          const notes = parts[4] || '';
          
          // Check if notes mention the phone or Orogun
          if (notes && (notes.includes(groupPhone) || notes.toLowerCase().includes('orogun'))) {
            camperCount++;
            const fullName = `${firstName} ${lastName}`.trim();
            const key = normalizeName(fullName);
            
            if (!allPeople.has(key)) {
              allPeople.set(key, {
                firstName,
                lastName,
                fullName,
                id,
                status: 'pending',
                source: 'Campers CSV',
                notes
              });
            } else {
              const existing = allPeople.get(key)!;
              if (!existing.id && id) existing.id = id;
              existing.source = `${existing.source}, Campers CSV`;
            }
          }
        }
      }
      console.log(`   Found ${camperCount} entries\n`);
    }
    
    // 4. Search Check-in CSVs
    console.log('📂 Searching Check-in CSV files...');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const csvFiles = files.filter(f => f.endsWith('.csv') && f.toLowerCase().includes('check'));
      
      let checkInCount = 0;
      for (const file of csvFiles) {
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
          
          if (parts.length >= 4) {
            const firstName = parts[0]?.replace(/^"|"$/g, '') || '';
            const lastName = parts[1]?.replace(/^"|"$/g, '') || '';
            const phone = parts[3]?.replace(/^"|"$/g, '') || '';
            const checkInTime = parts[8]?.replace(/^"|"$/g, '') || '';
            
            const normalizedPhone = normalizePhone(phone);
            if (normalizedPhone && normalizedPhone.includes(normalizedGroupPhone.slice(-6))) {
              checkInCount++;
              const fullName = `${firstName} ${lastName}`.trim();
              const key = normalizeName(fullName);
              
              if (!allPeople.has(key)) {
                allPeople.set(key, {
                  firstName,
                  lastName,
                  fullName,
                  phone,
                  status: 'checked-in',
                  checkInTime: checkInTime ? new Date(checkInTime) : undefined,
                  source: `Check-In CSV (${file})`
                });
              } else {
                const existing = allPeople.get(key)!;
                if (!existing.phone && phone) existing.phone = phone;
                if (existing.status !== 'checked-in') {
                  existing.status = 'checked-in';
                  existing.checkInTime = checkInTime ? new Date(checkInTime) : undefined;
                }
                existing.source = `${existing.source}, Check-In CSV`;
              }
            }
          }
        }
      }
      console.log(`   Found ${checkInCount} check-ins\n`);
    }
    
    // Now search by names - get all names from registration CSV that used this phone
    console.log('📂 Finding names associated with this phone in Registration CSV...');
    const nameMatches = new Set<string>();
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
          const firstName = parts[1] || '';
          const lastName = parts[2] || '';
          const phone = parts[4] || '';
          const location = parts[9] || '';
          
          const normalizedPhone = normalizePhone(phone);
          if (normalizedPhone && normalizedPhone.includes(normalizedGroupPhone.slice(-6))) {
            const fullName = `${firstName} ${lastName}`.trim();
            nameMatches.add(normalizeName(fullName));
            
            // Also search database for this name
            const nameRegex = new RegExp(firstName, 'i');
            const lastNameRegex = new RegExp(lastName, 'i');
            const dbMatches = await Camper.find({
              $or: [
                { firstName: nameRegex, lastName: lastNameRegex },
                { firstName: lastNameRegex, lastName: nameRegex }
              ],
              isDeleted: false
            }).lean();
            
            for (const camper of dbMatches) {
              const camperFullName = `${camper.firstName} ${camper.lastName}`.trim();
              const key = normalizeName(camperFullName);
              
              if (!allPeople.has(key)) {
                allPeople.set(key, {
                  firstName: camper.firstName,
                  lastName: camper.lastName,
                  fullName: camperFullName,
                  phone: camper.phone,
                  email: camper.email,
                  id: camper.code || camper._id.toString(),
                  status: camper.status || 'pending',
                  checkInTime: camper.checkInTime,
                  source: 'Database (name match from registration)',
                  notes: camper.notes,
                  registrationLocation: location
                });
              }
            }
          }
        }
      }
    }
    
    console.log(`✅ Total unique people found: ${allPeople.size}\n`);
    
    // Categorize by status
    const checkedIn = Array.from(allPeople.values()).filter(p => p.status === 'checked-in');
    const checkedOut = Array.from(allPeople.values()).filter(p => p.status === 'checked-out');
    const pending = Array.from(allPeople.values()).filter(p => p.status === 'pending' || !p.status);
    
    // Print Report
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CHECKED IN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (checkedIn.length > 0) {
      for (let i = 0; i < checkedIn.length; i++) {
        const person = checkedIn[i];
        console.log(`${i + 1}. ${person.fullName}`);
        console.log(`   ID: ${person.id || 'N/A'} | Phone: ${person.phone || 'N/A'}`);
        if (person.email) console.log(`   Email: ${person.email}`);
        if (person.checkInTime) console.log(`   Check-in Time: ${person.checkInTime}`);
        if (person.registrationLocation) console.log(`   Registration Location: ${person.registrationLocation}`);
        console.log(`   Source: ${person.source}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⏳ REGISTERED BUT NOT CHECKED IN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (pending.length > 0) {
      for (let i = 0; i < pending.length; i++) {
        const person = pending[i];
        console.log(`${i + 1}. ${person.fullName}`);
        console.log(`   ID: ${person.id || 'N/A'} | Phone: ${person.phone || 'N/A'}`);
        if (person.email) console.log(`   Email: ${person.email}`);
        if (person.registrationLocation) console.log(`   Registration Location: ${person.registrationLocation}`);
        console.log(`   Source: ${person.source}`);
        console.log('');
      }
    } else {
      console.log('None found\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Group Phone: ${groupPhone}`);
    console.log(`Total Unique People Found: ${allPeople.size}`);
    console.log(`✅ Checked In: ${checkedIn.length}`);
    console.log(`🚪 Checked Out: ${checkedOut.length}`);
    console.log(`⏳ Pending: ${pending.length}\n`);
    
    // Export to CSV
    const exportData: any[] = [];
    for (const person of Array.from(allPeople.values())) {
      exportData.push({
        'First Name': person.firstName,
        'Last Name': person.lastName,
        'Full Name': person.fullName,
        'Phone': person.phone || '',
        'Email': person.email || '',
        'ID': person.id || '',
        'Status': person.status || 'pending',
        'Check-In Time': person.checkInTime ? new Date(person.checkInTime).toISOString() : '',
        'Registration Location': person.registrationLocation || '',
        'Source': person.source,
        'Notes': person.notes || '',
        'Attendance Category': person.status === 'checked-in' ? 'ATTENDED' :
                              person.status === 'checked-out' ? 'ATTENDED (Left)' :
                              'REGISTERED BUT NOT ATTENDED'
      });
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `orogun-group-phone-${groupPhone}-${Date.now()}.csv`);
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
    console.log(`💾 Exported results to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

findOrogunGroupPhone();




