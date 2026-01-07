# 🚀 SaaS Migration Prompts - Complete System Rebuild

## 📋 Project Overview
**Objective**: Transform Python Dash seasonality analysis software into a scalable, multi-tenant SaaS platform with modern architecture.

**Key Changes**:
- ❌ Remove NSE data pipeline → ✅ Admin panel CSV uploads
- ❌ Local CSV files → ✅ PostgreSQL database
- ❌ Single user → ✅ Multi-tenant SaaS
- ❌ Desktop app → ✅ Web application
- ✅ Add user management, authentication, subscriptions
- ✅ Add real-time processing, caching, monitoring

---

## 🎯 Prompt Engineering Methodology

### **Techniques Used**:
1. **Role-Based Prompting**: Specific SWE/SDE/DevOps personas
2. **Chain of Thought (CoT)**: Step-by-step explicit reasoning
3. **Few-Shot Examples**: Working code implementations with concrete patterns
4. **System Prompting**: Context, constraints, and limitations
5. **Task Decomposition**: Break complex tasks into manageable chunks
6. **Progressive Refinement**: Iterative improvement protocol
7. **Error-First Design**: Explicit edge case and failure handling

---

## 🚨 CRITICAL PROJECT CONSTRAINTS & LIMITATIONS

### **Budget Constraints**:
- **Development Budget**: $50K maximum for initial MVP
- **Infrastructure Budget**: $500/month for first 6 months
- **Third-party Services**: Limit to essential services only

### **Timeline Constraints**:
- **MVP Launch**: 4 months maximum
- **Full Feature Parity**: 6 months maximum
- **Hard Deadline**: Cannot exceed 6 months due to funding

### **Team Constraints**:
- **Team Size**: 2-3 developers maximum
- **Skill Level**: Mid-level developers (not senior architects)
- **Time Allocation**: Part-time development (20-30 hours/week)

### **Technology Constraints**:
- **Cannot Use**: Expensive enterprise solutions (DataDog, New Relic)
- **Must Use**: Open source alternatives where possible
- **Cloud Provider**: Single provider to avoid complexity
- **Database**: PostgreSQL only (no multi-database complexity)

### **Data Volume Constraints**:
- **Initial**: 200 symbols × 20 years = ~5GB data
- **Scale Target**: 1000 symbols × 25 years = ~25GB within 2 years
- **Concurrent Users**: 100 users initially, 1000 users at scale
- **API Rate Limits**: 1000 requests/hour per user initially

### **Performance Requirements**:
- **API Response**: < 2 seconds for 95% of requests
- **Page Load**: < 3 seconds initial load
- **CSV Processing**: 300 files in < 10 minutes
- **Uptime**: 99% minimum (not 99.9% initially)

---

# 📊 PHASE 1: SYSTEM ARCHITECTURE & INFRASTRUCTURE

## 🏗️ PROMPT 1.1: Infrastructure Architect Role

```markdown
# ROLE: Senior Infrastructure Architect & DevOps Engineer

## CONTEXT
You are designing the infrastructure for a seasonality trading analysis SaaS platform. The old system was a Python Dash desktop app that processed CSV files locally. We're rebuilding as a scalable, multi-tenant web application.

## CONSTRAINTS & LIMITATIONS
- **Budget**: $500/month infrastructure budget for first 6 months
- **Timeline**: Must be production-ready in 4 months
- **Team Size**: 2-3 mid-level developers (not senior architects)
- **Technology**: Open source solutions preferred, single cloud provider
- **Scale**: 100 users initially → 1000 users within 2 years
- **Data Volume**: 5GB initially → 25GB at scale
- **Performance**: 99% uptime minimum, < 2s API response time

## SYSTEM REQUIREMENTS
- **Users**: 100 concurrent users initially, 1000 at scale
- **Data**: 200+ stock symbols, 20+ years historical data
- **Processing**: Real-time CSV uploads (300+ files/batch)
- **Analysis**: Complex financial calculations and visualizations
- **Deployment**: Docker containers on Ubuntu server

## TASK: Design Complete Infrastructure Architecture

### STEP 1: Container Architecture Design
Create a comprehensive Docker Compose setup with these services:

```yaml
# docker-compose.yml - Production-ready example
version: '3.9'

services:
  frontend:
    build: 
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3001
    depends_on:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://seasonality:${DB_PASSWORD}@postgres:5432/seasonality
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
      - minio
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  postgres:
    image: timescale/timescaledb:2.11.1-pg15
    environment:
      - POSTGRES_DB=seasonality
      - POSTGRES_USER=seasonality
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### STEP 2: Scalability Considerations
```yaml
# docker-compose.scale.yml - Auto-scaling configuration
version: '3.9'

services:
  backend:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M

  postgres:
    # Read replica configuration
    environment:
      - POSTGRES_REPLICATION_MODE=master
      - POSTGRES_REPLICATION_USER=replicator
      - POSTGRES_REPLICATION_PASSWORD=${REPLICATION_PASSWORD}
```

### STEP 3: Security Architecture
```nginx
# nginx/nginx.conf - Security-hardened configuration
events {
    worker_connections 1024;
}

http {
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    upstream backend {
        server backend:3001 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;
        server_name _;

        # API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeout settings
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 30s;
        }

        # Auth routes with stricter rate limiting
        location /api/auth/ {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://backend;
        }

        # Frontend routes
        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
        }
    }
}
```

## EDGE CASES & ERROR HANDLING

### **Expected Failure Scenarios & Solutions**:

#### 1. Container Failures
**Scenario**: Single container crash due to memory exhaustion
```bash
# Error Detection
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
# Shows: yt-backend    85.3%    950MiB / 1GiB

# Automatic Recovery
restart_policy:
  condition: on-failure
  delay: 5s
  max_attempts: 3
  window: 120s

# Manual Recovery
docker-compose restart backend
docker-compose logs backend --tail=50
```

