/**
 * Script to generate calculated data for all existing tickers
 * This populates the Phase 2 tables (weekly, monthly, yearly)
 */
const { PrismaClient } = require('@prisma/client');
const { generateSymbolFiles } = require('./src/processing/fileGenerator');

const prisma = new PrismaClient();

async function generateAllCalculatedData() {
  try {
    console.log('🚀 Starting calculated data generation for all tickers...\n');

    // Get all tickers with data
    const tickers = await prisma.ticker.findMany({
      where: { totalRecords: { gt: 0 } },
      orderBy: { symbol: 'asc' }
    });

    console.log(`📊 Found ${tickers.length} tickers with data\n`);

    let totalWeekly = 0;
    let totalMonthly = 0;
    let totalYearly = 0;

    for (const ticker of tickers) {
      console.log(`\n📈 Processing ${ticker.symbol}...`);

      // Get daily data for this ticker
      const dailyData = await prisma.seasonalityData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'asc' }
      });

      if (dailyData.length === 0) {
        console.log(`  ⚠️ No daily data found, skipping`);
        continue;
      }

      console.log(`  📋 Found ${dailyData.length} daily records`);

      // Transform to the format expected by fileGenerator
      const transformedData = dailyData.map(record => ({
        date: record.date,
        symbol: ticker.symbol,
        ticker: ticker.symbol,
        open: parseFloat(record.open),
        high: parseFloat(record.high),
        low: parseFloat(record.low),
        close: parseFloat(record.close),
        volume: parseInt(record.volume),
        openInterest: parseInt(record.openInterest || 0)
      }));

      // Generate calculated data
      const calculatedData = await generateSymbolFiles(transformedData, ticker.symbol);

      console.log(`  ✅ Generated: ${calculatedData.mondayWeekly?.length || 0} weekly, ${calculatedData.monthly?.length || 0} monthly, ${calculatedData.yearly?.length || 0} yearly`);

      // Store Monday Weekly data
      if (calculatedData.mondayWeekly && calculatedData.mondayWeekly.length > 0) {
        for (const record of calculatedData.mondayWeekly) {
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
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
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
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            totalWeekly++;
          } catch (error) {
            // Skip duplicates silently
          }
        }
      }

      // Store Expiry Weekly data
      if (calculatedData.expiryWeekly && calculatedData.expiryWeekly.length > 0) {
        for (const record of calculatedData.expiryWeekly) {
          try {
            await prisma.weeklySeasonalityData.upsert({
              where: {
                date_tickerId_weekType: {
                  date: record.date,
                  tickerId: ticker.id,
                  weekType: 'EXPIRY'
                }
              },
              update: {
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                updatedAt: new Date()
              },
              create: {
                tickerId: ticker.id,
                date: record.date,
                weekType: 'EXPIRY',
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            totalWeekly++;
          } catch (error) {
            // Skip duplicates silently
          }
        }
      }

      // Store Monthly data
      if (calculatedData.monthly && calculatedData.monthly.length > 0) {
        for (const record of calculatedData.monthly) {
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
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                evenMonth: record.evenMonth || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
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
                weekday: record.weekday || null,
                evenMonth: record.evenMonth || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            totalMonthly++;
          } catch (error) {
            // Skip duplicates silently
          }
        }
      }

      // Store Yearly data
      if (calculatedData.yearly && calculatedData.yearly.length > 0) {
        for (const record of calculatedData.yearly) {
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
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                evenYear: record.evenYear || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveYear: record.positiveYear || null,
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
                weekday: record.weekday || null,
                evenYear: record.evenYear || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            totalYearly++;
          } catch (error) {
            // Skip duplicates silently
          }
        }
      }

      console.log(`  💾 Stored in database`);
    }

    // Final counts
    console.log('\n\n========================================');
    console.log('📊 FINAL DATABASE COUNTS:');
    console.log('========================================');
    
    const weeklyCount = await prisma.weeklySeasonalityData.count();
    const monthlyCount = await prisma.monthlySeasonalityData.count();
    const yearlyCount = await prisma.yearlySeasonalityData.count();
    const dailyCount = await prisma.seasonalityData.count();
    
    console.log(`📈 Daily records: ${dailyCount}`);
    console.log(`📅 Weekly records: ${weeklyCount}`);
    console.log(`📆 Monthly records: ${monthlyCount}`);
    console.log(`🗓️  Yearly records: ${yearlyCount}`);
    console.log('========================================');
    console.log('\n✅ Calculated data generation complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

generateAllCalculatedData();
