# Quick Start: PM2 Deployment

## 🎯 Goal
Deploy PM2 cluster mode to production for 3-4x performance improvement.

## ⚡ Quick Deployment (3 Steps)

### 1. Build & Push (Local Machine)
```bash
chmod +x build-and-push-pm2.sh
./build-and-push-pm2.sh
```

### 2. Deploy (Production Server)
```bash
ssh ubuntu@your-server
cd /home/ubuntu/Incollabe-BE
echo "IMAGE_TAG=pm2-v1" >> .env
./deploy.sh
```

### 3. Verify (Production Server)
```bash
docker exec -it incollab-backend pm2 status
```

Expected: **2 instances** running in **cluster** mode

## 📝 What Changed?

### No Changes Needed To:
- ✅ `docker-compose.yml` - Already uses `${IMAGE_TAG}` variable
- ✅ `deploy.sh` - Already pulls image based on IMAGE_TAG
- ✅ `.env` - Just add/update `IMAGE_TAG=pm2-v1`

### New Files Created:
- ✅ `Dockerfile.pm2` - Docker image with PM2
- ✅ `ecosystem.config.js` - PM2 cluster configuration
- ✅ `build-and-push-pm2.sh` - Build automation script
- ✅ `deploy-pm2-to-production.sh` - Server-side deployment script
- ✅ `PM2_DEPLOYMENT_GUIDE.md` - Complete documentation

### Modified Files:
- ✅ `src/database/postgres.db.ts` - Increased connection pool (50→100)

## 🔄 How It Works

### Current Production (Before)
```
docker-compose.yml reads IMAGE_TAG=latest from .env
→ Uses: buymybills/incollab:latest
→ Runs: node dist/main (single process)
→ Uses: 1 CPU core only
```

### After Deployment
```
docker-compose.yml reads IMAGE_TAG=pm2-v1 from .env
→ Uses: buymybills/incollab:pm2-v1
→ Runs: pm2-runtime with cluster mode (2 processes)
→ Uses: Both CPU cores
```

## 🎓 Understanding ecosystem.config.js

**Why JavaScript?**
- PM2 is a Node.js tool
- JS allows dynamic configuration
- Industry standard format

**What it does**:
```javascript
{
  instances: 'max',      // Auto-detect CPU count (2 on t3.medium)
  exec_mode: 'cluster',  // Load balance across instances
  autorestart: true,     // Auto-recover from crashes
}
```

## 📊 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Concurrent Users | 50-75 | 150-200 |
| Success Rate | 44-54% | 90-95% |
| p95 Response | 5-8s | <1s |
| CPU Usage | 50% | 90%+ |

## 🆘 Rollback

If issues occur:
```bash
ssh ubuntu@your-server
cd /home/ubuntu/Incollabe-BE
sed -i 's/IMAGE_TAG=pm2-v1/IMAGE_TAG=latest/' .env
./deploy.sh
```

## 📚 Full Documentation

See `PM2_DEPLOYMENT_GUIDE.md` for complete details.

## ✅ Post-Deployment Verification

```bash
# Check PM2 status (should show 2 instances)
docker exec -it incollab-backend pm2 status

# Monitor logs
docker exec -it incollab-backend pm2 logs

# Run load test
artillery run load-test-safe-100-users.yml
```

---

**Bottom Line**: Your infrastructure is already set up correctly. Just build the PM2 image, update IMAGE_TAG in .env, and deploy. No changes to docker-compose.yml or deploy.sh needed!