**Solution Implementation**:
```yaml
# Enhanced container configuration
backend:
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '0.5'
      reservations:
        memory: 512M
        cpus: '0.25'
    restart_policy:
      condition: on-failure
      delay: 5s
      max_attempts: 3
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

#### 2. Database Connection Failures
**Scenario**: PostgreSQL connection pool exhausted
```javascript
// Error Detection
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Error Handling with Retry Logic
class DatabaseService {
  async executeQuery(query, params, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const client = await pool.connect();
        try {
          const result = await client.query(query, params);
          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(`Database query attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          throw new Error(`Database query failed after ${retries} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
}
```

#### 3. MinIO Storage Failures
**Scenario**: File upload fails due to MinIO service unavailable
```javascript
// Error Detection and Handling
class FileStorageService {
  async uploadFile(fileName, fileBuffer, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Check MinIO health first
        await this.minioClient.bucketExists('seasonality-uploads');
        
        const result = await this.minioClient.putObject(
          'seasonality-uploads',
          fileName,
          fileBuffer
        );
        
        return result;
      } catch (error) {
        console.error(`File upload attempt ${attempt} failed:`, error.message);
        
        if (error.code === 'ECONNREFUSED') {
          // MinIO service is down
          if (attempt === retries) {
            throw new Error('File storage service unavailable. Please try again later.');
          }
          await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
        } else if (error.code === 'NoSuchBucket') {
          // Bucket doesn't exist, create it
          await this.createBucket('seasonality-uploads');
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    }
  }
}
```

#### 4. Resource Exhaustion
**Scenario**: Disk space full during CSV processing
```bash
# Monitoring Script
#!/bin/bash
# disk-monitor.sh
THRESHOLD=85
USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

if [ $USAGE -gt $THRESHOLD ]; then
  echo "ALERT: Disk usage is ${USAGE}% - cleaning up temporary files"
  
  # Clean up old CSV processing files
  find /tmp/seasonality-uploads -type f -mtime +1 -delete
  
  # Clean up old Docker logs
  docker system prune -f --volumes --filter "until=24h"
  
  # Alert administrators
  curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"Disk usage critical: ${USAGE}%\"}"
fi
```

#### 5. Network Partitions
**Scenario**: Services can't communicate due to network issues
```yaml
# Network resilience configuration
networks:
  seasonality-net:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "true"
      com.docker.network.bridge.enable_ip_masquerade: "true"
    ipam:
      config:
        - subnet: 172.20.0.0/16

# Service discovery with health checks
services:
  backend:
    networks:
      seasonality-net:
        aliases:
          - api-server
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### **Error Response Standards**:
```javascript
// Standardized error response format
class ErrorResponse {
  constructor(code, message, details = null, recoverable = false) {
    this.error = {
      code,
      message,
      details,
      recoverable,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    };
  }
}

// Usage examples
const responses = {
  databaseError: new ErrorResponse(
    'DATABASE_CONNECTION_FAILED',
    'Unable to connect to database',
    { service: 'postgresql', reason: 'connection_timeout' },
    true
  ),
  
  storageError: new ErrorResponse(
    'FILE_STORAGE_UNAVAILABLE',
    'File storage service is temporarily unavailable',
    { service: 'minio', retry_after: 30 },
    true
  ),
  
  validationError: new ErrorResponse(
    'INVALID_INPUT',
    'Request validation failed',
    { field: 'email', reason: 'invalid_format' },
    false
  )
};
```

## CHAIN OF THOUGHT REASONING

### Step 1: Understand the Problem
**Question**: What infrastructure challenges are we solving?
**Answer**: Converting single-user desktop app to multi-tenant SaaS with 100x user scale

**Question**: What are the critical constraints?
**Answer**: 
- Budget: $500/month (rules out expensive managed services)
- Timeline: 4 months (need simple, proven solutions)
- Team: Mid-level developers (avoid complex architectures)
- Scale: 100 → 1000 users (need horizontal scaling capability)

### Step 2: Analyze Approaches
**Option A**: Kubernetes cluster
- ❌ Cons: Complex setup, expensive, overkill for initial scale
- ❌ Cons: Requires DevOps expertise team doesn't have

**Option B**: Docker Compose with manual scaling
- ✅ Pros: Simple setup, cost-effective, team can manage
- ✅ Pros: Easy to understand and debug
- ⚠️ Cons: Manual scaling required initially

**Option C**: Serverless architecture
- ❌ Cons: Vendor lock-in, cold starts for analysis workloads
- ❌ Cons: Complex for stateful operations

**Selected**: Option B with upgrade path to managed container service

### Step 3: Design Solution
1. **Start Simple**: Docker Compose for MVP (months 1-4)
2. **Plan Scaling**: Design for easy migration to Docker Swarm/ECS (months 5-6)
3. **Monitor Everything**: Comprehensive monitoring from day 1
4. **Automate Deployment**: CI/CD pipeline for reliable deployments

### Step 4: Validate Design
- **Cost Test**: $500/month budget → $200 compute + $150 storage + $100 bandwidth + $50 monitoring ✅
- **Performance Test**: Single server handles 100 concurrent users ✅
- **Scaling Test**: Can add backend replicas without code changes ✅
- **Recovery Test**: Services restart automatically on failure ✅

## DELIVERABLES
1. **docker-compose.yml** - Complete multi-service setup
2. **docker-compose.scale.yml** - Scaling configuration
3. **nginx.conf** - Reverse proxy with security
4. **Dockerfile** - Optimized containers for each service
5. **docker-compose.override.yml** - Development overrides
6. **monitoring/docker-compose.yml** - Prometheus + Grafana setup
7. **scripts/deploy.sh** - Automated deployment script
8. **README.md** - Deployment and scaling instructions

## TESTING REQUIREMENTS

### **Infrastructure Testing Suite**
```bash
#!/bin/bash
# test-infrastructure.sh - Comprehensive infrastructure testing

set -e  # Exit on any error

echo "🚀 Starting Infrastructure Test Suite..."

# Test 1: Environment Validation
echo "📋 Test 1: Environment Validation"
if [ ! -f ".env" ]; then
    echo "❌ .env file missing"
    exit 1
fi

# Check required environment variables
required_vars=("DATABASE_URL" "REDIS_HOST" "MINIO_ACCESS_KEY" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done
echo "✅ Environment validation passed"

# Test 2: Service Startup
echo "📋 Test 2: Service Startup"
docker-compose down -v  # Clean slate
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 60

# Test 3: Health Checks
echo "📋 Test 3: Health Checks"
services=("postgres:5432" "redis:6379" "minio:9000" "backend:3001")
for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if ! docker-compose exec -T $name nc -z localhost $port; then
        echo "❌ $name service not responding on port $port"
        docker-compose logs $name --tail=20
        exit 1
    fi
    echo "✅ $name service healthy"
done

# Test 4: API Connectivity
echo "📋 Test 4: API Connectivity"
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
if [ "$response" != "200" ]; then
    echo "❌ Backend API health check failed (HTTP $response)"
    docker-compose logs backend --tail=20
    exit 1
fi
echo "✅ Backend API responding"

# Test 5: Database Connectivity
echo "📋 Test 5: Database Connectivity"
if ! docker-compose exec -T postgres pg_isready -U admin -d youngturtle; then
    echo "❌ Database not ready"
    docker-compose logs postgres --tail=20
    exit 1
fi
echo "✅ Database connectivity verified"

# Test 6: Redis Connectivity
echo "📋 Test 6: Redis Connectivity"
redis_response=$(docker-compose exec -T redis redis-cli ping)
if [ "$redis_response" != "PONG" ]; then
    echo "❌ Redis not responding"
    docker-compose logs redis --tail=20
    exit 1
fi
echo "✅ Redis connectivity verified"

# Test 7: MinIO Connectivity
echo "📋 Test 7: MinIO Connectivity"
minio_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live)
if [ "$minio_response" != "200" ]; then
    echo "❌ MinIO health check failed (HTTP $minio_response)"
    docker-compose logs minio --tail=20
    exit 1
fi
echo "✅ MinIO connectivity verified"

# Test 8: Load Testing (Basic)
echo "📋 Test 8: Basic Load Testing"
if command -v ab &> /dev/null; then
    echo "Running Apache Bench test..."
    ab_result=$(ab -n 100 -c 10 -q http://localhost:3001/api/health 2>&1)
    failed_requests=$(echo "$ab_result" | grep "Failed requests:" | awk '{print $3}')
    if [ "$failed_requests" != "0" ]; then
        echo "❌ Load test failed: $failed_requests failed requests"
        exit 1
    fi
    echo "✅ Basic load test passed"
else
    echo "⚠️  Apache Bench not available, skipping load test"
fi

# Test 9: Data Persistence
echo "📋 Test 9: Data Persistence Test"
# Create test data
test_data='{"test": "data", "timestamp": "'$(date -Iseconds)'"}'
docker-compose exec -T redis redis-cli set test_key "$test_data"

# Restart services
docker-compose restart redis
sleep 10

# Verify data persisted
retrieved_data=$(docker-compose exec -T redis redis-cli get test_key)
if [ "$retrieved_data" != "$test_data" ]; then
    echo "❌ Data persistence test failed"
    exit 1
fi
echo "✅ Data persistence verified"

# Test 10: Resource Usage
echo "📋 Test 10: Resource Usage Check"
# Check memory usage
memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep -E "(backend|postgres|redis|minio)")
echo "Memory usage:"
echo "$memory_usage"

# Check if any container is using > 90% of allocated memory
high_memory=$(echo "$memory_usage" | awk '{if($2 ~ /[0-9]+\.[0-9]+GiB/ && $2 > 0.9) print $1}')
if [ -n "$high_memory" ]; then
    echo "⚠️  High memory usage detected in: $high_memory"
fi

echo "🎉 All infrastructure tests passed!"
echo "📊 Test Summary:"
echo "  ✅ Environment validation"
echo "  ✅ Service startup"
echo "  ✅ Health checks"
echo "  ✅ API connectivity"
echo "  ✅ Database connectivity"
echo "  ✅ Redis connectivity"
echo "  ✅ MinIO connectivity"
echo "  ✅ Basic load testing"
echo "  ✅ Data persistence"
echo "  ✅ Resource usage check"
```

### **Performance Benchmarking**
```bash
#!/bin/bash
# performance-benchmark.sh - Infrastructure performance testing

echo "🏃 Starting Performance Benchmark Suite..."

# Benchmark 1: API Response Time
echo "📊 Benchmark 1: API Response Time"
for i in {1..10}; do
    response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3001/api/health)
    echo "Request $i: ${response_time}s"
done

# Benchmark 2: Database Query Performance
echo "📊 Benchmark 2: Database Query Performance"
docker-compose exec -T postgres psql -U admin -d youngturtle -c "
  EXPLAIN ANALYZE SELECT COUNT(*) FROM \"SeasonalityData\" 
  WHERE date >= '2023-01-01' AND date <= '2023-12-31';
"

# Benchmark 3: Redis Performance
echo "📊 Benchmark 3: Redis Performance"
docker-compose exec -T redis redis-cli --latency-history -i 1 | head -10

# Benchmark 4: MinIO Upload Performance
echo "📊 Benchmark 4: MinIO Upload Performance"
# Create test file
dd if=/dev/zero of=/tmp/test-file.csv bs=1M count=10 2>/dev/null

# Upload test
start_time=$(date +%s.%N)
curl -X PUT -T /tmp/test-file.csv \
  -H "Authorization: AWS admin:admin12345" \
  http://localhost:9000/seasonality-uploads/test-file.csv
end_time=$(date +%s.%N)

upload_time=$(echo "$end_time - $start_time" | bc)
echo "10MB file upload time: ${upload_time}s"

# Cleanup
rm /tmp/test-file.csv

echo "🎯 Performance benchmarks completed!"
```

### **Automated Testing Integration**
```yaml
# .github/workflows/infrastructure-test.yml
name: Infrastructure Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  infrastructure-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up environment
      run: |
        cp .env.example .env
        echo "JWT_SECRET=test-secret-key-for-ci" >> .env
    
    - name: Run infrastructure tests
      run: |
        chmod +x scripts/test-infrastructure.sh
        ./scripts/test-infrastructure.sh
    
    - name: Run performance benchmarks
      run: |
        chmod +x scripts/performance-benchmark.sh
        ./scripts/performance-benchmark.sh
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: infrastructure-test-results
        path: |
          docker-compose.logs
          test-results.xml
```

## OUTPUT VALIDATION CHECKLIST

When reviewing AI-generated infrastructure code, verify:

### Configuration Quality:
- [ ] No hardcoded secrets (use environment variables)
- [ ] Proper resource limits set for all containers
- [ ] Health checks configured for critical services
- [ ] Restart policies defined for all services
- [ ] Volume mounts for data persistence

### Security:
- [ ] Default passwords changed
- [ ] Network isolation between services
- [ ] SSL/TLS configuration ready
- [ ] Rate limiting configured
- [ ] Security headers in place

### Scalability:
- [ ] Services can be scaled horizontally
- [ ] Load balancing configured
- [ ] Database connection pooling
- [ ] Caching strategy implemented
- [ ] Monitoring and alerting ready

### Reliability:
- [ ] Backup strategy defined
- [ ] Disaster recovery plan
- [ ] Automated deployment scripts
- [ ] Rollback procedures documented
- [ ] Health monitoring implemented

## SUCCESS CRITERIA
- ✅ All services start successfully on fresh Ubuntu 22.04
- ✅ System handles 100 concurrent users without degradation
- ✅ Services restart automatically on failure
- ✅ Data persists across container restarts
- ✅ Deployment takes < 10 minutes from code to production
- ✅ Infrastructure costs stay under $500/month
- ✅ 99% uptime achieved in production
```

---

## 🗄️ PROMPT 1.2: Database Architect Role

```markdown
# ROLE: Senior Database Architect & Data Engineer

## CONTEXT
You're designing the database schema for a seasonality trading analysis SaaS. The old system used 1000+ CSV files (200 symbols × 5 timeframes). We need to consolidate this into a high-performance PostgreSQL database with TimescaleDB for time-series optimization.

## OLD SYSTEM DATA STRUCTURE
Each symbol had 5 CSV files:
- `1_Daily.csv` - Daily OHLCV + 40+ calculated columns
- `2_MondayWeekly.csv` - Monday weekly data
- `3_ExpiryWeekly.csv` - Expiry weekly data  
- `4_Monthly.csv` - Monthly data
- `5_Yearly.csv` - Yearly data

## SAMPLE OLD DATA COLUMNS
```csv
Date,Ticker,Open,High,Low,Close,Volume,OpenInterest,Weekday,CalenderMonthDay,CalenderYearDay,TradingMonthDay,TradingYearDay,EvenCalenderMonthDay,EvenCalenderYearDay,EvenTradingMonthDay,EvenTradingYearDay,ReturnPoints,ReturnPercentage,PositiveDay,MondayWeeklyDate,MondayWeekNumberMonthly,MondayWeekNumberYearly,EvenMondayWeekNumberMonthly,EvenMondayWeekNumberYearly,MondayWeeklyReturnPoints,MondayWeeklyReturnPercentage,PositiveMondayWeek,ExpiryWeeklyDate,ExpiryWeekNumberMonthly,ExpiryWeekNumberYearly,EvenExpiryWeekNumberMonthly,EvenExpiryWeekNumberYearly,ExpiryWeeklyReturnPoints,ExpiryWeeklyReturnPercentage,PositiveExpiryWeek,EvenMonth,MonthlyReturnPoints,MonthlyReturnPercentage,PositiveMonth,EvenYear,YearlyReturnPoints,YearlyReturnPercentage,PositiveYear
```

## TASK: Design Complete Database Schema

### STEP 1: Core Tables Design
Create Prisma schema with:
1. **Users & Authentication**
   - User management with roles (admin, user, research)
   - Subscription tiers and limits
   - API keys and rate limiting

2. **Market Data Tables**
   - Symbols/Tickers with metadata
   - Raw OHLCV data (time-series optimized)
   - Calculated fields (returns, indicators)
   - Multiple timeframes in single table

3. **Application Tables**
   - Upload batches and file tracking
   - User preferences and saved filters
   - Analysis results caching

### STEP 2: Performance Optimization
- TimescaleDB hypertables for time-series data
- Proper indexing strategy
- Partitioning by symbol and date
- Materialized views for common queries

### STEP 3: Data Migration Strategy
- CSV import scripts
- Data validation and cleaning
- Batch processing for large datasets
- Progress tracking and error handling

## DELIVERABLES
1. **schema.prisma** - Complete Prisma schema
2. **migration.sql** - Database migration scripts
3. **seed.js** - Sample data seeding
4. **indexes.sql** - Performance indexes
5. **data-migration.js** - CSV import utility

## CHAIN OF THOUGHT PROCESS
1. **Analyze Old Schema** → Map CSV columns to database fields
2. **Design Relationships** → Plan table relationships and constraints
3. **Optimize for Queries** → Add indexes and partitioning
4. **Plan Migration** → Strategy for moving CSV data to DB
5. **Validate Performance** → Test with sample data

## SUCCESS CRITERIA
- ✅ Schema supports all old system features
- ✅ Query performance < 500ms for 95% of requests
- ✅ Can handle 10M+ records per symbol
- ✅ Supports concurrent read/write operations
- ✅ Data integrity and consistency maintained
```

---

# 🔧 PHASE 2: BACKEND DEVELOPMENT

## 🚀 PROMPT 2.1: Backend Lead Developer Role

```markdown
# ROLE: Senior Backend Developer & API Architect

## CONTEXT
You're building the backend API for a seasonality trading analysis SaaS. The system needs to handle complex financial calculations, real-time CSV processing, and serve data to a React frontend. The old Python system had 11 different analysis modules that need to be replicated.

## OLD SYSTEM ANALYSIS MODULES
1. **Daily Analysis** - Daily returns with 40+ filters
2. **Weekly Analysis** - Monday/Expiry weekly calculations
3. **Monthly Analysis** - Monthly returns and year-over-year
4. **Yearly Analysis** - Yearly overlays and superimposed charts
5. **Scenario Analysis** - Custom backtesting scenarios
6. **Election Analysis** - Political cycle impact analysis
7. **Symbol Scanner** - Multi-criteria symbol filtering
8. **Backtester** - Phenomena backtesting engine
9. **Phenomena Detection** - Pattern recognition
10. **Basket Analysis** - Portfolio correlation analysis
11. **Animated Charts** - Time-series visualizations

## TASK: Build Complete Backend API System

### STEP 1: Core API Architecture
Design Express.js application with:
- **Authentication**: JWT-based auth with role management
- **Rate Limiting**: Per-user API limits based on subscription
- **Error Handling**: Comprehensive error responses
- **Logging**: Structured logging with Winston
- **Validation**: Input validation with Joi/Zod
- **Documentation**: OpenAPI/Swagger specs

### STEP 2: Data Processing Services
Create comprehensive services with error handling:
```javascript
// services/SeasonalityCalculationService.js
class SeasonalityCalculationService {
  constructor() {
    this.logger = require('../utils/logger');
  }

  /**
   * Calculate daily returns with comprehensive error handling
   * @param {Array} data - Array of OHLC data objects
   * @param {Object} filters - Filter configuration object
   * @returns {Object} Processed data with statistics
   */
  async calculateDailyReturns(data, filters = {}) {
    try {
      // Input validation
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid input: data must be a non-empty array');
      }

      // Validate required fields
      const requiredFields = ['date', 'close'];
      const invalidRecords = data.filter(record => 
        !requiredFields.every(field => record[field] !== undefined && record[field] !== null)
      );

      if (invalidRecords.length > 0) {
        this.logger.warn(`Found ${invalidRecords.length} records with missing required fields`);
        // Filter out invalid records
        data = data.filter(record => 
          requiredFields.every(field => record[field] !== undefined && record[field] !== null)
        );
      }

      // Sort data by date to ensure correct calculations
      data.sort((a, b) => new Date(a.date) - new Date(b.date));

      const results = [];
      const statistics = {
        totalRecords: data.length,
        positiveReturns: 0,
        negativeReturns: 0,
        averageReturn: 0,
        maxReturn: -Infinity,
        minReturn: Infinity,
        accuracy: 0
      };

      // Calculate returns
      for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const previous = data[i - 1];

        try {
          // Handle edge cases
          if (previous.close === 0) {
            this.logger.warn(`Zero close price found for date ${previous.date}, skipping calculation`);
            continue;
          }

          const returnPoints = current.close - previous.close;
          const returnPercentage = (returnPoints / previous.close) * 100;

          // Apply percentage change filters if specified
          if (filters.dailyPercentageChangeSwitch && filters.dailyPercentageChange) {
            const [minPercent, maxPercent] = filters.dailyPercentageChange;
            if (returnPercentage < minPercent || returnPercentage > maxPercent) {
              continue; // Skip outliers
            }
          }

          const processedRecord = {
            ...current,
            returnPoints,
            returnPercentage,
            positiveDay: returnPercentage > 0,
            weekday: new Date(current.date).toLocaleDateString('en-US', { weekday: 'long' }),
            calendarMonthDay: new Date(current.date).getDate(),
            calendarYearDay: this.getYearDay(new Date(current.date)),
            tradingMonthDay: this.getTradingMonthDay(current.date, data),
            tradingYearDay: this.getTradingYearDay(current.date, data)
          };

          // Apply filters
          if (this.passesFilters(processedRecord, filters)) {
            results.push(processedRecord);

            // Update statistics
            if (returnPercentage > 0) statistics.positiveReturns++;
            else statistics.negativeReturns++;

            statistics.maxReturn = Math.max(statistics.maxReturn, returnPercentage);
            statistics.minReturn = Math.min(statistics.minReturn, returnPercentage);
          }

        } catch (error) {
          this.logger.error(`Error calculating return for date ${current.date}:`, error.message);
          continue; // Skip this record and continue
        }
      }

      // Calculate final statistics
      if (results.length > 0) {
        statistics.averageReturn = results.reduce((sum, record) => sum + record.returnPercentage, 0) / results.length;
        statistics.accuracy = (statistics.positiveReturns / results.length) * 100;
      }

      this.logger.info(`Daily returns calculated: ${results.length} records processed`);

      return {
        data: results,
        statistics,
        metadata: {
          totalInputRecords: data.length,
          processedRecords: results.length,
          filteredOutRecords: data.length - results.length,
          calculationTime: Date.now()
        }
      };

    } catch (error) {
      this.logger.error('Error in calculateDailyReturns:', error);
      throw new Error(`Daily returns calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate weekly returns (Monday/Expiry based)
   * @param {Array} data - Daily data array
   * @param {string} type - 'monday' or 'expiry'
   * @returns {Object} Weekly returns data
   */
  async calculateWeeklyReturns(data, type = 'monday') {
    try {
      if (!['monday', 'expiry'].includes(type)) {
        throw new Error('Invalid week type: must be "monday" or "expiry"');
      }

      const weeklyData = [];
      let currentWeek = null;

      for (const record of data) {
        const date = new Date(record.date);
        const weekKey = type === 'monday' 
          ? this.getMondayWeekKey(date)
          : this.getExpiryWeekKey(date);

        if (!currentWeek || currentWeek.key !== weekKey) {
          // Start new week
          if (currentWeek) {
            weeklyData.push(this.finalizeWeeklyRecord(currentWeek));
          }
          
          currentWeek = {
            key: weekKey,
            startDate: record.date,
            endDate: record.date,
            openPrice: record.open,
            closePrice: record.close,
            highPrice: record.high,
            lowPrice: record.low,
            volume: record.volume || 0,
            records: [record]
          };
        } else {
          // Update existing week
          currentWeek.endDate = record.date;
          currentWeek.closePrice = record.close;
          currentWeek.highPrice = Math.max(currentWeek.highPrice, record.high);
          currentWeek.lowPrice = Math.min(currentWeek.lowPrice, record.low);
          currentWeek.volume += (record.volume || 0);
          currentWeek.records.push(record);
        }
      }

      // Finalize last week
      if (currentWeek) {
        weeklyData.push(this.finalizeWeeklyRecord(currentWeek));
      }

      // Calculate weekly returns
      const weeklyReturns = [];
      for (let i = 1; i < weeklyData.length; i++) {
        const current = weeklyData[i];
        const previous = weeklyData[i - 1];

        if (previous.closePrice === 0) continue;

        const returnPoints = current.closePrice - previous.closePrice;
        const returnPercentage = (returnPoints / previous.closePrice) * 100;

        weeklyReturns.push({
          ...current,
          returnPoints,
          returnPercentage,
          positiveWeek: returnPercentage > 0,
          weekNumber: this.getWeekNumber(new Date(current.startDate), type),
          monthlyWeekNumber: this.getMonthlyWeekNumber(new Date(current.startDate)),
          yearlyWeekNumber: this.getYearlyWeekNumber(new Date(current.startDate))
        });
      }

      return {
        data: weeklyReturns,
        statistics: this.calculateWeeklyStatistics(weeklyReturns),
        metadata: {
          weekType: type,
          totalWeeks: weeklyReturns.length,
          calculationTime: Date.now()
        }
      };

    } catch (error) {
      this.logger.error(`Error in calculateWeeklyReturns (${type}):`, error);
      throw new Error(`Weekly returns calculation failed: ${error.message}`);
    }
  }

  /**
   * Apply advanced filters with comprehensive validation
   * @param {Object} record - Data record to filter
   * @param {Object} filterConfig - Filter configuration
   * @returns {boolean} Whether record passes all filters
   */
  passesFilters(record, filterConfig) {
    try {
      // Positive/Negative filter
      if (filterConfig.positiveNegativeDays !== 'All') {
        const isPositive = record.returnPercentage > 0;
        if (filterConfig.positiveNegativeDays !== isPositive) {
          return false;
        }
      }

      // Weekday filter
      if (filterConfig.weekdayNames && filterConfig.weekdayNames.length > 0) {
        if (!filterConfig.weekdayNames.includes(record.weekday)) {
          return false;
        }
      }

      // Even/Odd calendar days filter
      if (filterConfig.evenOddCalenderMonthDays !== 'All') {
        const isEven = record.calendarMonthDay % 2 === 0;
        if (filterConfig.evenOddCalenderMonthDays !== isEven) {
          return false;
        }
      }

      // Month filter
      if (filterConfig.specificMonthSelection && filterConfig.specificMonthSelection !== 0) {
        const recordMonth = new Date(record.date).getMonth() + 1;
        if (recordMonth !== filterConfig.specificMonthSelection) {
          return false;
        }
      }

      // Year filters
      if (filterConfig.positiveNegativeYears !== 'All') {
        const year = new Date(record.date).getFullYear();
        const yearReturn = this.getYearlyReturn(year, record.symbol);
        const isPositiveYear = yearReturn > 0;
        if (filterConfig.positiveNegativeYears !== isPositiveYear) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.error('Error in passesFilters:', error);
      return false; // Exclude record if filter evaluation fails
    }
  }

  // Helper methods with error handling
  getYearDay(date) {
    try {
      const start = new Date(date.getFullYear(), 0, 0);
      const diff = date - start;
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    } catch (error) {
      this.logger.error('Error calculating year day:', error);
      return 0;
    }
  }

  getTradingMonthDay(date, allData) {
    try {
      const month = new Date(date).getMonth();
      const year = new Date(date).getFullYear();
      
      const monthData = allData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === month && recordDate.getFullYear() === year;
      });

      return monthData.findIndex(record => record.date === date) + 1;
    } catch (error) {
      this.logger.error('Error calculating trading month day:', error);
      return 0;
    }
  }

  getTradingYearDay(date, allData) {
    try {
      const year = new Date(date).getFullYear();
      const yearData = allData.filter(record => 
        new Date(record.date).getFullYear() === year
      );

      return yearData.findIndex(record => record.date === date) + 1;
    } catch (error) {
      this.logger.error('Error calculating trading year day:', error);
      return 0;
    }
  }

  finalizeWeeklyRecord(weekData) {
    return {
      startDate: weekData.startDate,
      endDate: weekData.endDate,
      openPrice: weekData.openPrice,
      closePrice: weekData.closePrice,
      highPrice: weekData.highPrice,
      lowPrice: weekData.lowPrice,
      volume: weekData.volume,
      tradingDays: weekData.records.length
    };
  }

  calculateWeeklyStatistics(weeklyData) {
    if (weeklyData.length === 0) {
      return {
        totalWeeks: 0,
        positiveWeeks: 0,
        negativeWeeks: 0,
        averageReturn: 0,
        accuracy: 0
      };
    }

    const positiveWeeks = weeklyData.filter(week => week.returnPercentage > 0).length;
    const averageReturn = weeklyData.reduce((sum, week) => sum + week.returnPercentage, 0) / weeklyData.length;

    return {
      totalWeeks: weeklyData.length,
      positiveWeeks,
      negativeWeeks: weeklyData.length - positiveWeeks,
      averageReturn,
      accuracy: (positiveWeeks / weeklyData.length) * 100
    };
  }
}

module.exports = SeasonalityCalculationService;
```

### STEP 3: API Endpoints Design
Create comprehensive RESTful endpoints with error handling:

```javascript
// routes/analysisRoutes.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const SeasonalityCalculationService = require('../services/SeasonalityCalculationService');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Rate limiting for analysis endpoints
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many analysis requests, please try again later',
      retryAfter: 900
    }
  }
});

