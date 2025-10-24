# Monitoring Deployment - Step by Step

## 📦 What's Been Configured

All configuration files have been updated and are ready to deploy:

### ✅ Updated Files
1. `nginx.conf` - Added monitoring routes
2. `monitoring/docker-compose.monitoring.yml` - Fixed networking and ports
3. `monitoring/promtail-config.yml` - Updated app name and paths
4. `monitoring/prometheus.yml` - Updated app name

### ✅ New Files Created
1. `monitoring/setup-monitoring.sh` - Automated setup script
2. `monitoring/QUICK_START.md` - Quick reference guide
3. `monitoring/CHANGES_SUMMARY.md` - Detailed changes
4. `monitoring/DEPLOYMENT_STEPS.md` - This file

---

## 🚀 Deploy to Production (Copy & Paste)

### Step 1: Upload Files to Server

From your **local machine**:

```bash
# Upload monitoring folder
scp -r monitoring ubuntu@your-ec2-ip:/home/ubuntu/Incollabe-BE/

# Upload updated nginx.conf
scp nginx.conf ubuntu@your-ec2-ip:/home/ubuntu/Incollabe-BE/

# SSH to server
ssh ubuntu@your-ec2-ip
```

---

### Step 2: Update Nginx Configuration

On **EC2 server**:

```bash
cd /home/ubuntu/Incollabe-BE

# Copy new nginx config to container
docker cp nginx.conf incollab-nginx:/etc/nginx/conf.d/incollab.conf

# Test nginx config
docker exec incollab-nginx nginx -t

# If test passes, reload nginx
docker exec incollab-nginx nginx -s reload

# Verify nginx is running
docker ps | grep nginx
```

**Expected output:**
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

### Step 3: Deploy Monitoring Stack

On **EC2 server**:

```bash
cd /home/ubuntu/Incollabe-BE/monitoring

# Make setup script executable
chmod +x setup-monitoring.sh

# Run automated setup
./setup-monitoring.sh
```

The script will:
- ✅ Check Docker installation
- ✅ Create logs directory
- ✅ Verify app network exists
- ✅ Start Grafana, Prometheus, Loki
- ✅ Wait for services to be healthy
- ✅ Show access URLs

**Expected output:**
```
[✓] Docker is installed
[✓] Logs directory created
[✓] App network exists
[✓] Grafana is ready
[✓] Prometheus is ready
[✓] Loki is ready
[✓] Monitoring setup completed successfully! 🎉
```

---

### Step 4: Verify Deployment

On **EC2 server**:

```bash
# Check all containers are running
docker ps | grep -E 'grafana|prometheus|loki|promtail'

# Test Grafana
curl -I http://localhost:3003

# Test Prometheus
curl -I http://localhost:9090

# Test Loki
curl http://localhost:3100/ready

# Check nginx can reach Grafana
docker exec incollab-nginx curl -I http://grafana:3000
```

---

### Step 5: Access Dashboards

**Via Domain (HTTPS - Recommended):**
- Grafana: https://incollab.buymybills.in/grafana/
- Prometheus: https://incollab.buymybills.in/prometheus/
- Loki: https://incollab.buymybills.in/loki/

**Via Direct IP (HTTP):**
- Grafana: http://YOUR-EC2-IP:3003
- Prometheus: http://YOUR-EC2-IP:9090
- Loki: http://YOUR-EC2-IP:3100

**First Login to Grafana:**
- Username: `admin`
- Password: `admin`
- You'll be prompted to change password

---

### Step 6: Test Log Collection

1. **Access Grafana**: https://incollab.buymybills.in/grafana/

2. **Click "Explore"** (compass icon on left sidebar)

3. **Select "Loki"** from dropdown at top

4. **Enter query:**
   ```
   {app="incollab"}
   ```

5. **Click "Run query"**

**If you see logs:**
✅ Everything is working!

**If "No data":**
⚠️ Your app might not be writing logs yet. See troubleshooting below.

---

## 🔧 Troubleshooting

### Problem: "No data" in Grafana

**Check if logs directory exists:**
```bash
ls -la /home/ubuntu/Incollabe-BE/logs/
```

**If empty, create a test log:**
```bash
echo '{"timestamp":"'$(date -Iseconds)'","level":"info","message":"Test log"}' >> /home/ubuntu/Incollabe-BE/logs/test.log
```

**Check Promtail is reading logs:**
```bash
docker logs promtail | tail -20
```

**Restart Promtail:**
```bash
cd /home/ubuntu/Incollabe-BE/monitoring
docker-compose -f docker-compose.monitoring.yml restart promtail
```

---

### Problem: Can't access Grafana via domain

**Check nginx is running:**
```bash
docker ps | grep incollab-nginx
```

**Check nginx logs:**
```bash
docker logs incollab-nginx --tail 50
```

