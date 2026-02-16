#!/bin/bash
# Seasonality SaaS - Easy Startup Script
# Run this to start all services


set -e


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color


echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Seasonality SaaS - Starting...       ${NC}"
echo -e "${GREEN}=========================================${NC}"


# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from template...${NC}"
    cp .env.example .env
fi


# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running!${NC}"
    echo "Please start Docker and try again."
    exit 1
fi


echo -e "${GREEN}Building and starting containers...${NC}"
docker-compose up -d --build


echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Services Started!                    ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  MinIO:    http://localhost:9000"
echo "            (Console: http://localhost:9001)"
echo "  Redis:    localhost:6379"
echo "  Postgres: localhost:5432"
echo ""
echo -e "${YELLOW}View logs:${NC} docker-compose logs -f"
echo -e "${YELLOW}Stop:${NC} docker-compose down"
echo ""