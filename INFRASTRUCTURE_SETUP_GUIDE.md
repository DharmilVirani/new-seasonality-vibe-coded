# 🏗️ Seasonality SaaS Infrastructure Setup Guide

## 📋 Overview
This guide will help you set up the complete seasonality trading analysis SaaS platform on your Ubuntu desktop PC. The setup is optimized for resource-constrained environments while maintaining production-ready capabilities.

## 🖥️ System Requirements

### **Minimum Hardware Requirements**
- **CPU**: 4 cores (Intel i5 or AMD Ryzen 5 equivalent)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB free space (SSD preferred)
- **Network**: Stable internet connection

### **Software Requirements**
- **OS**: Ubuntu 20.04 LTS or newer
- **Docker**: 20.10 or newer
- **Docker Compose**: 2.0 or newer
- **Git**: Latest version
- **Node.js**: 18.x or newer (for development)

## 🚀 Quick Start (5 Minutes)

```bash
# Clone and setup in one command
git clone <your-repo-url> seasonality-saas
cd seasonality-saas
chmod +x scripts/quick-setup.sh
./scripts/quick-setup.sh
```

## 📖 Detailed Setup Instructions

### **Step 1: System Preparation**

#### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git htop
```

#### 1.2 Install Docker
```bash
# Remove old Docker versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### 1.3 Install Node.js (for development)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

### **Step 2: Project Setup**

#### 2.1 Clone Repository
```bash
git clone <your-repo-url> seasonality-saas
cd seasonality-saas
```

#### 2.2 Create Directory Structure
```bash
mkdir -p {docker,apps/{frontend,backend},scripts,volumes/{postgres,redis,minio},nginx}
```

#### 2.3 Set Up Environment Variables
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### **Step 3: Infrastructure Configuration**

#### 3.1 Docker Compose Configuration
The main `docker-compose.yml` is optimized for your Ubuntu desktop:

```yaml
# Resource allocation optimized for 8-16GB RAM systems
# Services configured for single-machine deployment
# Persistent volumes for data safety
```

#### 3.2 Network Configuration
```bash
# Create Docker network
docker network create seasonality-net

# Verify network
docker network ls
```

### **Step 4: Service Deployment**

#### 4.1 Build and Start Services
```bash
# Start infrastructure services first
docker-compose up -d postgres redis minio

# Wait for services to be ready
sleep 30

# Start application services
docker-compose up -d backend frontend nginx

# Check all services
docker-compose ps
```

#### 4.2 Verify Deployment
```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check service logs
docker-compose logs -f backend
```

### **Step 5: Data Migration (Optional)**

If you have existing CSV data from the old system, you can migrate it:

```mermaid
flowchart TD
    A[Old CSV Files<br/>217 Symbols × 5 Timeframes] --> B[Migration Script<br/>data-migration.js]
    B --> C{Data Processing}
    C --> D[Parse & Validate<br/>OHLCV + OpenInterest]
    C --> E[Create Tickers<br/>Symbol Metadata]
    C --> F[Transform Data<br/>Type Conversion]
    
    D --> G[Batch Processing<br/>1000 records/batch]
    E --> G
    F --> G
    
    G --> H{Timeframe Router}
    H --> I[DailyData Table<br/>TimescaleDB Hypertable]
    H --> J[WeeklyData Table<br/>Monday/Expiry Types]
    H --> K[MonthlyData Table<br/>Monthly Aggregates]
    H --> L[YearlyData Table<br/>Yearly Summaries]
    
    I --> M[Performance Optimization<br/>Indexes & Compression]
    J --> M
    K --> M
    L --> M
    
    M --> N[Migration Complete<br/>Database Ready]
    
    style A fill:#e1f5fe
    style B fill:#fff3e0
    style G fill:#e8f5e8
    style N fill:#c8e6c9
```

#### 5.1 Run Data Migration
```bash
# Navigate to backend directory
cd apps/backend

# Install dependencies
npm install

# Run database setup (creates schema and optimizations)
./scripts/setup-database.sh

# Migrate specific symbols (recommended for testing)
node scripts/data-migration.js --symbols "NIFTY,BANKNIFTY,RELIANCE"

# Or migrate all symbols (takes longer)
node scripts/data-migration.js

# Check migration progress
docker-compose logs -f backend
```

#### 5.2 MinIO Setup
```bash
# Create required buckets
docker-compose exec backend npm run setup-storage
```

#### 5.3 Create Admin User
```bash
# Create first admin user
docker-compose exec backend npm run create-admin
```

## 🔧 Configuration Files

