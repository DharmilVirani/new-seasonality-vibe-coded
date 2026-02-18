-- =====================================================
-- CRITICAL PERFORMANCE OPTIMIZATION MIGRATION
-- Seasonality SaaS Database Optimization
-- Run this AFTER Prisma migration: npx prisma migrate deploy
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Set timezone
SET timezone = 'UTC';

-- =====================================================
-- STEP 1: CONVERT TABLES TO TIMESCALEDB HYPERTABLES
-- This is CRITICAL for time-series performance
-- =====================================================

-- Convert daily_seasonality_data to hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'daily_seasonality_data'
    ) THEN
        PERFORM create_hypertable('daily_seasonality_data', 'date', 
            chunk_time_interval => INTERVAL '1 month',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'daily_seasonality_data converted to hypertable';
    END IF;
END $$;

-- Convert monday_weekly_data to hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'monday_weekly_data'
    ) THEN
        PERFORM create_hypertable('monday_weekly_data', 'date', 
            chunk_time_interval => INTERVAL '3 months',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'monday_weekly_data converted to hypertable';
    END IF;
END $$;

-- Convert expiry_weekly_data to hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'expiry_weekly_data'
    ) THEN
        PERFORM create_hypertable('expiry_weekly_data', 'date', 
            chunk_time_interval => INTERVAL '3 months',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'expiry_weekly_data converted to hypertable';
    END IF;
END $$;

-- Convert monthly_seasonality_data to hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'monthly_seasonality_data'
    ) THEN
        PERFORM create_hypertable('monthly_seasonality_data', 'date', 
            chunk_time_interval => INTERVAL '1 year',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'monthly_seasonality_data converted to hypertable';
    END IF;
END $$;

-- Convert yearly_seasonality_data to hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'yearly_seasonality_data'
    ) THEN
        PERFORM create_hypertable('yearly_seasonality_data', 'date', 
            chunk_time_interval => INTERVAL '5 years',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'yearly_seasonality_data converted to hypertable';
    END IF;
END $$;

-- Convert seasonality_data (raw data) to hypertable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'seasonality_data'
    ) THEN
        PERFORM create_hypertable('seasonality_data', 'date', 
            chunk_time_interval => INTERVAL '1 month',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'seasonality_data converted to hypertable';
    END IF;
END $$;

-- =====================================================
-- STEP 2: CREATE COMPOSITE INDEXES FOR FILTER QUERIES
-- These match your AnalysisService filter patterns
-- =====================================================

-- Daily Seasonality Data - Composite indexes for common filter combinations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_ticker_date_return 
    ON daily_seasonality_data (tickerId, date DESC) 
    INCLUDE (returnPercentage, open, high, low, close, volume, positiveDay, weekday);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_ticker_year_positive 
    ON daily_seasonality_data (tickerId, positiveYear, date DESC) 
    WHERE positiveYear IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_ticker_month_positive 
    ON daily_seasonality_data (tickerId, positiveMonth, date DESC) 
    WHERE positiveMonth IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_ticker_weekday 
    ON daily_seasonality_data (tickerId, weekday, date DESC);

-- Monday Weekly Data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monday_ticker_date_return 
    ON monday_weekly_data (tickerId, date DESC) 
    INCLUDE (returnPercentage, open, high, low, close, volume, positiveWeek);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monday_ticker_positive_week 
    ON monday_weekly_data (tickerId, positiveWeek, date DESC) 
    WHERE positiveWeek IS NOT NULL;

-- Expiry Weekly Data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expiry_ticker_date_return 
    ON expiry_weekly_data (tickerId, date DESC) 
    INCLUDE (returnPercentage, open, high, low, close, volume, positiveWeek);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expiry_ticker_positive_week 
    ON expiry_weekly_data (tickerId, positiveWeek, date DESC) 
    WHERE positiveWeek IS NOT NULL;

-- Monthly Seasonality Data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_ticker_date_return 
    ON monthly_seasonality_data (tickerId, date DESC) 
    INCLUDE (returnPercentage, open, high, low, close, volume, positiveMonth);

-- Yearly Seasonality Data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yearly_ticker_date_return 
    ON yearly_seasonality_data (tickerId, date DESC) 
    INCLUDE (returnPercentage, open, high, low, close, volume, positiveYear);

-- =====================================================
-- STEP 3: PARTIAL INDEXES FOR FILTERED QUERIES
-- These speed up queries with specific filter combinations
-- =====================================================

-- Recent data only (last 2 years) - for fast recent queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_recent_data 
    ON daily_seasonality_data (tickerId, date DESC) 
    WHERE date >= CURRENT_DATE - INTERVAL '2 years';

-- Positive days only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_positive_days 
    ON daily_seasonality_data (tickerId, date, returnPercentage) 
    WHERE positiveDay = true;

-- Negative days only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_negative_days 
    ON daily_seasonality_data (tickerId, date, returnPercentage) 
    WHERE positiveDay = false;

-- Election year queries (assuming you store year as a field or calculate it)
-- Note: Add a year column for better performance if you filter by year often

-- =====================================================
-- STEP 4: OPTIMIZE TICKER TABLE
-- =====================================================

-- Covering index for ticker lookups with counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticker_symbol_active_covering 
    ON "Ticker" (symbol, isActive) 
    INCLUDE (id, name, sector, exchange, totalRecords, firstDataDate, lastDataDate);

-- Sector queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticker_sector_active 
    ON "Ticker" (sector, isActive) 
    WHERE isActive = true AND sector IS NOT NULL;

-- =====================================================
-- STEP 5: ANALYSIS RESULT AND CACHE TABLES
-- =====================================================

-- Analysis result indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_result_user_created 
    ON "AnalysisResult" (userId, createdAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_result_expires 
    ON "AnalysisResult" (expiresAt) 
    WHERE expiresAt IS NOT NULL;

-- =====================================================
-- STEP 6: MATERIALIZED VIEWS FOR COMMON AGGREGATIONS
-- Pre-compute expensive aggregations
-- =====================================================

-- Symbol statistics materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_symbol_statistics CASCADE;

CREATE MATERIALIZED VIEW mv_symbol_statistics AS
SELECT 
    t.id as ticker_id,
    t.symbol,
    t.name,
    t.sector,
    COUNT(dsd.id) as total_daily_records,
    MIN(dsd.date) as first_date,
    MAX(dsd.date) as last_date,
    AVG(dsd.close) as avg_close,
    MIN(dsd.close) as min_close,
    MAX(dsd.close) as max_close,
    AVG(dsd.volume) as avg_volume,
    STDDEV(dsd.returnPercentage) as volatility,
    COUNT(CASE WHEN dsd.returnPercentage > 0 THEN 1 END) as positive_days,
    COUNT(CASE WHEN dsd.returnPercentage < 0 THEN 1 END) as negative_days,
    COUNT(CASE WHEN dsd.returnPercentage = 0 THEN 1 END) as neutral_days,
    MAX(dsd.updatedAt) as last_updated
FROM "Ticker" t
LEFT JOIN daily_seasonality_data dsd ON t.id = dsd.tickerId
WHERE t.isActive = true
GROUP BY t.id, t.symbol, t.name, t.sector;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_symbol_stats_ticker_id 
    ON mv_symbol_statistics (ticker_id);

CREATE INDEX idx_mv_symbol_stats_symbol 
    ON mv_symbol_statistics (symbol);

CREATE INDEX idx_mv_symbol_stats_sector 
    ON mv_symbol_statistics (sector);

-- Daily aggregation by weekday materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_weekday_analysis CASCADE;

CREATE MATERIALIZED VIEW mv_weekday_analysis AS
SELECT 
    dsd.tickerId,
    t.symbol,
    dsd.weekday,
    COUNT(*) as occurrence_count,
    AVG(dsd.returnPercentage) as avg_return,
    STDDEV(dsd.returnPercentage) as std_dev,
    MIN(dsd.returnPercentage) as min_return,
    MAX(dsd.returnPercentage) as max_return,
    COUNT(CASE WHEN dsd.returnPercentage > 0 THEN 1 END) as positive_count,
    COUNT(CASE WHEN dsd.returnPercentage < 0 THEN 1 END) as negative_count
FROM daily_seasonality_data dsd
JOIN "Ticker" t ON dsd.tickerId = t.id
WHERE dsd.weekday IS NOT NULL
GROUP BY dsd.tickerId, t.symbol, dsd.weekday;

CREATE UNIQUE INDEX idx_mv_weekday_analysis_unique 
    ON mv_weekday_analysis (tickerId, weekday);

CREATE INDEX idx_mv_weekday_analysis_symbol 
    ON mv_weekday_analysis (symbol);

-- Monthly performance summary
DROP MATERIALIZED VIEW IF EXISTS mv_monthly_performance CASCADE;

CREATE MATERIALIZED VIEW mv_monthly_performance AS
SELECT 
    dsd.tickerId,
    t.symbol,
    EXTRACT(YEAR FROM dsd.date)::int as year,
    EXTRACT(MONTH FROM dsd.date)::int as month,
    COUNT(*) as trading_days,
    AVG(dsd.returnPercentage) as avg_return,
    STDDEV(dsd.returnPercentage) as volatility,
    MIN(dsd.close) as month_low,
    MAX(dsd.close) as month_high,
    (MAX(dsd.close) - MIN(dsd.close)) / NULLIF(MIN(dsd.close), 0) * 100 as month_range_pct,
    COUNT(CASE WHEN dsd.returnPercentage > 0 THEN 1 END) as positive_days,
    COUNT(CASE WHEN dsd.returnPercentage < 0 THEN 1 END) as negative_days
FROM daily_seasonality_data dsd
JOIN "Ticker" t ON dsd.tickerId = t.id
GROUP BY dsd.tickerId, t.symbol, EXTRACT(YEAR FROM dsd.date), EXTRACT(MONTH FROM dsd.date);

CREATE UNIQUE INDEX idx_mv_monthly_perf_unique 
    ON mv_monthly_performance (tickerId, year, month);

-- =====================================================
-- STEP 7: COMPRESSION POLICIES (TimescaleDB)
-- Compress old data to save space and improve queries
-- =====================================================

-- Add compression policy for daily data (compress after 3 months)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'daily_seasonality_data'
    ) THEN
        PERFORM add_compression_policy('daily_seasonality_data', INTERVAL '3 months', 
            if_not_exists => TRUE);
        RAISE NOTICE 'Compression policy added for daily_seasonality_data';
    END IF;
END $$;

-- Add compression policy for weekly data (compress after 6 months)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'monday_weekly_data'
    ) THEN
        PERFORM add_compression_policy('monday_weekly_data', INTERVAL '6 months',
            if_not_exists => TRUE);
        RAISE NOTICE 'Compression policy added for monday_weekly_data';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'expiry_weekly_data'
    ) THEN
        PERFORM add_compression_policy('expiry_weekly_data', INTERVAL '6 months',
            if_not_exists => TRUE);
        RAISE NOTICE 'Compression policy added for expiry_weekly_data';
    END IF;
