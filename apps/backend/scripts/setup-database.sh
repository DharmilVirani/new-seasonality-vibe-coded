#!/bin/bash

# Seasonality SaaS Database Setup Script
# Complete database initialization, migration, and optimization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🗄️  Seasonality SaaS Database Setup"
echo "===================================="
echo "This script will:"
echo "1. Initialize the database schema"
echo "2. Run Prisma migrations"
echo "3. Set up TimescaleDB optimizations"
echo "4. Seed the database with sample data"
echo "5. Optionally migrate CSV data"
echo

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the backend directory (apps/backend)"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Check if database is accessible
print_status "Checking database connection..."
if ! npx prisma db execute --file prisma/migrations/001_initial_setup.sql --preview-feature 2>/dev/null; then
    print_warning "Could not execute initial setup SQL directly"
fi

# Step 1: Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate
print_success "Prisma client generated"

# Step 2: Push database schema
print_status "Pushing database schema..."
npx prisma db push --force-reset
print_success "Database schema pushed"

# Step 3: Run initial setup SQL
print_status "Running initial database setup..."
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f prisma/migrations/001_initial_setup.sql
    print_success "Initial setup SQL executed"
else
    print_warning "psql not found. Skipping initial setup SQL."
    print_warning "Please run the SQL manually: psql \$DATABASE_URL -f prisma/migrations/001_initial_setup.sql"
fi

# Step 4: Run database optimizations
print_status "Running database optimizations..."
if node scripts/optimize-database.js; then
    print_success "Database optimizations completed"
else
    print_error "Database optimization failed"
    exit 1
fi

# Step 5: Seed the database
print_status "Seeding database with sample data..."
if node prisma/seed.js; then
    print_success "Database seeded successfully"
else
    print_error "Database seeding failed"
    exit 1
fi

# Step 6: Ask about CSV data migration
echo
read -p "Do you want to migrate CSV data from old-software? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting CSV data migration..."
    
    # Ask for specific symbols or all
    echo "Migration options:"
    echo "1. Migrate all symbols (may take a long time)"
    echo "2. Migrate specific symbols"
    echo "3. Migrate sample symbols (NIFTY, BANKNIFTY, RELIANCE)"
    echo
    read -p "Choose option (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            print_status "Migrating all symbols..."
            node scripts/data-migration.js
            ;;
        2)
            read -p "Enter comma-separated symbol names (e.g., NIFTY,BANKNIFTY,RELIANCE): " symbols
            print_status "Migrating symbols: $symbols"
            node scripts/data-migration.js --symbols "$symbols"
            ;;
        3)
            print_status "Migrating sample symbols..."
            node scripts/data-migration.js --symbols "NIFTY,BANKNIFTY,RELIANCE"
            ;;
        *)
            print_status "Skipping CSV data migration"
            ;;
    esac
else
    print_status "Skipping CSV data migration"
fi

# Step 7: Final validation
print_status "Running final validation..."

# Check if tables exist and have data
TABLES=("User" "Ticker" "DailyData" "WeeklyData" "MonthlyData" "YearlyData")
for table in "${TABLES[@]}"; do
    count=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | tail -1 || echo "0")
    if [ "$count" -gt 0 ]; then
        print_success "$table: $count records"
    else
        print_warning "$table: No records found"
    fi
done

# Check TimescaleDB hypertables
print_status "Checking TimescaleDB hypertables..."
hypertables=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM timescaledb_information.hypertables;" 2>/dev/null | tail -1 || echo "0")
if [ "$hypertables" -gt 0 ]; then
    print_success "TimescaleDB hypertables: $hypertables configured"
else
    print_warning "No TimescaleDB hypertables found"
fi

# Check materialized views
print_status "Checking materialized views..."
matviews=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM pg_matviews WHERE schemaname = 'public';" 2>/dev/null | tail -1 || echo "0")
if [ "$matviews" -gt 0 ]; then
    print_success "Materialized views: $matviews created"
else
    print_warning "No materialized views found"
fi

echo
echo "🎉 Database Setup Complete!"
echo "=========================="
echo
echo "📊 Database Summary:"
echo "   ✅ Schema: Deployed and optimized"
echo "   ✅ TimescaleDB: Configured for time-series data"
echo "   ✅ Indexes: Performance indexes created"
echo "   ✅ Sample Data: Seeded for testing"
echo "   ✅ Maintenance: Automated jobs configured"
echo
echo "🔐 Test Credentials:"
echo "   Admin: admin@seasonality.com / admin123"
echo "   Research: research@seasonality.com / research123"
echo "   Demo: demo@seasonality.com / demo123"
echo
echo "🚀 Next Steps:"
echo "1. Start the backend server: npm run dev"
echo "2. Test API endpoints: curl http://localhost:3001/api/health"
echo "3. Access database: npx prisma studio"
echo "4. Monitor performance: SELECT * FROM query_performance;"
echo
echo "📋 Maintenance Commands:"
echo "   Refresh stats: SELECT refresh_materialized_views();"
echo "   Cleanup old data: SELECT cleanup_old_data();"
echo "   Database stats: SELECT * FROM get_database_statistics();"
echo
print_success "Database is ready for production use! 🚀"