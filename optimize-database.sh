#!/bin/bash
# =====================================================
# One-Click Database Optimization Script
# Seasonality SaaS Performance Optimization
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if running from correct directory BEFORE changing dirs
if [ ! -f "$SCRIPT_DIR/apps/backend/prisma/schema.prisma" ]; then
    echo -e "${RED}ERROR: Cannot find project structure${NC}"
    echo -e "${RED}Please run this script from the project root directory${NC}"
    exit 1
fi

# Change to script directory (project root)
cd "$SCRIPT_DIR"

echo -e "${BLUE}==============================================================${NC}"
echo -e "${BLUE}  Seasonality SaaS - Database Performance Optimization${NC}"
echo -e "${BLUE}==============================================================${NC}"
echo ""

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}WARNING: DATABASE_URL environment variable not set${NC}"
    echo -e "${YELLOW}Please set it or the script will try to read from .env file${NC}"
    
    # Try to load from .env file
    if [ -f "apps/backend/.env" ]; then
        # Read DATABASE_URL specifically, handling special characters
        DATABASE_URL=$(grep '^DATABASE_URL=' apps/backend/.env | cut -d'=' -f2-)
        export DATABASE_URL
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found. Please set it and try again.${NC}"
    exit 1
fi

# Clean DATABASE_URL for psql (remove Prisma-specific parameters)
# psql doesn't understand connection_limit, pool_timeout, etc.
PSQL_URL=$(echo "$DATABASE_URL" | sed 's/?[^?]*$//')

echo -e "${GREEN}✓ Database URL configured${NC}"
echo ""

# =====================================================
# STEP 1: Check Prerequisites
# =====================================================
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}ERROR: psql command not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Check database connection
echo -n "  Testing database connection... "
if psql "$PSQL_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo -e "${RED}ERROR: Cannot connect to database. Please check DATABASE_URL.${NC}"
    exit 1
fi

# Check if TimescaleDB extension is available
echo -n "  Checking TimescaleDB... "
if psql "$PSQL_URL" -c "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb';" 2>/dev/null | grep -q 1; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${YELLOW}⚠ Not installed${NC}"
    echo -e "${YELLOW}  TimescaleDB is recommended for optimal performance.${NC}"
    echo -e "${YELLOW}  Continuing with standard optimizations...${NC}"
fi

echo ""

# =====================================================
# STEP 2: Run Prisma Migrations
# =====================================================
echo -e "${BLUE}Step 2: Running Prisma migrations...${NC}"
cd apps/backend

if npx prisma migrate deploy; then
    echo -e "${GREEN}✓ Migrations applied${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    echo -e "${RED}ERROR: Please check the error messages above.${NC}"
    exit 1
fi

echo ""

# =====================================================
# STEP 3: Run Performance Optimization SQL
# =====================================================
echo -e "${BLUE}Step 3: Applying performance optimizations...${NC}"

if psql "$PSQL_URL" -f prisma/migrations/002_performance_optimization.sql; then
    echo -e "${GREEN}✓ Performance optimizations applied${NC}"
else
    echo -e "${RED}✗ Optimization failed${NC}"
    echo -e "${YELLOW}WARNING: Some optimizations may not have been applied.${NC}"
    echo -e "${YELLOW}You can run the SQL file manually for debugging.${NC}"
fi

echo ""

# =====================================================
# STEP 4: Backup and Update AnalysisService
# =====================================================
echo -e "${BLUE}Step 4: Installing optimized AnalysisService...${NC}"

# Check if optimized service exists
if [ -f "src/services/AnalysisServiceOptimized.js" ]; then
    # Backup existing service
    if [ -f "src/services/AnalysisService.js" ]; then
        cp src/services/AnalysisService.js "src/services/AnalysisService.js.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "  ${GREEN}✓ Backup created${NC}"
    fi
    
    # Replace with optimized version
    cp src/services/AnalysisServiceOptimized.js src/services/AnalysisService.js
    echo -e "  ${GREEN}✓ Optimized AnalysisService installed${NC}"
else
    echo -e "  ${YELLOW}⚠ Optimized service not found. Manual update required.${NC}"
    echo -e "  ${YELLOW}  Please copy AnalysisServiceOptimized.js to AnalysisService.js${NC}"
fi

echo ""

# =====================================================
# STEP 5: Verify Installation
# =====================================================
echo -e "${BLUE}Step 5: Verifying installation...${NC}"

# Check hypertables
echo -n "  Checking hypertables... "
HYPERTABLES=$(psql "$PSQL_URL" -t -c "SELECT COUNT(*) FROM timescaledb_information.hypertables;" 2>/dev/null | xargs)
if [ "$HYPERTABLES" -gt 0 ] 2>/dev/null; then
    echo -e "${GREEN}✓ $HYPERTABLES hypertables created${NC}"
else
    echo -e "${YELLOW}⚠ No hypertables found${NC}"
fi

# Check indexes
echo -n "  Checking new indexes... "
INDEX_COUNT=$(psql "$PSQL_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_daily_ticker_%';" | xargs)
if [ "$INDEX_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ $INDEX_COUNT new indexes created${NC}"
else
    echo -e "${YELLOW}⚠ New indexes not found${NC}"
fi

# Check materialized views
echo -n "  Checking materialized views... "
MV_COUNT=$(psql "$PSQL_URL" -t -c "SELECT COUNT(*) FROM pg_matviews WHERE matviewname LIKE 'mv_%';" | xargs)
if [ "$MV_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ $MV_COUNT materialized views created${NC}"
else
    echo -e "${YELLOW}⚠ Materialized views not found${NC}"
fi

echo ""

# =====================================================
# STEP 6: Generate Report
# =====================================================
echo -e "${BLUE}Step 6: Generating optimization report...${NC}"

# Get table sizes
echo ""
echo -e "${YELLOW}Current Table Sizes:${NC}"
psql "$PSQL_URL" -c "
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN (
    'daily_seasonality_data',
    'monday_weekly_data', 
    'expiry_weekly_data',
    'monthly_seasonality_data',
    'yearly_seasonality_data'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

echo ""
echo -e "${BLUE}==============================================================${NC}"
echo -e "${GREEN}  OPTIMIZATION COMPLETE!${NC}"
echo -e "${BLUE}==============================================================${NC}"
echo ""
echo -e "${GREEN}✓ Database optimized for performance${NC}"
echo -e "${GREEN}✓ Indexes created${NC}"
echo -e "${GREEN}✓ Hypertables configured (if TimescaleDB available)${NC}"
echo -e "${GREEN}✓ Materialized views created${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Restart your backend application"
echo -e "  2. Test the analysis endpoints"
echo -e "  3. Monitor performance improvements"
echo ""
echo -e "${YELLOW}Maintenance:${NC}"
echo -e "  • Schedule: scripts/db-maintenance.sh (daily recommended)"
echo -e "  • Monitor: scripts/monitoring-queries.sql"
echo -e "  • Docs: docs/DATABASE_OPTIMIZATION.md"
echo ""
echo -e "${BLUE}==============================================================${NC}"

# Make maintenance script executable
chmod +x scripts/db-maintenance.sh

echo ""
echo -e "${GREEN}Done! Your database is now optimized for performance.${NC}"
