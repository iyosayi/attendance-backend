import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import Camper from '../src/models/Camper';

dotenv.config();

interface MatchResult {
  expected: string;
  found: boolean;
  matches: Array<{
    name: string;
    source: string;
    confidence: number;
    reason: string;
    phone?: string;
    email?: string;
    status?: string;
    id?: string;
  }>;
}

// Normalize name
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Search database by phone
async function searchByPhone(phone: string): Promise<any[]> {
  if (!phone) return [];
  const normalized = normalizePhone(phone);
  if (normalized.length < 6) return [];
  
  const campers = await Camper.find({
    $or: [
      { phone: { $regex: normalized.slice(-6), $options: 'i' } }
    ],
    isDeleted: false
  }).lean();
  
  return campers;
}

// Search database by name parts
async function searchByNameParts(nameParts: string[]): Promise<any[]> {
  const campers: any[] = [];
  const seen = new Set<string>();
  
  for (const part of nameParts) {
    if (part.length < 3) continue;
    const regex = new RegExp(part, 'i');
    const results = await Camper.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { notes: regex }
      ],
      isDeleted: false
    }).lean();
    
    for (const camper of results) {
      const key = `${camper.firstName}_${camper.lastName}`;
      if (!seen.has(key)) {
        seen.add(key);
        campers.push(camper);
      }
    }
  }
  
  return campers;
}

async function generateFinalReport() {
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
    console.log('📊 FINAL KOKORI ATTENDANCE REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const results: MatchResult[] = [];
    
    for (const member of unmatchedMembers) {
      console.log(`\n🔍 Searching for: "${member.name}"`);
      if (member.phone) console.log(`   Phone: ${member.phone}`);
      
      const matches: MatchResult['matches'] = [];
      
      // Search by phone
      if (member.phone) {
        const phoneResults = await searchByPhone(member.phone);
        for (const camper of phoneResults) {
          const fullName = `${camper.firstName} ${camper.lastName}`.trim();
          matches.push({
            name: fullName,
            source: 'Database (phone search)',
            confidence: 0.9,
            reason: 'Phone number match',
            phone: camper.phone,
            email: camper.email,
            status: camper.status,
            id: camper.code || camper._id.toString()
          });
        }
      }
      
      // Search by name parts
      const nameResults = await searchByNameParts(member.parts);
      for (const camper of nameResults) {
        const fullName = `${camper.firstName} ${camper.lastName}`.trim();
        const normalizedCamper = normalizeName(fullName);
        const normalizedMember = normalizeName(member.name);
        
        // Check if it's a good match
        let confidence = 0.5;
        let reason = 'Name part match';
        
        if (normalizedCamper.includes(normalizedMember) || normalizedMember.includes(normalizedCamper)) {
          confidence = 0.8;
          reason = 'Name contains match';
        } else if (member.parts.some(p => normalizedCamper.includes(normalizeName(p)))) {
          confidence = 0.6;
          reason = 'Partial name match';
        }
        
        // Avoid duplicates
        if (!matches.some(m => m.name === fullName && m.source === 'Database (name search)')) {
          matches.push({
            name: fullName,
            source: 'Database (name search)',
            confidence,
            reason,
            phone: camper.phone,
            email: camper.email,
            status: camper.status,
            id: camper.code || camper._id.toString()
          });
        }
      }
      
      // Remove duplicates and sort by confidence
      const uniqueMatches = matches.filter((match, index, self) =>
        index === self.findIndex(m => m.name === match.name && m.source === match.source)
      );
      uniqueMatches.sort((a, b) => b.confidence - a.confidence);
      
      results.push({
        expected: member.name,
        found: uniqueMatches.length > 0,
        matches: uniqueMatches.slice(0, 5) // Top 5 matches
      });
      
      if (uniqueMatches.length > 0) {
        console.log(`   ✅ Found ${uniqueMatches.length} potential match(es):`);
        for (const match of uniqueMatches.slice(0, 3)) {
          console.log(`      • ${match.name} (${match.source})`);
          console.log(`        ${match.reason} | Confidence: ${(match.confidence * 100).toFixed(0)}%`);
          if (match.phone) console.log(`        Phone: ${match.phone}`);
          if (match.status) console.log(`        Status: ${match.status}`);
          if (match.id) console.log(`        ID: ${match.id}`);
        }
      } else {
        console.log(`   ❌ No matches found`);
      }
    }
    
    // Summary
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const found = results.filter(r => r.found).length;
    const notFound = results.filter(r => !r.found).length;
    
    console.log(`Total Unmatched Members Searched: ${results.length}`);
    console.log(`✅ Found: ${found}`);
    console.log(`❌ Not Found: ${notFound}\n`);
    
    console.log('✅ MEMBERS WITH MATCHES:');
    for (const result of results.filter(r => r.found)) {
      console.log(`   • ${result.expected}`);
      for (const match of result.matches.slice(0, 1)) {
        console.log(`     → ${match.name} (${match.confidence >= 0.8 ? 'HIGH' : 'MEDIUM'} confidence)`);
      }
    }
    
    console.log('\n❌ MEMBERS WITHOUT MATCHES:');
    for (const result of results.filter(r => !r.found)) {
      console.log(`   • ${result.expected}`);
    }
    
    // Export results
    const exportData: any[] = [];
    for (const result of results) {
      if (result.matches.length > 0) {
        for (const match of result.matches) {
          exportData.push({
            'Expected Member': result.expected,
            'Found Name': match.name,
            'Source': match.source,
            'Confidence': `${(match.confidence * 100).toFixed(0)}%`,
            'Reason': match.reason,
            'Phone': match.phone || '',
            'Email': match.email || '',
            'Status': match.status || '',
            'ID': match.id || ''
          });
        }
      } else {
        exportData.push({
          'Expected Member': result.expected,
          'Found Name': 'NOT FOUND',
          'Source': '',
          'Confidence': '',
          'Reason': '',
          'Phone': '',
          'Email': '',
          'Status': '',
          'ID': ''
        });
      }
    }
    
    const csvPath = path.join(__dirname, '..', 'uploads', `kokori-unmatched-search-${Date.now()}.csv`);
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
    console.log(`\n💾 Exported results to: ${csvPath}\n`);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

generateFinalReport();




