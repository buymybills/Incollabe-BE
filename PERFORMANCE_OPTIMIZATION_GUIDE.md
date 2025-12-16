# Performance Optimization Guide

## 🚨 Issue Identified
Load testing revealed the application was running as a **single Node.js process**, unable to utilize multiple CPU cores. This created a severe bottleneck under concurrent load.

## 📊 Load Test Results (Before Optimization)

### t3.small (1 vCPU)
- **Success Rate**: 54% (10,309 / 18,900 requests)
- **p95 Response Time**: 5.8 seconds ❌
- **p99 Response Time**: 12 seconds ❌
- **Errors**: 8,591 ECONNREFUSED, 1,507 ETIMEDOUT

### t3.medium (2 vCPUs) - Without PM2 Clustering
- **Success Rate**: 44.5% (8,411 / 18,900 requests) - **WORSE!**
- **p95 Response Time**: 8.4 seconds ❌
- **p99 Response Time**: 16.5 seconds ❌
- **Errors**: 5,980 ECONNREFUSED, 4,509 ETIMEDOUT

**Key Finding**: Upgrading instance size made performance WORSE because the single Node.js process couldn't utilize the additional CPU core.

## 🔧 Implemented Optimizations

### 1. PM2 Cluster Mode ⭐ (Most Important)

**Problem**: Single Node.js process = single thread = bottleneck
**Solution**: PM2 cluster mode to run multiple instances (one per CPU core)

**Files Created/Modified**:
- `ecosystem.config.js` - PM2 configuration with cluster mode
- `Dockerfile.pm2` - Optimized Dockerfile with PM2 runtime

**Benefits**:
- ✅ Utilizes all CPU cores (2 on t3.medium, 4 on t3.xlarge, etc.)
- ✅ Built-in load balancing across instances
- ✅ Zero-downtime restarts
- ✅ Automatic process recovery
- ✅ Memory leak protection (auto-restart on high memory)

**Key Configuration**:
```javascript
{
  instances: 'max',        // Use all CPU cores
  exec_mode: 'cluster',    // Enable clustering
  max_memory_restart: '1G' // Restart if memory > 1GB
}
```

### 2. Database Connection Pool Optimization

**Before**: max: 50 connections
**After**: max: 100 connections with eviction strategy

**File Modified**: `src/database/postgres.db.ts`

**Configuration**:
```typescript
pool: {
  max: 100,       // Maximum 100 connections
  min: 10,        // Minimum 10 idle connections  
  acquire: 60000, // 60s timeout for acquiring connection
  idle: 10000,    // 10s idle before releasing
  evict: 1000,    // Run eviction every 1 second
}
```

**Why This Helps**:
- More connections available for concurrent requests
- Faster connection acquisition
- Better resource utilization
- Automatic cleanup of idle connections

### 3. RDS Configuration Recommendations

**Check your RDS instance's max_connections**:
```sql
SHOW max_connections;
```

**Typical RDS limits**:
- db.t3.micro: 85 connections
- db.t3.small: 85 connections
- db.t3.medium: 150 connections
- db.t3.large: 300 connections

**Formula**: Set pool.max = (RDS max_connections - 10) / number_of_app_instances

Example for db.t3.medium with 2 PM2 instances:
- RDS max: 150 connections
- Reserve: 10 connections
- Available: 140 connections
- Per instance: 140 / 2 = 70 connections

**Adjust in postgres.db.ts accordingly!**

## 🚀 Deployment Steps

### Option A: Use New Dockerfile with PM2 (Recommended)

1. **Build and push new image**:
```bash
# Build with PM2
docker build -f Dockerfile.pm2 -t buymybills/incollab:pm2-optimized .

# Push to Docker Hub
docker push buymybills/incollab:pm2-optimized
```

2. **Update docker-compose.yml**:
```yaml
services:
  incollab-app:
    image: buymybills/incollab:pm2-optimized
    # ... rest of config
```

3. **Deploy**:
```bash
./deploy.sh
```

### Option B: Modify Existing Dockerfile

Replace existing `Dockerfile` content with `Dockerfile.pm2` content.

### Option C: Run PM2 Manually (Quick Test)

If you want to test without rebuilding Docker image:

```bash
# SSH into EC2
ssh ubuntu@your-server

# Stop Docker container
docker stop incollab-backend

# Install PM2 globally
npm install -g pm2

# Navigate to app directory
cd /path/to/app

# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# Monitor
pm2 monit

# View logs
pm2 logs
```

## 📈 Expected Improvements

With PM2 cluster mode on t3.medium (2 vCPUs):