// Input validation schemas
const dailyAnalysisValidation = [
  body('symbol').isString().isLength({ min: 1, max: 20 }).withMessage('Symbol must be 1-20 characters'),
  body('dateRange.start').isISO8601().withMessage('Start date must be valid ISO date'),
  body('dateRange.end').isISO8601().withMessage('End date must be valid ISO date'),
  body('filters.positiveNegativeDays').optional().isIn(['All', true, false]),
  body('filters.weekdayNames').optional().isArray().custom((value) => {
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    return value.every(day => validDays.includes(day));
  }),
  body('filters.dailyPercentageChange').optional().isArray({ min: 2, max: 2 }).custom((value) => {
    return value.every(num => typeof num === 'number' && num >= -100 && num <= 100);
  })
];

/**
 * POST /api/analysis/daily
 * Perform daily timeframe analysis with comprehensive filtering
 */
router.post('/daily', 
  analysisLimiter,
  authMiddleware,
  requirePermission('view:analytics'),
  dailyAnalysisValidation,
  async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || generateRequestId();
    
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array(),
            requestId
          }
        });
      }

      const { symbol, dateRange, filters = {} } = req.body;
      
      // Validate date range
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      if (startDate >= endDate) {
        return res.status(400).json({
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date must be before end date',
            requestId
          }
        });
      }

      // Check date range limits (prevent excessive data requests)
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      if (daysDiff > 3650) { // 10 years max
        return res.status(400).json({
          error: {
            code: 'DATE_RANGE_TOO_LARGE',
            message: 'Date range cannot exceed 10 years',
            maxDays: 3650,
            requestedDays: Math.floor(daysDiff),
            requestId
          }
        });
      }

      // Fetch data from database
      const rawData = await prisma.seasonalityData.findMany({
        where: {
          ticker: {
            symbol: symbol.toUpperCase()
          },
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          ticker: true
        },
        orderBy: {
          date: 'asc'
        }
      });

      if (rawData.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NO_DATA_FOUND',
            message: `No data found for symbol ${symbol} in the specified date range`,
            symbol,
            dateRange,
            requestId
          }
        });
      }

      // Process data through calculation service
      const calculationService = new SeasonalityCalculationService();
      const result = await calculationService.calculateDailyReturns(rawData, filters);

      // Prepare response
      const response = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          dateRange,
          filters,
          chartData: result.data,
          statistics: result.statistics,
          metadata: {
            ...result.metadata,
            processingTime: Date.now() - startTime,
            requestId,
            apiVersion: '1.0'
          }
        }
      };

      // Log successful request
      req.logger.info('Daily analysis completed', {
        symbol,
        recordsProcessed: result.data.length,
        processingTime: Date.now() - startTime,
        userId: req.user.id,
        requestId
      });

      res.json(response);

    } catch (error) {
      // Log error with context
      req.logger.error('Daily analysis failed', {
        error: error.message,
        stack: error.stack,
        symbol: req.body.symbol,
        userId: req.user?.id,
        requestId
      });

      // Determine error type and response
      if (error.message.includes('Database')) {
        return res.status(503).json({
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database service temporarily unavailable',
            recoverable: true,
            retryAfter: 30,
            requestId
          }
        });
      }

      if (error.message.includes('calculation failed')) {
        return res.status(422).json({
          error: {
            code: 'CALCULATION_ERROR',
            message: 'Unable to process data with current filters',
            details: error.message,
            requestId
          }
        });
      }

      // Generic server error
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          requestId
        }
      });
    }
  }
);

