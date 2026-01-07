#!/bin/bash

# Seasonality SaaS Health Check Script
# Comprehensive health monitoring for all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_CHECKS++))
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_CHECKS++))
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Function to run a health check
run_check() {
    local check_name="$1"
    local check_command="$2"
    local expected_result="$3"
    
    ((TOTAL_CHECKS++))
    print_status "Checking $check_name..."
    
    if eval "$check_command" &>/dev/null; then
        if [ -n "$expected_result" ]; then
            local result=$(eval "$check_command" 2>/dev/null)
            if [[ "$result" == *"$expected_result"* ]]; then
                print_success "$check_name is healthy"
            else
                print_error "$check_name check failed - unexpected result: $result"
            fi
        else
            print_success "$check_name is healthy"
        fi
    else
        print_error "$check_name is not responding"
    fi
}

echo "🏥 Seasonality SaaS Health Check"
echo "=================================="
echo "Timestamp: $(date)"
echo

# Check 1: Docker daemon
print_status "Checking Docker daemon..."
if docker info &>/dev/null; then
    print_success "Docker daemon is running"
    ((PASSED_CHECKS++))
else
    print_error "Docker daemon is not running"
    ((FAILED_CHECKS++))
    exit 1
fi
((TOTAL_CHECKS++))

# Check 2: Docker Compose services
print_status "Checking Docker Compose services..."
RUNNING_SERVICES=$(docker-compose ps --services --filter "status=running" | wc -l)
TOTAL_SERVICES=$(docker-compose ps --services | wc -l)

if [ "$RUNNING_SERVICES" -eq "$TOTAL_SERVICES" ] && [ "$TOTAL_SERVICES" -gt 0 ]; then
    print_success "All $TOTAL_SERVICES services are running"
    ((PASSED_CHECKS++))
