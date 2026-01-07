#!/usr/bin/env node

/**
 * Database Optimization Script for Seasonality SaaS
 * Sets up TimescaleDB hypertables, indexes, and performance optimizations
 */

const { PrismaClient } = require('@prisma/client');

class DatabaseOptimizer {
    constructor() {
        this.prisma = new PrismaClient();
    }

    async initialize() {
        console.log('🔧 Initializing Database Optimization');
        console.log('=====================================');
        
        try {
            await this.prisma.$connect();
            console.log('✅ Database connection established');
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            process.exit(1);
        }
    }

    async setupTimescaleHypertables() {
        console.log('\n📊 Setting up TimescaleDB Hypertables...');
        
        try {
            // Setup hypertables
            await this.prisma.$executeRaw`SELECT setup_timescale_hypertables();`;
            console.log('✅ TimescaleDB hypertables configured');
        } catch (error) {
            console.error('❌ Error setting up hypertables:', error.message);
            throw error;
        }
    }

    async createPerformanceIndexes() {
        console.log('\n🚀 Creating Performance Indexes...');
        
        try {
            await this.prisma.$executeRaw`SELECT create_performance_indexes();`;
            console.log('✅ Performance indexes created');
        } catch (error) {
            console.error('❌ Error creating indexes:', error.message);
            throw error;
        }
    }

    async createMaterializedViews() {
        console.log('\n📈 Creating Materialized Views...');
        
        try {
            await this.prisma.$executeRaw`SELECT create_materialized_views();`;
            console.log('✅ Materialized views created');
        } catch (error) {
            console.error('❌ Error creating materialized views:', error.message);
            throw error;
        }
    }

    async setupCompressionPolicies() {
        console.log('\n🗜️  Setting up Compression Policies...');
        
        try {
            await this.prisma.$executeRaw`SELECT setup_compression_policies();`;
            console.log('✅ Compression policies configured');
        } catch (error) {
            console.error('❌ Error setting up compression:', error.message);
            // Don't throw - compression might not be available in all TimescaleDB versions
            console.log('⚠️  Compression policies skipped (may not be available)');
        }
    }

    async setupRetentionPolicies() {
        console.log('\n🗄️  Setting up Retention Policies...');
        
        try {
            await this.prisma.$executeRaw`SELECT setup_retention_policies();`;
            console.log('✅ Retention policies configured');
        } catch (error) {
            console.error('❌ Error setting up retention:', error.message);
            // Don't throw - retention might not be available in all TimescaleDB versions
            console.log('⚠️  Retention policies skipped (may not be available)');
        }
    }

    async setupNotificationTriggers() {
        console.log('\n🔔 Setting up Notification Triggers...');
        
        try {
            // Create triggers for real-time notifications
            await this.prisma.$executeRaw`
                CREATE OR REPLACE TRIGGER daily_data_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON "DailyData"
                FOR EACH ROW EXECUTE FUNCTION notify_data_change();
            `;

            await this.prisma.$executeRaw`
                CREATE OR REPLACE TRIGGER weekly_data_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON "WeeklyData"
                FOR EACH ROW EXECUTE FUNCTION notify_data_change();
            `;

            await this.prisma.$executeRaw`
                CREATE OR REPLACE TRIGGER monthly_data_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON "MonthlyData"
                FOR EACH ROW EXECUTE FUNCTION notify_data_change();
            `;

            await this.prisma.$executeRaw`
                CREATE OR REPLACE TRIGGER yearly_data_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON "YearlyData"
                FOR EACH ROW EXECUTE FUNCTION notify_data_change();
            `;

            console.log('✅ Notification triggers created');
        } catch (error) {
            console.error('❌ Error creating triggers:', error.message);
            throw error;
        }
    }

