-- Seasonality SaaS Initial Database Setup
-- This migration sets up the complete database schema with TimescaleDB optimizations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Set timezone
SET timezone = 'UTC';

-- =====================================================
-- TIMESCALEDB HYPERTABLE SETUP
-- =====================================================

-- Function to setup hypertables after Prisma creates tables
CREATE OR REPLACE FUNCTION setup_timescale_hypertables()
RETURNS void AS $$
BEGIN
    -- Convert DailyData to hypertable (1 month chunks)
    IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'DailyData') THEN
        SELECT create_hypertable('"DailyData"', 'date', chunk_time_interval => INTERVAL '1 month');
        RAISE NOTICE 'DailyData converted to hypertable';
    END IF;
    
    -- Convert WeeklyData to hypertable (3 month chunks)
    IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'WeeklyData') THEN
        SELECT create_hypertable('"WeeklyData"', 'date', chunk_time_interval => INTERVAL '3 months');
        RAISE NOTICE 'WeeklyData converted to hypertable';
    END IF;
    
    -- Convert MonthlyData to hypertable (1 year chunks)
    IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'MonthlyData') THEN
        SELECT create_hypertable('"MonthlyData"', 'date', chunk_time_interval => INTERVAL '1 year');
        RAISE NOTICE 'MonthlyData converted to hypertable';
    END IF;
    
    -- Convert YearlyData to hypertable (5 year chunks)
    IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'YearlyData') THEN
        SELECT create_hypertable('"YearlyData"', 'date', chunk_time_interval => INTERVAL '5 years');
        RAISE NOTICE 'YearlyData converted to hypertable';
    END IF;
    
    -- Convert CalculatedFields to hypertable (1 month chunks)
    IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'CalculatedFields') THEN
        SELECT create_hypertable('"CalculatedFields"', 'date', chunk_time_interval => INTERVAL '1 month');
        RAISE NOTICE 'CalculatedFields converted to hypertable';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

CREATE OR REPLACE FUNCTION create_performance_indexes()
RETURNS void AS $$
BEGIN
    -- DailyData performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dailydata_ticker_date_desc 
        ON "DailyData" (tickerId, date DESC);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dailydata_date_ticker 
        ON "DailyData" (date DESC, tickerId);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dailydata_close_notnull 
        ON "DailyData" (close) WHERE close IS NOT NULL;
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dailydata_volume_notnull 
        ON "DailyData" (volume) WHERE volume > 0;
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dailydata_return_percentage 
        ON "DailyData" (returnPercentage) WHERE returnPercentage IS NOT NULL;
    
    -- Recent data partial index (last 2 years)
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dailydata_recent 
        ON "DailyData" (tickerId, date DESC) 
        WHERE date >= CURRENT_DATE - INTERVAL '2 years';
    
    -- WeeklyData performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weeklydata_ticker_date_type 
        ON "WeeklyData" (tickerId, date DESC, weekType);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weeklydata_type_date 
        ON "WeeklyData" (weekType, date DESC);
    
    -- MonthlyData performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthlydata_ticker_date_desc 
        ON "MonthlyData" (tickerId, date DESC);
    
    -- YearlyData performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yearlydata_ticker_date_desc 
        ON "YearlyData" (tickerId, date DESC);
    
    -- CalculatedFields performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculatedfields_ticker_date_timeframe 
        ON "CalculatedFields" (tickerId, date DESC, timeframe);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculatedfields_timeframe_date 
        ON "CalculatedFields" (timeframe, date DESC);
    
    -- Ticker performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticker_symbol_active 
        ON "Ticker" (symbol) WHERE isActive = true;
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticker_sector_active 
        ON "Ticker" (sector) WHERE isActive = true AND sector IS NOT NULL;
    
    -- User and API key indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscription_active 
        ON "User" (subscriptionTier, isActive) WHERE isActive = true;
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apikey_hash_active 
        ON "ApiKey" (keyHash) WHERE isActive = true;
    
    -- Upload batch indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploadbatch_user_status 
        ON "UploadBatch" (userId, status);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploadbatch_created_desc 
        ON "UploadBatch" (createdAt DESC);
    
    -- Analysis result indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysisresult_user_type 
        ON "AnalysisResult" (userId, analysisType);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysisresult_expires 
        ON "AnalysisResult" (expiresAt) WHERE expiresAt IS NOT NULL;
    
    -- System log indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_systemlog_level_created 
        ON "SystemLog" (level, createdAt DESC);
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_systemlog_user_created 
        ON "SystemLog" (userId, createdAt DESC) WHERE userId IS NOT NULL;
    
    RAISE NOTICE 'Performance indexes created successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =====================================================

