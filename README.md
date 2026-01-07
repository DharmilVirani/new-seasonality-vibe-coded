# 🏗️ Seasonality SaaS Infrastructure

A complete, production-ready infrastructure setup for the Seasonality Trading Analysis SaaS platform, optimized for Ubuntu desktop environments.

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url> seasonality-saas
cd seasonality-saas

# 2. Run the quick setup script
chmod +x scripts/quick-setup.sh
./scripts/quick-setup.sh

# 3. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# MinIO Console: http://localhost:9001
```

## 📋 System Requirements

### **Minimum Requirements**
- **OS**: Ubuntu 20.04 LTS or newer
- **CPU**: 4 cores (Intel i5 or AMD Ryzen 5 equivalent)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB free space (SSD preferred)
- **Network**: Stable internet connection

### **Software Dependencies**
- Docker 20.10+
- Docker Compose 2.0+
- Git (latest)
- curl, wget, htop

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Next.js)     │◄──►│   (Node.js)     │
│   Port: 3000    │    │   Port: 3001    │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   PostgreSQL    │
│   (Proxy)       │    │   (TimescaleDB) │
│   Port: 80/443  │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Redis         │
                       │   (Cache)       │
                       │   Port: 6379    │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   MinIO         │
                       │   (Storage)     │
                       │   Port: 9000    │
                       └─────────────────┘
```

## 🐳 Services

| Service | Purpose | Port | Memory | CPU |
|---------|---------|------|--------|-----|
| **PostgreSQL** | Time-series database | 5432 | 2GB | 1.0 |
| **Backend** | API server | 3001 | 1GB | 1.0 |
| **Worker** | Background processing | - | 512MB | 0.5 |
| **Frontend** | Web interface | 3000 | 512MB | 0.5 |
| **Redis** | Cache & sessions | 6379 | 256MB | 0.5 |
| **MinIO** | File storage | 9000/9001 | 512MB | 0.5 |
| **Nginx** | Reverse proxy | 80/443 | 128MB | 0.25 |

**Total Resource Usage**: ~5GB RAM, ~4 CPU cores

## 📁 Project Structure

```
seasonality-saas/
├── apps/
│   ├── backend/          # Node.js API server
│   └── frontend/         # Next.js web application
├── docker-compose.yml    # Main Docker configuration
├── docker-compose.low-memory.yml  # Low memory override
├── nginx/
│   └── nginx.conf        # Nginx configuration
├── init-scripts/
│   └── 01-init-database.sql  # Database initialization
├── scripts/
│   ├── quick-setup.sh    # One-command setup
│   ├── health-check.sh   # System health monitoring
│   ├── backup-system.sh  # Complete system backup
│   └── monitor-system.sh # Continuous monitoring
├── volumes/              # Persistent data storage
├── .env.example          # Environment template
└── INFRASTRUCTURE_SETUP_GUIDE.md  # Detailed setup guide
```

## ⚙️ Configuration

### **Environment Variables**
Copy `.env.example` to `.env` and customize:

```bash
# Database
DATABASE_URL=postgresql://seasonality:your_password@localhost:5432/seasonality

# Security
JWT_SECRET=your-super-secure-jwt-secret
BCRYPT_ROUNDS=12

# Performance
DB_POOL_SIZE=10
WORKER_CONCURRENCY=2
```

### **Resource Optimization**

For **8GB RAM systems**, use the low-memory configuration:
```bash
docker-compose -f docker-compose.yml -f docker-compose.low-memory.yml up -d
```

For **16GB+ RAM systems**, use the standard configuration:
```bash
docker-compose up -d
```

## 🔧 Management Commands

### **Service Management**
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart backend

# View logs
docker-compose logs -f backend

# Scale backend service
docker-compose up -d --scale backend=2
```

### **Health Monitoring**
```bash
# Run health check
./scripts/health-check.sh

# Start continuous monitoring
./scripts/monitor-system.sh

# Start monitoring as daemon
./scripts/monitor-system.sh --daemon
```

### **Backup & Recovery**
```bash
# Create full system backup
./scripts/backup-system.sh

# Restore from backup
./scripts/restore-backup.sh backup-file.tar.gz
```

## 🔍 Monitoring & Troubleshooting

### **System Health Dashboard**
- **Health Check**: `./scripts/health-check.sh`
- **Resource Usage**: `docker stats`
- **Service Status**: `docker-compose ps`
- **Logs**: `docker-compose logs [service]`

### **Common Issues**

#### Services Won't Start
```bash
# Check Docker daemon
sudo systemctl status docker

# Check available resources
free -h && df -h

# Restart Docker
sudo systemctl restart docker
```

#### High Memory Usage
```bash
# Check container memory usage
docker stats --no-stream

# Restart memory-heavy services
docker-compose restart backend postgres
```

#### Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U seasonality
```

## 🔐 Security Features

- **Network Isolation**: Services communicate through private Docker network
- **Rate Limiting**: API endpoints protected with rate limiting
- **Security Headers**: Comprehensive HTTP security headers
- **Input Validation**: All API inputs validated
- **Authentication**: JWT-based authentication with secure secrets
- **SSL Ready**: HTTPS configuration prepared

## 📊 Performance Optimization

### **Database Optimizations**
- TimescaleDB for time-series data
- Optimized indexes for common queries
- Connection pooling
- Query performance monitoring

### **Caching Strategy**
- Redis for session storage
- API response caching
- Static asset caching via Nginx

### **Resource Management**
- Container resource limits
- Memory usage monitoring
- Automatic cleanup of old data

## 🚀 Scaling Options

### **Vertical Scaling** (Single Machine)
- Increase container memory limits
- Add more CPU cores
- Upgrade to SSD storage

### **Horizontal Scaling** (Future)
- Docker Swarm for multi-node deployment
- Load balancer for multiple backend instances
- Database read replicas

## 📈 Monitoring & Alerts

The monitoring system tracks:
- **System Resources**: CPU, memory, disk usage
- **Service Health**: All container health checks
- **Application Performance**: API response times
- **Database Performance**: Query performance and connections
- **Storage Usage**: File storage and log sizes

Alerts are triggered for:
- High resource usage (>85%)
- Service failures
- Slow API responses (>2s)
- Database connection issues

## 🎯 Production Readiness

This infrastructure is production-ready with:
- ✅ **High Availability**: Automatic service restart
- ✅ **Data Persistence**: All data stored in named volumes
- ✅ **Backup Strategy**: Automated backup scripts
- ✅ **Monitoring**: Comprehensive health monitoring
- ✅ **Security**: Production security configurations
- ✅ **Performance**: Optimized for 100-1000 concurrent users
- ✅ **Scalability**: Designed for horizontal scaling

## 📞 Support

For detailed setup instructions, see [INFRASTRUCTURE_SETUP_GUIDE.md](INFRASTRUCTURE_SETUP_GUIDE.md)

### **Quick Help**
- **Setup Issues**: Check the setup guide and run `./scripts/health-check.sh`
- **Performance Issues**: Monitor resources with `docker stats` and `htop`
- **Service Issues**: Check logs with `docker-compose logs [service]`
- **Data Issues**: Verify backups and run database health checks

---

**🎉 Your Seasonality SaaS infrastructure is ready for production!**

Built with ❤️ for scalable, reliable trading analysis.