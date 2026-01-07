/**
 * Seasonality SaaS Database Seeding Script
 * Seeds the database with initial data for development and testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@seasonality.com' },
        update: {},
        create: {
            email: 'admin@seasonality.com',
            name: 'System Administrator',
            password: adminPassword,
            role: 'admin',
            subscriptionTier: 'enterprise',
            isActive: true
        }
    });
    console.log('✅ Created admin user:', admin.email);

    // Create research user
    const researchPassword = await bcrypt.hash('research123', 12);
    const researcher = await prisma.user.upsert({
        where: { email: 'research@seasonality.com' },
        update: {},
        create: {
            email: 'research@seasonality.com',
            name: 'Research Team',
            password: researchPassword,
            role: 'research',
            subscriptionTier: 'premium',
            isActive: true
        }
    });
    console.log('✅ Created research user:', researcher.email);

    // Create demo user
    const demoPassword = await bcrypt.hash('demo123', 12);
    const demoUser = await prisma.user.upsert({
        where: { email: 'demo@seasonality.com' },
        update: {},
        create: {
            email: 'demo@seasonality.com',
            name: 'Demo User',
            password: demoPassword,
            role: 'user',
            subscriptionTier: 'basic',
            isActive: true
        }
    });
    console.log('✅ Created demo user:', demoUser.email);

    // Create API keys for admin
    const adminApiKey = await prisma.apiKey.create({
        data: {
            keyHash: await bcrypt.hash('sk_admin_test_key_123', 10),
            name: 'Admin Development Key',
            userId: admin.id,
            permissions: ['*'], // All permissions
            rateLimit: 10000,
            isActive: true
        }
    });
    console.log('✅ Created admin API key');

    // Create user preferences for demo user
    await prisma.userPreferences.create({
        data: {
            userId: demoUser.id,
            defaultTimeframe: 'daily',
            defaultSymbols: ['NIFTY', 'BANKNIFTY', 'RELIANCE'],
            defaultFilters: {
                positiveNegativeDays: 'All',
                weekdayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                evenOddCalenderMonthDays: 'All'
            },
            theme: 'light',
            chartType: 'candlestick',
            emailNotifications: true
        }
    });
    console.log('✅ Created user preferences for demo user');

    // Create sample tickers (major Indian indices and stocks)
    const sampleTickers = [
        { symbol: 'NIFTY', name: 'Nifty 50 Index', sector: 'Index', exchange: 'NSE' },
        { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', sector: 'Index', exchange: 'NSE' },
        { symbol: 'SENSEX', name: 'BSE Sensex', sector: 'Index', exchange: 'BSE' },
        { symbol: 'RELIANCE', name: 'Reliance Industries Limited', sector: 'Oil & Gas', exchange: 'NSE' },
        { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Information Technology', exchange: 'NSE' },
        { symbol: 'INFY', name: 'Infosys Limited', sector: 'Information Technology', exchange: 'NSE' },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', sector: 'Banking', exchange: 'NSE' },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', sector: 'Banking', exchange: 'NSE' },
        { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Limited', sector: 'FMCG', exchange: 'NSE' },
        { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG', exchange: 'NSE' }
    ];

    for (const tickerData of sampleTickers) {
        const ticker = await prisma.ticker.upsert({
            where: { symbol: tickerData.symbol },
            update: {},
            create: {
                ...tickerData,
                isActive: true,
                totalRecords: 0
            }
        });
        console.log(`✅ Created ticker: ${ticker.symbol}`);
    }

    // Create sample daily data for NIFTY (last 30 days)
    const niftyTicker = await prisma.ticker.findUnique({
        where: { symbol: 'NIFTY' }
    });

    if (niftyTicker) {
        const sampleDailyData = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        let currentPrice = 19500; // Starting price
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            // Generate realistic OHLC data
            const change = (Math.random() - 0.5) * 200; // Random change ±100 points
            const open = currentPrice;
            const close = currentPrice + change;
            const high = Math.max(open, close) + Math.random() * 50;
            const low = Math.min(open, close) - Math.random() * 50;
            const volume = Math.floor(Math.random() * 1000000) + 500000;
            
            const returnPoints = close - open;
            const returnPercentage = (returnPoints / open) * 100;
            
            sampleDailyData.push({
                date,
                tickerId: niftyTicker.id,
                open,
                high,
                low,
                close,
                volume,
                openInterest: 0,
                returnPoints,
                returnPercentage,
                positiveDay: returnPercentage > 0,
                weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
                calendarMonthDay: date.getDate(),
                calendarYearDay: Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)),
                evenCalendarMonthDay: date.getDate() % 2 === 0,
                evenMonth: (date.getMonth() + 1) % 2 === 0,
                evenYear: date.getFullYear() % 2 === 0
            });
            
            currentPrice = close;
        }
        
        await prisma.dailyData.createMany({
            data: sampleDailyData,
            skipDuplicates: true
        });
        
        console.log(`✅ Created ${sampleDailyData.length} sample daily records for NIFTY`);
        
        // Update ticker statistics
        await prisma.ticker.update({
            where: { id: niftyTicker.id },
            data: {
                totalRecords: sampleDailyData.length,
                firstDataDate: sampleDailyData[0].date,
                lastDataDate: sampleDailyData[sampleDailyData.length - 1].date,
                lastUpdated: new Date()
            }
        });
    }

    // Create sample upload batch
    const sampleBatch = await prisma.uploadBatch.create({
        data: {
            userId: researcher.id,
            name: 'Sample Data Upload',
            description: 'Initial sample data for testing',
            status: 'COMPLETED',
            totalFiles: 5,
            processedFiles: 5,
            failedFiles: 0,
            progressPercentage: 100,
            totalRecordsProcessed: 1000,
            completedAt: new Date()
        }
    });
    console.log('✅ Created sample upload batch');

    // Create sample uploaded files
    const sampleFiles = [
        { name: 'NIFTY_Daily.csv', records: 250 },
        { name: 'BANKNIFTY_Daily.csv', records: 250 },
        { name: 'RELIANCE_Daily.csv', records: 200 },
        { name: 'TCS_Daily.csv', records: 200 },
        { name: 'INFY_Daily.csv', records: 100 }
    ];

    for (const file of sampleFiles) {
        await prisma.uploadedFile.create({
            data: {
                batchId: sampleBatch.id,
                originalName: file.name,
                objectKey: `uploads/${sampleBatch.id}/${file.name}`,
                fileSize: file.records * 200, // Approximate file size
                mimeType: 'text/csv',
                status: 'COMPLETED',
                recordsProcessed: file.records,
                recordsSkipped: 0,
                recordsFailed: 0,
                processedAt: new Date()
            }
        });
    }
    console.log('✅ Created sample uploaded files');

    // Create sample analysis result
    await prisma.analysisResult.create({
        data: {
            userId: demoUser.id,
            analysisType: 'daily',
            symbols: ['NIFTY', 'BANKNIFTY'],
            filters: {
                dateRange: { start: '2023-01-01', end: '2023-12-31' },
                positiveNegativeDays: 'All',
                weekdayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            },
            dateRange: { start: '2023-01-01', end: '2023-12-31' },
            chartData: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                datasets: [{
                    label: 'NIFTY Returns',
                    data: [2.5, -1.2, 3.8, 0.5, 2.1]
                }]
            },
            statistics: {
                totalDays: 250,
                positiveDays: 135,
                negativeDays: 115,
                averageReturn: 0.8,
                volatility: 1.2,
                accuracy: 54.0
            },
            processingTime: 1250,
            dataPoints: 500,
            isPublic: false
        }
    });
    console.log('✅ Created sample analysis result');

    // Create system logs
    const logLevels = ['info', 'warn', 'error'];
    const logMessages = [
        'System started successfully',
        'Database connection established',
        'User login successful',
        'API rate limit warning',
        'Database connection timeout',
        'File upload completed',
        'Analysis calculation finished'
    ];

    for (let i = 0; i < 20; i++) {
        await prisma.systemLog.create({
            data: {
                level: logLevels[Math.floor(Math.random() * logLevels.length)],
                message: logMessages[Math.floor(Math.random() * logMessages.length)],
                context: {
                    timestamp: new Date(),
                    component: 'system',
                    version: '1.0.0'
                },
                userId: Math.random() > 0.5 ? demoUser.id : null,
                requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                endpoint: '/api/analysis/daily',
                method: 'POST',
                responseTime: Math.floor(Math.random() * 2000) + 100,
                memoryUsage: Math.floor(Math.random() * 500) + 100
            }
        });
    }
    console.log('✅ Created sample system logs');

    // Create data quality checks
    await prisma.dataQualityCheck.create({
        data: {
            tickerId: niftyTicker.id,
            checkType: 'missing_data',
            dateRange: { start: '2023-01-01', end: '2023-12-31' },
            issuesFound: 2,
            issueDetails: {
                missingDates: ['2023-03-15', '2023-07-22'],
                description: 'Missing data for 2 trading days'
            },
            isResolved: false
        }
    });
    console.log('✅ Created sample data quality check');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   👥 Users: 3 (admin, research, demo)');
    console.log('   🔑 API Keys: 1');
    console.log('   📈 Tickers: 10');
    console.log('   📊 Daily Data: ~20 records');
    console.log('   📁 Upload Batches: 1');
    console.log('   📄 Uploaded Files: 5');
    console.log('   📋 Analysis Results: 1');
    console.log('   📝 System Logs: 20');
    console.log('   🔍 Data Quality Checks: 1');
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Admin: admin@seasonality.com / admin123');
    console.log('   Research: research@seasonality.com / research123');
    console.log('   Demo: demo@seasonality.com / demo123');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Seeding failed:', e);
        await prisma.$disconnect();
        process.exit(1);
    });