CREATE OR REPLACE FUNCTION create_materialized_views()
RETURNS void AS $$
BEGIN
    -- Symbol statistics materialized view
    CREATE MATERIALIZED VIEW IF NOT EXISTS symbol_statistics AS
    SELECT 
        t.id as ticker_id,
        t.symbol,
        t.name,
        t.sector,
        t.exchange,
        COUNT(dd.id) as total_daily_records,
        MIN(dd.date) as first_date,
        MAX(dd.date) as last_date,
        AVG(dd.close) as avg_close,
        MIN(dd.close) as min_close,
        MAX(dd.close) as max_close,
        AVG(dd.volume) as avg_volume,
        STDDEV(dd.returnPercentage) as volatility,
        COUNT(CASE WHEN dd.returnPercentage > 0 THEN 1 END) as positive_days,
        COUNT(CASE WHEN dd.returnPercentage < 0 THEN 1 END) as negative_days,
        EXTRACT(DAYS FROM (MAX(dd.date) - MIN(dd.date))) as days_span,
        MAX(dd.updatedAt) as last_updated
    FROM "Ticker" t
    LEFT JOIN "DailyData" dd ON t.id = dd.tickerId
    WHERE t.isActive = true
    GROUP BY t.id, t.symbol, t.name, t.sector, t.exchange;
    
    -- Create unique index on materialized view
    CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_stats_ticker_id 
        ON symbol_statistics (ticker_id);
    
    CREATE INDEX IF NOT EXISTS idx_symbol_stats_symbol 
        ON symbol_statistics (symbol);
    
    -- Monthly performance summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_performance_summary AS
    SELECT 
        t.symbol,
        EXTRACT(YEAR FROM dd.date) as year,
        EXTRACT(MONTH FROM dd.date) as month,
        COUNT(*) as trading_days,
        AVG(dd.returnPercentage) as avg_return,
        STDDEV(dd.returnPercentage) as volatility,
        MIN(dd.close) as month_low,
        MAX(dd.close) as month_high,
        (MAX(dd.close) - MIN(dd.close)) / MIN(dd.close) * 100 as month_range_pct,
        COUNT(CASE WHEN dd.returnPercentage > 0 THEN 1 END) as positive_days,
        COUNT(CASE WHEN dd.returnPercentage < 0 THEN 1 END) as negative_days
    FROM "Ticker" t
    JOIN "DailyData" dd ON t.id = dd.tickerId
    WHERE t.isActive = true
    GROUP BY t.symbol, EXTRACT(YEAR FROM dd.date), EXTRACT(MONTH FROM dd.date);
    
    CREATE INDEX IF NOT EXISTS idx_monthly_perf_symbol_year_month 
        ON monthly_performance_summary (symbol, year, month);
    
    RAISE NOTICE 'Materialized views created successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY symbol_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_performance_summary;
    RAISE NOTICE 'Materialized views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trading day numbers
