# Complete Monitoring Setup - Everything You Need

This gives you **TWO dashboards** working together:

## 🎯 Dashboard 1: Grafana (Viewing & Alerts)
**Access:** `http://your-ec2-ip:3002`
- ✅ Real-time error logs scrolling
- ✅ Search errors by keyword/time
- ✅ CPU & Memory graphs
- ✅ Email alerts
- ✅ Beautiful visualizations
- ❌ No restart/stop buttons (read-only)

## 🎮 Dashboard 2: PM2 Web (Control Panel)
**Access:** `http://your-ec2-ip:9000`
- ✅ Restart/Stop buttons
- ✅ Live process status (online/crashed)
- ✅ All PM2 logs in one view
- ✅ Real-time metrics
- ✅ Quick actions

---

## 🚀 Complete Installation

### Step 1: Set Up Grafana Stack (30 min)

```bash
# 1. Upload monitoring folder to EC2
scp -r monitoring ubuntu@your-ec2-ip:/home/ubuntu/

# 2. SSH into EC2
ssh ubuntu@your-ec2-ip

# 3. Install Docker (if not installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in
exit
ssh ubuntu@your-ec2-ip

# 4. Update log paths in monitoring/docker-compose.yml
cd /home/ubuntu/monitoring
nano docker-compose.yml
# Update these lines to match your paths:
# - /home/ubuntu/cloutsy/logs:/var/log/cloutsy:ro
# - /home/ubuntu/.pm2/logs:/var/log/pm2:ro

# 5. Start Grafana stack
docker-compose up -d

# 6. Verify all running
docker-compose ps
```

### Step 2: Set Up PM2 Web (5 min)

```bash
# Install PM2 Web globally
npm install -g pm2-web

# Start it with PM2 (so it auto-restarts)
pm2 start pm2-web --name pm2-dashboard -- --port 9000

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it shows you (starts with sudo)
```

### Step 3: Open Firewall Ports

```bash
# Open ports
sudo ufw allow 3002  # Grafana
sudo ufw allow 9000  # PM2 Web

# Or in AWS Console:
# EC2 → Security Groups → Inbound Rules → Add:
# - Custom TCP, Port 3002, Source: 0.0.0.0/0 (Grafana)
# - Custom TCP, Port 9000, Source: 0.0.0.0/0 (PM2 Web)
```

---

## 📊 How to Use

### Daily Workflow

**Option 1: Quick Check (PM2 Web)**
1. Open `http://your-ec2-ip:9000`
2. See if app is online
3. Quick restart if needed
4. View recent logs

**Option 2: Deep Investigation (Grafana)**
1. Open `http://your-ec2-ip:3002`
2. Login: admin / admin
3. Go to Explore → Select Loki
4. Query errors: `{app="cloutsy", level="error"}`
5. Click on error to see full context

### When You See an Error

**In PM2 Web (`http://your-ec2-ip:9000`):**
1. See error in logs
2. Click "Restart" button if needed
3. Monitor if issue persists

**In Grafana (`http://your-ec2-ip:3002`):**
1. Search for error: `{app="cloutsy"} |= "database"`
2. Click on error log line
3. See full stack trace
4. See what happened before/after
5. Filter by time to find root cause

---

## 🎯 Common Tasks

### 1. "I want to restart the app"
→ Go to PM2 Web → Click "Restart" button

### 2. "I want to see why it crashed"
→ Go to Grafana → Explore → Query: `{job="pm2"} |= "stopped"`

### 3. "Show me all errors today"
→ Grafana → Explore → `{app="cloutsy", level="error"}` → Time: Last 24h

### 4. "I want email alerts for errors"
→ Grafana → Alerting → Create rule (see guide below)

### 5. "Check if memory is high"
→ PM2 Web shows current usage
→ Grafana shows historical graph

---

## ⚙️ Grafana Setup (First Time)

### 1. Access Grafana
```
http://your-ec2-ip:3002
Login: admin / admin
Change password when prompted
```

### 2. View Logs
1. Click **Explore** (compass icon)
2. Select **Loki** from dropdown
3. Enter query:
   ```logql
   {app="cloutsy"}
   ```
4. Click **Run query**

### 3. Filter Errors Only
```logql
{app="cloutsy", level="error"}
```

### 4. Search Specific Error
```logql
{app="cloutsy"} |= "database" |= "error"
```

### 5. Create Error Dashboard

**Import Pre-built Dashboard:**
1. Click **+** → **Import**
2. Enter ID: `12611` (Loki Dashboard)
3. Select **Loki** as datasource
4. Click **Import**

**Create Custom Dashboard:**
1. Click **+** → **Dashboard** → **Add visualization**
2. Select **Loki** datasource
3. Query: `count_over_time({app="cloutsy", level="error"}[5m])`
4. Panel title: "Error Rate"
5. Click **Apply**
6. Add more panels (CPU, Memory, etc.)
7. Click **Save dashboard**

### 6. Set Up Email Alerts

**Configure Email:**
1. Go to **Alerting** → **Contact points**
2. Click **New contact point**
3. Name: "Email Alerts"
4. Type: **Email**
5. Addresses: your-email@gmail.com
6. Click **Save**

**Configure SMTP (for Gmail):**
```bash
# Edit Grafana config
docker exec -it grafana bash
vi /etc/grafana/grafana.ini

# Add under [smtp]:
[smtp]
enabled = true
host = smtp.gmail.com:587
user = your-email@gmail.com
password = your-app-password
from_address = your-email@gmail.com
from_name = Cloutsy Alerts

# Exit and restart Grafana
exit
docker-compose restart grafana
```

