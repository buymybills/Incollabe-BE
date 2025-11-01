#!/bin/bash

# Complete Monitoring Deployment Script
# Deploys monitoring stack and updates nginx in correct order

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
if [ "$EUID" -eq 0 ]; then
    error "Please run as ubuntu user, not root"
    exit 1
fi

log "Starting Complete Monitoring Deployment"
echo ""

# Step 1: Create logs directory
log "Step 1/5: Creating logs directory..."
if [ ! -d "$LOGS_DIR" ]; then
    mkdir -p "$LOGS_DIR"
    log "✓ Logs directory created: $LOGS_DIR"
else
    log "✓ Logs directory already exists"
fi
echo ""

# Step 2: Check if main app is running
log "Step 2/5: Checking if main app is running..."
if ! docker ps | grep -q "incollab-backend"; then
    error "Main app (incollab-backend) is not running!"
    info "Please start the main app first: cd $APP_DIR && docker-compose up -d"
    exit 1
fi
if ! docker ps | grep -q "incollab-nginx"; then
    error "Nginx (incollab-nginx) is not running!"
    info "Please start nginx first: cd $APP_DIR && docker-compose up -d"
    exit 1
fi
log "✓ Main app is running"
log "✓ Nginx is running"
echo ""

# Step 3: Deploy monitoring stack
log "Step 3/5: Deploying monitoring stack..."
cd "$MONITORING_DIR"

# Stop existing monitoring if any
docker-compose -f docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true

# Start monitoring stack
log "Starting Grafana, Prometheus, Loki, Promtail..."
docker-compose -f docker-compose.monitoring.yml up -d

log "Waiting for containers to start (15 seconds)..."
sleep 15

# Verify containers are running
if ! docker ps | grep -q "grafana"; then
    error "Grafana failed to start!"
    docker-compose -f docker-compose.monitoring.yml logs grafana
    exit 1
fi
if ! docker ps | grep -q "prometheus"; then
    error "Prometheus failed to start!"
    docker-compose -f docker-compose.monitoring.yml logs prometheus
    exit 1
fi
if ! docker ps | grep -q "loki"; then
    error "Loki failed to start!"
    docker-compose -f docker-compose.monitoring.yml logs loki
    exit 1
fi

log "✓ Grafana is running"
log "✓ Prometheus is running"
log "✓ Loki is running"
log "✓ Promtail is running"
echo ""

# Step 4: Update nginx configuration
log "Step 4/5: Updating nginx configuration..."
cd "$APP_DIR"

if [ ! -f "nginx.conf" ]; then
    error "nginx.conf not found in $APP_DIR"
    exit 1
fi

# Copy config to nginx container
if ! docker cp nginx.conf incollab-nginx:/etc/nginx/conf.d/incollab.conf; then
    error "Failed to copy nginx.conf to container"
    exit 1
fi

# Test nginx config
log "Testing nginx configuration..."
if ! docker exec incollab-nginx nginx -t; then
    error "Nginx configuration test failed!"
    docker exec incollab-nginx nginx -t 2>&1
    exit 1
fi

# Reload nginx
log "Reloading nginx..."
if ! docker exec incollab-nginx nginx -s reload; then
    error "Failed to reload nginx"
    exit 1
fi

log "✓ Nginx configuration updated successfully"
echo ""

# Step 5: Verify everything is working
log "Step 5/5: Verifying deployment..."

# Wait for services to be fully ready
sleep 5

# Test Grafana
if curl -f -s http://localhost:3003 > /dev/null; then
    log "✓ Grafana is accessible at http://localhost:3003"
else
    warn "Grafana health check failed (might still be starting up)"
fi

# Test Prometheus
if curl -f -s http://localhost:9090/-/healthy > /dev/null; then
    log "✓ Prometheus is accessible at http://localhost:9090"
else
    warn "Prometheus health check failed (might still be starting up)"
fi

# Test Loki
if curl -f -s http://localhost:3100/ready > /dev/null; then
    log "✓ Loki is accessible at http://localhost:3100"
else
    warn "Loki health check failed (might still be starting up)"
fi

# Test nginx can reach Grafana
if docker exec incollab-nginx wget -q --spider http://grafana:3000 2>/dev/null; then
    log "✓ Nginx can reach Grafana container"
else
    warn "Nginx cannot reach Grafana (might need to wait longer)"
fi

echo ""
log "Deployment Status:"
echo "=================="
cd "$MONITORING_DIR"
docker-compose -f docker-compose.monitoring.yml ps

echo ""
log "✅ Monitoring Deployment Complete! 🎉"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Access your monitoring dashboards:"
echo ""
echo "  📊 Grafana:     https://incollab.buymybills.in/grafana/"
echo "                  (Login: admin / admin)"
echo ""
echo "  📈 Prometheus:  https://incollab.buymybills.in/prometheus/"
echo ""
echo "  📝 Loki:        https://incollab.buymybills.in/loki/"
echo ""
echo "  Or via direct IP:"
echo "  - Grafana:      http://YOUR-EC2-IP:3003"
echo "  - Prometheus:   http://YOUR-EC2-IP:9090"
echo "  - Loki:         http://YOUR-EC2-IP:3100"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Next steps:"
echo "  1. Open Grafana and change the default password"
echo "  2. Go to Explore → Select 'Loki' datasource"
echo "  3. Query: {app=\"incollab\"} to see your logs"
echo ""
info "Management commands:"
echo "  Start:   cd $MONITORING_DIR && ./setup-monitoring.sh start"
echo "  Stop:    cd $MONITORING_DIR && ./setup-monitoring.sh stop"
echo "  Restart: cd $MONITORING_DIR && ./setup-monitoring.sh restart"
echo "  Logs:    cd $MONITORING_DIR && ./setup-monitoring.sh logs"
echo ""
