#!/bin/bash

# Deploy script for BMB Backend
# This script is executed on EC2 instance to deploy the latest version

set -e  # Exit on any error

# Configuration
APP_DIR="/home/ubuntu/Bmb-backend/cloutsy"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Function to check if Docker Hub credentials are set
check_docker_credentials() {
    if [ -f "$ENV_FILE" ] && grep -q "DOCKERHUB_USERNAME" "$ENV_FILE"; then
        log "Docker Hub credentials found in $ENV_FILE"
        source "$ENV_FILE"
    else
        error "DOCKERHUB_USERNAME not found in $ENV_FILE"
        error "Please set up your environment variables"
        exit 1
    fi
}

# Function to pull latest code
pull_latest_code() {
    log "Pulling latest code from repository..."
    
    # Check current branch
    current_branch=$(git branch --show-current)
    log "Current branch: $current_branch"
    
    # Pull latest changes
    git fetch origin
    git reset --hard origin/$current_branch
    
    log "Code updated successfully"
}

# Function to stop services gracefully
stop_services() {
    log "Stopping existing services..."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans
    elif [ -f "docker-compose.yml" ]; then
        docker-compose down --remove-orphans
    else
        warn "No docker-compose file found, skipping service stop"
    fi
    
    log "Services stopped"
}

# Function to pull latest images
pull_images() {
    log "Pulling latest Docker images..."
    
    # Set environment variables for docker-compose
    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="latest"
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" pull
    else
        docker-compose pull
    fi
    
    log "Images pulled successfully"
}

# Function to start services
start_services() {
    log "Starting services..."
    
    # Set environment variables for docker-compose
    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="latest"
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    else
        docker-compose up -d
    fi
    
    log "Services started"
}

# Function to check service health
check_health() {
    log "Checking service health..."
    
    # Wait a bit for services to start
    sleep 30
    
    # Check if containers are running
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        running_services=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps --services --filter "status=running")
    else
        running_services=$(docker-compose ps --services --filter "status=running")
    fi
    
    log "Running services: $running_services"
    
    # Basic health checks
    check_url() {
        local url=$1
        local service=$2
        local max_attempts=5
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if curl -f -s "$url" > /dev/null; then
                log "$service health check passed"
                return 0
            else
                warn "$service health check failed (attempt $attempt/$max_attempts)"
                sleep 10
                attempt=$((attempt + 1))
            fi
        done
        
        error "$service health check failed after $max_attempts attempts"
        return 1
    }
    
    # Check API Gateway
    if echo "$running_services" | grep -q "api-gateway"; then
        check_url "http://localhost:3001/health" "API Gateway" || true
    fi
    
    # Check Product Service
    if echo "$running_services" | grep -q "product-service"; then
        check_url "http://localhost:3002/health" "Product Service" || true
    fi
    
    # Check Incollab Service (via nginx proxy)
    if echo "$running_services" | grep -q "incollab"; then
        check_url "http://localhost/api" "Incollab Service" || true
    fi
}

# Function to cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this in production)
    # docker volume prune -f
    
    log "Cleanup completed"
}

# Function to show deployment summary
show_summary() {
    log "Deployment Summary:"
    echo "===================="
    
    # Show running containers
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    
    # Show disk usage
    echo "Docker disk usage:"
    docker system df
    
    echo ""
    log "Deployment completed successfully!"
}

# Main deployment function
main() {
    log "Starting BMB Backend deployment..."
    
    # Change to app directory
    cd "$APP_DIR" || {
        error "Failed to change to app directory: $APP_DIR"
        exit 1
    }
    
    # Check prerequisites
    check_docker_credentials
    
    # Deployment steps
    pull_latest_code
    stop_services
    pull_images
    start_services
    check_health
    cleanup
    show_summary
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    stop)
        log "Stopping all services..."
        cd "$APP_DIR" && stop_services
        ;;
    start)
        log "Starting all services..."
        cd "$APP_DIR" && start_services
        ;;
    restart)
        log "Restarting all services..."
        cd "$APP_DIR" && stop_services && start_services
        ;;
    status)
        log "Service status:"
        cd "$APP_DIR" && docker-compose ps
        ;;
    logs)
        service=${2:-}
        if [ -n "$service" ]; then
            log "Showing logs for $service..."
            cd "$APP_DIR" && docker-compose logs -f "$service"
        else
            log "Showing logs for all services..."
            cd "$APP_DIR" && docker-compose logs -f
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|stop|start|restart|status|logs [service]}"
        echo "  deploy  - Full deployment (default)"
        echo "  stop    - Stop all services"
        echo "  start   - Start all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status"
        echo "  logs    - Show logs (optionally for specific service)"
        exit 1
        ;;
esac