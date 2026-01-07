-- Seasonality SaaS Database Initialization Script
-- This script sets up the initial database structure and optimizations

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create database if it doesn't exist (this runs after database creation)
-- The database is already created by Docker, so we just ensure proper setup

-- Set timezone
SET timezone = 'UTC';

-- Create custom types for better data integrity
DO $$ 
BEGIN
    -- Create enum for user roles if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'user', 'research');
    END IF;
    
    -- Create enum for batch status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_status') THEN
        CREATE TYPE batch_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');
    END IF;
    
    -- Create enum for file status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_status') THEN
        CREATE TYPE file_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
END $$;

-- Performance optimizations for TimescaleDB
-- These will be applied after tables are created by Prisma

-- Function to setup hypertables and optimizations
CREATE OR REPLACE FUNCTION setup_timescale_optimizations()
RETURNS void AS $$
BEGIN
    -- Check if SeasonalityData table exists before creating hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'SeasonalityData') THEN
        -- Convert SeasonalityData to hypertable if not already
        IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'SeasonalityData') THEN
            SELECT create_hypertable('SeasonalityData', 'date', chunk_time_interval => INTERVAL '1 month');
            
            -- Create additional indexes for better query performance
            CREATE INDEX IF NOT EXISTS idx_seasonality_ticker_date ON "SeasonalityData" (tickerId, date DESC);
            CREATE INDEX IF NOT EXISTS idx_seasonality_date_ticker ON "SeasonalityData" (date DESC, tickerId);
            CREATE INDEX IF NOT EXISTS idx_seasonality_close ON "SeasonalityData" (close) WHERE close IS NOT NULL;
            
            -- Create partial indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_seasonality_recent_data ON "SeasonalityData" (tickerId, date DESC) 
                WHERE date >= CURRENT_DATE - INTERVAL '2 years';
        END IF;
        
        -- Set up compression policy (compress chunks older than 3 months)
        SELECT add_compression_policy('SeasonalityData', INTERVAL '3 months');
        
        -- Set up retention policy (keep data for 10 years)
        SELECT add_retention_policy('SeasonalityData', INTERVAL '10 years');
    END IF;
    
    RAISE NOTICE 'TimescaleDB optimizations setup completed';
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate trading days
CREATE OR REPLACE FUNCTION calculate_trading_day_of_month(input_date DATE, ticker_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    trading_day INTEGER;
BEGIN
    -- Calculate trading day of month for given ticker
    SELECT COUNT(*)
    INTO trading_day
    FROM "SeasonalityData"
    WHERE tickerId = ticker_id
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM input_date)
      AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM input_date)
      AND date <= input_date;
    
    RETURN COALESCE(trading_day, 0);
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate trading day of year
CREATE OR REPLACE FUNCTION calculate_trading_day_of_year(input_date DATE, ticker_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    trading_day INTEGER;
BEGIN
    -- Calculate trading day of year for given ticker
    SELECT COUNT(*)
    INTO trading_day
    FROM "SeasonalityData"
    WHERE tickerId = ticker_id
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM input_date)
      AND date <= input_date;
    
    RETURN COALESCE(trading_day, 0);
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for symbol statistics (will be refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS symbol_statistics AS
SELECT 
    t.symbol,
    t.id as ticker_id,
    COUNT(sd.id) as total_records,
    MIN(sd.date) as first_date,
    MAX(sd.date) as last_date,
    AVG(sd.close) as avg_close,
    MIN(sd.close) as min_close,
    MAX(sd.close) as max_close,
    AVG(sd.volume) as avg_volume,
    EXTRACT(DAYS FROM (MAX(sd.date) - MIN(sd.date))) as days_span
FROM "Ticker" t
LEFT JOIN "SeasonalityData" sd ON t.id = sd.tickerId
GROUP BY t.id, t.symbol;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_stats_symbol ON symbol_statistics (symbol);

-- Function to refresh symbol statistics
CREATE OR REPLACE FUNCTION refresh_symbol_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY symbol_statistics;
    RAISE NOTICE 'Symbol statistics refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a view for recent data (last 2 years) for faster queries
CREATE OR REPLACE VIEW recent_seasonality_data AS
SELECT 
    sd.*,
    t.symbol
FROM "SeasonalityData" sd
JOIN "Ticker" t ON sd.tickerId = t.id
WHERE sd.date >= CURRENT_DATE - INTERVAL '2 years';

-- Performance monitoring function
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT,
    total_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins - n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) + pg_indexes_size(schemaname||'.'||tablename)) as total_size
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to clean up old temporary data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Clean up old upload batches (older than 30 days and completed/failed)
    DELETE FROM "UploadBatch" 
    WHERE createdAt < NOW() - INTERVAL '30 days' 
      AND status IN ('COMPLETED', 'FAILED');
    
    -- Clean up orphaned uploaded files
    DELETE FROM "UploadedFile" 
    WHERE batchId NOT IN (SELECT id FROM "UploadBatch");
    
    RAISE NOTICE 'Old data cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Set up connection pooling optimizations
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Enable query logging for performance monitoring (optional)
-- ALTER SYSTEM SET log_statement = 'all';
-- ALTER SYSTEM SET log_duration = on;
-- ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking more than 1 second

-- Create a user for read-only access (for reporting/analytics)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'seasonality_readonly') THEN
        CREATE ROLE seasonality_readonly WITH LOGIN PASSWORD 'readonly123';
        GRANT CONNECT ON DATABASE seasonality TO seasonality_readonly;
        GRANT USAGE ON SCHEMA public TO seasonality_readonly;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO seasonality_readonly;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO seasonality_readonly;
    END IF;
END $$;

-- Create notification function for real-time updates
CREATE OR REPLACE FUNCTION notify_data_change()
RETURNS trigger AS $$
BEGIN
    -- Notify about data changes for real-time updates
    PERFORM pg_notify('data_change', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'ticker_id', COALESCE(NEW.tickerId, OLD.tickerId),
        'timestamp', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Set up triggers for real-time notifications (will be applied after Prisma creates tables)
-- These will be created by a separate script after Prisma migration

RAISE NOTICE 'Database initialization completed successfully';
RAISE NOTICE 'Run setup_timescale_optimizations() after Prisma migration to enable TimescaleDB features';