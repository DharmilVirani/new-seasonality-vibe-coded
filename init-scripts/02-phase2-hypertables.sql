-- Phase 2 Hypertables Setup for Research Team Uploads
-- This script sets up hypertables for WeeklySeasonalityData, MonthlySeasonalityData, and YearlySeasonalityData
-- Run this after research team upload tables are created by Prisma

-- Function to setup Phase 2 hypertables and optimizations
CREATE OR REPLACE FUNCTION setup_phase2_hypertables()
RETURNS void AS $$
BEGIN
    -- WeeklySeasonalityData hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'WeeklySeasonalityData') THEN
        IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'WeeklySeasonalityData') THEN
            SELECT create_hypertable('WeeklySeasonalityData', 'date', chunk_time_interval => INTERVAL '3 months');
            
            -- Create indexes for weekly data
            CREATE INDEX IF NOT EXISTS idx_weekly_seasonality_ticker_date ON "WeeklySeasonalityData" (tickerId, date DESC);
            CREATE INDEX IF NOT EXISTS idx_weekly_seasonality_week_type ON "WeeklySeasonalityData" (weekType, tickerId, date DESC);
            CREATE INDEX IF NOT EXISTS idx_weekly_seasonality_returns ON "WeeklySeasonalityData" (returnPercentage) WHERE returnPercentage IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_weekly_seasonality_positive ON "WeeklySeasonalityData" (positiveWeek, tickerId) WHERE positiveWeek IS NOT NULL;
            
            -- Set up compression and retention policies
            SELECT add_compression_policy('WeeklySeasonalityData', INTERVAL '6 months');
            SELECT add_retention_policy('WeeklySeasonalityData', INTERVAL '15 years');
            
            RAISE NOTICE 'WeeklySeasonalityData hypertable created successfully';
        ELSE
            RAISE NOTICE 'WeeklySeasonalityData hypertable already exists';
        END IF;
    ELSE
        RAISE NOTICE 'WeeklySeasonalityData table does not exist yet';
    END IF;
    
    -- MonthlySeasonalityData hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'MonthlySeasonalityData') THEN
        IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'MonthlySeasonalityData') THEN
            SELECT create_hypertable('MonthlySeasonalityData', 'date', chunk_time_interval => INTERVAL '1 year');
            
            -- Create indexes for monthly data
            CREATE INDEX IF NOT EXISTS idx_monthly_seasonality_ticker_date ON "MonthlySeasonalityData" (tickerId, date DESC);
            CREATE INDEX IF NOT EXISTS idx_monthly_seasonality_returns ON "MonthlySeasonalityData" (returnPercentage) WHERE returnPercentage IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_monthly_seasonality_even_month ON "MonthlySeasonalityData" (evenMonth, tickerId) WHERE evenMonth IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_monthly_seasonality_positive ON "MonthlySeasonalityData" (positiveMonth, tickerId) WHERE positiveMonth IS NOT NULL;
            
            -- Set up compression and retention policies
            SELECT add_compression_policy('MonthlySeasonalityData', INTERVAL '1 year');
            SELECT add_retention_policy('MonthlySeasonalityData', INTERVAL '20 years');
            
            RAISE NOTICE 'MonthlySeasonalityData hypertable created successfully';
        ELSE
            RAISE NOTICE 'MonthlySeasonalityData hypertable already exists';
        END IF;
    ELSE
        RAISE NOTICE 'MonthlySeasonalityData table does not exist yet';
    END IF;
    
    -- YearlySeasonalityData hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'YearlySeasonalityData') THEN
        IF NOT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'YearlySeasonalityData') THEN
            SELECT create_hypertable('YearlySeasonalityData', 'date', chunk_time_interval => INTERVAL '5 years');
            
            -- Create indexes for yearly data
            CREATE INDEX IF NOT EXISTS idx_yearly_seasonality_ticker_date ON "YearlySeasonalityData" (tickerId, date DESC);
            CREATE INDEX IF NOT EXISTS idx_yearly_seasonality_returns ON "YearlySeasonalityData" (returnPercentage) WHERE returnPercentage IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_yearly_seasonality_even_year ON "YearlySeasonalityData" (evenYear, tickerId) WHERE evenYear IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_yearly_seasonality_positive ON "YearlySeasonalityData" (positiveYear, tickerId) WHERE positiveYear IS NOT NULL;
            
            -- Set up compression and retention policies
            SELECT add_compression_policy('YearlySeasonalityData', INTERVAL '2 years');
            SELECT add_retention_policy('YearlySeasonalityData', INTERVAL '25 years');
            
            RAISE NOTICE 'YearlySeasonalityData hypertable created successfully';
        ELSE
            RAISE NOTICE 'YearlySeasonalityData hypertable already exists';
        END IF;
    ELSE
        RAISE NOTICE 'YearlySeasonalityData table does not exist yet';
    END IF;
    
    RAISE NOTICE 'Phase 2 hypertables setup completed';
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for comprehensive symbol statistics (Phase 1 + Phase 2)
CREATE OR REPLACE VIEW comprehensive_symbol_statistics AS
SELECT 
    t.symbol,
    t.id as ticker_id,
    
    -- Phase 1 data (current)
    COALESCE(basic_stats.total_records, 0) as basic_records,
    basic_stats.first_date as basic_first_date,
    basic_stats.last_date as basic_last_date,
    basic_stats.avg_close as avg_close,
    
    -- Phase 2 data (future)
    COALESCE(weekly_stats.total_records, 0) as weekly_records,
    COALESCE(monthly_stats.total_records, 0) as monthly_records,
    COALESCE(yearly_stats.total_records, 0) as yearly_records,
    
    -- Combined statistics
    COALESCE(basic_stats.total_records, 0) + 
    COALESCE(weekly_stats.total_records, 0) + 
    COALESCE(monthly_stats.total_records, 0) + 
    COALESCE(yearly_stats.total_records, 0) as total_all_records,
    
    -- Data availability flags
    CASE WHEN basic_stats.total_records > 0 THEN true ELSE false END as has_basic_data,
    CASE WHEN weekly_stats.total_records > 0 THEN true ELSE false END as has_weekly_data,
    CASE WHEN monthly_stats.total_records > 0 THEN true ELSE false END as has_monthly_data,
    CASE WHEN yearly_stats.total_records > 0 THEN true ELSE false END as has_yearly_data
    
