/**
 * Seed dummy data for testing
 * Usage: node scripts/seed-dummy-data.js
 * 
 * Generates realistic data with seasonality patterns matching old software
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Generate OHLCV with realistic seasonality patterns
function generateOHLCV(basePrice, date, symbol) {
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();
  
  // Base volatility
  let volatility = 0.015;
  let bias = 0;
  
  // Monthly seasonality (Jan, Nov, Dec tend to be bullish)
  if ([1, 11, 12].includes(month)) {
    bias += 0.001;
  } else if ([5, 6, 9].includes(month)) {
    bias -= 0.0005;
  }
  
  // Day of week effect (Monday tends to be weak, Friday strong)
  if (dayOfWeek === 1) bias -= 0.0003; // Monday
  if (dayOfWeek === 5) bias += 0.0003; // Friday
  
  // Expiry week effect (last week of month tends to be volatile)
  if (dayOfMonth >= 25) {
    volatility *= 1.3;
  }
  
  // Election year effect
  const electionYears = [2004, 2009, 2014, 2019, 2024];
  if (electionYears.includes(year)) {
    volatility *= 1.2;
    bias += 0.0002;
  }
  
  // Generate price movement
  const change = (Math.random() - 0.5 + bias) * 2 * volatility;
  
  const open = basePrice * (1 + (Math.random() - 0.5) * volatility * 0.5);
  const close = open * (1 + change);
  const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.3);
  const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.3);
  const volume = Math.floor(1000000 + Math.random() * 5000000);
  const openInterest = Math.floor(100000 + Math.random() * 500000);

  return {
    date,
    open: parseFloat(open.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    close: parseFloat(close.toFixed(2)),
    volume,
    openInterest,
  };
}

// Generate date range
function generateDates(startDate, days) {
  const dates = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    // Skip weekends
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

async function seedData() {
  console.log('🌱 Starting seed...\n');

  // Define symbols with base prices
  const symbols = [
    { symbol: 'NIFTY', name: 'Nifty 50 Index', basePrice: 22000, sector: 'Index' },
    { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', basePrice: 48000, sector: 'Index' },
    { symbol: 'RELIANCE', name: 'Reliance Industries', basePrice: 2500, sector: 'Energy' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', basePrice: 3800, sector: 'IT' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', basePrice: 1600, sector: 'Banking' },
    { symbol: 'INFY', name: 'Infosys', basePrice: 1500, sector: 'IT' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', basePrice: 1100, sector: 'Banking' },
    { symbol: 'SBIN', name: 'State Bank of India', basePrice: 750, sector: 'Banking' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel', basePrice: 1400, sector: 'Telecom' },
    { symbol: 'ITC', name: 'ITC Limited', basePrice: 450, sector: 'FMCG' },
  ];

  // Generate 5 years of data (approx 1260 trading days)
  const startDate = new Date('2020-01-01');
  const tradingDays = generateDates(startDate, 365 * 5 + 365); // Extra days to account for weekends
  
  console.log(`📅 Generated ${tradingDays.length} trading days\n`);

  for (const symbolData of symbols) {
    console.log(`📊 Processing ${symbolData.symbol}...`);
    
    // Create or update ticker
    const ticker = await prisma.ticker.upsert({
      where: { symbol: symbolData.symbol },
      update: {
        name: symbolData.name,
        sector: symbolData.sector,
        exchange: 'NSE',
        currency: 'INR',
        isActive: true,
      },
      create: {
        symbol: symbolData.symbol,
        name: symbolData.name,
        sector: symbolData.sector,
        exchange: 'NSE',
        currency: 'INR',
        isActive: true,
      },
    });

    // Delete existing data for this ticker
    await prisma.seasonalityData.deleteMany({
      where: { tickerId: ticker.id },
    });

    // Generate OHLCV data
    let currentPrice = symbolData.basePrice;
    const records = [];

    for (const date of tradingDays) {
      const ohlcv = generateOHLCV(currentPrice, date, symbolData.symbol);
      currentPrice = ohlcv.close; // Use close as next day's base
      
      records.push({
        tickerId: ticker.id,
        ...ohlcv,
      });
    }

    // Batch insert
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await prisma.seasonalityData.createMany({
        data: batch,
      });
    }

    // Update ticker stats
    await prisma.ticker.update({
      where: { id: ticker.id },
      data: {
        totalRecords: records.length,
        firstDataDate: tradingDays[0],
        lastDataDate: tradingDays[tradingDays.length - 1],
      },
    });

    console.log(`   ✅ Added ${records.length} records for ${symbolData.symbol}`);
  }

  // Summary
  const tickerCount = await prisma.ticker.count();
  const dataCount = await prisma.seasonalityData.count();

  console.log('\n✨ Seed completed!');
  console.log(`   📈 Tickers: ${tickerCount}`);
  console.log(`   📊 Data records: ${dataCount}`);
}

seedData()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
