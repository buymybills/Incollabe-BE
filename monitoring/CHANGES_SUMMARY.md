# Monitoring Setup - Changes Summary

## ✅ Files Modified

### 1. `/nginx.conf`
**Changes:**
- ✅ Added Grafana route: `/grafana/` → `grafana:3000`
- ✅ Added Prometheus route: `/prometheus/` → `prometheus:9090`
- ✅ Added Loki route: `/loki/` → `loki:3100`
- ✅ Uses container names instead of `host.docker.internal` (Docker network routing)

**Why:** Enable access to monitoring dashboards via domain with SSL

---

### 2. `/monitoring/docker-compose.monitoring.yml`
**Changes:**
- ✅ Changed Grafana port: `3002` → `3003` (avoid conflict with backend)
- ✅ Added Grafana environment variables:
  - `GF_SERVER_ROOT_URL=https://incollab.buymybills.in/grafana/`
  - `GF_SERVER_SERVE_FROM_SUB_PATH=true`
- ✅ Fixed Grafana volume paths for provisioning
- ✅ Updated log mount paths: `/home/ubuntu/Incollabe-BE/logs` (correct path)
- ✅ Added `incollab-network` to connect with main app
- ✅ Connected Grafana, Prometheus, and Loki to `incollab-network`

**Why:**
- Port conflict resolution
- Enable reverse proxy support
- Connect monitoring to main app network
- Use correct server paths

---

### 3. `/monitoring/promtail-config.yml`
**Changes:**
- ✅ Updated all `cloutsy` → `incollab`
- ✅ Updated job names: `cloutsy-app` → `incollab-app`
- ✅ Updated log paths: `/var/log/cloutsy/*.log` → `/var/log/incollab/*.log`
- ✅ Updated PM2 log patterns: `cloutsy-out*.log` → `incollab-out*.log`
- ✅ Updated PM2 error patterns: `cloutsy-error*.log` → `incollab-error*.log`

**Why:** Match actual application name and PM2 process names

---

### 4. `/monitoring/prometheus.yml`
**Changes:**
- ✅ Updated monitor label: `cloutsy-monitor` → `incollab-monitor`
- ✅ Updated job name: `cloutsy-app` → `incollab-app`

**Why:** Consistent naming across monitoring stack

---

## 📝 Files Created

### 1. `/monitoring/setup-monitoring.sh`
**Features:**
- ✅ Automated setup script with health checks
- ✅ Docker installation check
- ✅ Network creation/verification
- ✅ Logs directory creation
- ✅ Service health monitoring
- ✅ Nginx configuration update
- ✅ Management commands (start/stop/restart/status/logs)

**Usage:**
```bash
./setup-monitoring.sh          # Full setup
./setup-monitoring.sh start    # Start services
./setup-monitoring.sh stop     # Stop services
./setup-monitoring.sh status   # Check status
```

---

### 2. `/monitoring/QUICK_START.md`
**Contents:**
- Quick setup instructions
- Access URLs
- Common log queries
- Troubleshooting guide
- Architecture diagram
- Security notes

---

### 3. `/monitoring/CHANGES_SUMMARY.md`
This file - summary of all changes made

---

## 🔧 Key Configuration Details

### Network Setup
```yaml
networks:
  monitoring:
    driver: bridge
  incollab-network:
    external: true  # Connects to main app network
```

**Services on both networks:**
- Grafana
- Prometheus
- Loki

**Why:** Allows nginx (on `incollab-network`) to proxy to monitoring services

---

### Port Mapping

| Service | Container Port | Host Port | Nginx Route |
|---------|---------------|-----------|-------------|
| Grafana | 3000 | 3003 | `/grafana/` |
| Prometheus | 9090 | 9090 | `/prometheus/` |
| Loki | 3100 | 3100 | `/loki/` |
| Incollabe-BE | 3002 | 3002 | `/api/` |
| Nginx | 80/443 | 80/443 | - |

---

### Log Paths

**On Host:**
- App logs: `/home/ubuntu/Incollabe-BE/logs/*.log`
- PM2 logs: `/home/ubuntu/.pm2/logs/incollab-*.log`

**In Promtail Container:**
- App logs: `/var/log/incollab/*.log`
- PM2 logs: `/var/log/pm2/incollab-*.log`

---

## 🚀 Deployment Checklist

### Before Deployment
- [ ] Main app is running (`docker ps | grep incollab`)
- [ ] App network exists (`docker network ls | grep incollab`)
- [ ] SSL certificates are configured
- [ ] Server has at least 2GB RAM (recommended)

### Deployment Steps

