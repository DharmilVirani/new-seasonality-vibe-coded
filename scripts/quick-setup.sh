#!/bin/bash

# Seasonality SaaS Quick Setup Script
# This script sets up the entire infrastructure in one go

set -e  # Exit on any error

echo "🚀 Seasonality SaaS Quick Setup Starting..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Step 1: Check system requirements
print_status "Checking system requirements..."

# Check available memory
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
if [ "$TOTAL_MEM" -lt 7000 ]; then
    print_warning "System has ${TOTAL_MEM}MB RAM. Minimum 8GB recommended."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "System has ${TOTAL_MEM}MB RAM - sufficient"
fi

# Check available disk space
AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 50 ]; then
    print_warning "Available disk space: ${AVAILABLE_SPACE}GB. Minimum 50GB recommended."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Available disk space: ${AVAILABLE_SPACE}GB - sufficient"
fi

# Step 2: Check Docker installation
print_status "Checking Docker installation..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Run: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if user is in docker group
if ! groups $USER | grep -q docker; then
    print_error "User $USER is not in docker group. Please add user to docker group:"
    echo "sudo usermod -aG docker $USER"
    echo "Then logout and login again."
    exit 1
fi

print_success "Docker installation verified"

# Step 3: Create directory structure
print_status "Creating directory structure..."

mkdir -p {apps/{frontend,backend},scripts,volumes/{postgres,redis,minio},nginx/ssl,init-scripts}

print_success "Directory structure created"

# Step 4: Set up environment variables
print_status "Setting up environment variables..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Environment file created from template"
        
        # Generate secure secrets
        JWT_SECRET=$(openssl rand -base64 32)
        SESSION_SECRET=$(openssl rand -base64 32)
        DB_PASSWORD=$(openssl rand -base64 16)
        MINIO_SECRET=$(openssl rand -base64 16)
        
        # Update .env file with generated secrets
        sed -i "s/your-super-secure-jwt-secret-key-change-this-in-production/$JWT_SECRET/" .env
        sed -i "s/your-session-secret-change-this-in-production/$SESSION_SECRET/" .env
        sed -i "s/seasonality123/$DB_PASSWORD/" .env
        sed -i "s/admin12345/$MINIO_SECRET/" .env
        
        print_success "Secure secrets generated and configured"
    else
        print_error ".env.example file not found. Please create environment configuration."
        exit 1
    fi
else
    print_success "Environment file already exists"
fi

# Step 5: Create Docker network
print_status "Creating Docker network..."

if ! docker network ls | grep -q seasonality-net; then
    docker network create seasonality-net
    print_success "Docker network created"
else
    print_success "Docker network already exists"
fi

# Step 6: Pull Docker images
print_status "Pulling Docker images (this may take a while)..."

docker-compose pull

print_success "Docker images pulled successfully"

# Step 7: Start infrastructure services
print_status "Starting infrastructure services..."

# Start database, cache, and storage first
docker-compose up -d postgres redis minio

print_status "Waiting for infrastructure services to be ready..."
sleep 30

# Check if services are healthy
for i in {1..12}; do
    if docker-compose ps | grep -E "(postgres|redis|minio)" | grep -q "healthy\|Up"; then
        print_success "Infrastructure services are ready"
        break
    fi
    if [ $i -eq 12 ]; then
        print_error "Infrastructure services failed to start properly"
        docker-compose logs
        exit 1
    fi
    print_status "Waiting for services... (attempt $i/12)"
    sleep 10
done

# Step 8: Build and start application services
print_status "Building and starting application services..."

# Note: This assumes the backend and frontend code exists
if [ -d "apps/backend" ] && [ -d "apps/frontend" ]; then
    docker-compose up -d --build backend worker frontend nginx
    print_success "Application services started"
else
    print_warning "Backend/Frontend code not found. Starting infrastructure only."
    print_warning "You'll need to add the application code and restart services."
fi

# Step 9: Wait for all services to be ready
print_status "Waiting for all services to be ready..."
sleep 60

# Step 10: Run health checks
print_status "Running health checks..."

# Check if health check script exists
if [ -f "scripts/health-check.sh" ]; then
    chmod +x scripts/health-check.sh
    ./scripts/health-check.sh
else
    # Basic health checks
    print_status "Running basic health checks..."
    
    # Check PostgreSQL
    if docker-compose exec -T postgres pg_isready -U seasonality; then
        print_success "PostgreSQL is ready"
    else
        print_error "PostgreSQL health check failed"
    fi
    
    # Check Redis
    if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
        print_success "Redis is ready"
    else
        print_error "Redis health check failed"
    fi
    
    # Check MinIO
    if curl -f http://localhost:9000/minio/health/live &>/dev/null; then
        print_success "MinIO is ready"
    else
        print_error "MinIO health check failed"
    fi
fi

# Step 11: Display final status
echo
echo "================================================"
echo "🎉 Seasonality SaaS Setup Complete!"
echo "================================================"
echo
echo "Services Status:"
docker-compose ps
echo
echo "Access URLs:"
echo "  Frontend:     http://localhost:3000"
echo "  Backend API:  http://localhost:3001"
echo "  MinIO Console: http://localhost:9001"
echo "  Database:     localhost:5432"
echo
echo "Next Steps:"
echo "1. If you haven't added the application code yet:"
echo "   - Add your backend code to apps/backend/"
echo "   - Add your frontend code to apps/frontend/"
echo "   - Run: docker-compose up -d --build"
echo
echo "2. Initialize the database:"
echo "   docker-compose exec backend npm run migrate"
echo
echo "3. Create an admin user:"
echo "   docker-compose exec backend npm run create-admin"
echo
echo "4. Monitor logs:"
echo "   docker-compose logs -f"
echo
echo "For troubleshooting, check the logs:"
echo "  docker-compose logs [service-name]"
echo
print_success "Setup completed successfully!"