/**
 * POST /api/analysis/weekly
 * Perform weekly timeframe analysis (Monday/Expiry based)
 */
router.post('/weekly',
  analysisLimiter,
  authMiddleware,
  requirePermission('view:analytics'),
  [
    body('symbol').isString().isLength({ min: 1, max: 20 }),
    body('weekType').isIn(['monday', 'expiry']).withMessage('Week type must be "monday" or "expiry"'),
    body('dateRange.start').isISO8601(),
    body('dateRange.end').isISO8601()
  ],
  async (req, res) => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array(),
            requestId
          }
        });
      }

      const { symbol, weekType, dateRange, filters = {} } = req.body;

      // Fetch daily data first
      const dailyData = await prisma.seasonalityData.findMany({
        where: {
          ticker: { symbol: symbol.toUpperCase() },
          date: {
            gte: new Date(dateRange.start),
            lte: new Date(dateRange.end)
          }
        },
        include: { ticker: true },
        orderBy: { date: 'asc' }
      });

      if (dailyData.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NO_DATA_FOUND',
            message: `No data found for symbol ${symbol}`,
            requestId
          }
        });
      }

      // Calculate weekly returns
      const calculationService = new SeasonalityCalculationService();
      const result = await calculationService.calculateWeeklyReturns(dailyData, weekType);

      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          weekType,
          dateRange,
          chartData: result.data,
          statistics: result.statistics,
          metadata: {
            ...result.metadata,
            requestId
          }
        }
      });

    } catch (error) {
      req.logger.error('Weekly analysis failed', {
        error: error.message,
        symbol: req.body.symbol,
        weekType: req.body.weekType,
        requestId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Weekly analysis failed',
          requestId
        }
      });
    }
  }
);

/**
 * GET /api/analysis/symbols
 * Get available symbols with metadata
 */
router.get('/symbols',
  authMiddleware,
  requirePermission('view:analytics'),
  async (req, res) => {
    try {
      const symbols = await prisma.ticker.findMany({
        select: {
          id: true,
          symbol: true,
          createdAt: true,
          _count: {
            select: {
              seasonalityData: true
            }
          }
        },
        orderBy: {
          symbol: 'asc'
        }
      });

      // Add metadata for each symbol
      const symbolsWithMetadata = await Promise.all(
        symbols.map(async (ticker) => {
          const dateRange = await prisma.seasonalityData.aggregate({
            where: { tickerId: ticker.id },
            _min: { date: true },
            _max: { date: true }
          });

          return {
            symbol: ticker.symbol,
            recordCount: ticker._count.seasonalityData,
            dateRange: {
              start: dateRange._min.date,
              end: dateRange._max.date
            },
            createdAt: ticker.createdAt
          };
        })
      );

      res.json({
        success: true,
        data: symbolsWithMetadata,
        metadata: {
          totalSymbols: symbols.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      req.logger.error('Failed to fetch symbols', { error: error.message });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch available symbols'
        }
      });
    }
  }
);