**Create Alert Rule:**
1. Go to **Alerting** → **Alert rules** → **New alert rule**
2. Name: "High Error Rate"
3. Query A:
   ```logql
   count_over_time({app="cloutsy", level="error"}[5m])
   ```
4. Expression B: `$A > 10` (alert if more than 10 errors in 5 min)
5. Set evaluation: Every 1m for 5m
6. Add annotation:
   - Summary: `{{ $values.A }} errors detected`
   - Description: `Check logs at http://your-ip:3002`
7. Select contact point: "Email Alerts"
8. Click **Save and exit**

**More Alert Examples:**

**App Down Alert:**
```promql
up{job="cloutsy-app"} == 0
```

**High Memory Alert:**
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 80
```

**High Disk Alert:**
```promql
100 - ((node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100) > 85
```

---

## 📈 Useful Grafana Queries

### Logs (Loki)

```logql
# All errors
{app="cloutsy", level="error"}

# Database errors
{app="cloutsy"} |= "database" |= "error"

# Errors in last hour
{app="cloutsy", level="error"} [1h]

# Count errors per minute
count_over_time({app="cloutsy", level="error"}[1m])

# PM2 crashes
{job="pm2"} |= "errored" or |= "stopped"

# Slow requests (>1s)
{app="cloutsy"} |= "duration" | json | duration > 1000

# Filter by endpoint
{app="cloutsy"} |= "/api/campaign"

# Multiple filters
{app="cloutsy"} |= "error" |= "user" != "debug"
```

### Metrics (Prometheus)

```promql
# CPU Usage
100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory Usage %
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk Usage %
100 - ((node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100)

# Network Traffic In
rate(node_network_receive_bytes_total[5m])

# Network Traffic Out
rate(node_network_transmit_bytes_total[5m])

# HTTP Requests per second (if you add prom-client)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

---

## 🔧 PM2 Web Setup

PM2 Web is already installed from Step 2. Access it at `http://your-ec2-ip:9000`

**Features:**
- ✅ Start/Stop/Restart buttons
- ✅ Real-time logs
- ✅ CPU/Memory usage
- ✅ Process status
- ✅ Quick actions

**Secure it with Password (Optional):**

```bash
# Install nginx for reverse proxy
sudo apt install nginx apache2-utils -y

# Create password
sudo htpasswd -c /etc/nginx/.htpasswd admin

# Create nginx config
sudo nano /etc/nginx/sites-available/pm2-web
```

Add this config:
```nginx
server {
    listen 80;
    server_name pm2.your-domain.com;  # Or use IP

    location / {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Add basic auth
        auth_basic "PM2 Dashboard";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/pm2-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🎨 Your Complete Setup

### Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Grafana** | `http://your-ec2-ip:3002` | View errors, logs, metrics, alerts |
| **PM2 Web** | `http://your-ec2-ip:9000` | Restart/stop app, quick logs |
| **Prometheus** | `http://your-ec2-ip:9090` | Raw metrics (optional) |
| **Loki** | `http://your-ec2-ip:3100` | Raw logs API (optional) |

### Typical Workflow

**Morning Check:**
1. Open PM2 Web → See app is online ✅
2. Open Grafana → Check error count overnight

**Error Alert Received:**
1. Open email → See "10 errors detected"
2. Click link to Grafana
3. See error: "Database connection timeout"
4. Search: `{app="cloutsy"} |= "database"`
5. See full context and stack trace
6. Identify issue: Connection pool exhausted
7. Go to PM2 Web → Restart app
8. Monitor in Grafana to confirm fixed

**Weekly Review:**
1. Open Grafana dashboard
2. Check error trend (going up/down?)
3. Check memory usage trend
4. Check disk usage
5. Export report if needed

---

## 🛠️ Troubleshooting

### Grafana not showing logs

```bash
# Check Promtail is running
docker-compose ps promtail

# View Promtail logs
docker-compose logs promtail

# Verify log paths exist
ls -la /home/ubuntu/cloutsy/logs/
ls -la /home/ubuntu/.pm2/logs/

# Check Promtail can access logs
docker exec promtail ls -la /var/log/cloutsy/
```

### PM2 Web not accessible

```bash
# Check if running
pm2 list | grep pm2-dashboard

# Restart it
pm2 restart pm2-dashboard

# Check logs
pm2 logs pm2-dashboard
```

### Can't access from browser

```bash
# Check firewall
sudo ufw status

# Check ports are listening
sudo netstat -tulpn | grep 3002
sudo netstat -tulpn | grep 9000

# Check security group in AWS Console
```

---

## 📦 Resource Usage

On t3.micro (1GB RAM):
- Grafana stack: ~280MB
- PM2 Web: ~20MB
- Your app: ~400MB
- **Total: ~700MB** (leaves 300MB buffer)

---

## ✅ Quick Reference

### See Errors
```
Grafana → Explore → {app="cloutsy", level="error"}
```

### Restart App
```
PM2 Web → Click "Restart" button
```

### Get Email Alerts
```
Grafana → Alerting → New Rule
```

### Search Logs
```
Grafana → Explore → {app="cloutsy"} |= "search term"
```

### View CPU/Memory
```
Grafana → Import Dashboard 1860
```

---

**You now have EVERYTHING you need! 🎉**

- ✅ View errors with full context (Grafana)
- ✅ Restart/stop buttons (PM2 Web)
- ✅ Real-time monitoring (Both)
- ✅ Email alerts (Grafana)
- ✅ No vendor lock-in (All open source)
