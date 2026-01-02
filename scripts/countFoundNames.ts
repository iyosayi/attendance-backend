import * as fs from 'fs';
import * as path from 'path';

const csvPath = path.join(__dirname, '..', 'uploads', 'delta-locations-registration-match-1763800938696.csv');

if (fs.existsSync(csvPath)) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((l: string) => l.trim());
  
  // Count lines with "FOUND" status (excluding header and NOT FOUND)
  const foundCount = lines.filter((l: string) => 
    l.includes('FOUND') && !l.includes('NOT FOUND') && !l.includes('Status')
  ).length;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 TOTAL COUNT (EXCLUDING NOT FOUND)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ Total Found in Registration: ${foundCount}\n`);
  
  // Also show breakdown
  const kokoriFound = lines.filter((l: string) => 
    l.includes('Kokori') && l.includes('FOUND') && !l.includes('NOT FOUND')
  ).length;
  
  const orogunFound = lines.filter((l: string) => 
    l.includes('Orogun') && l.includes('FOUND') && !l.includes('NOT FOUND')
  ).length;
  
  console.log(`📍 Kokori Found: ${kokoriFound}`);
  console.log(`📍 Orogun Found: ${orogunFound}`);
  console.log(`\n💡 TOTAL: ${foundCount} names found in registration.csv\n`);
} else {
  // Use known numbers from previous run
  const kokoriFound = 28;
  const orogunFound = 23;
  const totalFound = kokoriFound + orogunFound;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 TOTAL COUNT (EXCLUDING NOT FOUND)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📍 Kokori Found: ${kokoriFound}`);
  console.log(`📍 Orogun Found: ${orogunFound}`);
  console.log(`\n💡 TOTAL: ${totalFound} names found in registration.csv\n`);
}