### **Environment Variables (.env)**
```bash
# Database Configuration
DATABASE_URL=postgresql://seasonality:your_secure_password@localhost:5432/seasonality
POSTGRES_USER=seasonality
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=seasonality

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=your_secure_minio_password
MINIO_USE_SSL=false

# Application Configuration
NODE_ENV=production
JWT_SECRET=your_super_secure_jwt_secret_key_here
API_PORT=3001
FRONTEND_PORT=3000

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your_session_secret_here

# Performance
DB_POOL_SIZE=10
REDIS_MAX_MEMORY=256mb
WORKER_CONCURRENCY=2
```

## 🐳 Docker Services Overview

### **Service Architecture**
```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js Frontend<br/>Port: 3000]
    end
    
    subgraph "Proxy Layer"
        B[Nginx Reverse Proxy<br/>Port: 80/443<br/>Load Balancer & SSL]
    end
    
    subgraph "Application Layer"
        C[Node.js Backend<br/>Port: 3001<br/>API Server]
        D[Background Worker<br/>CSV Processing<br/>Analysis Jobs]
    end
    
    subgraph "Data Layer"
        E[PostgreSQL + TimescaleDB<br/>Port: 5432<br/>Time-series Database]
        F[Redis Cache<br/>Port: 6379<br/>Session & Cache]
        G[MinIO Storage<br/>Port: 9000/9001<br/>File Storage]
    end
    
    A --> B
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G
    D --> E
    D --> G
    
    style A fill:#e3f2fd
    style B fill:#e8f5e8
    style C fill:#fff3e0
    style D fill:#fff3e0
    style E fill:#fce4ec
    style F fill:#f3e5f5
    style G fill:#e0f2f1
```

### **Database Architecture**
```mermaid
graph TB
    subgraph "TimescaleDB Hypertables"
        H1[DailyData<br/>1 Month Chunks<br/>10M+ Records/Symbol]
        H2[WeeklyData<br/>3 Month Chunks<br/>Monday/Expiry Types]
        H3[MonthlyData<br/>1 Year Chunks<br/>Monthly Aggregates]
        H4[YearlyData<br/>5 Year Chunks<br/>Yearly Summaries]
    end
    
    subgraph "Supporting Tables"
        S1[Ticker<br/>Symbol Metadata<br/>217 Symbols]
        S2[User<br/>Authentication<br/>Multi-tenant]
        S3[UploadBatch<br/>File Processing<br/>Progress Tracking]
    end
    
    subgraph "Performance Layer"
        P1[Materialized Views<br/>Pre-computed Stats]
        P2[Strategic Indexes<br/>Query Optimization]
        P3[Compression Policies<br/>Storage Efficiency]
    end
    
    S1 --> H1
    S1 --> H2
    S1 --> H3
    S1 --> H4
    
    H1 --> P1
    H2 --> P1
    H3 --> P1
    H4 --> P1
    
    H1 --> P2
    H2 --> P2
    H3 --> P2
    H4 --> P2
    
    P1 --> P3
    P2 --> P3
    
    style H1 fill:#e3f2fd
    style H2 fill:#e8f5e8
    style H3 fill:#fff3e0
    style H4 fill:#fce4ec
    style S1 fill:#f3e5f5
    style S2 fill:#e0f2f1
    style S3 fill:#fafafa
```

### **Resource Allocation (8GB RAM System)**
- **PostgreSQL**: 2GB RAM, 20GB storage
- **Backend**: 1GB RAM (2 replicas = 2GB total)
- **Frontend**: 512MB RAM
- **Redis**: 256MB RAM
- **MinIO**: 512MB RAM
- **Nginx**: 128MB RAM
- **System Reserve**: 2GB RAM

## 🔍 Monitoring & Maintenance

### **Comprehensive Monitoring Architecture**

```mermaid
graph TB
    subgraph "System Health Monitoring"
        A[Health Check Script<br/>./scripts/health-check.sh]
        A --> B[Service Status<br/>All Containers Running]
        A --> C[Resource Usage<br/>CPU, Memory, Disk]
        A --> D[Network Connectivity<br/>Inter-service Communication]
    end
    
    subgraph "Database Monitoring"
        E[Database Statistics<br/>get_database_statistics()]
        E --> F[Table Sizes<br/>Row Counts & Storage]
        E --> G[Query Performance<br/>Response Times]
        E --> H[Index Usage<br/>Optimization Status]
    end
    
    subgraph "Application Monitoring"
        I[API Monitoring<br/>Response Times]
        I --> J[User Activity<br/>Active Sessions]
        I --> K[Data Processing<br/>CSV Upload Status]
        I --> L[Error Tracking<br/>System Logs]
    end
    
    subgraph "TimescaleDB Monitoring"
        M[Hypertable Status<br/>Chunk Information]
        M --> N[Compression Status<br/>Storage Efficiency]
        M --> O[Retention Policies<br/>Data Lifecycle]
        M --> P[Performance Metrics<br/>Query Optimization]
    end
    
    B --> Q[Alerting System<br/>Slack/Email Notifications]
    F --> Q
    J --> Q
    N --> Q
    
    style A fill:#e3f2fd
    style E fill:#e8f5e8
    style I fill:#fff3e0
    style M fill:#fce4ec
    style Q fill:#c8e6c9
```

