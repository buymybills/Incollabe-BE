# Grafana Monitoring Setup Guide

This will give you a **professional monitoring dashboard** to see all errors, logs, CPU, memory, and get alerts.

## What You'll Get

✅ **Beautiful web dashboard** - No SSH needed
✅ **Real-time error tracking** - See errors as they happen
✅ **Full error context** - Stack traces, timestamps, what caused it
✅ **Search logs** - Find errors by keyword, time, level
✅ **CPU & Memory graphs** - Visual performance monitoring
✅ **Email alerts** - Get notified when errors occur
✅ **No vendor lock-in** - All open source, runs on your server

---

## Installation (30 Minutes)

### Step 1: Upload Files to EC2

```bash
# From your local machine
scp -r monitoring ubuntu@your-ec2-ip:/home/ubuntu/
```

### Step 2: Install Docker (if not installed)

```bash
ssh ubuntu@your-ec2-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
ssh ubuntu@your-ec2-ip

# Verify Docker is working
docker --version
docker ps
```

### Step 3: Install Docker Compose

```bash
# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker-compose --version
```

### Step 4: Update Paths in Config

```bash
cd /home/ubuntu/monitoring

# Edit promtail-config.yml to match your actual log paths
nano promtail-config.yml
```

Update these lines if your paths are different:
```yaml
__path__: /var/log/cloutsy/*.log  # Change if your app logs are elsewhere
__path__: /var/log/pm2/*.log      # Change if PM2 logs are elsewhere
```

Also update docker-compose.yml volume mounts:
```yaml
- /home/ubuntu/cloutsy/logs:/var/log/cloutsy:ro  # Your app logs
- /home/ubuntu/.pm2/logs:/var/log/pm2:ro         # PM2 logs
```

### Step 5: Start Monitoring Stack

```bash
cd /home/ubuntu/monitoring

# Start all services
docker-compose up -d

# Check if all containers are running
docker-compose ps

# You should see:
# - grafana (running)
# - loki (running)
# - promtail (running)
# - prometheus (running)
# - node-exporter (running)

# View logs if any issues
docker-compose logs -f
```

### Step 6: Open Firewall Ports

```bash
# Allow Grafana port
sudo ufw allow 3002

# Or in AWS EC2 Security Group:
# Add inbound rule: Custom TCP, Port 3002, Source: 0.0.0.0/0
```

### Step 7: Access Grafana

1. Open browser: `http://your-ec2-ip:3002`
2. Login with:
   - Username: `admin`
   - Password: `admin`
3. You'll be prompted to change password (do it!)

---

## Using Grafana

### View Logs and Find Errors

1. Click **Explore** (compass icon on left sidebar)
2. Select **Loki** as data source
3. Use these queries:

**See all errors:**
```logql
{app="cloutsy"} |= "error"
```

**See errors in last hour:**
```logql
{app="cloutsy", level="error"}
```

**Search for specific error:**
```logql
{app="cloutsy"} |= "Database connection failed"
```

**See PM2 errors:**
```logql
{job="pm2-errors"}
```

**Filter by time:**
- Use time picker in top right (Last 5 minutes, Last 1 hour, etc.)

4. Click on any log line to see **full details**:
   - Full error message
   - Stack trace
   - Timestamp
   - Context

### View System Metrics

1. Go to **Explore**
2. Select **Prometheus** as data source
3. Use these queries:

**CPU usage:**
```promql
100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

**Memory usage:**
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

**Disk usage:**
```promql
100 - ((node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100)
```

### Create Dashboard

1. Click **+** → **Dashboard** → **Add visualization**
2. Select **Prometheus**
3. Add query (e.g., CPU usage query above)
4. Click **Apply**
5. Add more panels for Memory, Disk, Error Count, etc.
6. Click **Save dashboard**

**Or import pre-built dashboards:**
1. Click **+** → **Import**
2. Enter dashboard ID: `1860` (Node Exporter Full)
3. Click **Load**
4. Select **Prometheus** as data source
5. Click **Import**

### Set Up Email Alerts

1. Go to **Alerting** → **Contact points**
2. Click **New contact point**
3. Select **Email**
4. Enter your email
5. Configure SMTP settings:

```yaml
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: your-app-password  # Use Gmail App Password
```

6. Click **Test** then **Save**

### Create Alert Rules

**Alert on high error rate:**

1. Go to **Alerting** → **Alert rules** → **New alert rule**
2. Name: "High Error Rate"
3. Query:
   ```logql
   count_over_time({app="cloutsy", level="error"}[5m])
   ```
4. Condition: `WHEN last() OF query(A) IS ABOVE 10`
5. Evaluation: Every 1m for 5m
6. Add contact point (your email)
7. Save

**Alert on app down:**

1. Create new alert rule
2. Name: "App Down"
3. Query:
   ```promql
   up{job="cloutsy-app"}
   ```
4. Condition: `WHEN last() OF query(A) IS BELOW 1`
5. Contact point: Your email
6. Save

**Alert on high memory:**

1. Create new alert rule
2. Name: "High Memory Usage"
3. Query:
   ```promql
   (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
   ```
4. Condition: `WHEN last() OF query(A) IS ABOVE 80`
5. Contact point: Your email
6. Save

---

## Common Use Cases

### 1. "I want to see what errors happened today"

```logql
{app="cloutsy", level="error"}
```
Time range: Last 24 hours

### 2. "Show me all database errors"

```logql
{app="cloutsy"} |= "database" |= "error"
```

### 3. "When did the app crash?"

```logql
{job="pm2"} |= "stopped" or |= "errored"
```

### 4. "Show me slow requests"

```logql
{app="cloutsy"} |= "duration" | json | duration > 1000
```

### 5. "What happened around 2 PM?"

1. Set time range to specific time
2. View all logs around that time
3. Filter by level=error

---

## Troubleshooting

### Containers not starting

```bash
# Check logs
docker-compose logs

# Restart specific service
docker-compose restart loki

# Restart all
docker-compose down
docker-compose up -d
```

### No logs showing in Grafana

```bash
# Check Promtail is collecting logs
docker-compose logs promtail

# Verify log file paths exist
ls -la /home/ubuntu/cloutsy/logs/
ls -la /home/ubuntu/.pm2/logs/

# Check Promtail can read files
docker exec promtail ls -la /var/log/cloutsy/
```

### Can't access Grafana

```bash
# Check if Grafana is running
docker ps | grep grafana

# Check firewall
sudo ufw status
```

### High disk usage

```bash
# Check Docker volume sizes
docker system df

# Clean up old logs (Loki auto-deletes after 30 days)
# Or reduce retention in loki-config.yml:
retention_period: 168h  # 7 days instead of 30
```

---

## Maintenance

### Stop monitoring stack

```bash
cd /home/ubuntu/monitoring
docker-compose down
```

### Start monitoring stack

```bash
cd /home/ubuntu/monitoring
docker-compose up -d
```

### View logs

```bash
docker-compose logs -f  # All services
docker-compose logs -f grafana  # Just Grafana
```

### Update containers

```bash
docker-compose pull
docker-compose up -d
```

### Backup Grafana dashboards

```bash
docker exec grafana grafana-cli admin export > grafana-backup.json
```

---

## Resource Usage

On t3.micro (1GB RAM), this stack uses approximately:
- Grafana: ~100MB RAM
- Loki: ~50MB RAM
- Promtail: ~20MB RAM
- Prometheus: ~100MB RAM
- Node Exporter: ~10MB RAM
- **Total: ~280MB RAM** (leaves ~720MB for your app)

---

## Next Steps

1. ✅ Create your first dashboard
2. ✅ Set up email alerts for critical errors
3. ✅ Explore logs to understand your app behavior
4. ✅ Monitor CPU/Memory usage trends

---

## Benefits Over Other Solutions

| Feature | Grafana Stack | PM2 Plus | CloudWatch |
|---------|---------------|----------|------------|
| Cost | Free | Free tier limited | $5-50/month |
| Vendor lock-in | ❌ None | ✅ PM2 only | ✅ AWS only |
| Self-hosted | ✅ Yes | ❌ No | ❌ No |
| Custom dashboards | ✅ Yes | Limited | Limited |
| Log search | ✅ Powerful | Basic | Good |
| Alerts | ✅ Unlimited | Limited | Paid |
| Data retention | ✅ Configurable | 7 days | Paid |

---

## Support

If you need help:
1. Check Grafana docs: https://grafana.com/docs/
2. Check Loki docs: https://grafana.com/docs/loki/
3. View Docker logs: `docker-compose logs`

---

**You now have professional-grade monitoring! 🎉**

Access your dashboard: `http://your-ec2-ip:3002`