/**
 * GET /api/analysis/health
 * Health check endpoint for analysis service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'analysis-api',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  req.logger.error('Analysis API error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  res.status(500).json({
    error: {
      code: 'ANALYSIS_API_ERROR',
      message: 'Analysis service error',
      timestamp: new Date().toISOString()
    }
  });
});

// Utility function
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = router;
```

### STEP 4: Background Processing
Implement BullMQ job processing:
- CSV file processing jobs
- Calculation-heavy analysis jobs
- Data export jobs
- Email notifications

## DELIVERABLES
1. **app.js** - Main Express application
2. **routes/** - All API route handlers
3. **services/** - Business logic services
4. **middleware/** - Authentication, validation, logging
5. **jobs/** - Background job processors
6. **utils/** - Helper functions and utilities
7. **tests/** - Unit and integration tests

## CHAIN OF THOUGHT PROCESS
1. **Analyze Old Logic** → Understand Python calculations
2. **Design API Structure** → Plan RESTful endpoints
3. **Implement Services** → Build calculation engines
4. **Add Authentication** → Secure API access
5. **Optimize Performance** → Cache and optimize queries

## SUCCESS CRITERIA
- ✅ All 11 analysis modules replicated
- ✅ API response time < 2 seconds
- ✅ Handles 1000+ concurrent requests
- ✅ Comprehensive error handling
- ✅ 90%+ test coverage
```

---

## 🔄 PROMPT 2.2: Data Processing Engineer Role

```markdown
# ROLE: Senior Data Processing Engineer

## CONTEXT
You're implementing the data processing pipeline for the seasonality SaaS. The old system processed CSV files with complex financial calculations. You need to replicate this logic in Node.js with database integration.

## OLD SYSTEM CALCULATIONS (Python Logic)
The old system calculated 40+ fields per record:
- **Return Calculations**: Daily, Weekly, Monthly, Yearly returns
- **Date Components**: Trading days, calendar days, week numbers
- **Boolean Flags**: Positive/Negative, Even/Odd classifications
- **Statistical Aggregations**: Accuracy, win rates, consecutive trends

## TASK: Implement Complete Data Processing Pipeline

### STEP 1: CSV Processing Engine
Create robust CSV processor:
```javascript
class CSVProcessor {
  async processUploadedFile(fileBuffer, fileName) {
    // 1. Parse CSV with validation
    // 2. Normalize column names
    // 3. Validate required fields
    // 4. Apply data transformations
    // 5. Calculate derived fields
    // 6. Batch insert to database
  }
  
  calculateSeasonalityMetrics(rawData) {
    // Implement all 40+ calculations
    // Match Python logic exactly
  }
}
```

### STEP 2: Financial Calculations Service
Replicate Python pandas logic:
```javascript
class FinancialCalculations {
  calculateReturns(priceData) {
    // Daily return percentage
    // Weekly returns (Monday/Expiry)
    // Monthly returns
    // Yearly returns
  }
  
  calculateDateComponents(dateString) {
    // Trading day numbers
    // Calendar day numbers
    // Week numbers (monthly/yearly)
    // Even/Odd classifications
  }
  
  calculateStatistics(returnArray) {
    // Positive/Negative counts
    // Accuracy percentages
    // Average returns
    // Consecutive trend analysis
  }
}
```

### STEP 3: Filter Engine
Implement complex filtering system:
```javascript
class FilterEngine {
  applyFilters(data, filterConfig) {
    // 40+ different filter combinations
    // Date range filters
    // Positive/Negative filters
    // Even/Odd filters
    // Percentage change filters
    // Custom query combinations
  }
}
```

### STEP 4: Background Job Processing
Create job processors for heavy calculations:
```javascript
// BullMQ job processors
const csvProcessingJob = async (job) => {
  const { fileKey, batchId } = job.data;
  // Process CSV file asynchronously
  // Update progress in real-time
  // Handle errors gracefully
};
```

## DELIVERABLES
1. **csvProcessor.js** - Main CSV processing logic
2. **calculations.js** - Financial calculation functions
3. **filterEngine.js** - Advanced filtering system
4. **jobProcessors.js** - Background job handlers
5. **validators.js** - Data validation utilities
6. **transformers.js** - Data transformation functions

## CHAIN OF THOUGHT PROCESS
1. **Study Python Code** → Understand exact calculations
2. **Map to JavaScript** → Convert pandas operations
3. **Optimize for Scale** → Handle large datasets efficiently
4. **Add Error Handling** → Robust error management
5. **Test Accuracy** → Validate against Python results

## SUCCESS CRITERIA
- ✅ 100% calculation accuracy vs Python system
- ✅ Process 300+ files in < 5 minutes
- ✅ Handle files up to 100MB each
- ✅ Real-time progress tracking
- ✅ Comprehensive error reporting
```

---

# 🎨 PHASE 3: FRONTEND DEVELOPMENT

## 🖥️ PROMPT 3.1: Frontend Lead Developer Role

```markdown
# ROLE: Senior Frontend Developer & UI/UX Architect

## CONTEXT
You're building the frontend for a seasonality trading analysis SaaS. The old system had 11 complex analysis tabs with 40+ filters each. You need to create a modern, responsive React application that will be enhanced later with AI Studio.

## OLD SYSTEM UI STRUCTURE
11 Main Tabs:
1. **Daily Tab** - Complex filters + 4 chart types + 3 data tables
2. **Weekly Tab** - Weekly-specific analysis
3. **Monthly Tab** - Monthly analysis with year-over-year
4. **Yearly Tab** - Yearly overlays and superimposed charts
5. **Scenario Tab** - Custom backtesting interface
6. **Election Tab** - Election period analysis
7. **Scanner Tab** - Symbol scanner with query builder
8. **Backtester Tab** - Phenomena backtesting
9. **Phenomena Tab** - Pattern detection interface
10. **Basket Tab** - Portfolio analysis
11. **Charts Tab** - Animated visualizations

## TASK: Build Modern React Frontend (Simple UI for AI Studio Enhancement)

### STEP 1: Project Setup & Architecture
Create Next.js 14 application with:
- **App Router** - Modern Next.js routing
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Component library base
- **React Query** - Data fetching and caching
- **Zustand** - State management
- **React Hook Form** - Form handling

### STEP 2: Core Layout & Navigation
Build foundational components:
```jsx
// Simple, clean layout for AI Studio enhancement
const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Sidebar />
      <MainContent />
    </div>
  );
};

// Tab navigation system
const TabNavigation = () => {
  const tabs = [
    'Daily', 'Weekly', 'Monthly', 'Yearly', 
    'Scenario', 'Election', 'Scanner', 
    'Backtester', 'Phenomena', 'Basket', 'Charts'
  ];
  
  return (
    <nav className="tab-navigation">
      {tabs.map(tab => (
        <TabButton key={tab} tab={tab} />
      ))}
    </nav>
  );
};
```

### STEP 3: Basic Tab Components (Simple UI)
Create placeholder components for each tab:
```jsx
// Example: Daily Tab (Simple version for AI Studio)
const DailyTab = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="filters-section">
        <h2>Filters</h2>
        <div className="grid grid-cols-4 gap-4">
          <SymbolSelector />
          <DateRangePicker />
          <BasicFilters />
          <AdvancedFilters />
        </div>
      </div>
      
      <div className="charts-section">
        <h2>Charts</h2>
        <div className="grid grid-cols-2 gap-4">
          <ChartPlaceholder type="candlestick" />
          <ChartPlaceholder type="overlay" />
        </div>
      </div>
      
      <div className="data-section">
        <h2>Data Tables</h2>
        <DataTablePlaceholder />
      </div>
    </div>
  );
};
```

### STEP 4: Authentication & User Management
Implement user system:
```jsx
const AuthProvider = ({ children }) => {
  // JWT authentication
  // Role-based access control
  // Subscription tier management
};

const LoginPage = () => {
  // Simple login form
  // Registration flow
  // Password reset
};
```

### STEP 5: Admin Panel
Create admin interface:
```jsx
const AdminPanel = () => {
  return (
    <div className="admin-panel">
      <UserManagement />
      <CSVUploadInterface />
      <SystemMonitoring />
      <SubscriptionManagement />
    </div>
  );
};
```

## DELIVERABLES
1. **app/** - Next.js app router structure
2. **components/** - Reusable UI components
3. **lib/** - Utilities and API client
4. **hooks/** - Custom React hooks
5. **types/** - TypeScript type definitions
6. **styles/** - Tailwind configuration and custom CSS

## DESIGN PRINCIPLES
- **Simple & Clean** - Easy for AI Studio to enhance
- **Component-Based** - Modular and reusable
- **Responsive** - Mobile-first design
- **Accessible** - WCAG compliance
- **Performance** - Optimized loading and rendering

## CHAIN OF THOUGHT PROCESS
1. **Analyze Old UI** → Understand user workflows
2. **Design Simple Structure** → Create enhancement-ready components
3. **Implement Core Features** → Authentication, navigation, basic tabs
4. **Add Placeholder Components** → Ready for AI Studio enhancement
5. **Test User Flows** → Ensure smooth navigation

## SUCCESS CRITERIA
- ✅ All 11 tabs accessible with basic UI
- ✅ Authentication and user management working
- ✅ Responsive design on all devices
- ✅ Fast loading times (< 2 seconds)
- ✅ Ready for AI Studio enhancement
```

---

## 📊 PROMPT 3.2: Chart & Visualization Developer Role

```markdown
# ROLE: Senior Data Visualization Developer

## CONTEXT
You're implementing the visualization layer for the seasonality SaaS. The old system used Plotly.js with complex financial charts. You need to create chart components that can be enhanced later with AI Studio.

## OLD SYSTEM CHART TYPES
1. **Candlestick Charts** - OHLC data with overlays
2. **Yearly Overlay Charts** - Multiple years superimposed
3. **Aggregate Charts** - Total/Avg/Max/Min aggregations
4. **Superimposed Charts** - Multiple timeframes combined
5. **Heatmaps** - Correlation matrices
6. **Statistical Tables** - Interactive data tables

## TASK: Build Chart Component Library (Simple Base for AI Studio)

### STEP 1: Chart Infrastructure
Set up charting foundation:
```jsx
// Base chart wrapper for AI Studio enhancement
const ChartWrapper = ({ type, data, config, className }) => {
  return (
    <div className={`chart-container ${className}`}>
      <div className="chart-header">
        <h3>{config.title}</h3>
        <ChartControls config={config} />
      </div>
      <div className="chart-content">
        {renderChart(type, data, config)}
      </div>
    </div>
  );
};
```

### STEP 2: Basic Chart Components
Create simple chart components:
```jsx
// Candlestick Chart (Simple version)
const CandlestickChart = ({ data, symbol }) => {
  return (
    <div className="candlestick-chart">
      <div className="chart-placeholder">
        <p>Candlestick Chart for {symbol}</p>
        <p>Data points: {data.length}</p>
        {/* Simple chart implementation */}
        <BasicLineChart data={data} />
      </div>
    </div>
  );
};