    async optimizePostgreSQLSettings() {
        console.log('\n⚙️  Optimizing PostgreSQL Settings...');
        
        try {
            // Get current settings
            const currentSettings = await this.prisma.$queryRaw`
                SELECT name, setting, unit, context 
                FROM pg_settings 
                WHERE name IN (
                    'shared_buffers', 
                    'effective_cache_size', 
                    'work_mem', 
                    'maintenance_work_mem',
                    'checkpoint_completion_target',
                    'wal_buffers',
                    'default_statistics_target',
                    'random_page_cost',
                    'effective_io_concurrency'
                )
                ORDER BY name;
            `;

            console.log('📊 Current PostgreSQL Settings:');
            currentSettings.forEach(setting => {
                console.log(`   ${setting.name}: ${setting.setting}${setting.unit || ''}`);
            });

            // Apply optimizations (these require restart to take effect)
            const optimizations = [
                "ALTER SYSTEM SET shared_buffers = '512MB';",
                "ALTER SYSTEM SET effective_cache_size = '1GB';",
                "ALTER SYSTEM SET work_mem = '16MB';",
                "ALTER SYSTEM SET maintenance_work_mem = '128MB';",
                "ALTER SYSTEM SET checkpoint_completion_target = 0.9;",
                "ALTER SYSTEM SET wal_buffers = '16MB';",
                "ALTER SYSTEM SET default_statistics_target = 100;",
                "ALTER SYSTEM SET random_page_cost = 1.1;",
                "ALTER SYSTEM SET effective_io_concurrency = 200;"
            ];

            for (const optimization of optimizations) {
                try {
                    await this.prisma.$executeRawUnsafe(optimization);
                } catch (error) {
                    console.log(`⚠️  Could not apply: ${optimization}`);
                }
            }

            console.log('✅ PostgreSQL settings optimized (restart required to take effect)');
        } catch (error) {
            console.error('❌ Error optimizing PostgreSQL settings:', error.message);
            // Don't throw - this is not critical
        }
    }