CREATE OR REPLACE FUNCTION calculate_trading_day_of_month(input_date DATE, ticker_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    trading_day INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO trading_day
    FROM "DailyData"
    WHERE tickerId = ticker_id
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM input_date)
      AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM input_date)
      AND date <= input_date;
    
    RETURN COALESCE(trading_day, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trading day of year
CREATE OR REPLACE FUNCTION calculate_trading_day_of_year(input_date DATE, ticker_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    trading_day INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO trading_day
    FROM "DailyData"
    WHERE tickerId = ticker_id
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM input_date)
      AND date <= input_date;
    
    RETURN COALESCE(trading_day, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get database statistics
CREATE OR REPLACE FUNCTION get_database_statistics()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT,
    total_size TEXT,
    last_vacuum TIMESTAMP,
    last_analyze TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) + pg_indexes_size(schemaname||'.'||tablename)) as total_size,
        last_vacuum,
        last_analyze
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Clean up old upload batches (older than 30 days and completed/failed)
    DELETE FROM "UploadBatch" 
    WHERE createdAt < NOW() - INTERVAL '30 days' 
      AND status IN ('COMPLETED', 'FAILED');
    
    -- Clean up old analysis results (older than 7 days and not public)
    DELETE FROM "AnalysisResult" 
    WHERE createdAt < NOW() - INTERVAL '7 days' 
      AND isPublic = false;
    
    -- Clean up old system logs (older than 30 days, keep only errors)
    DELETE FROM "SystemLog" 
    WHERE createdAt < NOW() - INTERVAL '30 days' 
      AND level NOT IN ('error', 'warn');
    
    -- Clean up expired analysis results
    DELETE FROM "AnalysisResult" 
    WHERE expiresAt IS NOT NULL 
      AND expiresAt < NOW();
    
    RAISE NOTICE 'Old data cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPRESSION AND RETENTION POLICIES
-- =====================================================

CREATE OR REPLACE FUNCTION setup_compression_policies()
RETURNS void AS $$
BEGIN
    -- Enable compression on DailyData chunks older than 3 months
    SELECT add_compression_policy('"DailyData"', INTERVAL '3 months');
    
    -- Enable compression on WeeklyData chunks older than 6 months
    SELECT add_compression_policy('"WeeklyData"', INTERVAL '6 months');
    
    -- Enable compression on MonthlyData chunks older than 1 year
    SELECT add_compression_policy('"MonthlyData"', INTERVAL '1 year');
    
    -- Enable compression on YearlyData chunks older than 2 years
    SELECT add_compression_policy('"YearlyData"', INTERVAL '2 years');
    
    -- Enable compression on CalculatedFields chunks older than 3 months
    SELECT add_compression_policy('"CalculatedFields"', INTERVAL '3 months');
    
    RAISE NOTICE 'Compression policies setup completed';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION setup_retention_policies()
RETURNS void AS $$
BEGIN
    -- Keep DailyData for 10 years
    SELECT add_retention_policy('"DailyData"', INTERVAL '10 years');
    
    -- Keep WeeklyData for 15 years
    SELECT add_retention_policy('"WeeklyData"', INTERVAL '15 years');
    
    -- Keep MonthlyData for 20 years
    SELECT add_retention_policy('"MonthlyData"', INTERVAL '20 years');
    
    -- Keep YearlyData for 25 years
    SELECT add_retention_policy('"YearlyData"', INTERVAL '25 years');
    
    -- Keep CalculatedFields for 5 years
    SELECT add_retention_policy('"CalculatedFields"', INTERVAL '5 years');
    
    RAISE NOTICE 'Retention policies setup completed';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Create view for query performance monitoring
CREATE OR REPLACE VIEW query_performance AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Create view for index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'Unused'
        WHEN idx_scan < 100 THEN 'Low Usage'
        WHEN idx_scan < 1000 THEN 'Medium Usage'
        ELSE 'High Usage'
    END as usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- =====================================================
-- NOTIFICATION TRIGGERS
-- =====================================================

-- Function to notify about data changes
CREATE OR REPLACE FUNCTION notify_data_change()
RETURNS trigger AS $$
BEGIN
    -- Notify about data changes for real-time updates
    PERFORM pg_notify('data_change', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'ticker_id', COALESCE(NEW.tickerId, OLD.tickerId),
        'date', COALESCE(NEW.date, OLD.date),
        'timestamp', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIALIZATION COMPLETE MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Seasonality SaaS Database Migration Complete';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Next steps after Prisma migration:';
    RAISE NOTICE '1. Run: SELECT setup_timescale_hypertables();';
    RAISE NOTICE '2. Run: SELECT create_performance_indexes();';
    RAISE NOTICE '3. Run: SELECT create_materialized_views();';
    RAISE NOTICE '4. Run: SELECT setup_compression_policies();';
    RAISE NOTICE '5. Run: SELECT setup_retention_policies();';
    RAISE NOTICE '==============================================';
END $$;