else
    print_error "Only $RUNNING_SERVICES out of $TOTAL_SERVICES services are running"
    docker-compose ps
    ((FAILED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Check 3: PostgreSQL
run_check "PostgreSQL connection" \
    "docker-compose exec -T postgres pg_isready -U seasonality -d seasonality" \
    "accepting connections"

# Check 4: PostgreSQL query
run_check "PostgreSQL query test" \
    "docker-compose exec -T postgres psql -U seasonality -d seasonality -c 'SELECT 1;'" \
    "1 row"

# Check 5: Redis
run_check "Redis connection" \
    "docker-compose exec -T redis redis-cli ping" \
    "PONG"

# Check 6: Redis memory usage
REDIS_MEMORY=$(docker-compose exec -T redis redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
if [ -n "$REDIS_MEMORY" ]; then
    print_success "Redis memory usage: $REDIS_MEMORY"
    ((PASSED_CHECKS++))
else
    print_error "Could not get Redis memory usage"
    ((FAILED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Check 7: MinIO health
run_check "MinIO health endpoint" \
    "curl -f http://localhost:9000/minio/health/live" \
    ""

# Check 8: MinIO ready
run_check "MinIO ready endpoint" \
    "curl -f http://localhost:9000/minio/health/ready" \
    ""

# Check 9: Backend API health (if backend is running)
if docker-compose ps backend | grep -q "Up"; then
    run_check "Backend API health" \
        "curl -f http://localhost:3001/api/health" \
        ""
    
    # Check 10: Backend API response time
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3001/api/health 2>/dev/null || echo "0")
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        print_success "Backend API response time: ${RESPONSE_TIME}s (< 2s)"
        ((PASSED_CHECKS++))
    else
        print_error "Backend API response time: ${RESPONSE_TIME}s (> 2s)"
        ((FAILED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
else
    print_warning "Backend service is not running - skipping API checks"
fi

# Check 11: Frontend (if frontend is running)
if docker-compose ps frontend | grep -q "Up"; then
    run_check "Frontend accessibility" \
        "curl -f http://localhost:3000" \
        ""
else
    print_warning "Frontend service is not running - skipping frontend checks"
fi

# Check 12: Nginx (if nginx is running)
if docker-compose ps nginx | grep -q "Up"; then
    run_check "Nginx health endpoint" \
        "curl -f http://localhost/health" \
        "healthy"
else
    print_warning "Nginx service is not running - skipping nginx checks"
fi

# Check 13: System resources
print_status "Checking system resources..."

# Memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
if (( $(echo "$MEMORY_USAGE < 90.0" | bc -l) )); then
    print_success "Memory usage: ${MEMORY_USAGE}% (< 90%)"
    ((PASSED_CHECKS++))
else
    print_error "Memory usage: ${MEMORY_USAGE}% (> 90%)"
    ((FAILED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Disk usage
DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 85 ]; then
    print_success "Disk usage: ${DISK_USAGE}% (< 85%)"
    ((PASSED_CHECKS++))
else
    print_error "Disk usage: ${DISK_USAGE}% (> 85%)"
    ((FAILED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Check 14: Docker container resource usage
print_status "Checking Docker container resources..."
echo "Container Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Check for containers using too much memory
HIGH_MEMORY_CONTAINERS=$(docker stats --no-stream --format "{{.Container}} {{.MemPerc}}" | awk '$2 > 90 {print $1}')
if [ -z "$HIGH_MEMORY_CONTAINERS" ]; then
    print_success "No containers using excessive memory (> 90%)"
    ((PASSED_CHECKS++))
else
    print_error "Containers using high memory: $HIGH_MEMORY_CONTAINERS"
    ((FAILED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Check 15: Network connectivity between services
print_status "Checking inter-service connectivity..."

# Backend to PostgreSQL
if docker-compose ps backend | grep -q "Up" && docker-compose ps postgres | grep -q "Up"; then
    if docker-compose exec -T backend nc -z postgres 5432 &>/dev/null; then
        print_success "Backend can connect to PostgreSQL"
        ((PASSED_CHECKS++))
    else
        print_error "Backend cannot connect to PostgreSQL"
        ((FAILED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
fi

# Backend to Redis
if docker-compose ps backend | grep -q "Up" && docker-compose ps redis | grep -q "Up"; then
    if docker-compose exec -T backend nc -z redis 6379 &>/dev/null; then
        print_success "Backend can connect to Redis"
        ((PASSED_CHECKS++))
    else
        print_error "Backend cannot connect to Redis"
        ((FAILED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
fi

# Backend to MinIO
if docker-compose ps backend | grep -q "Up" && docker-compose ps minio | grep -q "Up"; then
    if docker-compose exec -T backend nc -z minio 9000 &>/dev/null; then
        print_success "Backend can connect to MinIO"
        ((PASSED_CHECKS++))
    else
        print_error "Backend cannot connect to MinIO"
        ((FAILED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
fi

# Summary
echo
echo "=================================="
echo "🏥 Health Check Summary"
echo "=================================="
echo "Total Checks: $TOTAL_CHECKS"
echo "Passed: $PASSED_CHECKS"
echo "Failed: $FAILED_CHECKS"
echo "Success Rate: $(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))%"
echo

if [ "$FAILED_CHECKS" -eq 0 ]; then
    print_success "All health checks passed! 🎉"
    echo
    echo "System Status: HEALTHY ✅"
    echo "All services are running optimally."
    exit 0
elif [ "$FAILED_CHECKS" -lt 3 ]; then
    print_warning "Some health checks failed, but system is mostly operational"
    echo
    echo "System Status: DEGRADED ⚠️"
    echo "Some non-critical issues detected. Monitor closely."
    exit 1
else
    print_error "Multiple health checks failed!"
    echo
    echo "System Status: UNHEALTHY ❌"
    echo "Critical issues detected. Immediate attention required."
    echo
    echo "Troubleshooting steps:"
    echo "1. Check service logs: docker-compose logs [service-name]"
    echo "2. Restart failed services: docker-compose restart [service-name]"
    echo "3. Check system resources: htop, df -h"
    echo "4. Verify network connectivity: docker network ls"
    exit 2
fi