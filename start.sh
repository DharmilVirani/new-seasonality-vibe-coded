#!/bin/bash
# Seasonality SaaS - Startup Script with Beautiful CLI UI

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Box drawing characters
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
ARROW="${CYAN}▸${NC}"
SPINNER="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

# Spinner function
spin() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while kill -0 $pid 2>/dev/null; do
        local temp=${spinstr:0:1}
        spinstr=${spinstr:1}${temp}
        printf "\r${CYAN}  ${temp} ${1}${NC}"
        sleep $delay
    done
    printf "\r"
}

print_header() {
    clear
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}${MAGENTA}🚀 Seasonality SaaS${NC} ${DIM}Production Server${NC}                         ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                                   ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${DIM}Loading...${NC}                                                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${ARROW} ${BOLD}$1${NC}"
}

print_success() {
    echo -e "  ${CHECK} ${GREEN}$1${NC}"
}

print_error() {
    echo -e "  ${CROSS} ${RED}$1${NC}"
}

print_warning() {
    echo -e "  ${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "  ${DIM}$1${NC}"
}

print_section() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━ $1 ━━━${NC}"
    echo ""
}

# Main
print_header

# Check if .env exists
print_step "Checking configuration..."
if [ ! -f .env ]; then
    print_warning ".env not found, creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success ".env created"
    else
        print_error ".env.example not found!"
        exit 1
    fi
else
    print_success ".env found"
fi

# Check Docker
print_step "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running!"
    echo ""
    echo -e "  ${YELLOW}Please start Docker and try again.${NC}"
    exit 1
fi
print_success "Docker is running"

# Check ports
print_step "Checking ports..."
PORTS_OK=true
for port in 3000 3001 5432 6379 9000 9001; do
    if lsof -i:$port > /dev/null 2>&1; then
        print_warning "Port $port is in use"
        PORTS_OK=false
    fi
done
if [ "$PORTS_OK" = true ]; then
    print_success "Required ports available"
fi

# Stop existing containers
print_section "Cleaning Up"
print_step "Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true
print_success "Containers stopped"

# Build and start
print_section "Building & Starting Services"
print_step "Building Docker images (this may take a few minutes)..."

# Build with progress
docker-compose build --parallel 2>&1 | while read line; do
    if echo "$line" | grep -q "Step"; then
        echo -e "  ${DIM}$line${NC}"
    fi
done

print_success "Images built"

print_step "Starting all services..."
docker-compose up -d

# Wait for services to be healthy
print_section "Checking Services"

services=("postgres" "redis" "minio" "backend" "worker" "frontend")
max_wait=60
waited=0

for service in "${services[@]}"; do
    echo -n "  ${ARROW} Starting $service... "
    
    # Wait for container to be running
    while ! docker ps --format '{{.Names}}' | grep -q "$service" 2>/dev/null; do
        sleep 1
        ((waited++))
        if [ $waited -gt $max_wait ]; then
            echo -e "${CROSS}"
            print_error "$service failed to start (timeout)"
            break
        fi
    done
    
    # Check if healthy
    if docker inspect --format='{{.State.Health.Status}}' $service 2>/dev/null | grep -q "healthy"; then
        echo -e "${CHECK}"
    elif docker ps --format '{{.Names}}' | grep -q "$service"; then
        echo -e "${CHECK} ${DIM}(running)${NC}"
    else
        echo -e "${CROSS}"
    fi
done

# Final status
echo ""
print_section "🎉 Server Ready!"

echo -e "  ${GREEN}${BOLD}Access URLs:${NC}"
echo ""
echo -e "  ${CYAN}▸ Frontend:${NC}   ${BOLD}http://localhost:3000${NC}"
echo -e "  ${CYAN}▸ Backend API:${NC} ${BOLD}http://localhost:3001${NC}"
echo -e "  ${CYAN}▸ MinIO:${NC}      http://localhost:9000 (${GREEN}files${NC})"
echo -e "  ${CYAN}▸ MinIO Console:${NC} http://localhost:9001"
echo ""
echo -e "  ${DIM}Database: localhost:5432${NC}"
echo -e "  ${DIM}Redis:   localhost:6379${NC}"
echo ""

echo -e "${YELLOW}Quick Commands:${NC}"
echo ""
echo -e "  ${DIM}View all logs:${NC}     docker-compose logs -f"
echo -e "  ${DIM}View backend:${NC}     docker-compose logs -f backend"
echo -e "  ${DIM}Stop server:${NC}      docker-compose down"
echo -e "  ${DIM}Restart:${NC}          docker-compose restart"
echo ""

# Health check
print_step "Running health checks..."
sleep 3

BACKEND_OK=false
FRONTEND_OK=false

if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    BACKEND_OK=true
    print_success "Backend API is healthy"
else
    print_warning "Backend API may need more time to start"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    FRONTEND_OK=true
    print_success "Frontend is running"
else
    print_warning "Frontend may need more time to start"
fi

echo ""
if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  ✅ All systems operational! Ready to use.                 ${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}  ⚠️  Server starting... Check docker-compose logs if issues. ${NC}"
    echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi
echo ""
