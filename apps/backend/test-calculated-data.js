/**
 * Test script to debug calculated data generation
 */
const { PrismaClient } = require('@prisma/client');
const { generateSymbolFiles } = require('./src/processing/fileGenerator');

const prisma = new PrismaClient();

async function testCalculatedData() {
  try {
    console.log('🔍 Testing calculated data generation...\n');

    // Get a ticker with data
    const ticker = await prisma.ticker.findFirst({
      where: { totalRecords: { gt: 0 } }
    });

    if (!ticker) {
      console.log('❌ No ticker with data found');
      return;
    }

    console.log(`📊 Testing with ticker: ${ticker.symbol} (ID: ${ticker.id})`);

    // Get daily data
    const dailyData = await prisma.seasonalityData.findMany({
      where: { tickerId: ticker.id },
      orderBy: { date: 'asc' },
      take: 100 // Just test with 100 records
    });

    console.log(`📈 Found ${dailyData.length} daily records`);

    if (dailyData.length === 0) {
      console.log('❌ No daily data found');
      return;
    }

    // Show sample data format
    console.log('\n📋 Sample daily data format:');
    console.log(JSON.stringify(dailyData[0], null, 2));

    // Transform to the format expected by fileGenerator
    const transformedData = dailyData.map(record => ({
      date: record.date,
      symbol: ticker.symbol,
      ticker: ticker.symbol,
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: record.volume,
      openInterest: record.openInterest || 0
    }));

    console.log('\n📋 Transformed data format:');
    console.log(JSON.stringify(transformedData[0], null, 2));

    // Generate calculated data
    console.log('\n🔄 Generating calculated data...');
    const calculatedData = await generateSymbolFiles(transformedData, ticker.symbol);

    console.log('\n✅ Generated data counts:');
    console.log(`  Daily: ${calculatedData.daily?.length || 0}`);
    console.log(`  Monday Weekly: ${calculatedData.mondayWeekly?.length || 0}`);
    console.log(`  Expiry Weekly: ${calculatedData.expiryWeekly?.length || 0}`);
    console.log(`  Monthly: ${calculatedData.monthly?.length || 0}`);
    console.log(`  Yearly: ${calculatedData.yearly?.length || 0}`);

    // Show sample generated data
    if (calculatedData.mondayWeekly?.length > 0) {
      console.log('\n📋 Sample Monday Weekly data:');
      console.log(JSON.stringify(calculatedData.mondayWeekly[0], null, 2));
    }

    if (calculatedData.monthly?.length > 0) {
      console.log('\n📋 Sample Monthly data:');
      console.log(JSON.stringify(calculatedData.monthly[0], null, 2));
    }

    if (calculatedData.yearly?.length > 0) {
      console.log('\n📋 Sample Yearly data:');
      console.log(JSON.stringify(calculatedData.yearly[0], null, 2));
    }

    // Try to store one record in each table
    console.log('\n🔄 Testing database storage...');

    if (calculatedData.mondayWeekly?.length > 0) {
      const record = calculatedData.mondayWeekly[0];
      try {
        await prisma.weeklySeasonalityData.upsert({
          where: {
            date_tickerId_weekType: {
              date: record.date,
              tickerId: ticker.id,
              weekType: 'MONDAY'
            }
          },
          update: {
            open: record.open || 0,
            high: record.high || 0,
            low: record.low || 0,
            close: record.close || 0,
            volume: record.volume || 0,
            updatedAt: new Date()
          },
          create: {
            tickerId: ticker.id,
            date: record.date,
            weekType: 'MONDAY',
            open: record.open || 0,
            high: record.high || 0,
            low: record.low || 0,
            close: record.close || 0,
            volume: record.volume || 0,
            openInterest: record.openInterest || 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log('  ✅ Weekly data stored successfully');
      } catch (error) {
        console.log('  ❌ Weekly storage error:', error.message);
      }
    }

    if (calculatedData.monthly?.length > 0) {
      const record = calculatedData.monthly[0];
      try {
        await prisma.monthlySeasonalityData.upsert({
          where: {
            date_tickerId: {
              date: record.date,
              tickerId: ticker.id
            }
          },
          update: {
            open: record.open || 0,
            high: record.high || 0,
            low: record.low || 0,
            close: record.close || 0,
            volume: record.volume || 0,
            updatedAt: new Date()
          },
          create: {
            tickerId: ticker.id,
            date: record.date,
            open: record.open || 0,
            high: record.high || 0,
            low: record.low || 0,
            close: record.close || 0,
            volume: record.volume || 0,
            openInterest: record.openInterest || 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log('  ✅ Monthly data stored successfully');
      } catch (error) {
        console.log('  ❌ Monthly storage error:', error.message);
      }
    }

    if (calculatedData.yearly?.length > 0) {
      const record = calculatedData.yearly[0];
      try {
        await prisma.yearlySeasonalityData.upsert({
          where: {
            date_tickerId: {
              date: record.date,
              tickerId: ticker.id
            }
          },
          update: {
            open: record.open || 0,
            high: record.high || 0,
            low: record.low || 0,
            close: record.close || 0,
            volume: record.volume || 0,
            updatedAt: new Date()
          },
          create: {
            tickerId: ticker.id,
            date: record.date,
            open: record.open || 0,
            high: record.high || 0,
            low: record.low || 0,
            close: record.close || 0,
            volume: record.volume || 0,
            openInterest: record.openInterest || 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log('  ✅ Yearly data stored successfully');
      } catch (error) {
        console.log('  ❌ Yearly storage error:', error.message);
      }
    }

    // Check counts after test
    console.log('\n📊 Database counts after test:');
    const weeklyCount = await prisma.weeklySeasonalityData.count();
    const monthlyCount = await prisma.monthlySeasonalityData.count();
    const yearlyCount = await prisma.yearlySeasonalityData.count();
    console.log(`  Weekly: ${weeklyCount}`);
    console.log(`  Monthly: ${monthlyCount}`);
    console.log(`  Yearly: ${yearlyCount}`);

    console.log('\n✅ Test complete');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCalculatedData();
