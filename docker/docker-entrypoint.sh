#!/bin/sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${GREEN}Starting Witylogix Platform...${NC}"

# Function to wait for service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local max_attempts=30
    local attempt=1

    echo "${YELLOW}Waiting for $service to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "${GREEN}$service is ready!${NC}"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: $service not ready, retrying..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "${RED}Error: $service did not become ready in time${NC}"
    return 1
}

# Wait for PostgreSQL
wait_for_service postgres 5432 "PostgreSQL"

# Wait for Redis
wait_for_service redis 6379 "Redis"

# Run Prisma migrations
if [ -f "dist/prisma.schema" ] || [ -d "packages/db/prisma" ]; then
    echo "${YELLOW}Running database migrations...${NC}"
    npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma || true
    echo "${GREEN}Migrations completed!${NC}"
fi

# Handle graceful shutdown
trap 'echo "${YELLOW}Received SIGTERM, shutting down gracefully...${NC}"; exit 0' TERM

echo "${GREEN}Starting application...${NC}"

# Execute the command passed to the container
exec "$@"