```bash
# 1. Upload monitoring folder to server
scp -r monitoring ubuntu@your-server:/home/ubuntu/Incollabe-BE/

# 2. Upload updated nginx.conf
scp nginx.conf ubuntu@your-server:/home/ubuntu/Incollabe-BE/

# 3. SSH to server
ssh ubuntu@your-server

# 4. Update nginx configuration
cd /home/ubuntu/Incollabe-BE
docker cp nginx.conf incollab-nginx:/etc/nginx/conf.d/incollab.conf
docker exec incollab-nginx nginx -t
docker exec incollab-nginx nginx -s reload

# 5. Run monitoring setup
cd /home/ubuntu/Incollabe-BE/monitoring
chmod +x setup-monitoring.sh
./setup-monitoring.sh

# 6. Verify services
docker ps | grep -E 'grafana|prometheus|loki|promtail'

# 7. Test access
curl http://localhost:3003  # Grafana
curl http://localhost:9090  # Prometheus
curl http://localhost:3100/ready  # Loki
```

### Post-Deployment
- [ ] Access Grafana: https://incollab.buymybills.in/grafana/
- [ ] Login with admin/admin and change password
- [ ] Test log query: `{app="incollab"}`
- [ ] Import dashboards (optional):
  - ID `12611` for Loki logs
  - ID `1860` for Node Exporter metrics

---

## 🔍 Verification Commands

```bash
# Check all monitoring containers are running
docker ps | grep -E 'grafana|prometheus|loki|promtail|node-exporter'

# Check nginx can reach Grafana
docker exec incollab-nginx curl -I http://grafana:3000

# Check logs are being collected
docker logs promtail | grep -i "file"

# Check Grafana datasources
curl http://localhost:3003/api/datasources

# Test Loki API
curl http://localhost:3100/loki/api/v1/label
```

---

## ⚠️ Known Issues & Solutions

### Issue: Grafana shows "No data"
**Cause:** App not writing logs or wrong log path
**Solution:**
```bash
# Check if logs exist
ls -la /home/ubuntu/Incollabe-BE/logs/
ls -la /home/ubuntu/.pm2/logs/

# If empty, configure your app to write logs
mkdir -p /home/ubuntu/Incollabe-BE/logs
```

### Issue: Can't access via domain
**Cause:** Nginx config not loaded
**Solution:**
```bash
cd /home/ubuntu/Incollabe-BE/monitoring
./setup-monitoring.sh update-nginx
```

### Issue: "network not found" error
**Cause:** Main app not running
**Solution:**
```bash
# Start main app first
cd /home/ubuntu/Incollabe-BE
docker-compose up -d

# Then start monitoring
cd monitoring
./setup-monitoring.sh
```

### Issue: Port 3002 conflict
**Solution:** Already resolved - Grafana moved to port 3003

---

## 📊 Resource Usage

Expected resource usage on EC2:

```
Container         CPU    Memory
---------------------------------
grafana          2%     80-120MB
prometheus       1%     100-150MB
loki             1%     50-80MB
promtail         <1%    30-50MB
node-exporter    <1%    20-30MB
---------------------------------
Total:           ~5%    ~400MB
```

**Recommended:** t3.small or larger (2GB RAM minimum)

---

## 🎯 Next Steps

1. **Configure your Node.js app to write logs**
   ```javascript
   // Example using Winston
   const winston = require('winston');

   const logger = winston.createLogger({
     format: winston.format.json(),
     transports: [
       new winston.transports.File({
         filename: '/home/ubuntu/Incollabe-BE/logs/app.log'
       })
     ]
   });
   ```

2. **Set up Grafana dashboards**
   - Import pre-built dashboards
   - Create custom panels for your metrics

3. **Configure alerts** (optional)
   - Email notifications
   - Slack notifications
   - Alert on errors, high CPU, memory usage

4. **Add Prometheus metrics to your app** (optional)
   ```bash
   npm install prom-client
   ```
   Then expose metrics at `/metrics` endpoint

---

## 📚 Documentation Files

- `QUICK_START.md` - Quick setup guide (recommended)
- `COMPLETE_SETUP.md` - Full setup with PM2 Web and email alerts
- `SETUP_GUIDE.md` - Original detailed setup guide
- `CHANGES_SUMMARY.md` - This file

---

## 🤝 Support

If you encounter issues:

1. Check the troubleshooting section in `QUICK_START.md`
2. View container logs: `docker-compose logs [service-name]`
3. Verify network connectivity: `docker network inspect incollab-network`
4. Check nginx logs: `docker logs incollab-nginx`

---

**Last Updated:** $(date)
**Application:** Incollabe-BE
**Environment:** Production
**Server Path:** /home/ubuntu/Incollabe-BE
