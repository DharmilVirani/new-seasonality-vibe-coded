-- =====================================================
-- PERFORMANCE MONITORING QUERIES
-- Run these queries to monitor database performance
-- =====================================================

-- 1. CHECK TABLE SIZES AND ROW COUNTS
-- Shows the largest tables and their statistics
SELECT 
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. CHECK INDEX USAGE
-- Shows which indexes are being used and which are not
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED - Consider removing'
        WHEN idx_scan < 100 THEN 'LOW USAGE - Monitor'
        ELSE 'ACTIVE'
    END as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname NOT LIKE 'pg_toast%'
ORDER BY idx_scan DESC;

-- 3. FIND MISSING INDEXES (TABLES WITH HIGH SEQ SCANS)
-- Tables that might benefit from additional indexes
SELECT 
    schemaname,
    tablename,
    seq_scan as sequential_scans,
    seq_tup_read as seq_tuples_read,
    idx_scan as index_scans,
    CASE 
        WHEN seq_scan > 0 THEN seq_tup_read / seq_scan 
        ELSE 0 
    END as avg_tuples_per_scan,
    CASE 
        WHEN seq_scan > 100 AND (idx_scan IS NULL OR seq_scan > idx_scan) 
        THEN 'POTENTIAL MISSING INDEX'
        ELSE 'OK'
    END as recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_tup_read DESC
LIMIT 20;

-- 4. CHECK SLOW QUERIES (Requires pg_stat_statements extension)
-- Shows the slowest queries by average execution time
SELECT 
    substring(query, 1, 100) as query_preview,
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    round(stddev_exec_time::numeric, 2) as stddev_time_ms,
    rows as total_rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 5. CHECK CACHE HIT RATIO
-- Higher is better (should be > 99% for optimal performance)
SELECT 
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'public';

-- 6. CHECK INDEX CACHE HIT RATIO
SELECT 
    sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)) * 100 as index_cache_hit_ratio
FROM pg_statio_user_indexes
WHERE schemaname = 'public';

-- 7. CHECK LOCK CONTENTION
-- Shows queries that might be causing locks
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.relation = blocked_locks.relation
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 8. CHECK CONNECTION COUNT
-- Monitor active connections
SELECT 
    datname as database,
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname;

-- 9. CHECK TIMESCALEDB CHUNK INFORMATION
-- Shows hypertable chunk distribution
SELECT 
    hypertable_name,
    chunk_name,
    range_start,
    range_end,
    pg_size_pretty(d.total_bytes) as size,
    d.total_bytes
FROM timescaledb_information.chunks c
JOIN hypertable_chunk_local_size d ON c.chunk_name = d.chunk_name
ORDER BY hypertable_name, range_start;

-- 10. CHECK COMPRESSION STATUS
-- Shows compression statistics for hypertables
SELECT 
    h.hypertable_name,
    h.compression_enabled,
    count(c.chunk_name) FILTER (WHERE c.is_compressed) as compressed_chunks,
    count(c.chunk_name) FILTER (WHERE NOT c.is_compressed) as uncompressed_chunks,
    pg_size_pretty(sum(d.total_bytes) FILTER (WHERE c.is_compressed)) as compressed_size,
    pg_size_pretty(sum(d.total_bytes) FILTER (WHERE NOT c.is_compressed)) as uncompressed_size
FROM timescaledb_information.hypertables h
LEFT JOIN timescaledb_information.chunks c ON h.hypertable_name = c.hypertable_name
LEFT JOIN hypertable_chunk_local_size d ON c.chunk_name = d.chunk_name
GROUP BY h.hypertable_name, h.compression_enabled
ORDER BY h.hypertable_name;

-- 11. CHECK FOR BLOAT (Estimated)
-- High bloat can slow down queries
SELECT 
    schemaname,
    tablename,
    n_dead_tup as dead_tuples,
    n_live_tup as live_tuples,
    round(n_dead_tup::numeric / nullif(n_live_tup, 0) * 100, 2) as dead_tuple_ratio,
    CASE 
        WHEN n_dead_tup::numeric / nullif(n_live_tup, 0) > 0.1 
        THEN 'VACUUM RECOMMENDED'
        ELSE 'OK'
    END as recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND n_live_tup > 1000
ORDER BY dead_tuple_ratio DESC
LIMIT 20;

-- 12. CHECK QUERY PERFORMANCE BY TABLE
-- Shows which tables have the most query activity
SELECT 
    schemaname,
    tablename,
    seq_scan + idx_scan as total_scans,
    seq_scan as seq_scans,
    idx_scan as index_scans,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_tup_hot_upd as hot_updates
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY total_scans DESC
LIMIT 20;
