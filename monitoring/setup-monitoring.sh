#!/bin/bash

# Monitoring Setup Script for Incollabe-BE
# This script sets up Grafana, Prometheus, Loki monitoring stack

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="/home/ubuntu/Incollabe-BE/monitoring"
APP_DIR="/home/ubuntu/Incollabe-BE"
LOGS_DIR="/home/ubuntu/Incollabe-BE/logs"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as correct user
check_user() {
    if [ "$EUID" -eq 0 ]; then
        error "Please run as ubuntu user, not root"
        exit 1
    fi
    log "Running as user: $(whoami)"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker ubuntu
        error "Docker installed. Please log out and back in, then run this script again."
        exit 1
    fi
    log "Docker is installed: $(docker --version)"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        info "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        log "Docker Compose installed: $(docker-compose --version)"
    else
        log "Docker Compose is installed: $(docker-compose --version)"
    fi
}

# Create logs directory
create_logs_dir() {
    if [ ! -d "$LOGS_DIR" ]; then
        log "Creating logs directory: $LOGS_DIR"
        mkdir -p "$LOGS_DIR"
    else
        log "Logs directory already exists: $LOGS_DIR"
    fi
}

# Check if main app network exists
check_network() {
    if ! docker network ls | grep -q "incollabe-be_incollab-network\|incollab-network"; then
        warn "Main app network not found. Make sure the main app is running first."
        info "Attempting to create network..."
        docker network create incollab-network || true
    else
        log "App network exists"
    fi
}

# Stop existing monitoring stack
stop_monitoring() {
    log "Stopping existing monitoring stack (if any)..."
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.monitoring.yml down --remove-orphans || true
    log "Stopped existing monitoring stack"
}

# Start monitoring stack
start_monitoring() {
    log "Starting monitoring stack..."
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.monitoring.yml up -d
    log "Monitoring stack started"
}

# Wait for services to be healthy
wait_for_services() {
    log "Waiting for services to be ready..."
    sleep 10

    # Check Grafana
    local attempts=30
    local count=1
    while [ $count -le $attempts ]; do
        if curl -f -s http://localhost:3003 > /dev/null; then
            log "✓ Grafana is ready"
            break
        else
            if [ $count -eq $attempts ]; then
                error "Grafana failed to start after $attempts attempts"
            else
                info "Waiting for Grafana... (attempt $count/$attempts)"
            fi
            sleep 2
        fi
        count=$((count + 1))
    done

    # Check Prometheus
    if curl -f -s http://localhost:9090/-/healthy > /dev/null; then
        log "✓ Prometheus is ready"
    else
        warn "Prometheus health check failed"
    fi

    # Check Loki
    if curl -f -s http://localhost:3100/ready > /dev/null; then
        log "✓ Loki is ready"
    else
        warn "Loki health check failed"
    fi
}

# Update nginx configuration
update_nginx() {
    log "Updating nginx configuration..."
    cd "$APP_DIR"

    if [ -f "nginx.conf" ]; then
        if docker cp nginx.conf incollab-nginx:/etc/nginx/conf.d/incollab.conf 2>/dev/null; then
            if docker exec incollab-nginx nginx -t 2>/dev/null; then
                docker exec incollab-nginx nginx -s reload
                log "✓ Nginx configuration updated successfully"
            else
                error "Nginx configuration test failed"
                return 1
            fi
        else
            warn "Nginx container not running. Start main app first, then run: ./deploy.sh"
        fi
    else
        error "nginx.conf not found in $APP_DIR"
        return 1
    fi
}

# Show monitoring status
show_status() {
    log "Monitoring Stack Status:"
    echo "=========================="

    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.monitoring.yml ps

    echo ""
    log "Access URLs:"
    echo "  Grafana:    https://incollab.buymybills.in/grafana/"
    echo "              (or http://YOUR-EC2-IP:3003)"
    echo "              Login: admin / admin"
    echo ""
    echo "  Prometheus: https://incollab.buymybills.in/prometheus/"
    echo "              (or http://YOUR-EC2-IP:9090)"
    echo ""
    echo "  Loki:       http://YOUR-EC2-IP:3100"
    echo "              (Internal use only)"
    echo ""

    info "First time setup:"
    echo "  1. Open Grafana and change the default password"
    echo "  2. Go to Explore → Select 'Loki' datasource"
    echo "  3. Query: {app=\"incollab\"} to see your logs"
    echo ""
}

# Check PM2 logs
check_pm2_logs() {
    if [ -d "/home/ubuntu/.pm2/logs" ]; then
        log "✓ PM2 logs directory exists"
        local log_count=$(ls -1 /home/ubuntu/.pm2/logs/*.log 2>/dev/null | wc -l)
        info "Found $log_count PM2 log files"
    else
        warn "PM2 logs directory not found. PM2 might not be set up."
    fi
}

# Main setup function
main() {
    log "Starting Incollabe-BE Monitoring Setup"
    echo ""

    check_user
    check_docker
    check_docker_compose
    create_logs_dir
    check_pm2_logs
    check_network
    stop_monitoring
    start_monitoring
    wait_for_services
    update_nginx

    echo ""
    show_status

    echo ""
    log "Monitoring setup completed successfully! 🎉"
}

# Handle script arguments
case "${1:-setup}" in
    setup)
        main
        ;;
    start)
        log "Starting monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml up -d
        log "Monitoring stack started"
        ;;
    stop)
        log "Stopping monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml down
        log "Monitoring stack stopped"
        ;;
    restart)
        log "Restarting monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml restart
        log "Monitoring stack restarted"
        ;;
    status)
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml ps
        ;;
    logs)
        service=${2:-}
        cd "$MONITORING_DIR"
        if [ -n "$service" ]; then
            docker-compose -f docker-compose.monitoring.yml logs -f "$service"
        else
            docker-compose -f docker-compose.monitoring.yml logs -f
        fi
        ;;
    update-nginx)
        update_nginx
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|restart|status|logs [service]|update-nginx}"
        echo ""
        echo "Commands:"
        echo "  setup        - Initial setup (default)"
        echo "  start        - Start monitoring stack"
        echo "  stop         - Stop monitoring stack"
        echo "  restart      - Restart monitoring stack"
        echo "  status       - Show running containers"
        echo "  logs         - Show logs (optionally for specific service)"
        echo "  update-nginx - Update nginx configuration"
        exit 1
        ;;
esac
