# PM2 Cluster Mode Deployment Guide

## 🎯 Overview

This guide explains how to deploy the PM2-optimized version of the application to production for improved performance under load.

## 📊 Performance Impact

**Before PM2 (Current Production)**:
- Single Node.js process
- Uses only 1 CPU core (50% of t3.medium capacity)
- Success rate: 44-54% at 100 concurrent users
- p95 response time: 5-8 seconds

**After PM2 (Target)**:
- Multiple Node.js processes (2 on t3.medium)
- Uses both CPU cores (90%+ capacity)
- Expected success rate: 90-95% at 100 concurrent users
- Expected p95 response time: <1 second

## 🏗️ Architecture

### Files Involved

1. **`Dockerfile.pm2`** - Optimized Dockerfile with PM2 runtime
2. **`ecosystem.config.js`** - PM2 configuration (cluster mode, auto-restart, etc.)
3. **`docker-compose.yml`** - Already configured to use `IMAGE_TAG` env variable
4. **`.env`** - Set `IMAGE_TAG=pm2-v1` to use PM2 image

### Why ecosystem.config.js is JavaScript?

PM2 uses JavaScript configuration files because:
- **Native format**: PM2 is a Node.js tool
- **Dynamic configuration**: Can use environment variables and logic
- **Industry standard**: All PM2 configs are in JS format

Example:
```javascript
module.exports = {
  apps: [{
    instances: 'max',        // Use all CPU cores
    exec_mode: 'cluster',    // Enable load balancing
    max_memory_restart: '1G' // Auto-restart if memory > 1GB
  }]
};
```

## 🚀 Deployment Workflow

### Step 1: Build PM2 Image (Local Machine)

Run the automated build script:

```bash
# Make script executable (first time only)
chmod +x build-and-push-pm2.sh

# Build and push PM2 image
./build-and-push-pm2.sh
```

This will:
- ✅ Build Docker image with PM2
- ✅ Tag as `buymybills/incollab:pm2-v1`
- ✅ Push to Docker Hub
- ✅ Display next steps

**Manual alternative**:
```bash
docker build -f Dockerfile.pm2 -t buymybills/incollab:pm2-v1 .
docker push buymybills/incollab:pm2-v1
```

### Step 2: Deploy to Production Server

#### Option A: Use Automated Script (Recommended)

Copy the deployment script to production:
```bash
scp deploy-pm2-to-production.sh ubuntu@your-server:/home/ubuntu/Incollabe-BE/
```

SSH to production and run:
```bash
ssh ubuntu@your-server
cd /home/ubuntu/Incollabe-BE
chmod +x deploy-pm2-to-production.sh
./deploy-pm2-to-production.sh
```

#### Option B: Manual Deployment

SSH to production:
```bash
ssh ubuntu@your-server
cd /home/ubuntu/Incollabe-BE
```

Update IMAGE_TAG in .env:
```bash
# Add or update IMAGE_TAG
echo "IMAGE_TAG=pm2-v1" >> .env
# Or edit manually
nano .env
```

Deploy using existing deploy.sh:
```bash
./deploy.sh
```

### Step 3: Verify PM2 is Running

Check PM2 status:
```bash
docker exec -it incollab-backend pm2 status
```

Expected output:
```
┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ mode        │ status  │ cpu     │ memory   │
├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ incollab-api │ cluster     │ online  │ 0%      │ 45.2mb   │
│ 1   │ incollab-api │ cluster     │ online  │ 0%      │ 43.8mb   │
└─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┘
```

✅ **Success indicators**:
- 2 instances running (one per CPU core on t3.medium)
- Mode: `cluster`
- Status: `online`

### Step 4: Monitor and Test

#### Monitor PM2
```bash
# Real-time monitoring
docker exec -it incollab-backend pm2 monit

# View logs
docker exec -it incollab-backend pm2 logs

# View specific app info
docker exec -it incollab-backend pm2 info incollab-api
```

#### Monitor Container
```bash
# Container logs
docker logs -f incollab-backend

# Container stats (CPU, memory)
docker stats incollab-backend

# Container health
docker ps
```

#### Run Load Test
From your local machine:
```bash
artillery run load-test-safe-100-users.yml 2>&1 | tee test-100-pm2-results.txt
```

## 🔄 How docker-compose.yml Works

Your `docker-compose.yml` already supports this deployment:

```yaml
services:
  incollab-app:
    image: ${DOCKERHUB_USERNAME:-buymybills}/incollab:${IMAGE_TAG:-latest}
    # ... rest of config
```

**How it works**:
1. Reads `DOCKERHUB_USERNAME` from `.env` (default: `buymybills`)
2. Reads `IMAGE_TAG` from `.env` (default: `latest`)
3. Constructs image name: `buymybills/incollab:pm2-v1`

**To switch versions**:
- PM2 version: Set `IMAGE_TAG=pm2-v1` in `.env`
- Regular version: Set `IMAGE_TAG=latest` in `.env`

## 🔧 How deploy.sh Works

Your existing `deploy.sh` script:
1. Reads `DOCKERHUB_USERNAME` and `IMAGE_TAG` from `.env`
2. Pulls the specified image from Docker Hub
3. Stops and removes old container
4. Starts new container with pulled image

