# PM2 Deployment - Complete Setup Summary

## 📁 Files Created/Modified

### New Files:
1. ✅ `ecosystem.config.js` - PM2 cluster configuration
2. ✅ `Dockerfile.pm2` - Docker image with PM2 support

### Modified Files:
3. ✅ `.github/workflows/main.yml` - Updated to build with Dockerfile.pm2
4. ✅ `src/database/postgres.db.ts` - Increased connection pool (50→100)

### Existing Files (No Changes Needed):
- ✅ `deploy.sh` - Already supports IMAGE_TAG, works as-is
- ✅ `docker-compose.yml` - Already uses IMAGE_TAG variable, works as-is

## 🚀 How It Works Now

### Automated Deployment (via GitHub Actions):

**Dev Branch (Staging)**:
```
Push to dev → Build with Dockerfile.pm2 → Test → Push to DockerHub → Deploy to Staging
```

**Main Branch (Production)**:
```
Push to main → Promote dev→latest → Deploy to Production
```

### Manual Deployment:

```bash
# 1. Build locally with PM2
docker build -f Dockerfile.pm2 -t buymybills/incollab:pm2-latest .

# 2. Push to Docker Hub
docker push buymybills/incollab:pm2-latest

# 3. Deploy on server
ssh ubuntu@your-server
export IMAGE_TAG=pm2-latest
./deploy.sh
```

## 📊 What Changed

### Before (Single Process):
```
Dockerfile → node dist/main
Result: 1 Node.js process, uses 1 CPU core
```

### After (PM2 Cluster):
```
Dockerfile.pm2 → pm2-runtime start ecosystem.config.js
Result: 2 Node.js processes (on t3.medium), uses all CPU cores
```

## 🎯 Next Steps

### To Deploy PM2 to Production:

1. **Commit and push to dev branch**:
   ```bash
   git add ecosystem.config.js Dockerfile.pm2 .github/workflows/main.yml src/database/postgres.db.ts
   git commit -m "Add PM2 cluster mode support"
   git push origin dev
   ```

2. **GitHub Actions will automatically**:
   - Build with Dockerfile.pm2
   - Run tests
   - Push to DockerHub as `buymybills/incollab:dev`
   - Deploy to staging

3. **Verify on staging**:
   ```bash
   ssh ubuntu@staging-server
   docker exec -it incollab-backend pm2 status
   ```
   You should see 2 PM2 instances running.

4. **Run load test on staging**:
   ```bash
   # Update load test to point to staging
   artillery run load-test-safe-100-users.yml
   ```

5. **If all good, merge to main**:
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```

6. **GitHub Actions will**:
   - Promote dev image to latest
   - Deploy to production

## 🔍 Verification Commands

After deployment, verify PM2 is working:

```bash
# Check PM2 status
docker exec -it incollab-backend pm2 status

# Expected output:
# ┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┐
# │ id  │ name         │ mode        │ status  │ cpu     │ memory   │
# ├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┤
# │ 0   │ incollab-api │ cluster     │ online  │ 0%      │ 45.2mb   │
# │ 1   │ incollab-api │ cluster     │ online  │ 0%      │ 43.8mb   │
# └─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┘

# Monitor in real-time
docker exec -it incollab-backend pm2 monit

# Check logs
docker exec -it incollab-backend pm2 logs

# Check database connections
docker exec -it incollab-backend pm2 logs | grep -i "database\|connection"
```

## 📈 Expected Performance Improvements

| Metric | Before (Single Process) | After (PM2 Cluster) |
|--------|------------------------|---------------------|
| Concurrent Users | 50-75 | 150-200 |
| Success Rate @ 100 users | 44.5% | 90-95% |
| p95 Response Time | 8.4s | <1s |
| p99 Response Time | 16.5s | <2s |
| CPU Utilization | 50% (1 core) | 90% (2 cores) |

## 🐛 Troubleshooting

### If PM2 not showing:
```bash
# Check if container is using new image
docker inspect incollab-backend | grep Image

# Should show: buymybills/incollab:pm2-latest or :dev or :latest
```

### If still seeing single process:
```bash
# Container might be using old Dockerfile
# Force rebuild and redeploy
docker-compose pull
docker-compose up -d --force-recreate
```

### If connection errors increase:
```bash
# Check RDS max_connections
# Adjust pool.max in src/database/postgres.db.ts
# RDS max connections = (pool.max × number of PM2 instances) + 10
```

## ✅ Success Criteria

PM2 deployment is successful when:
- ✅ `pm2 status` shows 2 instances in cluster mode
- ✅ Both instances show "online" status
- ✅ Load test shows >90% success rate with 100 users
- ✅ p95 response time < 2 seconds
- ✅ No increase in database connection errors

## 📚 Reference Documents

- `PERFORMANCE_OPTIMIZATION_GUIDE.md` - Detailed technical guide
- `LOAD_TEST_RESULTS_AND_ACTION_PLAN.md` - Load test analysis
- `ecosystem.config.js` - PM2 configuration with comments

---

**Questions?** Check the guides or verify each step above.
