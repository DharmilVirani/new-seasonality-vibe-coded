#!/usr/bin/env tsx
/**
 * Special Days Data Migration Script
 * Migrates data from old-software/SpecialDays/SpecialDays.csv to the database
 * 
 * Usage: npm run migrate:special-days
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface SpecialDayRecord {
  name: string;
  date: Date;
  year: number;
  country: string;
  category: string;
}

// Category mapping based on special day names
const getCategoryAndCountry = (name: string): { category: string; country: string } => {
  const upperName = name.toUpperCase();
  
  // USA holidays
  if (upperName.includes('USA :')) {
    return { category: 'HOLIDAY', country: 'USA' };
  }
  
  // Budget days
  if (upperName.includes('BUDGET')) {
    return { category: 'BUDGET', country: 'INDIA' };
  }
  
  // Election days
  if (upperName.includes('ELECTION')) {
    return { category: 'ELECTION', country: 'INDIA' };
  }
  
  // National holidays
  if (upperName.includes('INDEPENDENCE') || upperName.includes('REPUBLIC')) {
    return { category: 'NATIONAL_HOLIDAY', country: 'INDIA' };
  }
  
  // Festivals (default for Indian festivals)
  return { category: 'FESTIVAL', country: 'INDIA' };
};

async function migrateSpecialDays() {
  console.log('🚀 Starting Special Days Migration...\n');
  
  const csvPath = path.join(process.cwd(), 'old-software', 'SpecialDays', 'SpecialDays.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  console.log(`📂 Reading CSV file: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  console.log(`📊 Found ${records.length} rows in CSV\n`);
  
  // First row contains the special day names (headers)
  const specialDayNames = Object.keys(records[0]);
  console.log(`📋 Special Day Categories: ${specialDayNames.length}`);
  specialDayNames.forEach((name, idx) => {
    console.log(`   ${idx + 1}. ${name}`);
  });
  console.log('');
  
  const specialDaysToInsert: SpecialDayRecord[] = [];
  let skippedCount = 0;
  
  // Process each row (year)
  for (const row of records) {
    // Each column is a special day type
    for (const specialDayName of specialDayNames) {
      const dateStr = row[specialDayName];
      
      // Skip empty dates
      if (!dateStr || dateStr.trim() === '') {
        skippedCount++;
        continue;
      }
      
      try {
        // Parse date in DD-MM-YYYY format
        const [day, month, year] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        
        // Validate date
        if (isNaN(date.getTime())) {
          console.warn(`⚠️  Invalid date: ${dateStr} for ${specialDayName}`);
          skippedCount++;
          continue;
        }
        
        const { category, country } = getCategoryAndCountry(specialDayName);
        
        specialDaysToInsert.push({
          name: specialDayName.toUpperCase().trim(),
          date,
          year,
          country,
          category,
        });
      } catch (error) {
        console.warn(`⚠️  Error parsing date: ${dateStr} for ${specialDayName}`);
        skippedCount++;
      }
    }
  }
  
  console.log(`\n📈 Statistics:`);
  console.log(`   Total special day entries: ${specialDaysToInsert.length}`);
  console.log(`   Skipped empty/invalid entries: ${skippedCount}`);
  console.log('');
  
  // Clear existing special days
  console.log('🗑️  Clearing existing special days...');
  const deleteResult = await prisma.specialDay.deleteMany({});
  console.log(`   Deleted ${deleteResult.count} existing records\n`);
  
  // Insert in batches
  const batchSize = 100;
  let insertedCount = 0;
  
  console.log('💾 Inserting special days into database...');
  
  for (let i = 0; i < specialDaysToInsert.length; i += batchSize) {
    const batch = specialDaysToInsert.slice(i, i + batchSize);
    
    try {
      await prisma.specialDay.createMany({
        data: batch,
        skipDuplicates: true,
      });
      
      insertedCount += batch.length;
      const progress = ((insertedCount / specialDaysToInsert.length) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${insertedCount}/${specialDaysToInsert.length} (${progress}%)`);
    } catch (error) {
      console.error(`\n❌ Error inserting batch starting at index ${i}:`, error);
    }
  }
  
  console.log('\n');
  
  // Verify insertion
  const totalInserted = await prisma.specialDay.count();
  console.log(`✅ Migration completed!`);
  console.log(`   Total records in database: ${totalInserted}\n`);
  
  // Show summary by category
  console.log('📊 Summary by Category:');
  const categories = await prisma.specialDay.groupBy({
    by: ['category', 'country'],
    _count: true,
  });
  
  categories.forEach(({ category, country, _count }) => {
    console.log(`   ${country} - ${category}: ${_count} days`);
  });
  
  console.log('');
  
  // Show sample records
  console.log('📝 Sample Records:');
  const samples = await prisma.specialDay.findMany({
    take: 5,
    orderBy: { date: 'desc' },
  });
  
  samples.forEach((sample) => {
    console.log(`   ${sample.name} - ${sample.date.toISOString().split('T')[0]} (${sample.country})`);
  });
  
  console.log('\n✨ Special Days migration completed successfully!\n');
}

// Run migration
migrateSpecialDays()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