| Metric | Before | Expected After | Improvement |
|--------|--------|----------------|-------------|
| Success Rate | 44.5% | 90-95% | +100% |
| p95 Response | 8.4s | <1s | -88% |
| p99 Response | 16.5s | <2s | -88% |
| Concurrent Users | 50-75 | 150-200 | +200% |
| CPU Utilization | 50% (1 core) | 90%+ (2 cores) | +80% |

## 🔍 Monitoring After Deployment

### Check PM2 Status
```bash
# Inside Docker container
docker exec -it incollab-backend pm2 status

# View detailed info
docker exec -it incollab-backend pm2 info incollab-api

# Monitor in real-time
docker exec -it incollab-backend pm2 monit
```

### Check Database Connections
```sql
-- Active connections by application
SELECT 
  application_name,
  COUNT(*) as connection_count,
  state
FROM pg_stat_activity 
WHERE datname = 'your_database_name'
GROUP BY application_name, state
ORDER BY connection_count DESC;

-- Connection usage percentage
SELECT 
  COUNT(*) as current_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
  ROUND((COUNT(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')), 2) as usage_percent
FROM pg_stat_activity;
```

### Monitor Container Logs
```bash
# Application logs
docker logs -f incollab-backend --tail 100

# PM2 logs
docker exec -it incollab-backend pm2 logs --lines 50

# Error logs only
docker exec -it incollab-backend pm2 logs --err --lines 50
```

## 🧪 Re-run Load Tests

After deploying PM2 optimization:

```bash
# Test with 100 users
artillery run load-test-safe-100-users.yml 2>&1 | tee test-100-users-pm2.txt

# Test with 200 users (if 100 passes well)
artillery run load-test-safe-200-users.yml 2>&1 | tee test-200-users-pm2.txt
```

## 🎯 Additional Optimizations (Future)

### 1. Redis Connection Pool
Consider implementing connection pooling for Redis if you see Redis connection errors.

### 2. Caching Strategy
- Implement Redis caching for frequently accessed data
- Add cache headers for static assets
- Consider CDN for static content

### 3. Database Query Optimization
- Add indexes for frequently queried columns
- Use eager loading to reduce N+1 queries
- Implement pagination for large result sets

### 4. Rate Limiting
Implement rate limiting to protect against abuse:
```typescript
// In main.ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
  ],
})
```

### 5. Enable Gzip Compression
Already enabled in nginx, ensure it's working:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### 6. Horizontal Scaling
Once vertical scaling is optimized, consider:
- Multiple EC2 instances behind ALB (Application Load Balancer)
- Auto-scaling groups
- ECS/EKS for container orchestration

## 📝 Rollback Plan

If issues occur after deployment:

```bash
# Quick rollback to previous image
docker pull buymybills/incollab:previous-tag
docker-compose down
docker-compose up -d

# Or use previous Docker image tag in docker-compose.yml
```

## ✅ Checklist Before Production Deployment

- [ ] Backup database
- [ ] Test PM2 cluster mode in staging
- [ ] Verify RDS max_connections setting
- [ ] Update pool.max based on RDS limits
- [ ] Build and test new Docker image locally
- [ ] Push image to Docker Hub
- [ ] Update docker-compose.yml with new image tag
- [ ] Deploy during low-traffic window
- [ ] Monitor logs for 30 minutes after deployment
- [ ] Run load tests to verify improvements
- [ ] Document any issues and rollback if needed

## 🆘 Troubleshooting

### PM2 Logs Not Showing
```bash
# Check PM2 is running
docker exec -it incollab-backend pm2 list

# Flush logs
docker exec -it incollab-backend pm2 flush

# Restart app
docker exec -it incollab-backend pm2 restart all
```

### High Memory Usage
```bash
# Check memory per instance
docker exec -it incollab-backend pm2 monit

# Reduce max_memory_restart in ecosystem.config.js
# or reduce number of instances
```

### Database Connection Pool Exhausted
```sql
-- Check active connections
SELECT COUNT(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < NOW() - INTERVAL '5 minutes';
```

### All Instances Crashing
```bash
# Check error logs
docker exec -it incollab-backend pm2 logs --err

# Reduce instances temporarily
docker exec -it incollab-backend pm2 scale incollab-api 1
```

## 📞 Support

If issues persist after implementing these optimizations:
1. Check PM2 logs: `pm2 logs`
2. Check application logs: `docker logs incollab-backend`
3. Monitor RDS CloudWatch metrics
4. Review EC2 CloudWatch metrics (CPU, Network, Disk)

---

**Remember**: Always test in staging before production deployment!