### **Health Monitoring**
```bash
# Check system resources
htop

# Check Docker stats
docker stats

# Check service health
curl http://localhost:3001/api/health
curl http://localhost:9000/minio/health/live

# Run comprehensive health check
./scripts/health-check.sh

# Monitor database performance
docker-compose exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT * FROM get_database_statistics();\`.then(console.log);
"
```

### **Log Management**
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Clear old logs
docker system prune -f
```

### **Backup Procedures**
```bash
# Database backup
./scripts/backup-database.sh

# Full system backup
./scripts/backup-system.sh

# Restore from backup
./scripts/restore-backup.sh backup-2024-01-15.tar.gz
```

## 🚨 Troubleshooting

### **Common Issues**

#### Issue 1: Services Won't Start
```bash
# Check Docker daemon
sudo systemctl status docker

# Check available resources
free -h
df -h

# Restart Docker
sudo systemctl restart docker
```

#### Issue 2: Database Connection Failed
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down
docker volume rm seasonality_postgres_data
docker-compose up -d postgres
```

#### Issue 3: High Memory Usage
```bash
# Check memory usage
docker stats --no-stream

# Restart memory-heavy services
docker-compose restart backend
docker-compose restart postgres
```

#### Issue 4: Disk Space Full
```bash
# Clean Docker system
docker system prune -a -f

# Clean old logs
sudo journalctl --vacuum-time=7d

# Check large files
du -sh /var/lib/docker/*
```

## 📊 Performance Optimization

### **For 8GB RAM Systems**
```yaml
# Reduced resource limits
backend:
  deploy:
    resources:
      limits:
        memory: 512M
      reservations:
        memory: 256M

postgres:
  deploy:
    resources:
      limits:
        memory: 1.5G
      reservations:
        memory: 1G
```

### **For 16GB+ RAM Systems**
```yaml
# Standard resource limits
backend:
  deploy:
    resources:
      limits:
        memory: 1G
      reservations:
        memory: 512M

postgres:
  deploy:
    resources:
      limits:
        memory: 3G
      reservations:
        memory: 2G
```

## 🔐 Security Hardening

### **Basic Security Setup**
```bash
# Enable UFW firewall
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # Frontend (development)
sudo ufw allow 3001  # Backend API

# Secure Docker daemon
sudo systemctl edit docker
```

### **SSL Certificate Setup**
```bash
# Install Certbot
sudo apt install certbot

# Generate SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

## 📈 Scaling Considerations

### **Vertical Scaling (Single Machine)**
- Increase RAM allocation to services
- Add SSD storage for better I/O
- Optimize PostgreSQL configuration

### **Horizontal Scaling (Future)**
- Docker Swarm for multi-node deployment
- Load balancer for multiple backend instances
- Database read replicas

## 🎯 Success Criteria

After successful setup, you should have:

- ✅ All services running and healthy
- ✅ Frontend accessible at http://localhost:3000
- ✅ Backend API responding at http://localhost:3001
- ✅ Database accepting connections
- ✅ File uploads working through MinIO
- ✅ Redis caching operational
- ✅ System using < 80% of available RAM
- ✅ All health checks passing

## 📞 Support & Maintenance

### **Daily Maintenance**
```bash
# Check system health
./scripts/daily-health-check.sh

# Update containers (if needed)
docker-compose pull
docker-compose up -d
```

### **Weekly Maintenance**
```bash
# Full system backup
./scripts/weekly-backup.sh

# Clean up old data
./scripts/cleanup-old-data.sh

# Update system packages
sudo apt update && sudo apt upgrade -y
```

### **Monthly Maintenance**
```bash
# Security updates
sudo apt update && sudo apt upgrade -y

# Docker system cleanup
docker system prune -a -f

# Review logs and performance
./scripts/performance-report.sh
```

## 🔗 Useful Commands

```bash
# Quick service restart
docker-compose restart backend

# View real-time logs
docker-compose logs -f --tail=100

# Execute commands in containers
docker-compose exec backend bash
docker-compose exec postgres psql -U seasonality

# Check service dependencies
docker-compose config --services

# Scale services
docker-compose up -d --scale backend=2

# Stop all services
docker-compose down

# Stop and remove all data
docker-compose down -v
```

---

**🎉 Congratulations!** Your seasonality SaaS platform is now running on your Ubuntu desktop. The system is optimized for resource efficiency while maintaining production-ready capabilities.

For additional support, check the troubleshooting section or review the service logs for specific error messages.