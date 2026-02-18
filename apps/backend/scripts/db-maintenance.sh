#!/bin/bash
# =====================================================
# Database Maintenance Script for Seasonality SaaS
# Run this script regularly (e.g., daily via cron)
# =====================================================

set -e

echo "=============================================================="
echo "Starting Database Maintenance - $(date)"
echo "=============================================================="

# Configuration
DB_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/seasonality}"
LOG_FILE="/var/log/seasonality-db-maintenance.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to run SQL command
run_sql() {
    psql "$DB_URL" -c "$1"
}

log "Connecting to database..."

# =====================================================
# 1. REFRESH MATERIALIZED VIEWS
# =====================================================
log "Refreshing materialized views..."

run_sql "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_symbol_statistics;" || log "WARNING: Failed to refresh mv_symbol_statistics"
run_sql "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekday_analysis;" || log "WARNING: Failed to refresh mv_weekday_analysis"
run_sql "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_performance;" || log "WARNING: Failed to refresh mv_monthly_performance"

log "Materialized views refreshed successfully"

# =====================================================
# 2. VACUUM AND ANALYZE
# =====================================================
log "Running VACUUM ANALYZE on main tables..."

run_sql "VACUUM ANALYZE daily_seasonality_data;"
run_sql "VACUUM ANALYZE monday_weekly_data;"
run_sql "VACUUM ANALYZE expiry_weekly_data;"
run_sql "VACUUM ANALYZE monthly_seasonality_data;"
run_sql "VACUUM ANALYZE yearly_seasonality_data;"
run_sql "VACUUM ANALYZE \"Ticker\";"

log "VACUUM ANALYZE completed"

# =====================================================
# 3. CLEAN UP OLD DATA
# =====================================================
log "Cleaning up old data..."

# Clean up old upload batches (older than 30 days and completed/failed)
run_sql "
    DELETE FROM \"UploadBatch\" 
    WHERE createdAt < NOW() - INTERVAL '30 days' 
    AND status IN ('COMPLETED', 'FAILED');
"

# Clean up old analysis results (older than 7 days and not public)
run_sql "
    DELETE FROM \"AnalysisResult\" 
    WHERE createdAt < NOW() - INTERVAL '7 days' 
    AND isPublic = false;
"

# Clean up expired analysis results
run_sql "
    DELETE FROM \"AnalysisResult\" 
    WHERE expiresAt IS NOT NULL 
    AND expiresAt < NOW();
"

# Clean up old system logs (older than 30 days, keep only errors)
run_sql "
    DELETE FROM \"SystemLog\" 
    WHERE createdAt < NOW() - INTERVAL '30 days' 
    AND level NOT IN ('error', 'warn');
"

log "Data cleanup completed"

# =====================================================
# 4. CHECK FOR MISSING INDEXES
# =====================================================
log "Checking for missing indexes..."

MISSING_INDEXES=$(run_sql "
    SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        CASE 
            WHEN seq_scan > 0 THEN seq_tup_read / seq_scan 
            ELSE 0 
        END AS avg_seq_tup_read
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    AND seq_scan > 100
    AND (idx_scan IS NULL OR seq_scan > idx_scan * 10)
    ORDER BY seq_tup_read DESC
    LIMIT 10;
" 2>/dev/null || echo "No missing indexes found")

if [ -n "$MISSING_INDEXES" ]; then
    log "WARNING: Tables with potential missing indexes detected:"
    echo "$MISSING_INDEXES" | tee -a "$LOG_FILE"
fi

# =====================================================
# 5. CHECK FOR UNUSED INDEXES
# =====================================================
log "Checking for unused indexes..."

UNUSED_INDEXES=$(run_sql "
    SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexname NOT LIKE 'pg_toast%'
    AND indexname NOT LIKE 'pg_%'
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 10;
" 2>/dev/null || echo "No unused indexes found")

if [ -n "$UNUSED_INDEXES" ]; then
    log "INFO: Unused indexes (consider removing if not needed):"
    echo "$UNUSED_INDEXES" | tee -a "$LOG_FILE"
fi

# =====================================================
# 6. COMPRESSION STATUS CHECK
# =====================================================
log "Checking compression status..."

COMPRESSION_STATUS=$(run_sql "
    SELECT 
        hypertable_name,
        compression_enabled,
        num_compressed_chunks,
        num_uncompressed_chunks
    FROM timescaledb_information.hypertables
    WHERE compression_enabled = true;
" 2>/dev/null || echo "No compression data available")

log "Compression status:"
echo "$COMPRESSION_STATUS" | tee -a "$LOG_FILE"

# =====================================================
# 7. DATABASE SIZE REPORT
# =====================================================
log "Generating database size report..."

SIZE_REPORT=$(run_sql "
    SELECT 
        schemaname || '.' || tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 20;
")

log "Database size report:"
echo "$SIZE_REPORT" | tee -a "$LOG_FILE"

# =====================================================
# 8. SLOW QUERY CHECK
# =====================================================
log "Checking for slow queries..."

SLOW_QUERIES=$(run_sql "
    SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        rows
    FROM pg_stat_statements
    WHERE mean_exec_time > 1000  -- Queries taking > 1 second on average
    ORDER BY mean_exec_time DESC
    LIMIT 10;
" 2>/dev/null || echo "pg_stat_statements not available")

if [ -n "$SLOW_QUERIES" ]; then
    log "SLOW QUERIES DETECTED (>1s average):"
    echo "$SLOW_QUERIES" | tee -a "$LOG_FILE"
fi

# =====================================================
# COMPLETION
# =====================================================
log "=============================================================="
log "Database maintenance completed successfully - $(date)"
log "=============================================================="

echo ""
echo "Maintenance log saved to: $LOG_FILE"
