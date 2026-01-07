#!/bin/bash

# Seasonality SaaS System Monitoring Script
# Continuous monitoring with alerts and logging

set -e

# Configuration
MONITOR_INTERVAL=30  # seconds
LOG_FILE="./logs/monitor.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=85

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create logs directory
mkdir -p ./logs

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case $level in
        "ERROR")
            echo -e "${RED}[$timestamp] [ERROR]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] [WARNING]${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}[$timestamp] [INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] [SUCCESS]${NC} $message"
            ;;
    esac
}

# Function to send alert (customize as needed)
send_alert() {
    local severity="$1"
    local message="$2"
    
    log_message "$severity" "ALERT: $message"
    
    # Add your alert mechanisms here:
    # - Email notifications
    # - Slack webhooks
    # - Discord notifications
    # - SMS alerts
    
    # Example Slack webhook (uncomment and configure)
    # if [ -n "$SLACK_WEBHOOK_URL" ]; then
    #     curl -X POST -H 'Content-type: application/json' \
    #         --data "{\"text\":\"🚨 Seasonality SaaS Alert: $message\"}" \
    #         "$SLACK_WEBHOOK_URL"
    # fi
}

# Function to check system resources
check_system_resources() {
    # CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    CPU_USAGE_NUM=$(echo "$CPU_USAGE" | sed 's/%//')
    
    if (( $(echo "$CPU_USAGE_NUM > $ALERT_THRESHOLD_CPU" | bc -l) )); then
        send_alert "WARNING" "High CPU usage: $CPU_USAGE"
    fi
    
    # Memory usage
    MEMORY_INFO=$(free | grep Mem)
    MEMORY_TOTAL=$(echo $MEMORY_INFO | awk '{print $2}')
    MEMORY_USED=$(echo $MEMORY_INFO | awk '{print $3}')
    MEMORY_USAGE=$(echo "scale=1; $MEMORY_USED * 100 / $MEMORY_TOTAL" | bc)
    
    if (( $(echo "$MEMORY_USAGE > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
        send_alert "WARNING" "High memory usage: ${MEMORY_USAGE}%"
    fi
    
    # Disk usage
    DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$DISK_USAGE" -gt "$ALERT_THRESHOLD_DISK" ]; then
        send_alert "WARNING" "High disk usage: ${DISK_USAGE}%"
    fi
    
    log_message "INFO" "System resources - CPU: $CPU_USAGE, Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}%"
}

# Function to check Docker services
check_docker_services() {
    local services_down=0
    local services_unhealthy=0
    
    # Check if Docker is running
    if ! docker info &>/dev/null; then
        send_alert "ERROR" "Docker daemon is not running"
        return 1
    fi
    
    # Check each service
    while IFS= read -r service; do
        if [ -n "$service" ]; then
            local status=$(docker-compose ps "$service" --format "{{.State}}")
            local health=$(docker-compose ps "$service" --format "{{.Health}}")
            
            if [[ "$status" != "running" ]]; then
                send_alert "ERROR" "Service $service is not running (status: $status)"
                ((services_down++))
            elif [[ "$health" == "unhealthy" ]]; then
                send_alert "WARNING" "Service $service is unhealthy"
                ((services_unhealthy++))
            fi
        fi
    done < <(docker-compose ps --services)
    
    if [ "$services_down" -eq 0 ] && [ "$services_unhealthy" -eq 0 ]; then
        log_message "SUCCESS" "All Docker services are running and healthy"
    else
        log_message "WARNING" "Services down: $services_down, unhealthy: $services_unhealthy"
    fi
}

# Function to check application endpoints
check_application_endpoints() {
    local endpoints_down=0
    
    # Backend API health check
    if curl -f -s http://localhost:3001/api/health &>/dev/null; then
        log_message "SUCCESS" "Backend API is responding"
    else
        send_alert "ERROR" "Backend API is not responding"
        ((endpoints_down++))
    fi
    
    # Frontend check
    if curl -f -s http://localhost:3000 &>/dev/null; then
        log_message "SUCCESS" "Frontend is responding"
    else
        send_alert "ERROR" "Frontend is not responding"
        ((endpoints_down++))
    fi
    
    # MinIO health check
    if curl -f -s http://localhost:9000/minio/health/live &>/dev/null; then
        log_message "SUCCESS" "MinIO is responding"
    else
        send_alert "ERROR" "MinIO is not responding"
        ((endpoints_down++))
    fi
    
    # Database connection check
    if docker-compose exec -T postgres pg_isready -U seasonality &>/dev/null; then
        log_message "SUCCESS" "PostgreSQL is accepting connections"
    else
        send_alert "ERROR" "PostgreSQL is not accepting connections"
        ((endpoints_down++))
    fi
    
    # Redis connection check
    if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
        log_message "SUCCESS" "Redis is responding"
    else
        send_alert "ERROR" "Redis is not responding"
        ((endpoints_down++))
    fi
    
    if [ "$endpoints_down" -gt 0 ]; then
        send_alert "WARNING" "$endpoints_down application endpoints are down"
    fi
}

# Function to check container resources
check_container_resources() {
    local high_memory_containers=()
    local high_cpu_containers=()
    
    # Get container stats
    while IFS= read -r line; do
        if [[ "$line" =~ ^[a-zA-Z0-9_-]+[[:space:]]+([0-9.]+)%[[:space:]]+.*[[:space:]]([0-9.]+)% ]]; then
            local container=$(echo "$line" | awk '{print $1}')
            local cpu_percent=$(echo "$line" | awk '{print $2}' | sed 's/%//')
            local mem_percent=$(echo "$line" | awk '{print $7}' | sed 's/%//')
            
            if (( $(echo "$cpu_percent > 80" | bc -l) )); then
                high_cpu_containers+=("$container:${cpu_percent}%")
            fi
            
            if (( $(echo "$mem_percent > 90" | bc -l) )); then
                high_memory_containers+=("$container:${mem_percent}%")
            fi
        fi
    done < <(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}")
    
    if [ ${#high_cpu_containers[@]} -gt 0 ]; then
        send_alert "WARNING" "High CPU usage containers: ${high_cpu_containers[*]}"
    fi
    
    if [ ${#high_memory_containers[@]} -gt 0 ]; then
        send_alert "WARNING" "High memory usage containers: ${high_memory_containers[*]}"
    fi
}

# Function to check log file sizes
check_log_sizes() {
    local large_logs=()
    
    # Check Docker container logs
    for container in $(docker-compose ps -q); do
        if [ -n "$container" ]; then
            local log_size=$(docker logs "$container" 2>&1 | wc -c)
            local log_size_mb=$((log_size / 1024 / 1024))
            
            if [ "$log_size_mb" -gt 100 ]; then  # 100MB threshold
                local container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/\///')
                large_logs+=("$container_name:${log_size_mb}MB")
            fi
        fi
    done
    
    if [ ${#large_logs[@]} -gt 0 ]; then
        send_alert "WARNING" "Large log files detected: ${large_logs[*]}"
    fi
}

# Function to generate monitoring report
generate_report() {
    local report_file="./logs/monitoring_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
Seasonality SaaS Monitoring Report
==================================
Generated: $(date)

System Resources:
$(free -h)

Disk Usage:
$(df -h)

Docker Services:
$(docker-compose ps)

Container Resources:
$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}")

Recent Alerts (last 100 lines):
$(tail -100 "$LOG_FILE" | grep -E "(ERROR|WARNING)" || echo "No recent alerts")

Database Statistics:
$(docker-compose exec -T postgres psql -U seasonality -d seasonality -c "SELECT schemaname, tablename, n_tup_ins, n_tup_del FROM pg_stat_user_tables;" 2>/dev/null || echo "Database not accessible")

EOF
    
    log_message "INFO" "Monitoring report generated: $report_file"
}

# Main monitoring loop
main() {
    log_message "INFO" "Starting Seasonality SaaS monitoring system"
    log_message "INFO" "Monitor interval: ${MONITOR_INTERVAL}s"
    log_message "INFO" "Alert thresholds - CPU: ${ALERT_THRESHOLD_CPU}%, Memory: ${ALERT_THRESHOLD_MEMORY}%, Disk: ${ALERT_THRESHOLD_DISK}%"
    
    # Trap signals for graceful shutdown
    trap 'log_message "INFO" "Monitoring system shutting down"; exit 0' SIGINT SIGTERM
    
    local iteration=0
    
    while true; do
        ((iteration++))
        
        log_message "INFO" "Monitoring iteration #$iteration"
        
        # Run all checks
        check_system_resources
        check_docker_services
        check_application_endpoints
        check_container_resources
        check_log_sizes
        
        # Generate report every hour (120 iterations at 30s interval)
        if [ $((iteration % 120)) -eq 0 ]; then
            generate_report
        fi
        
        # Clean up old logs every 24 hours (2880 iterations at 30s interval)
        if [ $((iteration % 2880)) -eq 0 ]; then
            find ./logs -name "monitoring_report_*.txt" -mtime +7 -delete
            find ./logs -name "*.log" -size +100M -exec truncate -s 50M {} \;
            log_message "INFO" "Log cleanup completed"
        fi
        
        sleep "$MONITOR_INTERVAL"
    done
}

# Check if running in daemon mode
if [ "$1" = "--daemon" ]; then
    # Run as daemon
    nohup "$0" > /dev/null 2>&1 &
    echo "Monitoring system started as daemon (PID: $!)"
    echo "Logs: $LOG_FILE"
    echo "To stop: kill $!"
else
    # Run in foreground
    main
fi