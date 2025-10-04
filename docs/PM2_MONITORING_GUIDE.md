# PM2 Monitoring & Error Tracking Guide

## Quick Comparison

| Solution | Setup Time | Cost | Vendor Lock-in | Features |
|----------|------------|------|----------------|----------|
| **PM2 CLI** | 0 min | Free | ❌ None | Basic monitoring |
| **PM2 Web** | 5 min | Free | ❌ None | Web dashboard |
| **PM2 Plus** | 2 min | Free tier | ✅ PM2-specific | Advanced, cloud |
| **Grafana Stack** | 30 min | Free | ❌ None | Professional, self-hosted |

---

## Option 1: PM2 CLI (Simplest - Already Available)

### Basic Commands

```bash
# SSH into EC2
ssh ubuntu@your-ec2-ip

# Real-time dashboard (like htop for PM2)
pm2 monit

# List all apps with status
pm2 list

# View live logs
pm2 logs collabkaroo

# View only errors
pm2 logs collabkaroo --err

# View last 200 lines
pm2 logs collabkaroo --lines 200

# Detailed app info
pm2 show collabkaroo

# Restart app
pm2 restart collabkaroo

# Check if app crashed
pm2 list | grep "errored"
```

### View Logs by Time

```bash
# Today's errors
pm2 logs collabkaroo --err --lines 1000 | grep "$(date +%Y-%m-%d)"

# Last hour
pm2 logs collabkaroo --err --lines 500

# Follow logs (like tail -f)
pm2 logs collabkaroo --err --lines 0
```

### Output Example

```
┌─────┬──────────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ mode    │ ↺      │ status  │ cpu      │
├─────┼──────────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ collabkaroo  │ fork    │ 15      │ online  │ 0%       │
└─────┴──────────────┴─────────┴─────────┴─────────┴──────────┘

[TAILING] Tailing last 15 lines for [collabkaroo] process
collabkaroo-0 (out): [2025-10-03] Server started on port 3000
collabkaroo-0 (err): [2025-10-03] Error: Database connection failed
```

**Pros:**
- ✅ Already installed
- ✅ No setup needed
- ✅ Real-time monitoring

**Cons:**
- ❌ Must SSH to view
- ❌ No web UI
- ❌ No alerts

---

## Option 2: PM2 Web Dashboard (Easiest Web UI)

### Installation

```bash
# SSH into EC2
ssh ubuntu@your-ec2-ip

# Install PM2 web dashboard
npm install -g pm2-web

# Start it (runs on port 9000)
pm2-web --port 9000

# Run in background with PM2
pm2 start pm2-web -- --port 9000
pm2 save
```

### Access Dashboard

Open browser: `http://your-ec2-ip:9000`

**You'll see:**
- Live process list
- CPU & Memory graphs
- Real-time logs
- Start/Stop/Restart buttons

### Secure It (Important!)

```bash
# Install nginx
sudo apt install nginx

# Create password file
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin

# Configure nginx
sudo nano /etc/nginx/sites-available/pm2-web
```

Nginx config:
```nginx
server {
    listen 80;
    server_name pm2.your-domain.com;

    location / {
        proxy_pass http://localhost:9000;
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

**Pros:**
- ✅ Simple web interface
- ✅ Real-time monitoring
- ✅ No vendor lock-in

**Cons:**
- ❌ Basic features
- ❌ No alerts
- ❌ Limited history

---

## Option 3: PM2 Plus / Keymetrics (Official Cloud)

### Setup

1. Go to https://pm2.io/
2. Create free account
3. Get your keys
4. Link your server:

```bash
ssh ubuntu@your-ec2-ip
pm2 link <secret_key> <public_key>
```

### Features

**Dashboard shows:**
- Real-time metrics
- Error tracking
- Custom metrics
- Transaction tracing
- Exception tracking
- Email/SMS alerts

**Pros:**
- ✅ Professional UI
- ✅ Email alerts
- ✅ Error tracking
- ✅ Easy setup

**Cons:**
- ⚠️ Vendor lock-in (PM2-specific)
- ⚠️ Data sent to their servers
- ⚠️ Free tier limited to 1 server

---

## Option 4: Self-Hosted Grafana + Prometheus (Best for Production)

### Why This is Best

- ✅ **No vendor lock-in** - All open source
- ✅ **Professional dashboards** - Like AWS CloudWatch
- ✅ **Powerful alerts** - Email, Slack, Discord
- ✅ **Full control** - Data stays on your server
- ✅ **Industry standard** - Used by Google, Netflix, etc.

### Installation (30 minutes)

#### Step 1: Install Docker

```bash
ssh ubuntu@your-ec2-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
exit  # Log out and back in
```

#### Step 2: Deploy Monitoring Stack

```bash
# Upload monitoring files
scp -r monitoring ubuntu@your-ec2-ip:/home/ubuntu/

# Start the stack
cd /home/ubuntu/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

#### Step 3: Add Metrics to Your App

Install prom-client in your NestJS app:

```bash
npm install prom-client
```

Create metrics service:

```typescript
// src/shared/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private httpRequestDuration: Histogram;
  private httpRequestTotal: Counter;
  private errorCounter: Counter;
  private activeConnections: Gauge;

  constructor() {
    // HTTP request duration
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
    });

    // HTTP request count
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    // Error counter
    this.errorCounter = new Counter({
      name: 'app_errors_total',
      help: 'Total number of application errors',
      labelNames: ['type', 'endpoint'],
    });

    // Active connections
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
    });
  }

  recordHttpRequest(method: string, route: string, status: number, duration: number) {
    this.httpRequestDuration.labels(method, route, status.toString()).observe(duration);
    this.httpRequestTotal.labels(method, route, status.toString()).inc();
  }

  recordError(type: string, endpoint: string) {
    this.errorCounter.labels(type, endpoint).inc();
  }

  incrementConnections() {
    this.activeConnections.inc();
  }

  decrementConnections() {
    this.activeConnections.dec();
  }

  getMetrics() {
    return register.metrics();
  }
}
```

