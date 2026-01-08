/**
 * Test script to check database data
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('🔍 Checking database data...\n');

    // Check tickers
    const tickerCount = await prisma.ticker.count();
    console.log(`📊 Tickers: ${tickerCount}`);

    if (tickerCount > 0) {
      const tickers = await prisma.ticker.findMany({
        take: 5,
        select: { symbol: true, totalRecords: true }
      });
      console.log('Sample tickers:', tickers);
    }

    // Check daily data
    const dailyCount = await prisma.seasonalityData.count();
    console.log(`📈 Daily records: ${dailyCount}`);

    // Check weekly data
    const weeklyCount = await prisma.weeklySeasonalityData.count();
    console.log(`📅 Weekly records: ${weeklyCount}`);

    // Check monthly data
    const monthlyCount = await prisma.monthlySeasonalityData.count();
    console.log(`📆 Monthly records: ${monthlyCount}`);

    // Check yearly data
    const yearlyCount = await prisma.yearlySeasonalityData.count();
    console.log(`🗓️  Yearly records: ${yearlyCount}`);

    // Check upload batches
    const batchCount = await prisma.uploadBatch.count();
    console.log(`📦 Upload batches: ${batchCount}`);

    if (batchCount > 0) {
      const batches = await prisma.uploadBatch.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { 
          id: true, 
          name: true, 
          status: true, 
          totalFiles: true,
          processedFiles: true,
          createdAt: true 
        }
      });
      console.log('\nRecent batches:');
      batches.forEach(batch => {
        console.log(`  ${batch.id}: ${batch.name} - ${batch.status} (${batch.processedFiles}/${batch.totalFiles} files)`);
      });
    }

    console.log('\n✅ Database check complete');

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();