END $$;

-- =====================================================
-- STEP 8: REFRESH MATERIALIZED VIEWS
-- =====================================================

-- Initial refresh of materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_symbol_statistics;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekday_analysis;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_performance;

-- =====================================================
-- STEP 9: UPDATE STATISTICS
-- =====================================================

-- Update table statistics for query planner
ANALYZE daily_seasonality_data;
ANALYZE monday_weekly_data;
ANALYZE expiry_weekly_data;
ANALYZE monthly_seasonality_data;
ANALYZE yearly_seasonality_data;
ANALYZE "Ticker";
ANALYZE "AnalysisResult";

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check hypertables
SELECT hypertable_name, chunk_time_interval 
FROM timescaledb_information.hypertables;

-- Check indexes on main tables
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
    'daily_seasonality_data', 
    'monday_weekly_data', 
    'expiry_weekly_data',
    'monthly_seasonality_data',
    'yearly_seasonality_data'
)
ORDER BY tablename, indexname;

-- Check materialized views
SELECT schemaname, matviewname, hasindexes
FROM pg_matviews
WHERE schemaname = 'public';

-- Check compression policies
SELECT hypertable_name, compression_enabled
FROM timescaledb_information.hypertables
WHERE compression_enabled = true;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'DATABASE OPTIMIZATION COMPLETE';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'Optimizations applied:';
    RAISE NOTICE '1. TimescaleDB hypertables created for all time-series tables';
    RAISE NOTICE '2. Composite covering indexes added for filter queries';
    RAISE NOTICE '3. Partial indexes added for common filter patterns';
    RAISE NOTICE '4. Materialized views created for aggregations';
    RAISE NOTICE '5. Compression policies enabled for old data';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Update AnalysisService.js to use database-level filtering';
    RAISE NOTICE '2. Schedule regular refresh of materialized views';
    RAISE NOTICE '3. Monitor query performance with pg_stat_statements';
    RAISE NOTICE '==============================================================';
END $$;