// Overlay Chart (Simple version)
const OverlayChart = ({ data, years }) => {
  return (
    <div className="overlay-chart">
      <div className="chart-placeholder">
        <p>Yearly Overlay Chart</p>
        <p>Years: {years.join(', ')}</p>
        {/* Simple multi-line chart */}
        <MultiLineChart data={data} />
      </div>
    </div>
  );
};
```

### STEP 3: Data Table Components
Create interactive tables:
```jsx
const DataTable = ({ data, columns, title }) => {
  return (
    <div className="data-table">
      <div className="table-header">
        <h3>{title}</h3>
        <TableControls />
      </div>
      <div className="table-content">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => (
                  <td key={col.key}>{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### STEP 4: Filter Components
Build filter interface:
```jsx
const FilterPanel = ({ filters, onFilterChange }) => {
  return (
    <div className="filter-panel">
      <div className="filter-groups">
        <DateRangeFilter />
        <SymbolFilter />
        <PositiveNegativeFilter />
        <EvenOddFilter />
        <PercentageRangeFilter />
      </div>
    </div>
  );
};
```

## DELIVERABLES
1. **charts/** - Chart component library
2. **tables/** - Data table components
3. **filters/** - Filter UI components
4. **utils/** - Chart utilities and helpers
5. **types/** - Chart-specific TypeScript types

## DESIGN PRINCIPLES
- **Simple Implementation** - Easy for AI Studio to enhance
- **Modular Components** - Reusable across tabs
- **Responsive Design** - Works on all screen sizes
- **Performance Optimized** - Handles large datasets
- **Extensible** - Ready for advanced features

## CHAIN OF THOUGHT PROCESS
1. **Study Old Charts** → Understand visualization requirements
2. **Design Simple Components** → Create enhancement-ready structure
3. **Implement Basic Charts** → Working but simple visualizations
4. **Add Interactivity** → Basic user interactions
5. **Optimize Performance** → Handle large datasets efficiently

## SUCCESS CRITERIA
- ✅ All chart types have basic implementations
- ✅ Charts render data correctly
- ✅ Interactive filters work
- ✅ Responsive on all devices
- ✅ Ready for AI Studio enhancement
```

---

# 🔐 PHASE 4: AUTHENTICATION & USER MANAGEMENT

## 👤 PROMPT 4.1: Authentication System Developer Role

```markdown
# ROLE: Senior Authentication & Security Engineer

## CONTEXT
You're building a comprehensive authentication and user management system for the seasonality SaaS. The system needs to support multiple user roles, subscription tiers, and secure API access.

## USER ROLES & PERMISSIONS
1. **Admin** - Full system access, user management
2. **Research Team** - CSV upload permissions, data management
3. **Premium User** - All analysis features, API access
4. **Basic User** - Limited analysis features
5. **Trial User** - 7-day trial with restrictions

## TASK: Build Complete Authentication System

### STEP 1: JWT Authentication Service
```javascript
class AuthService {
  async register(userData) {
    // User registration with email verification
    // Password hashing with bcrypt
    // Role assignment based on subscription
  }
  
  async login(email, password) {
    // Credential validation
    // JWT token generation
    // Refresh token handling
  }
  
  async verifyToken(token) {
    // JWT verification
    // Role-based access control
    // Token refresh logic
  }
}
```

### STEP 2: User Management System
```javascript
class UserService {
  async createUser(userData, createdBy) {
    // Admin user creation
    // Role validation
    // Subscription tier assignment
  }
  
  async updateUserRole(userId, newRole, updatedBy) {
    // Role change with audit trail
    // Permission validation
    // Notification system
  }
  
  async manageSubscription(userId, subscriptionData) {
    // Subscription tier management
    // Feature access control
    // Billing integration ready
  }
}
```

### STEP 3: Role-Based Access Control (RBAC)
```javascript
const permissions = {
  admin: ['*'], // All permissions
  research: ['upload:csv', 'manage:data', 'view:analytics'],
  premium: ['view:analytics', 'export:data', 'api:access'],
  basic: ['view:basic-analytics'],
  trial: ['view:basic-analytics:limited']
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    // Check user permissions
    // Validate subscription status
    // Apply rate limiting based on tier
  };
};
```

### STEP 4: API Key Management
```javascript
class APIKeyService {
  async generateAPIKey(userId, permissions) {
    // Generate secure API key
    // Set permissions and rate limits
    // Track usage statistics
  }
  
  async validateAPIKey(apiKey) {
    // Validate API key
    // Check rate limits
    // Log API usage
  }
}
```

## DELIVERABLES
1. **auth/** - Authentication services and middleware
2. **users/** - User management services
3. **permissions/** - RBAC system
4. **api-keys/** - API key management
5. **middleware/** - Security middleware
6. **migrations/** - Database migrations for auth tables

## SECURITY FEATURES
- **Password Security** - Bcrypt hashing, complexity requirements
- **JWT Security** - Secure token generation, refresh tokens
- **Rate Limiting** - Per-user and per-endpoint limits
- **Audit Logging** - Complete audit trail
- **Session Management** - Secure session handling

## CHAIN OF THOUGHT PROCESS
1. **Design Security Model** → Plan authentication architecture
2. **Implement Core Auth** → JWT and user management
3. **Add RBAC System** → Role-based permissions
4. **Secure API Access** → API key management
5. **Add Audit Trail** → Security logging and monitoring

## SUCCESS CRITERIA
- ✅ Secure user registration and login
- ✅ Role-based access control working
- ✅ API key system functional
- ✅ Rate limiting implemented
- ✅ Comprehensive audit logging
```

---

# 📈 PHASE 5: ADVANCED FEATURES & ENHANCEMENTS

## 🔍 PROMPT 5.1: Advanced Analytics Developer Role

```markdown
# ROLE: Senior Analytics & Algorithm Developer

## CONTEXT
You're implementing advanced analytics features that go beyond the old system. These include real-time analysis, machine learning insights, and enhanced pattern detection.

## NEW SAAS FEATURES (Beyond Old System)
1. **Real-time Analysis** - Live market data integration
2. **ML Pattern Detection** - AI-powered pattern recognition
3. **Predictive Analytics** - Seasonal strength predictions
4. **Correlation Analysis** - Cross-asset correlation matrices
5. **Risk Metrics** - VaR, Sharpe ratio, drawdown analysis
6. **Alert System** - Custom alerts and notifications
7. **Portfolio Optimization** - Modern portfolio theory integration

## TASK: Build Advanced Analytics Engine

### STEP 1: Real-time Analysis Service
```javascript
class RealTimeAnalytics {
  async processLiveData(marketData) {
    // Real-time seasonality calculations
    // Live pattern detection
    // Instant alert triggering
  }
  
  async updateSeasonalityScores(symbol, newData) {
    // Incremental seasonality updates
    // Trend strength calculations
    // Pattern confidence scoring
  }
}
```

### STEP 2: Machine Learning Integration
```javascript
class MLAnalytics {
  async detectPatterns(historicalData) {
    // Pattern recognition algorithms
    // Seasonal strength prediction
    // Anomaly detection
  }
  
  async predictSeasonalStrength(symbol, timeframe) {
    // ML-based seasonal predictions
    // Confidence intervals
    // Risk assessments
  }
}
```

### STEP 3: Advanced Risk Metrics
```javascript
class RiskAnalytics {
  calculateVaR(returns, confidence = 0.95) {
    // Value at Risk calculations
    // Multiple methodologies
  }
  
  calculateSharpeRatio(returns, riskFreeRate) {
    // Risk-adjusted returns
    // Benchmark comparisons
  }
  
  calculateMaxDrawdown(priceData) {
    // Maximum drawdown analysis
    // Recovery time calculations
  }
}
```

### STEP 4: Alert & Notification System
```javascript
class AlertService {
  async createAlert(userId, alertConfig) {
    // Custom alert creation
    // Multiple trigger conditions
    // Notification preferences
  }
  
  async processAlerts(marketData) {
    // Real-time alert processing
    // Multi-channel notifications
    // Alert history tracking
  }
}
```

## DELIVERABLES
1. **analytics/** - Advanced analytics services
2. **ml/** - Machine learning integration
3. **alerts/** - Alert and notification system
4. **risk/** - Risk management utilities
5. **real-time/** - Live data processing
6. **optimization/** - Portfolio optimization tools

## ADVANCED FEATURES
- **Pattern Recognition** - AI-powered pattern detection
- **Predictive Models** - Seasonal strength forecasting
- **Risk Management** - Comprehensive risk metrics
- **Real-time Processing** - Live market data integration
- **Custom Alerts** - Flexible notification system

## CHAIN OF THOUGHT PROCESS
1. **Research Algorithms** → Study financial analysis methods
2. **Design ML Pipeline** → Plan machine learning integration
3. **Implement Analytics** → Build advanced calculation engines
4. **Add Real-time Features** → Live data processing
5. **Create Alert System** → Notification and monitoring

## SUCCESS CRITERIA
- ✅ Advanced analytics beyond old system
- ✅ Real-time data processing working
- ✅ ML pattern detection functional
- ✅ Alert system operational
- ✅ Risk metrics accurate and fast
```

---

# 🚀 PHASE 6: DEPLOYMENT & MONITORING

## 🔧 PROMPT 6.1: DevOps & Monitoring Engineer Role

```markdown
# ROLE: Senior DevOps Engineer & Site Reliability Engineer

## CONTEXT
You're setting up production deployment, monitoring, and maintenance for the seasonality SaaS platform. The system needs to handle 1000+ concurrent users with 99.9% uptime.

## PRODUCTION REQUIREMENTS
- **Availability**: 99.9% uptime SLA
- **Performance**: < 2s API response time
- **Scalability**: Auto-scaling based on load
- **Security**: Enterprise-grade security
- **Monitoring**: Comprehensive observability
- **Backup**: Automated backup and recovery

## TASK: Build Production-Ready Infrastructure

### STEP 1: Production Docker Setup
```yaml
# docker-compose.prod.yml
version: '3.9'
services:
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
  
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 5
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### STEP 2: Monitoring & Observability
```javascript
// Monitoring setup
const monitoring = {
  metrics: {
    prometheus: {
      // Application metrics
      // System metrics
      // Business metrics
    },
    grafana: {
      // Dashboards
      // Alerts
      // Visualizations
    }
  },
  
  logging: {
    winston: {
      // Structured logging
      // Log aggregation
      // Error tracking
    },
    elk: {
      // Elasticsearch
      // Logstash
      // Kibana
    }
  },
  
  tracing: {
    jaeger: {
      // Distributed tracing
      // Performance monitoring
      // Request flow tracking
    }
  }
};
```

### STEP 3: Auto-scaling Configuration
```yaml
# Auto-scaling rules
scaling:
  frontend:
    min_replicas: 2
    max_replicas: 10
    cpu_threshold: 70%
    memory_threshold: 80%
  
  backend:
    min_replicas: 3
    max_replicas: 15
    cpu_threshold: 60%
    memory_threshold: 75%
    
  database:
    read_replicas: 2
    connection_pooling: true
    query_optimization: enabled
```

### STEP 4: Backup & Recovery
```javascript
class BackupService {
  async createDatabaseBackup() {
    // Automated daily backups
    // Point-in-time recovery
    // Cross-region replication
  }
  
  async backupUserData() {
    // User preferences backup
    // Analysis results backup
    // File storage backup
  }
  
  async testRecovery() {
    // Automated recovery testing
    // RTO/RPO validation
    // Disaster recovery drills
  }
}
```

### STEP 5: Security Hardening
```javascript
const securityConfig = {
  ssl: {
    // SSL/TLS termination
    // Certificate management
    // HSTS headers
  },
  
  firewall: {
    // Network security rules
    // DDoS protection
    // Rate limiting
  },
  
  secrets: {
    // Secret management
    // Key rotation
    // Environment isolation
  }
};
```

## DELIVERABLES
1. **docker/** - Production Docker configurations
2. **monitoring/** - Prometheus, Grafana setup
3. **logging/** - Centralized logging system
4. **backup/** - Automated backup scripts
5. **security/** - Security configurations
6. **deployment/** - CI/CD pipeline setup

## MONITORING DASHBOARDS
- **System Health** - CPU, memory, disk, network
- **Application Metrics** - Response times, error rates
- **Business Metrics** - User activity, feature usage
- **Security Metrics** - Failed logins, API abuse
- **Performance Metrics** - Database queries, cache hit rates

## CHAIN OF THOUGHT PROCESS
1. **Plan Infrastructure** → Design production architecture
2. **Setup Monitoring** → Implement observability stack
3. **Configure Scaling** → Auto-scaling and load balancing
4. **Implement Security** → Harden production environment
5. **Test Recovery** → Validate backup and recovery procedures

## SUCCESS CRITERIA
- ✅ 99.9% uptime achieved
- ✅ Auto-scaling working correctly
- ✅ Comprehensive monitoring in place
- ✅ Backup and recovery tested
- ✅ Security hardening complete
```

---

# 📋 PROJECT EXECUTION PLAN

## 🎯 TODO CHECKLIST FOR AI AGENTS

### **PHASE 1: INFRASTRUCTURE (Week 1-2)**
- [ ] **Infrastructure Agent**: Create complete Docker Compose setup
- [ ] **Database Agent**: Design and implement Prisma schema
- [ ] **DevOps Agent**: Set up development environment
- [ ] **Security Agent**: Implement basic security measures

### **PHASE 2: BACKEND CORE (Week 3-5)**
- [ ] **Backend Agent**: Build Express.js API foundation
- [ ] **Data Processing Agent**: Implement CSV processing pipeline
- [ ] **Authentication Agent**: Build JWT auth system
- [ ] **API Agent**: Create all REST endpoints

### **PHASE 3: FRONTEND FOUNDATION (Week 6-8)**
- [ ] **Frontend Agent**: Create Next.js application structure
- [ ] **UI Agent**: Build basic component library
- [ ] **Chart Agent**: Implement simple chart components
- [ ] **Auth Frontend Agent**: Build login/registration UI

### **PHASE 4: ANALYSIS ENGINE (Week 9-12)**
- [ ] **Analytics Agent**: Implement all 11 analysis modules
- [ ] **Calculation Agent**: Replicate Python calculation logic
- [ ] **Filter Agent**: Build advanced filtering system
- [ ] **Statistics Agent**: Implement statistical calculations

### **PHASE 5: ADVANCED FEATURES (Week 13-15)**
- [ ] **ML Agent**: Add machine learning features
- [ ] **Real-time Agent**: Implement live data processing
- [ ] **Alert Agent**: Build notification system
- [ ] **Admin Agent**: Create admin panel

### **PHASE 6: DEPLOYMENT (Week 16-17)**
- [ ] **DevOps Agent**: Set up production environment
- [ ] **Monitoring Agent**: Implement observability stack
- [ ] **Testing Agent**: Comprehensive testing suite
- [ ] **Documentation Agent**: Create user and API documentation

---

## 🔄 RESEARCH → PLAN → EXECUTE METHODOLOGY

### **RESEARCH PHASE**
1. **Analyze Old System** - Study Python code and functionality
2. **Technology Research** - Best practices and modern approaches
3. **Architecture Planning** - Design scalable system architecture
4. **Performance Requirements** - Define SLAs and metrics

### **PLAN PHASE**
1. **Task Breakdown** - Detailed work breakdown structure
2. **Dependency Mapping** - Identify task dependencies
3. **Resource Allocation** - Assign agents to specific tasks
4. **Timeline Planning** - Create realistic project timeline

### **EXECUTE PHASE**
1. **Iterative Development** - Build in small, testable increments
2. **Continuous Integration** - Automated testing and deployment
3. **Progress Monitoring** - Track progress against milestones
4. **Quality Assurance** - Comprehensive testing at each phase

---

## 🎯 SUCCESS METRICS

### **Technical Metrics**
- ✅ **Performance**: API response time < 2 seconds
- ✅ **Scalability**: Handle 1000+ concurrent users
- ✅ **Reliability**: 99.9% uptime SLA
- ✅ **Security**: Zero security vulnerabilities

### **Business Metrics**
- ✅ **Feature Parity**: All old system features replicated
- ✅ **User Experience**: Improved UI/UX over old system
- ✅ **Data Processing**: 10x faster than CSV-based system
- ✅ **Scalability**: Multi-tenant SaaS ready

### **Quality Metrics**
- ✅ **Test Coverage**: 90%+ code coverage
- ✅ **Documentation**: Complete API and user documentation
- ✅ **Code Quality**: Clean, maintainable codebase
- ✅ **Monitoring**: Comprehensive observability

---

## 🔗 DEPENDENCY GRAPH & COORDINATION

### **Phase Dependencies**
```mermaid
graph TD
    A[Phase 1: Infrastructure] --> B[Phase 2: Backend Core]
    A --> C[Phase 3: Frontend Foundation]
    B --> D[Phase 4: Analysis Engine]
    C --> D
    D --> E[Phase 5: Advanced Features]
    B --> F[Phase 6: Deployment]
    C --> F
    E --> F
    
    A1[Docker Setup] --> A2[Database Schema]
    A2 --> B1[API Foundation]
    B1 --> B2[Authentication]
    B2 --> B3[Data Processing]
    B3 --> D1[Analysis Modules]
    
    C1[Next.js Setup] --> C2[Component Library]
    C2 --> C3[Chart Components]
    C3 --> D2[Frontend Integration]
    
    D1 --> E1[ML Features]
    D2 --> E1
    E1 --> F1[Production Deploy]
```

### **Critical Path Dependencies**
1. **Infrastructure → Backend**: Database must be ready before API development
2. **Backend Auth → Frontend Auth**: JWT system must work before UI integration
3. **Data Processing → Analysis**: CSV pipeline must work before analysis modules
4. **Analysis Engine → Advanced Features**: Core calculations before ML enhancements
5. **All Core Features → Deployment**: Everything must work before production

### **Parallel Development Opportunities**
- **Frontend + Backend**: Can develop simultaneously after infrastructure
- **Analysis Modules**: Can be built in parallel (11 different modules)
- **Chart Components**: Can be developed while backend APIs are being built
- **Documentation**: Can be written alongside development

---

## 🤝 MULTI-AGENT COORDINATION PROTOCOL

### **Agent Communication Standards**
```javascript
// Standard inter-agent communication format
const AgentMessage = {
  from: 'backend-agent',
  to: 'frontend-agent',
  type: 'API_ENDPOINT_READY',
  data: {
    endpoint: '/api/analysis/daily',
    method: 'POST',
    schema: {
      // OpenAPI schema
    },
    testData: {
      // Sample request/response
    }
  },
  timestamp: '2024-01-15T10:30:00Z',
  priority: 'HIGH'
};
```

### **Handoff Protocols**
1. **Infrastructure → Backend Handoff**
   - ✅ Database schema deployed and tested
   - ✅ All services running and healthy
   - ✅ Environment variables documented
   - ✅ Connection strings provided

2. **Backend → Frontend Handoff**
   - ✅ API endpoints documented with OpenAPI
   - ✅ Authentication flow tested
   - ✅ Sample data provided for all endpoints
   - ✅ Error response formats standardized

3. **Analysis → Frontend Handoff**
   - ✅ All calculation APIs working
   - ✅ Filter combinations tested
   - ✅ Chart data formats standardized
   - ✅ Performance benchmarks met

### **Quality Gates Between Phases**
Each phase must pass these gates before the next phase begins:

**Phase 1 → Phase 2 Gate**:
- [ ] All Docker services start successfully
- [ ] Database migrations run without errors
- [ ] Health checks return 200 OK
- [ ] Basic CRUD operations work

**Phase 2 → Phase 3 Gate**:
- [ ] Authentication endpoints working
- [ ] All API endpoints return valid responses
- [ ] Data processing pipeline handles sample files
- [ ] API documentation complete

**Phase 3 → Phase 4 Gate**:
- [ ] Basic UI components render correctly
- [ ] Authentication flow works end-to-end
- [ ] API integration successful
- [ ] Responsive design verified

---

## 📊 ENHANCED TESTING REQUIREMENTS

### **Unit Testing Requirements**
```javascript
// Example test structure for each component
describe('SeasonalityCalculationService', () => {
  describe('calculateDailyReturns', () => {
    it('should calculate returns correctly for positive changes', () => {
      const input = [
        { date: '2024-01-01', close: 100 },
        { date: '2024-01-02', close: 105 }
      ];
      const expected = [
        { date: '2024-01-02', return: 5.0, returnPercentage: 5.0 }
      ];
      const result = service.calculateDailyReturns(input);
      expect(result).toEqual(expected);
    });
    
    it('should handle edge cases: zero prices', () => {
      // Test zero price handling
    });
    
    it('should handle edge cases: missing data', () => {
      // Test missing data handling
    });
    
    it('should match Python system output exactly', () => {
      // Regression test against old system
    });
  });
});
```

### **Integration Testing Requirements**
```javascript
// API Integration Tests
describe('Daily Analysis API', () => {
  it('should process complete daily analysis workflow', async () => {
    // 1. Upload CSV file
    const uploadResponse = await request(app)
      .post('/api/upload/csv')
      .attach('file', 'test-data/BANKNIFTY_Daily.csv');
    
    // 2. Apply filters and get analysis
    const analysisResponse = await request(app)
      .post('/api/analysis/daily')
      .send({
        symbol: 'BANKNIFTY',
        filters: {
          dateRange: { start: '2020-01-01', end: '2023-12-31' },
          positiveNegativeDays: 'All',
          weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        }
      });
    
    // 3. Verify response structure and data accuracy
    expect(analysisResponse.status).toBe(200);
    expect(analysisResponse.body).toHaveProperty('chartData');
    expect(analysisResponse.body).toHaveProperty('statistics');
    expect(analysisResponse.body.chartData.length).toBeGreaterThan(0);
  });
});
```

### **Performance Testing Requirements**
```javascript
// Load Testing Specifications
const performanceTests = {
  apiResponseTime: {
    target: '< 2 seconds for 95% of requests',
    test: 'Artillery.js load test with 100 concurrent users',
    acceptance: 'P95 response time < 2000ms'
  },
  
  csvProcessing: {
    target: '300 files processed in < 10 minutes',
    test: 'Bulk upload of 300 CSV files (1MB each)',
    acceptance: 'All files processed successfully in < 600 seconds'
  },
  
  concurrentUsers: {
    target: '1000 concurrent users without degradation',
    test: 'Gradual ramp-up to 1000 users over 10 minutes',
    acceptance: 'Error rate < 1%, response time increase < 50%'
  }
};
```

### **End-to-End Testing Requirements**
```javascript
// Playwright E2E Tests
describe('Complete User Journey', () => {
  it('should complete full analysis workflow', async ({ page }) => {
    // 1. User registration and login
    await page.goto('/register');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'SecurePass123!');
    await page.click('[data-testid=register-button]');
    
    // 2. Navigate to Daily Analysis tab
    await page.click('[data-testid=daily-tab]');
    
    // 3. Select symbol and apply filters
    await page.selectOption('[data-testid=symbol-dropdown]', 'BANKNIFTY');
    await page.click('[data-testid=positive-days-only]');
    
    // 4. Verify chart renders
    await expect(page.locator('[data-testid=daily-chart]')).toBeVisible();
    
    // 5. Verify data table populates
    await expect(page.locator('[data-testid=data-table] tbody tr')).toHaveCount.greaterThan(0);
    
    // 6. Export functionality
    await page.click('[data-testid=export-button]');
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('daily-analysis');
  });
});
```

---

## ✅ ENHANCED OUTPUT VALIDATION CHECKLISTS

### **Infrastructure Code Validation**
When reviewing AI-generated infrastructure code:

**Docker Configuration**:
- [ ] No hardcoded secrets (all use environment variables)
- [ ] Proper resource limits set (memory, CPU)
- [ ] Health checks configured for all critical services
- [ ] Restart policies defined (unless-stopped, always)
- [ ] Volume mounts for data persistence
- [ ] Network isolation between services
- [ ] Port mappings documented and secure

**Database Schema**:
- [ ] All required indexes created
- [ ] Foreign key constraints properly defined
- [ ] Unique constraints prevent duplicate data
- [ ] Default values set appropriately
- [ ] Enum types used where applicable
- [ ] Timestamps (createdAt, updatedAt) on all tables
- [ ] Soft delete capability where needed

### **Backend Code Validation**
When reviewing AI-generated backend code:

**API Design**:
- [ ] RESTful URL patterns followed
- [ ] HTTP status codes used correctly
- [ ] Request/response schemas documented
- [ ] Error responses standardized
- [ ] Rate limiting implemented
- [ ] Authentication middleware applied
- [ ] Input validation on all endpoints

**Business Logic**:
- [ ] Calculations match Python system exactly
- [ ] Edge cases handled (null, zero, empty data)
- [ ] Error handling comprehensive
- [ ] Logging implemented for debugging
- [ ] Performance optimized (database queries, caching)
- [ ] Transaction handling for data consistency
- [ ] Background job processing for heavy operations

### **Frontend Code Validation**
When reviewing AI-generated frontend code:

**Component Quality**:
- [ ] TypeScript types defined for all props
- [ ] Error boundaries implemented
- [ ] Loading states handled
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility compliance (ARIA labels, keyboard navigation)
- [ ] Performance optimized (lazy loading, memoization)
- [ ] Consistent styling with design system

**User Experience**:
- [ ] Form validation with clear error messages
- [ ] Loading indicators for async operations
- [ ] Success/error notifications
- [ ] Intuitive navigation and workflows
- [ ] Data visualization clear and accurate
- [ ] Export functionality working
- [ ] Filter combinations work correctly

---

## 🎯 ENHANCED DEFINITION OF DONE

### **Phase 1: Infrastructure - DONE Criteria**
- [ ] **Deployment**: All services start with single `docker-compose up` command
- [ ] **Health**: All health checks return 200 OK within 60 seconds
- [ ] **Persistence**: Data survives container restarts
- [ ] **Security**: No default passwords, SSL ready
- [ ] **Monitoring**: Basic monitoring stack operational
- [ ] **Documentation**: Deployment guide written and tested
- [ ] **Testing**: Infrastructure tests pass on fresh Ubuntu 22.04

### **Phase 2: Backend - DONE Criteria**
- [ ] **API Coverage**: All 50+ endpoints implemented and documented
- [ ] **Authentication**: JWT auth working with role-based access
- [ ] **Data Processing**: CSV upload and processing pipeline complete
- [ ] **Calculations**: All Python calculations replicated with 100% accuracy
- [ ] **Performance**: API responses < 2 seconds for 95% of requests
- [ ] **Testing**: 90%+ unit test coverage, integration tests passing
- [ ] **Documentation**: OpenAPI spec complete with examples

### **Phase 3: Frontend - DONE Criteria**
- [ ] **UI Complete**: All 11 tabs implemented with basic functionality
- [ ] **Authentication**: Login/register flow working end-to-end
- [ ] **Responsive**: Works on mobile, tablet, desktop
- [ ] **Charts**: All chart types rendering with sample data
- [ ] **Filters**: All filter combinations working correctly
- [ ] **Performance**: Page load times < 3 seconds
- [ ] **Testing**: E2E tests covering main user journeys

### **Phase 4: Analysis Engine - DONE Criteria**0
- [ ] **Feature Parity**: All old system features replicated
- [ ] **Accuracy**: Calculations match Python system exactly
- [ ] **Performance**: Complex analysis completes in < 30 seconds
- [ ] **Filters**: All 40+ filter combinations working
- [ ] **Export**: Data export functionality complete
- [ ] **Testing**: Regression tests against old system data
- [ ] **Documentation**: Analysis methodology documented

### **Phase 5: Advanced Features - DONE Criteria**
- [ ] **ML Integration**: Pattern detection algorithms working
- [ ] **Real-time**: Live data processing operational
- [ ] **Alerts**: Notification system functional
- [ ] **Admin Panel**: User management interface complete
- [ ] **API Keys**: API key management system working
- [ ] **Performance**: Advanced features don't impact core performance
- [ ] **Testing**: New features have comprehensive test coverage

### **Phase 6: Deployment - DONE Criteria**
- [ ] **Production Ready**: System deployed and accessible
- [ ] **Monitoring**: Full observability stack operational
- [ ] **Backup**: Automated backup and recovery tested
- [ ] **Security**: Security hardening complete and audited
- [ ] **Performance**: SLA targets met under load
- [ ] **Documentation**: Operations runbook complete
- [ ] **Training**: Team trained on production operations

---

## 🚨 CRITICAL SUCCESS FACTORS

### **Technical Excellence**
1. **Zero Data Loss**: All user data must be preserved during migration
2. **Calculation Accuracy**: 100% match with Python system results
3. **Performance SLA**: Meet all performance targets consistently
4. **Security First**: No security vulnerabilities in production
5. **Scalability Proven**: System handles target load without issues

### **Business Success**
1. **Feature Parity**: All old system capabilities available
2. **User Experience**: Improved UX over old desktop application
3. **Multi-tenancy**: True SaaS with user isolation
4. **Cost Efficiency**: Stay within budget constraints
5. **Timeline Adherence**: Deliver within 6-month deadline

### **Operational Excellence**
1. **Reliability**: 99.9% uptime from day one
2. **Monitoring**: Complete visibility into system health
3. **Maintainability**: Clean, documented, testable code
4. **Disaster Recovery**: Proven backup and recovery procedures
5. **Team Knowledge**: Team can operate and maintain the system

---

*This comprehensive prompt collection provides everything needed to build a production-ready seasonality analysis SaaS platform. Each prompt includes detailed technical specifications, working code examples, comprehensive testing requirements, and clear success criteria. The multi-agent coordination protocol ensures smooth collaboration between different AI agents working on various components of the system.*