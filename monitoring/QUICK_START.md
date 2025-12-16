# Quick Start - Incollabe-BE Monitoring

This monitoring stack provides Grafana, Prometheus, and Loki for real-time monitoring and logging.

## 🚀 Quick Setup (5 minutes)

### Prerequisites
- Main Incollabe-BE app running (`docker-compose up -d`)
- Docker and Docker Compose installed
- SSL certificates configured

### One-Command Setup

```bash
cd /home/ubuntu/Incollabe-BE/monitoring
./setup-monitoring.sh
```

This script will:
- ✅ Check Docker installation
- ✅ Create logs directory
- ✅ Start monitoring stack (Grafana, Prometheus, Loki)
- ✅ Update nginx configuration
- ✅ Verify all services are running

### Manual Setup (if script fails)

```bash
# 1. Create logs directory
mkdir -p /home/ubuntu/Incollabe-BE/logs

# 2. Start monitoring stack
cd /home/ubuntu/Incollabe-BE/monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# 3. Update nginx (reload monitoring routes)
cd /home/ubuntu/Incollabe-BE
docker cp nginx.conf incollab-nginx:/etc/nginx/conf.d/incollab.conf
docker exec incollab-nginx nginx -t
docker exec incollab-nginx nginx -s reload
```

---

## 📊 Access Dashboards

### Via Domain (Recommended)
- **Grafana**: https://incollab.buymybills.in/grafana/
- **Prometheus**: https://incollab.buymybills.in/prometheus/
- **Loki**: https://incollab.buymybills.in/loki/

### Via Direct IP
- **Grafana**: http://YOUR-EC2-IP:3003
- **Prometheus**: http://YOUR-EC2-IP:9090
- **Loki**: http://YOUR-EC2-IP:3100

**Grafana Login:**
- Username: `admin`
- Password: `admin` (change on first login)

---

## 🔍 View Logs in Grafana

1. Open Grafana → https://incollab.buymybills.in/grafana/
2. Click **Explore** (compass icon on left sidebar)
3. Select **Loki** from the dropdown at top
4. Enter query:
   ```
   {app="incollab"}
   ```
5. Click **Run query**

### Common Queries

**All error logs:**
```logql
{app="incollab", level="error"}
```

**Search for specific text:**
```logql
{app="incollab"} |= "database"
```

**PM2 errors:**
```logql
{job="pm2-errors"}
```

**Last hour of logs:**
```logql
{app="incollab"} [1h]
```

---

## 🛠️ Management Commands

```bash
cd /home/ubuntu/Incollabe-BE/monitoring

# Start monitoring
./setup-monitoring.sh start

# Stop monitoring
./setup-monitoring.sh stop

# Restart monitoring
./setup-monitoring.sh restart

# Check status
./setup-monitoring.sh status

# View logs
./setup-monitoring.sh logs
./setup-monitoring.sh logs grafana  # specific service

# Update nginx only
./setup-monitoring.sh update-nginx
```

---

## 🔧 Troubleshooting

### Grafana shows "No data"

```bash
# Check if Promtail is running
docker ps | grep promtail

# Check Promtail logs
cd /home/ubuntu/Incollabe-BE/monitoring
docker-compose -f docker-compose.monitoring.yml logs promtail

# Verify log paths exist
ls -la /home/ubuntu/Incollabe-BE/logs/
ls -la /home/ubuntu/.pm2/logs/
```

### Can't access via domain

```bash
# Check nginx is running
docker ps | grep incollab-nginx

# Test nginx config
docker exec incollab-nginx nginx -t

# Check nginx logs
docker logs incollab-nginx

# Reload nginx
cd /home/ubuntu/Incollabe-BE/monitoring
./setup-monitoring.sh update-nginx
```

### Services won't start

```bash
# Check if network exists
docker network ls | grep incollab

# Create network if missing
docker network create incollab-network

# Check if ports are in use
sudo netstat -tulpn | grep -E '3003|9090|3100'

# View service logs
cd /home/ubuntu/Incollabe-BE/monitoring
docker-compose -f docker-compose.monitoring.yml logs
```

---

## 📈 Architecture

```
User Request
    ↓
Nginx (incollab-nginx) [Port 80/443]
    ↓
    ├─→ /api/       → Incollabe-BE App [Port 3002]
    ├─→ /grafana/   → Grafana [Port 3003]
    ├─→ /prometheus/→ Prometheus [Port 9090]
    └─→ /loki/      → Loki [Port 3100]

Monitoring Stack:
- Grafana: Visualization & Dashboards
- Prometheus: Metrics collection
- Loki: Log aggregation
- Promtail: Log shipper (reads from /logs and /.pm2/logs)
- Node Exporter: System metrics (CPU, RAM, Disk)
```

---

## 🔐 Security Notes

1. **Change Grafana password** on first login
2. **Prometheus & Loki** endpoints are exposed - consider restricting access in production
3. **Add firewall rules** if accessing directly via IP:
   ```bash
   # Allow only specific IPs
   sudo ufw allow from YOUR_IP to any port 3003
   sudo ufw allow from YOUR_IP to any port 9090
   ```

---

## 📦 What's Configured

✅ Grafana on port 3003 (was 3002 - changed to avoid conflict)
✅ Prometheus scraping system metrics
✅ Loki collecting logs from:
   - `/home/ubuntu/Incollabe-BE/logs/*.log`
   - `/home/ubuntu/.pm2/logs/incollab-*.log`
✅ Nginx routing with SSL
✅ All services connected to `incollab-network`
✅ Data persistence (survives container restarts)
✅ Auto-restart on failures

---

## 🎯 Next Steps

1. **Configure your app to write logs**:
   - Create `/home/ubuntu/Incollabe-BE/logs/app.log`
   - Use JSON format for better parsing in Grafana

2. **Set up Grafana dashboards**:
   - Import dashboard ID `12611` for Loki
   - Import dashboard ID `1860` for Node Exporter

3. **Configure alerts** (optional):
   - Grafana → Alerting → Create alert rules
   - Set up email notifications

---

## 📝 Logs Format Recommendation

For best results, use JSON format in your Node.js app:

```javascript
// Using Winston or similar
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "level": "error",
  "message": "Database connection failed",
  "context": {
    "userId": "123",
    "endpoint": "/api/users"
  }
}
```

This allows Grafana to parse and filter logs more effectively.

---

**Need help?** Check the detailed guides:
- `COMPLETE_SETUP.md` - Full setup with PM2 Web and email alerts
- `SETUP_GUIDE.md` - Step-by-step instructions
