#!/bin/bash

# Deploy script for BMB Backend
# This script is executed on EC2 instance to deploy the latest version

set -e  # Exit on any error

# Configuration
APP_DIR="/home/ubuntu/Incollabe-BE"
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

# Function to stop only the app service
stop_app_service() {
    log "Stopping incollab-app service..."

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" stop incollab-app
        docker-compose -f "$DOCKER_COMPOSE_FILE" rm -f incollab-app
    else
        docker-compose stop incollab-app
        docker-compose rm -f incollab-app
    fi

    log "App service stopped"
}

# Function to stop all services (kept for manual use)
stop_services() {
    log "Stopping all services..."

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans
    else
        docker-compose down --remove-orphans || true
    fi

    log "All services stopped"
}

# Function to pull only app image
pull_app_image() {
    log "Pulling latest incollab-app Docker image..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="latest"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" pull incollab-app
    else
        docker-compose pull incollab-app
    fi

    log "App image pulled successfully"
}

# Function to pull all images (kept for manual use)
pull_images() {
    log "Pulling all Docker images..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="latest"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" pull
    else
        docker-compose pull
    fi

    log "All images pulled successfully"
}

# Function to start only app service
start_app_service() {
    log "Starting incollab-app service..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="latest"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --no-deps incollab-app
    else
        docker-compose up -d --no-deps incollab-app
    fi

    log "App service started"
}

# Function to start all services (kept for manual use)
start_services() {
    log "Starting all services..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="latest"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    else
        docker-compose up -d
    fi

    log "All services started"
}

# Function to check service health
check_health() {
    log "Checking service health..."
    sleep 30

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        running_services=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps --services --filter "status=running")
    else
        running_services=$(docker-compose ps --services --filter "status=running")
    fi

    log "Running services: $running_services"

    if echo "$running_services" | grep -q "incollab"; then
        local url="http://localhost:3002/health"
        local attempts=5
        local count=1
        while [ $count -le $attempts ]; do
            if curl -f -s "$url" > /dev/null; then
                log "Incollab Service health check passed"
                return 0
            else
                warn "Incollab health check failed (attempt $count/$attempts)"
                sleep 10
            fi
            count=$((count + 1))
        done
        error "Incollab health check failed after $attempts attempts"
    fi
}

# Function to cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    docker image prune -f
    log "Cleanup completed"
}

# Function to handle nginx configuration
handle_nginx_config() {
    if [ -f "nginx.conf" ]; then
        log "Reloading nginx configuration..."
        # Test nginx configuration
        if docker exec incollab-nginx nginx -t 2>/dev/null; then
            # Reload nginx to apply changes
            docker exec incollab-nginx nginx -s reload
            log "Nginx configuration reloaded successfully"
        else
            error "Nginx configuration test failed!"
            warn "Please check nginx.conf for errors"
            # Restart nginx container to pick up changes if test fails
            log "Restarting nginx container..."
            docker-compose restart nginx
        fi
    else
        warn "No nginx.conf file found in current directory"
    fi
}

# Function to show deployment summary
show_summary() {
    log "Deployment Summary:"
    echo "===================="

    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo "Docker disk usage:"
    docker system df

    echo ""
    log "Deployment completed successfully!"
}

# Main deployment function (app-only)
main() {
    log "Starting Incollab app deployment..."

    cd "$APP_DIR" || {
        error "Failed to change to app directory: $APP_DIR"
        exit 1
    }

    check_docker_credentials
    stop_app_service
    pull_app_image
    start_app_service
    handle_nginx_config
    check_health
    cleanup
    show_summary
}

# Full deployment function (all services)
full_deploy() {
    log "Starting full Incollab deployment..."

    cd "$APP_DIR" || {
        error "Failed to change to app directory: $APP_DIR"
        exit 1
    }

    check_docker_credentials
    stop_services
    pull_images
    start_services
    check_health
    cleanup
    show_summary
}

# Handle script arguments
case "${1:-deploy}" in
    deploy) main ;;
    full-deploy) full_deploy ;;
    stop) log "Stopping all services..."; cd "$APP_DIR" && stop_services ;;
    stop-app) log "Stopping app service..."; cd "$APP_DIR" && stop_app_service ;;
    start) log "Starting all services..."; cd "$APP_DIR" && start_services ;;
    start-app) log "Starting app service..."; cd "$APP_DIR" && start_app_service ;;
    restart) log "Restarting all services..."; cd "$APP_DIR" && stop_services && start_services ;;
    restart-app) log "Restarting app service..."; cd "$APP_DIR" && stop_app_service && pull_app_image && start_app_service ;;
    status) log "Service status:"; cd "$APP_DIR" && docker-compose ps ;;
    logs) service=${2:-}; cd "$APP_DIR";
          if [ -n "$service" ]; then
              docker-compose logs -f "$service"
          else
              docker-compose logs -f
          fi ;;
    *) echo "Usage: $0 {deploy|full-deploy|stop|stop-app|start|start-app|restart|restart-app|status|logs [service]}"; exit 1 ;;
esac