Add metrics endpoint:

```typescript
// src/shared/shared.module.ts
import { MetricsService } from './metrics.service';

@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class SharedModule {}
```

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './shared/metrics.service';

@Controller()
export class AppController {
  constructor(private metricsService: MetricsService) {}

  @Get('/metrics')
  getMetrics() {
    return this.metricsService.getMetrics();
  }
}
```

Add middleware to track requests:

```typescript
// src/shared/middleware/metrics.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
      );

      if (res.statusCode >= 400) {
        this.metricsService.recordError(
          res.statusCode >= 500 ? 'server_error' : 'client_error',
          req.route?.path || req.path,
        );
      }
    });

    next();
  }
}
```

Apply middleware:

```typescript
// src/app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
```

#### Step 4: Install PM2 Metrics Exporter

```bash
npm install -g pm2-prometheus-exporter

# Start exporter (runs on port 9209)
pm2 install pm2-prometheus-exporter
```

#### Step 5: Access Grafana

1. Open browser: `http://your-ec2-ip:3002`
2. Login: `admin` / `admin`
3. Change password
4. Add Prometheus datasource (should be auto-configured)
5. Import dashboard ID `11159` (PM2 Dashboard)
6. Import dashboard ID `1860` (Node Exporter)

### What You'll See

**Beautiful dashboards showing:**
- 📊 CPU, Memory, Disk usage graphs
- 📈 Request rate, response time
- 🚨 Error rate
- 📉 PM2 process status
- 📝 Live log streaming
- ⚡ Real-time alerts

### Set Up Alerts

In Grafana:
1. Go to Alerting → Alert Rules
2. Create new alert:
   - **High Error Rate**: If errors > 10/min, send email
   - **High Memory**: If memory > 80%, send alert
   - **App Down**: If PM2 process offline, send alert
   - **Disk Full**: If disk > 90%, send alert

**Alert channels:**
- Email
- Slack
- Discord
- Telegram
- Webhook (any service)

---

## Recommended Setup for t3.micro

### Basic Setup (5 minutes)

```bash
# Use PM2 CLI for quick checks
pm2 monit
pm2 logs --err
```

### Production Setup (30 minutes)

1. **Install Grafana stack** (Option 4)
2. **Set up alerts** for:
   - App crashes
   - High error rate
   - Memory > 80%
   - Disk > 80%
3. **Configure logrotate** (from previous guide)

### Daily Workflow

**Check health:**
```bash
# Quick SSH check
ssh ubuntu@your-ec2-ip "pm2 status"

# Or open Grafana dashboard in browser
http://your-ec2-ip:3002
```

**When errors occur:**
```bash
# View recent errors
pm2 logs collabkaroo --err --lines 100

# Or search in Grafana Loki
# (Explore → Loki → {app="collabkaroo"} |= "error")
```

---

## Comparison Table

| Feature | PM2 CLI | PM2 Web | PM2 Plus | Grafana Stack |
|---------|---------|---------|----------|---------------|
| Real-time monitoring | ✅ | ✅ | ✅ | ✅ |
| Web UI | ❌ | ✅ | ✅ | ✅ |
| Log search | Basic | Basic | ✅ | ✅✅ |
| Alerts | ❌ | ❌ | ✅ | ✅✅ |
| Historical data | ❌ | ❌ | ✅ | ✅✅ |
| Custom metrics | ❌ | ❌ | ✅ | ✅✅ |
| Vendor lock-in | ❌ | ❌ | ✅ | ❌ |
| Setup time | 0 min | 5 min | 2 min | 30 min |
| Resource usage | Minimal | Low | Minimal | Medium |

---

## My Recommendation

**For your t3.micro EC2 instance:**

### Start Simple (Week 1)
```bash
# Use built-in PM2 commands
pm2 monit
pm2 logs --err
```

### Upgrade When Ready (Week 2+)
Set up Grafana stack for professional monitoring:
- Beautiful dashboards
- Email alerts
- No vendor lock-in
- Industry standard

---

## Quick Start Script

Save this as `check-errors.sh`:

```bash
#!/bin/bash
# Quick error check script

echo "=== PM2 Status ==="
pm2 status

echo -e "\n=== Recent Errors ==="
pm2 logs collabkaroo --err --lines 20 --nostream

echo -e "\n=== Disk Usage ==="
df -h / | awk 'NR==2 {print "Used: " $5}'

echo -e "\n=== Memory Usage ==="
free -h | awk 'NR==2 {print "Used: " $3 " / " $2}'

echo -e "\n=== CPU Load ==="
uptime
```

Use it:
```bash
chmod +x check-errors.sh
./check-errors.sh
```

---

## Need Help?

**Common Issues:**

1. **Can't access Grafana** - Check firewall: `sudo ufw allow 3002`
2. **PM2 metrics not showing** - Restart exporter: `pm2 restart pm2-prometheus-exporter`
3. **Logs not appearing** - Check Promtail: `docker logs promtail`

**Want me to help set up:**
- Grafana stack installation?
- Alert configuration?
- Custom dashboards?

Just let me know! 🚀
