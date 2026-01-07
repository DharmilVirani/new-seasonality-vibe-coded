#!/bin/bash

# Seasonality SaaS System Backup Script
# Creates comprehensive backups of all data and configurations

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="seasonality_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "💾 Seasonality SaaS System Backup"
echo "=================================="
echo "Timestamp: $(date)"
echo "Backup Name: $BACKUP_NAME"
echo

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Step 1: Backup PostgreSQL database
print_status "Backing up PostgreSQL database..."
if docker-compose ps postgres | grep -q "Up"; then
    docker-compose exec -T postgres pg_dump -U seasonality -d seasonality --clean --if-exists > "$BACKUP_PATH/database.sql"
    print_success "Database backup completed"
else
    print_error "PostgreSQL is not running - skipping database backup"
fi

# Step 2: Backup Redis data
print_status "Backing up Redis data..."
if docker-compose ps redis | grep -q "Up"; then
    # Create Redis backup
    docker-compose exec -T redis redis-cli BGSAVE
    sleep 5  # Wait for background save to complete
    
    # Copy the dump file
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_PATH/redis_dump.rdb"
    print_success "Redis backup completed"
else
    print_error "Redis is not running - skipping Redis backup"
fi

# Step 3: Backup MinIO data
print_status "Backing up MinIO data..."
if docker-compose ps minio | grep -q "Up"; then
    mkdir -p "$BACKUP_PATH/minio"
    docker cp $(docker-compose ps -q minio):/data "$BACKUP_PATH/minio/"
    print_success "MinIO backup completed"
else
    print_error "MinIO is not running - skipping MinIO backup"
fi

# Step 4: Backup Docker volumes
print_status "Backing up Docker volumes..."
mkdir -p "$BACKUP_PATH/volumes"

# List all volumes used by the project
VOLUMES=$(docker-compose config --volumes)
for volume in $VOLUMES; do
    if docker volume ls | grep -q "$volume"; then
        print_status "Backing up volume: $volume"
        docker run --rm -v "${volume}:/data" -v "$PWD/$BACKUP_PATH/volumes:/backup" alpine tar czf "/backup/${volume}.tar.gz" -C /data .
        print_success "Volume $volume backed up"
    fi
done

# Step 5: Backup configuration files
print_status "Backing up configuration files..."
mkdir -p "$BACKUP_PATH/config"

# Copy important configuration files
cp docker-compose.yml "$BACKUP_PATH/config/" 2>/dev/null || print_warning "docker-compose.yml not found"
cp .env "$BACKUP_PATH/config/env.backup" 2>/dev/null || print_warning ".env not found"
cp -r nginx "$BACKUP_PATH/config/" 2>/dev/null || print_warning "nginx config not found"
cp -r init-scripts "$BACKUP_PATH/config/" 2>/dev/null || print_warning "init-scripts not found"

print_success "Configuration files backed up"

# Step 6: Backup application code (if exists)
print_status "Backing up application code..."
if [ -d "apps" ]; then
    cp -r apps "$BACKUP_PATH/"
    print_success "Application code backed up"
else
    print_warning "No application code found to backup"
fi

# Step 7: Create backup metadata
print_status "Creating backup metadata..."
cat > "$BACKUP_PATH/backup_info.txt" << EOF
Seasonality SaaS Backup Information
===================================
Backup Date: $(date)
Backup Name: $BACKUP_NAME
System Info: $(uname -a)
Docker Version: $(docker --version)
Docker Compose Version: $(docker-compose --version)

Services Status at Backup Time:
$(docker-compose ps)

Docker Images:
$(docker-compose images)

System Resources:
Memory: $(free -h | grep Mem)
Disk: $(df -h .)

Backup Contents:
- PostgreSQL database dump
- Redis data dump
- MinIO file storage
- Docker volumes
- Configuration files
- Application code (if present)

Restore Instructions:
1. Stop all services: docker-compose down -v
2. Extract backup: tar -xzf ${BACKUP_NAME}.tar.gz
3. Run restore script: ./scripts/restore-backup.sh ${BACKUP_NAME}
EOF

print_success "Backup metadata created"

# Step 8: Create compressed archive
print_status "Creating compressed archive..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"  # Remove uncompressed directory
cd - > /dev/null

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
print_success "Compressed backup created: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Step 9: Cleanup old backups (keep last 7 days)
print_status "Cleaning up old backups..."
find "$BACKUP_DIR" -name "seasonality_backup_*.tar.gz" -mtime +7 -delete
REMAINING_BACKUPS=$(ls -1 "$BACKUP_DIR"/seasonality_backup_*.tar.gz 2>/dev/null | wc -l)
print_success "Cleanup completed. $REMAINING_BACKUPS backup(s) retained"

# Step 10: Verify backup integrity
print_status "Verifying backup integrity..."
if tar -tzf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" > /dev/null; then
    print_success "Backup integrity verified"
else
    print_error "Backup integrity check failed!"
    exit 1
fi

echo
echo "=================================="
echo "💾 Backup Summary"
echo "=================================="
echo "Backup File: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Backup Size: $BACKUP_SIZE"
echo "Backup Location: $(realpath ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz)"
echo
echo "Backup Contents:"
echo "  ✓ PostgreSQL database"
echo "  ✓ Redis data"
echo "  ✓ MinIO file storage"
echo "  ✓ Docker volumes"
echo "  ✓ Configuration files"
echo "  ✓ Application code"
echo "  ✓ Backup metadata"
echo
echo "To restore this backup:"
echo "  ./scripts/restore-backup.sh ${BACKUP_NAME}.tar.gz"
echo
print_success "System backup completed successfully! 🎉"

# Optional: Upload to remote storage (uncomment if needed)
# print_status "Uploading backup to remote storage..."
# # Add your remote backup commands here
# # Example: rsync, scp, aws s3 cp, etc.
# print_success "Backup uploaded to remote storage"