**Test nginx can reach Grafana:**
```bash
docker exec incollab-nginx curl -v http://grafana:3000
```

**Reload nginx config:**
```bash
cd /home/ubuntu/Incollabe-BE/monitoring
./setup-monitoring.sh update-nginx
```

---

### Problem: Containers won't start

**Check if network exists:**
```bash
docker network ls | grep incollab
```

**If missing, create it:**
```bash
docker network create incollab-network
```

**Check for port conflicts:**
```bash
sudo netstat -tulpn | grep -E '3003|9090|3100'
```

**View container logs:**
```bash
cd /home/ubuntu/Incollabe-BE/monitoring
docker-compose -f docker-compose.monitoring.yml logs grafana
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs loki
```

---

## 🎯 Post-Deployment Tasks

### 1. Change Grafana Password

1. Login to Grafana: https://incollab.buymybills.in/grafana/
2. Use `admin` / `admin`
3. Follow prompt to change password
4. Save new password securely

---

### 2. Import Dashboards (Optional)

**Loki Logs Dashboard:**
1. Click **+** → **Import**
2. Enter ID: `12611`
3. Select **Loki** datasource
4. Click **Import**

**System Metrics Dashboard:**
1. Click **+** → **Import**
2. Enter ID: `1860`
3. Select **Prometheus** datasource
4. Click **Import**

---

### 3. Configure Your App to Write Logs

Your Node.js app should write logs to:
```
/home/ubuntu/Incollabe-BE/logs/app.log
```

**Example using Winston:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: '/home/ubuntu/Incollabe-BE/logs/app.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.Console()
  ]
});

// Usage
logger.info('Server started', { port: 3002 });
logger.error('Database error', { error: err.message });
```

---

## 📊 Useful Commands

```bash
# Start monitoring
cd /home/ubuntu/Incollabe-BE/monitoring
./setup-monitoring.sh start

# Stop monitoring
./setup-monitoring.sh stop

# Restart monitoring
./setup-monitoring.sh restart

# Check status
./setup-monitoring.sh status

# View all logs
./setup-monitoring.sh logs

# View specific service logs
./setup-monitoring.sh logs grafana
./setup-monitoring.sh logs promtail

# Update nginx config
./setup-monitoring.sh update-nginx
```

---

## 📈 What's Monitored

✅ **System Metrics** (via Prometheus + Node Exporter)
- CPU usage
- Memory usage
- Disk usage
- Network traffic

✅ **Application Logs** (via Loki + Promtail)
- App logs from `/home/ubuntu/Incollabe-BE/logs/`
- PM2 logs from `/home/ubuntu/.pm2/logs/`

✅ **Container Metrics** (via Prometheus)
- Container status
- Resource usage per container

---

## 🔐 Security Checklist

- [ ] Changed Grafana default password
- [ ] Restricted Prometheus access (production only)
- [ ] Configured firewall rules (if using direct IP access)
- [ ] Set up HTTPS-only access via domain
- [ ] Reviewed who has access to monitoring dashboards

---

## 📚 Reference Documentation

- **Quick Start**: `QUICK_START.md`
- **Detailed Setup**: `COMPLETE_SETUP.md`
- **Changes Made**: `CHANGES_SUMMARY.md`
- **This Guide**: `DEPLOYMENT_STEPS.md`

---

## ✅ Deployment Checklist

**Pre-Deployment:**
- [ ] Main app is running (`docker ps | grep incollab-backend`)
- [ ] Nginx is running (`docker ps | grep incollab-nginx`)
- [ ] Have SSH access to EC2 server

**Deployment:**
- [ ] Uploaded monitoring folder to server
- [ ] Uploaded nginx.conf to server
- [ ] Updated nginx configuration
- [ ] Ran setup-monitoring.sh
- [ ] Verified all containers running

**Post-Deployment:**
- [ ] Accessed Grafana successfully
- [ ] Changed Grafana password
- [ ] Tested log query in Grafana
- [ ] (Optional) Imported dashboards
- [ ] (Optional) Configured app logging

---

## 🎉 Success Criteria

You know everything is working when:

1. ✅ All containers are running:
   ```bash
   docker ps | grep -E 'grafana|prometheus|loki|promtail'
   ```

2. ✅ Can access Grafana:
   ```
   https://incollab.buymybills.in/grafana/
   ```

3. ✅ Can query logs in Grafana:
   ```
   {app="incollab"}
   ```

4. ✅ See data in Grafana (logs, metrics, etc.)

---

**Need Help?**
- Check `QUICK_START.md` for troubleshooting
- Run `./setup-monitoring.sh logs` to view container logs
- Verify network: `docker network inspect incollab-network`

**Ready to Deploy?** Follow Step 1 above! 🚀