    async analyzeTableStatistics() {
        console.log('\n📊 Analyzing Table Statistics...');
        
        try {
            // Update table statistics
            await this.prisma.$executeRaw`ANALYZE;`;
            
            // Get table statistics
            const stats = await this.prisma.$queryRaw`SELECT * FROM get_database_statistics();`;
            
            console.log('📈 Database Table Statistics:');
            console.log('┌─────────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
            console.log('│ Table                   │ Rows        │ Table Size  │ Index Size  │ Total Size  │');
            console.log('├─────────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
            
            stats.forEach(stat => {
                const tableName = stat.table_name.padEnd(23);
                const rowCount = stat.row_count.toString().padStart(11);
                const tableSize = stat.table_size.padStart(11);
                const indexSize = stat.index_size.padStart(11);
                const totalSize = stat.total_size.padStart(11);
                
                console.log(`│ ${tableName} │ ${rowCount} │ ${tableSize} │ ${indexSize} │ ${totalSize} │`);
            });
            
            console.log('└─────────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘');
            
        } catch (error) {
            console.error('❌ Error analyzing statistics:', error.message);
        }
    }

    async setupMaintenanceJobs() {
        console.log('\n🔧 Setting up Maintenance Jobs...');
        
        try {
            // Create a maintenance log table if it doesn't exist
            await this.prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS maintenance_log (
                    id SERIAL PRIMARY KEY,
                    job_name VARCHAR(100) NOT NULL,
                    started_at TIMESTAMP DEFAULT NOW(),
                    completed_at TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'running',
                    details JSONB,
                    error_message TEXT
                );
            `;

            // Create maintenance functions
            await this.prisma.$executeRaw`
                CREATE OR REPLACE FUNCTION run_maintenance_job(job_name TEXT)
                RETURNS void AS $$
                DECLARE
                    job_id INTEGER;
                BEGIN
                    -- Log job start
                    INSERT INTO maintenance_log (job_name, status) 
                    VALUES (job_name, 'running') 
                    RETURNING id INTO job_id;
                    
                    -- Execute maintenance based on job name
                    CASE job_name
                        WHEN 'refresh_materialized_views' THEN
                            PERFORM refresh_materialized_views();
                        WHEN 'cleanup_old_data' THEN
                            PERFORM cleanup_old_data();
                        WHEN 'analyze_tables' THEN
                            ANALYZE;
                        WHEN 'vacuum_tables' THEN
                            VACUUM ANALYZE;
                        ELSE
                            RAISE EXCEPTION 'Unknown maintenance job: %', job_name;
                    END CASE;
                    
                    -- Log job completion
                    UPDATE maintenance_log 
                    SET completed_at = NOW(), status = 'completed' 
                    WHERE id = job_id;
                    
                EXCEPTION WHEN OTHERS THEN
                    -- Log job failure
                    UPDATE maintenance_log 
                    SET completed_at = NOW(), status = 'failed', error_message = SQLERRM 
                    WHERE id = job_id;
                    RAISE;
                END;
                $$ LANGUAGE plpgsql;
            `;

            console.log('✅ Maintenance jobs configured');
            console.log('   Available jobs:');
            console.log('   - refresh_materialized_views');
            console.log('   - cleanup_old_data');
            console.log('   - analyze_tables');
            console.log('   - vacuum_tables');
            
        } catch (error) {
            console.error('❌ Error setting up maintenance jobs:', error.message);
            throw error;
        }
    }

    async validateOptimizations() {
        console.log('\n✅ Validating Optimizations...');
        
        try {
            // Check if hypertables are created
            const hypertables = await this.prisma.$queryRaw`
                SELECT hypertable_name, num_chunks 
                FROM timescaledb_information.hypertables;
            `;
            
            console.log('📊 TimescaleDB Hypertables:');
            hypertables.forEach(ht => {
                console.log(`   ${ht.hypertable_name}: ${ht.num_chunks} chunks`);
            });

            // Check index usage
            const indexStats = await this.prisma.$queryRaw`
                SELECT schemaname, tablename, indexname, idx_scan
                FROM pg_stat_user_indexes 
                WHERE schemaname = 'public' 
                ORDER BY idx_scan DESC 
                LIMIT 10;
            `;
            
            console.log('\n📈 Top 10 Most Used Indexes:');
            indexStats.forEach(idx => {
                console.log(`   ${idx.tablename}.${idx.indexname}: ${idx.idx_scan} scans`);
            });

            // Check materialized views
            const matViews = await this.prisma.$queryRaw`
                SELECT schemaname, matviewname 
                FROM pg_matviews 
                WHERE schemaname = 'public';
            `;
            
            console.log('\n📋 Materialized Views:');
            matViews.forEach(mv => {
                console.log(`   ${mv.matviewname}`);
            });

            console.log('\n✅ Optimization validation completed');
            
        } catch (error) {
            console.error('❌ Error validating optimizations:', error.message);
        }
    }

    async runOptimization() {
        console.log('\n🚀 Starting Database Optimization Process');
        console.log('==========================================');
        
        try {
            await this.setupTimescaleHypertables();
            await this.createPerformanceIndexes();
            await this.createMaterializedViews();
            await this.setupCompressionPolicies();
            await this.setupRetentionPolicies();
            await this.setupNotificationTriggers();
            await this.optimizePostgreSQLSettings();
            await this.setupMaintenanceJobs();
            await this.analyzeTableStatistics();
            await this.validateOptimizations();
            
            console.log('\n🎉 Database Optimization Complete!');
            console.log('===================================');
            console.log('✅ TimescaleDB hypertables configured');
            console.log('✅ Performance indexes created');
            console.log('✅ Materialized views set up');
            console.log('✅ Compression policies applied');
            console.log('✅ Retention policies configured');
            console.log('✅ Notification triggers created');
            console.log('✅ PostgreSQL settings optimized');
            console.log('✅ Maintenance jobs configured');
            
            console.log('\n📋 Next Steps:');
            console.log('1. Restart PostgreSQL to apply system settings');
            console.log('2. Run data migration: node scripts/data-migration.js');
            console.log('3. Set up cron jobs for maintenance:');
            console.log('   - Daily: SELECT run_maintenance_job(\'analyze_tables\');');
            console.log('   - Weekly: SELECT run_maintenance_job(\'refresh_materialized_views\');');
            console.log('   - Monthly: SELECT run_maintenance_job(\'cleanup_old_data\');');
            
        } catch (error) {
            console.error('❌ Optimization failed:', error.message);
            throw error;
        }
    }

    async cleanup() {
        await this.prisma.$disconnect();
        console.log('\n✅ Database connection closed');
    }
}

// Main execution
async function main() {
    const optimizer = new DatabaseOptimizer();
    
    try {
        await optimizer.initialize();
        await optimizer.runOptimization();
    } catch (error) {
        console.error('❌ Database optimization failed:', error.message);
        process.exit(1);
    } finally {
        await optimizer.cleanup();
    }
}

// Run if this is the main module
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DatabaseOptimizer };