**No changes needed to deploy.sh!** It already supports switching between image tags.

## 📋 Configuration Files Explained

### Dockerfile vs Dockerfile.pm2

| Aspect | Dockerfile | Dockerfile.pm2 |
|--------|-----------|----------------|
| Runtime | `node dist/main` | `pm2-runtime start ecosystem.config.js` |
| Processes | 1 (single thread) | 2+ (cluster mode) |
| CPU Usage | 50% (1 core) | 90%+ (all cores) |
| PM2 Installed | ❌ No | ✅ Yes |
| Best For | Development | Production |

### ecosystem.config.js Settings

```javascript
{
  instances: 'max',           // Auto-detect CPU cores (2 on t3.medium)
  exec_mode: 'cluster',       // Enable clustering & load balancing
  max_memory_restart: '1G',   // Auto-restart if memory exceeds 1GB
  autorestart: true,          // Auto-restart on crash
  watch: false,               // Don't watch files (production)
  kill_timeout: 5000,         // 5s graceful shutdown
  wait_ready: true,           // Wait for app ready signal
}
```

## 🆘 Troubleshooting

### PM2 Not Found
**Issue**: `docker exec -it incollab-backend pm2 status` fails

**Cause**: Still using old Docker image without PM2

**Solution**: Verify IMAGE_TAG in .env and redeploy
```bash
cat .env | grep IMAGE_TAG  # Should show pm2-v1
./deploy.sh
```

### Only 1 Instance Running
**Issue**: PM2 shows only 1 instance instead of 2

**Cause**: 
- Single CPU instance (t3.micro, t3.nano)
- Manual instance count set in ecosystem.config.js

**Solution**: Check CPU count
```bash
docker exec -it incollab-backend nproc  # Should show 2 on t3.medium
```

### High Memory Usage
**Issue**: Container using too much memory

**Solution**: 
1. Reduce instances in ecosystem.config.js
2. Lower `max_memory_restart` threshold
3. Check for memory leaks in application

### Performance Not Improved
**Issue**: Load test still shows poor performance

**Debugging steps**:
1. Verify PM2 cluster mode: `docker exec -it incollab-backend pm2 status`
2. Check CPU usage: `docker stats incollab-backend`
3. Check database connections: Query `pg_stat_activity`
4. Review PM2 logs: `docker exec -it incollab-backend pm2 logs --err`

## 🔙 Rollback

### Quick Rollback to Previous Version

On production server:
```bash
# Update .env to use old image
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=latest/' /home/ubuntu/Incollabe-BE/.env

# Redeploy
cd /home/ubuntu/Incollabe-BE
./deploy.sh
```

### Verify Rollback
```bash
docker ps  # Should show container running
docker logs incollab-backend  # Should NOT show PM2 logs
```

## 📈 Expected Improvements

| Metric | Before PM2 | After PM2 | Improvement |
|--------|-----------|-----------|-------------|
| Concurrent Users | 50-75 | 150-200 | +200% |
| Success Rate (100 users) | 44-54% | 90-95% | +100% |
| p95 Response Time | 5-8s | <1s | -85% |
| p99 Response Time | 12-16s | <2s | -88% |
| CPU Utilization | 50% | 90%+ | +80% |

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Read this guide thoroughly
- [ ] Backup production database
- [ ] Test PM2 image locally if possible
- [ ] Plan deployment during low-traffic window
- [ ] Notify team about deployment

### Build & Push
- [ ] Run `./build-and-push-pm2.sh` from local machine
- [ ] Verify image pushed to Docker Hub

### Deploy
- [ ] SSH to production server
- [ ] Update `IMAGE_TAG=pm2-v1` in `.env`
- [ ] Run `./deploy.sh` or `./deploy-pm2-to-production.sh`
- [ ] Verify container is running: `docker ps`

### Verify
- [ ] Check PM2 status: `docker exec -it incollab-backend pm2 status`
- [ ] Verify 2 instances running in cluster mode
- [ ] Monitor logs for 30 minutes: `docker logs -f incollab-backend`
- [ ] Test API endpoints manually
- [ ] Run load test: `artillery run load-test-safe-100-users.yml`

### Post-Deployment
- [ ] Document any issues encountered
- [ ] Update team on deployment status
- [ ] Monitor CloudWatch metrics for 24 hours
- [ ] Schedule load test during peak hours

## 🎓 Additional Resources

- **PM2 Documentation**: https://pm2.keymetrics.io/
- **PM2 Cluster Mode**: https://pm2.keymetrics.io/docs/usage/cluster-mode/
- **Load Testing Results**: See `LOAD_TEST_RESULTS_AND_ACTION_PLAN.md`
- **Performance Guide**: See `PERFORMANCE_OPTIMIZATION_GUIDE.md`

## 📞 Support

If issues persist:
1. Check PM2 logs: `docker exec -it incollab-backend pm2 logs`
2. Check application logs: `docker logs incollab-backend`
3. Review this guide's troubleshooting section
4. Consider rolling back if critical issues occur

---

**Remember**: This is a significant architecture change. Deploy during low-traffic periods and monitor closely for the first 24 hours.
