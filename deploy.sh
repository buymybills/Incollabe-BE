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

# Detect docker-compose command (v1 or v2)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    log "Using docker-compose (v1)"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    log "Using docker compose (v2)"
else
    error "Neither 'docker-compose' nor 'docker compose' command found"
    error "Please install Docker Compose"
    exit 1
fi

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
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" stop incollab-app
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" rm -f incollab-app
    else
        $DOCKER_COMPOSE stop incollab-app
        $DOCKER_COMPOSE rm -f incollab-app
    fi

    log "App service stopped"
}

# Function to stop all services (kept for manual use)
stop_services() {
    log "Stopping all services..."

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" down --remove-orphans
    else
        $DOCKER_COMPOSE down --remove-orphans || true
    fi

    log "All services stopped"
}

# Function to pull only app image
pull_app_image() {
    log "Pulling latest incollab-app Docker image..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="${IMAGE_TAG:-latest}"

    log "Using image tag: $IMAGE_TAG"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" pull incollab-app
    else
        $DOCKER_COMPOSE pull incollab-app
    fi

    log "App image pulled successfully"
}

# Function to pull all images (kept for manual use)
pull_images() {
    log "Pulling all Docker images..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="${IMAGE_TAG:-latest}"

    log "Using image tag: $IMAGE_TAG"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" pull
    else
        $DOCKER_COMPOSE pull
    fi

    log "All images pulled successfully"
}

# Function to start only app service
start_app_service() {
    log "Starting incollab-app service..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="${IMAGE_TAG:-latest}"

    log "Using image tag: $IMAGE_TAG"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" up -d --no-deps incollab-app
    else
        $DOCKER_COMPOSE up -d --no-deps incollab-app
    fi

    log "App service started"
}

# Function to start all services (kept for manual use)
start_services() {
    log "Starting all services..."

    export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}"
    export IMAGE_TAG="${IMAGE_TAG:-latest}"

    log "Using image tag: $IMAGE_TAG"

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" up -d
    else
        $DOCKER_COMPOSE up -d
    fi

    log "All services started"
}

# Function to check service health
check_health() {
    log "Checking service health..."
    sleep 30

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        running_services=$($DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" ps --services --filter "status=running")
    else
        running_services=$($DOCKER_COMPOSE ps --services --filter "status=running")
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
        log "Checking nginx configuration..."
        # Test nginx configuration
        if docker exec incollab-nginx nginx -t 2>/dev/null; then
            # Reload nginx to apply changes
            docker exec incollab-nginx nginx -s reload
            log "Nginx configuration reloaded successfully"
        else
            error "Nginx configuration test failed!"
            warn "Nginx may need to be recreated with new volume mounts"
            # Stop and remove nginx to recreate with updated docker-compose.yml
            log "Recreating nginx container with updated configuration..."
            $DOCKER_COMPOSE stop nginx
            $DOCKER_COMPOSE rm -f nginx
            $DOCKER_COMPOSE up -d nginx
            log "Nginx container recreated"
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

# Function to pull latest code from git
pull_git_changes() {
    # Check if we're in a git repository
    if [ -d ".git" ]; then
        log "Pulling latest code from git..."

        # Stash any local changes to avoid conflicts
        git stash

        # Pull latest changes
        if git pull origin dev; then
            log "Git pull completed successfully"
        else
            error "Git pull failed"
            exit 1
        fi
    else
        log "Not a git repository - skipping git pull (CI/CD will handle file sync)"
    fi

    # Verify public directory exists
    if [ -d "public/.well-known" ]; then
        log "Deep linking files found in public/.well-known/"
        ls -la public/.well-known/
    else
        warn "public/.well-known/ directory not found - deep linking may not work"
    fi
}

# Main deployment function (app-only)
main() {
    log "Starting Incollab app deployment..."

    cd "$APP_DIR" || {
        error "Failed to change to app directory: $APP_DIR"
        exit 1
    }

    pull_git_changes
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

    pull_git_changes
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
    status) log "Service status:"; cd "$APP_DIR" && $DOCKER_COMPOSE ps ;;
    logs) service=${2:-}; cd "$APP_DIR";
          if [ -n "$service" ]; then
              $DOCKER_COMPOSE logs -f "$service"
          else
              $DOCKER_COMPOSE logs -f
          fi ;;
    *) echo "Usage: $0 {deploy|full-deploy|stop|stop-app|start|start-app|restart|restart-app|status|logs [service]}"; exit 1 ;;
esac