FROM "Ticker" t

-- Phase 1 basic data statistics
LEFT JOIN (
    SELECT 
        tickerId,
        COUNT(*) as total_records,
        MIN(date) as first_date,
        MAX(date) as last_date,
        AVG(close) as avg_close
    FROM "SeasonalityData"
    GROUP BY tickerId
) basic_stats ON t.id = basic_stats.tickerId

-- Phase 2 weekly data statistics
LEFT JOIN (
    SELECT 
        tickerId,
        COUNT(*) as total_records,
        MIN(date) as first_date,
        MAX(date) as last_date
    FROM "WeeklySeasonalityData"
    GROUP BY tickerId
) weekly_stats ON t.id = weekly_stats.tickerId

-- Phase 2 monthly data statistics
LEFT JOIN (
    SELECT 
        tickerId,
        COUNT(*) as total_records,
        MIN(date) as first_date,
        MAX(date) as last_date
    FROM "MonthlySeasonalityData"
    GROUP BY tickerId
) monthly_stats ON t.id = monthly_stats.tickerId

-- Phase 2 yearly data statistics
LEFT JOIN (
    SELECT 
        tickerId,
        COUNT(*) as total_records,
        MIN(date) as first_date,
        MAX(date) as last_date
    FROM "YearlySeasonalityData"
    GROUP BY tickerId
) yearly_stats ON t.id = yearly_stats.tickerId;

-- Function to get Phase 2 data upload status
CREATE OR REPLACE FUNCTION get_phase2_upload_status()
RETURNS TABLE (
    phase TEXT,
    table_name TEXT,
    exists BOOLEAN,
    is_hypertable BOOLEAN,
    record_count BIGINT,
    symbols_count BIGINT,
    date_range_start DATE,
    date_range_end DATE
) AS $$
BEGIN
    -- Check WeeklySeasonalityData
    RETURN QUERY
    SELECT 
        'Phase 2'::TEXT as phase,
        'WeeklySeasonalityData'::TEXT as table_name,
        EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'WeeklySeasonalityData') as exists,
        EXISTS(SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'WeeklySeasonalityData') as is_hypertable,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'WeeklySeasonalityData') 
            THEN (SELECT COUNT(*) FROM "WeeklySeasonalityData")
            ELSE 0
        END as record_count,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'WeeklySeasonalityData') 
            THEN (SELECT COUNT(DISTINCT tickerId) FROM "WeeklySeasonalityData")
            ELSE 0
        END as symbols_count,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'WeeklySeasonalityData') 
            THEN (SELECT MIN(date) FROM "WeeklySeasonalityData")
            ELSE NULL
        END as date_range_start,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'WeeklySeasonalityData') 
            THEN (SELECT MAX(date) FROM "WeeklySeasonalityData")
            ELSE NULL
        END as date_range_end;
    
    -- Check MonthlySeasonalityData
    RETURN QUERY
    SELECT 
        'Phase 2'::TEXT as phase,
        'MonthlySeasonalityData'::TEXT as table_name,
        EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'MonthlySeasonalityData') as exists,
        EXISTS(SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'MonthlySeasonalityData') as is_hypertable,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'MonthlySeasonalityData') 
            THEN (SELECT COUNT(*) FROM "MonthlySeasonalityData")
            ELSE 0
        END as record_count,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'MonthlySeasonalityData') 
            THEN (SELECT COUNT(DISTINCT tickerId) FROM "MonthlySeasonalityData")
            ELSE 0
        END as symbols_count,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'MonthlySeasonalityData') 
            THEN (SELECT MIN(date) FROM "MonthlySeasonalityData")
            ELSE NULL
        END as date_range_start,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'MonthlySeasonalityData') 
            THEN (SELECT MAX(date) FROM "MonthlySeasonalityData")
            ELSE NULL
        END as date_range_end;
    
    -- Check YearlySeasonalityData
    RETURN QUERY
    SELECT 
        'Phase 2'::TEXT as phase,
        'YearlySeasonalityData'::TEXT as table_name,
        EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'YearlySeasonalityData') as exists,
        EXISTS(SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'YearlySeasonalityData') as is_hypertable,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'YearlySeasonalityData') 
            THEN (SELECT COUNT(*) FROM "YearlySeasonalityData")
            ELSE 0
        END as record_count,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'YearlySeasonalityData') 
            THEN (SELECT COUNT(DISTINCT tickerId) FROM "YearlySeasonalityData")
            ELSE 0
        END as symbols_count,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'YearlySeasonalityData') 
            THEN (SELECT MIN(date) FROM "YearlySeasonalityData")
            ELSE NULL
        END as date_range_start,
        CASE 
            WHEN EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'YearlySeasonalityData') 
            THEN (SELECT MAX(date) FROM "YearlySeasonalityData")
            ELSE NULL
        END as date_range_end;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Phase 2 hypertables script loaded successfully';
RAISE NOTICE 'Run setup_phase2_hypertables() after Prisma creates the Phase 2 tables';
RAISE NOTICE 'Use get_phase2_upload_status() to check Phase 2 data availability';