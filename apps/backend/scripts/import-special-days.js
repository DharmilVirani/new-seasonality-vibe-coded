/**
 * Import Special Days from CSV
 * Reads old-software/SpecialDays/SpecialDays.csv and imports into database
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importSpecialDays() {
  console.log('Starting special days import...');

  const csvPath = path.join(__dirname, '../../../old-software/SpecialDays/SpecialDays.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');

  // First line is headers (special day names)
  const headers = lines[0].split(',');
  
  // Rest are data rows (one row per year)
  const dataRows = lines.slice(1);

  const specialDaysToInsert = [];

  // Process each row (year)
  for (const row of dataRows) {
    const dates = row.split(',');
    
    // Each column corresponds to a special day
    for (let i = 0; i < headers.length; i++) {
      const dayName = headers[i].trim();
      const dateStr = dates[i]?.trim();
      
      if (!dateStr || dateStr === '') continue;
      
      // Parse date (format: DD-MM-YYYY)
      const [day, month, year] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Determine country and category
      let country = 'INDIA';
      let category = 'FESTIVAL';
      
      if (dayName.startsWith('USA :')) {
        country = 'USA';
        category = 'HOLIDAY';
      } else if (dayName.includes('BUDGET') || dayName.includes('Budget')) {
        category = 'BUDGET';
      } else if (dayName.includes('ELECTION') || dayName.includes('Election')) {
        category = 'ELECTION';
      } else if (dayName.includes('INDEPENDENCE') || dayName.includes('REPUBLIC')) {
        category = 'NATIONAL';
      }
      
      specialDaysToInsert.push({
        name: dayName,
        date,
        year,
        country,
        category
      });
    }
  }

  console.log(`Parsed ${specialDaysToInsert.length} special day records`);

  // Delete existing records
  await prisma.specialDay.deleteMany({});
  console.log('Cleared existing special days');

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < specialDaysToInsert.length; i += batchSize) {
    const batch = specialDaysToInsert.slice(i, i + batchSize);
    await prisma.specialDay.createMany({
      data: batch,
      skipDuplicates: true
    });
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(specialDaysToInsert.length / batchSize)}`);
  }

  console.log('✅ Special days import completed!');

  // Show summary
  const counts = await prisma.specialDay.groupBy({
    by: ['country', 'category'],
    _count: true
  });

  console.log('\nSummary by country and category:');
  counts.forEach(c => {
    console.log(`  ${c.country} - ${c.category}: ${c._count} records`);
  });

  await prisma.$disconnect();
}

importSpecialDays().catch(error => {
  console.error('Error importing special days:', error);
  process.exit(1);
});
