# Redis Setup Guide

Complete guide to set up Redis for caching in your NestJS application.

---

## Why Redis?

✅ **Performance boost:** 10-100x faster than database queries  
✅ **Reduced DB load:** Cache frequently accessed data  
✅ **Session management:** Store user sessions  
✅ **Rate limiting:** API throttling  
✅ **Real-time features:** Pub/Sub for notifications  

**Expected improvements:**
- 40-60% reduction in database queries
- 50-80% faster API response times
- Better scalability

---

## Option 1: Redis on EC2 with Docker (Recommended for Start)

**Pros:**
- ✅ Easy setup (5 minutes)
- ✅ No additional cost
- ✅ Works with existing infrastructure
- ✅ Good for staging and small production

**Cons:**
- ❌ Single point of failure
- ❌ Manual backups
- ❌ Limited to EC2 instance memory

**Cost:** $0 (uses existing EC2)

---

## Option 2: AWS ElastiCache (Recommended for Production)

**Pros:**
- ✅ Fully managed (automatic failover, backups, patches)
- ✅ Multi-AZ for high availability
- ✅ Better performance (optimized hardware)
- ✅ Scalable (add replicas easily)

**Cons:**
- ❌ Additional cost ($15-50/month)
- ❌ Slightly more complex setup

**Cost:** 
- cache.t3.micro: ~$12/month (staging)
- cache.t3.small: ~$25/month (production)

---

# Setup Instructions

---

## Part 1: Redis on EC2 with Docker (Quick Start)

### Step 1: Update docker-compose.yml

SSH to your EC2 instance:
```bash
ssh ubuntu@<EC2_IP>
cd /home/ubuntu/Incollabe-BE
nano docker-compose.yml
```

Add Redis service to your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  incollab-app:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DB_HOST=${DB_HOST}
      - DB_PORT=${DB_PORT}
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    depends_on:
      - redis
    networks:
      - app-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: incollab-redis
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
    driver: local
```

**What this does:**
- Creates Redis container with password protection
- Limits memory to 256MB (adjust based on your EC2)
- Uses LRU eviction (removes least recently used keys)
- Persists data to volume
- Auto-restarts if crashes

---

### Step 2: Update .env File

Add Redis configuration:

```bash
nano .env
```

Add these variables:

```bash
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-redis-password-here
REDIS_TTL=3600
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

# Cache TTL (in seconds)
CACHE_USER_TTL=1800        # 30 minutes
CACHE_CAMPAIGN_TTL=600     # 10 minutes
CACHE_SEARCH_TTL=300       # 5 minutes
CACHE_ANALYTICS_TTL=3600   # 1 hour
```

**Generate strong Redis password:**
```bash
openssl rand -base64 32
```

**Save and exit:** `Ctrl+X`, `Y`, `Enter`

---

### Step 3: Install Redis Package in Your App

```bash
npm install ioredis @nestjs/cache-manager cache-manager cache-manager-ioredis-yet
```

---

### Step 4: Create Redis Module

Create `src/redis/redis.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          ttl: configService.get('REDIS_TTL', 3600) * 1000,
          maxRetriesPerRequest: configService.get('REDIS_MAX_RETRIES', 3),
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        }),
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
```

---

### Step 5: Update app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
// ... other imports

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule, // Add this
    AuthModule,
    BrandModule,
    InfluencerModule,
    CampaignModule,
    // ... other modules
  ],
  // ...
})
export class AppModule {}
```

---

### Step 6: Use Redis in Your Services

**Example: Cache user profiles**

`src/influencer/influencer.service.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class InfluencerService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // ... other dependencies
  ) {}

  async findOne(id: number) {
    // Try to get from cache first
    const cacheKey = `influencer:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      console.log('Cache hit for influencer:', id);
      return cached;
    }

    // If not in cache, get from database
    console.log('Cache miss for influencer:', id);
    const influencer = await this.influencerRepository.findOne({
      where: { id },
      include: ['user', 'socialMedia'],
    });

    // Store in cache for 30 minutes
    await this.cacheManager.set(cacheKey, influencer, 1800 * 1000);

    return influencer;
  }

  async update(id: number, updateData: any) {
    const updated = await this.influencerRepository.update(updateData, {
      where: { id },
    });

    // Invalidate cache when data changes
    const cacheKey = `influencer:${id}`;
    await this.cacheManager.del(cacheKey);

    return updated;
  }
}
```

**Example: Cache search results**

```typescript
async searchInfluencers(searchDto: SearchDto) {
  const cacheKey = `search:influencers:${JSON.stringify(searchDto)}`;
  const cached = await this.cacheManager.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const results = await this.influencerRepository.findAll({
    where: { /* search criteria */ },
  });

  // Cache for 5 minutes
  await this.cacheManager.set(cacheKey, results, 300 * 1000);
  
  return results;
}
```

---

### Step 7: Start Redis

```bash
# SSH to EC2
ssh ubuntu@<EC2_IP>
cd /home/ubuntu/Incollabe-BE

# Start with docker-compose
docker-compose up -d redis

# Check Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it incollab-redis redis-cli -a your-redis-password ping
# Should output: PONG
```

---

### Step 8: Restart Your Application

```bash
# Rebuild and restart app with Redis
docker-compose up -d --build

# Check logs
docker-compose logs -f incollab-app

# You should see:
# "Connected to Redis successfully"
```

---

### Step 9: Test Redis Caching

**Test 1: Check Redis is working**
```bash
# Connect to Redis
docker exec -it incollab-redis redis-cli -a your-redis-password

# Test commands
127.0.0.1:6379> SET test "Hello Redis"
OK
127.0.0.1:6379> GET test
"Hello Redis"
127.0.0.1:6379> DEL test
(integer) 1
127.0.0.1:6379> EXIT
```

**Test 2: Check cache is working in your app**
```bash
# First request (cache miss - slow)
curl http://localhost:3002/api/influencers/1
# Check logs: Should see "Cache miss"

# Second request (cache hit - fast)
curl http://localhost:3002/api/influencers/1
# Check logs: Should see "Cache hit"
```

---

## Part 2: AWS ElastiCache Setup (Production)

### Why ElastiCache?

- ✅ Automatic failover (Multi-AZ)
- ✅ Automatic backups
- ✅ Automatic patches
- ✅ Better performance
- ✅ Monitoring included

**Cost:** ~$25/month for cache.t3.small

---

### Step 1: Create ElastiCache Redis Cluster

1. **Go to AWS Console** → Search "ElastiCache"
2. Click **"Redis clusters"** → **"Create Redis cluster"**

---

### Step 2: Configure Cluster

**Choose cluster creation method:**
- ☑️ **Easy Create** (faster) OR **Standard Create** (more control)

**For Standard Create:**

**Cluster mode:**
- ☑️ **Disabled** (simpler, sufficient for most cases)

**Cluster info:**
- **Name:** `incollab-production-redis`
- **Description:** Production Redis cache for Incollabe

**Location:**
- ☑️ **AWS Cloud**

**Multi-AZ:**
- ☑️ **Enable** (recommended for production)

**Engine version:**
- Select: **Redis 7.x** (latest)

**Port:**
- `6379` (default)

**Parameter group:**
- **default.redis7**

**Node type:**
- **cache.t3.micro** (staging - $12/month)
- **cache.t3.small** (production - $25/month)

**Number of replicas:**
- **1** (for Multi-AZ failover)

---

### Step 3: Advanced Settings

**Subnet group:**
- ☑️ **Create new**
- **Name:** `incollab-redis-subnet-group`
- **VPC:** Select same VPC as your EC2 and RDS

**Availability zones:**
- ☑️ **No preference** (let AWS choose)

**Security:**

**Security groups:**
- ☑️ **Create new**
- **Name:** `incollab-redis-sg`

**Encryption:**
- ☑️ **Enable encryption at rest** (recommended)
- ☑️ **Enable encryption in transit** (recommended)

**Backup:**
- ☑️ **Enable automatic backups**
- **Retention:** 7 days (staging) / 14 days (production)

**Maintenance window:**
- ☑️ **No preference**

---

### Step 4: Review and Create

- **Estimated monthly cost:** $25-30 for cache.t3.small Multi-AZ
- Click **"Create"**
- Wait 10-15 minutes for creation

---

### Step 5: Configure Security Group

After cluster is created:

1. Go to **EC2** → **Security Groups**
2. Find `incollab-redis-sg`
3. Click **"Edit inbound rules"**
4. **Add rule:**
   - **Type:** Custom TCP
   - **Port:** 6379
   - **Source:** Select your EC2 security group (or EC2 private IP)
   - **Description:** Allow EC2 to access Redis

5. Click **"Save rules"**

---

### Step 6: Get Redis Endpoint

1. Go to **ElastiCache** → **Redis clusters**
2. Click on `incollab-production-redis`
3. Find **Primary endpoint:** 
   ```
   incollab-production-redis.xxxxx.0001.use1.cache.amazonaws.com:6379
   ```
4. **Copy this endpoint**

---

### Step 7: Update .env on EC2

```bash
ssh ubuntu@<EC2_IP>
cd /home/ubuntu/Incollabe-BE
nano .env
```

Update Redis configuration:

```bash
# Redis Configuration - ElastiCache
REDIS_HOST=incollab-production-redis.xxxxx.0001.use1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty if not using AUTH
REDIS_TTL=3600
REDIS_TLS=true   # If you enabled encryption in transit
```

---

### Step 8: Update docker-compose.yml

Remove the Redis service (since using ElastiCache):

```yaml
version: '3.8'

services:
  incollab-app:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - REDIS_TLS=${REDIS_TLS}
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

---

### Step 9: Test ElastiCache Connection

```bash
# Install redis-cli on EC2
sudo apt install redis-tools -y

# Test connection
redis-cli -h incollab-production-redis.xxxxx.0001.use1.cache.amazonaws.com -p 6379 ping

# Should output: PONG
```

---

### Step 10: Restart Application

```bash
docker-compose up -d --build
docker-compose logs -f
```

---

## Part 3: Redis Best Practices

### 1. Cache Invalidation Strategy

**Time-based expiration (TTL):**
```typescript
// Short TTL for frequently changing data
await this.cacheManager.set('campaigns:active', data, 300 * 1000); // 5 min

// Long TTL for rarely changing data
await this.cacheManager.set('user:profile', data, 3600 * 1000); // 1 hour
```

**Event-based invalidation:**
```typescript
async updateCampaign(id: number, data: any) {
  await this.campaignRepository.update(data, { where: { id } });
  
  // Invalidate related caches
  await this.cacheManager.del(`campaign:${id}`);
  await this.cacheManager.del('campaigns:active');
  await this.cacheManager.del('campaigns:featured');
}
```

---

### 2. Cache Key Naming Convention

Use consistent, descriptive keys:

```typescript
// Good
const cacheKey = `user:${userId}:profile`;
const cacheKey = `campaign:${campaignId}:details`;
const cacheKey = `search:influencers:${category}:${page}`;

// Bad
const cacheKey = `u${userId}`;
const cacheKey = `data`;
```

---

### 3. What to Cache

**✅ Cache these:**
- User profiles (30 min TTL)
- Campaign listings (5-10 min TTL)
- Search results (5 min TTL)
- Analytics data (1 hour TTL)
- Static content (1 day TTL)
- API rate limits (1 min TTL)

**❌ Don't cache these:**
- Real-time data (live notifications)
- Sensitive data (passwords, payment info)
- Frequently changing data (likes, views counters)
- Data that changes per user (unless user-specific keys)

---

### 4. Cache Size Management

**Set memory limits:**
```bash
# In docker-compose.yml or ElastiCache parameter group
maxmemory 256mb
maxmemory-policy allkeys-lru  # Remove least recently used keys
```

**Monitor cache usage:**
```bash
# Check Redis memory usage
docker exec incollab-redis redis-cli -a password INFO memory

# Or for ElastiCache: Check CloudWatch metrics
```

---

### 5. Handle Cache Failures Gracefully

```typescript
async findOne(id: number) {
  try {
    // Try cache first
    const cacheKey = `influencer:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    console.error('Redis error:', error);
    // Continue to database if cache fails
  }

  // Always fall back to database
  const influencer = await this.influencerRepository.findOne({
    where: { id },
  });

  try {
    // Try to cache result
    await this.cacheManager.set(`influencer:${id}`, influencer, 1800 * 1000);
  } catch (error) {
    console.error('Failed to cache:', error);
    // Don't fail the request if caching fails
  }

  return influencer;
}
```

---

## Part 4: Monitoring Redis

### Monitor These Metrics:

**1. Memory Usage**
```bash
# Docker Redis
docker exec incollab-redis redis-cli -a password INFO memory | grep used_memory_human

# Should be < 80% of maxmemory
```

**2. Hit Rate**
```bash
# Check cache effectiveness
docker exec incollab-redis redis-cli -a password INFO stats | grep keyspace

# Good hit rate: > 80%
```

**3. Connected Clients**
```bash
docker exec incollab-redis redis-cli -a password INFO clients

# Monitor: connected_clients
```

**4. For ElastiCache:** Use CloudWatch

Go to **CloudWatch** → **Metrics** → **ElastiCache**

Monitor:
- **CPUUtilization** (should be < 80%)
- **DatabaseMemoryUsagePercentage** (should be < 80%)
- **CacheHits / CacheMisses** (ratio should be high)
- **NetworkBytesIn / NetworkBytesOut**

---

### Set Up CloudWatch Alarms (ElastiCache)

1. **High Memory Usage**
   - Metric: `DatabaseMemoryUsagePercentage`
   - Threshold: > 80%
   - Action: SNS notification

2. **Low Cache Hit Rate**
   - Metric: `CacheHitRate`
   - Threshold: < 80%
   - Action: Review caching strategy

---

## Part 5: Troubleshooting

### Issue 1: Cannot connect to Redis

**Symptoms:**
```
Error: connect ETIMEDOUT
Error: Redis connection to redis:6379 failed
```

**Solutions:**

**For Docker Redis:**
```bash
# Check Redis container is running
docker ps | grep redis

# Check logs
docker logs incollab-redis

# Test connection
docker exec incollab-redis redis-cli -a password ping
```

**For ElastiCache:**
```bash
# Check security group allows port 6379 from EC2
# Check VPC/subnet configuration
# Test from EC2:
redis-cli -h <ELASTICACHE_ENDPOINT> -p 6379 ping
```

---

### Issue 2: Authentication failed

**Symptoms:**
```
Error: NOAUTH Authentication required
Error: ERR invalid password
```

**Solutions:**
```bash
# For Docker: Check REDIS_PASSWORD in .env matches docker-compose.yml
# For ElastiCache: Check if AUTH is enabled (usually not by default)

# Test with password
redis-cli -h redis -p 6379 -a your-password ping
```

---

### Issue 3: Out of memory

**Symptoms:**
```
Error: OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**
```bash
# Increase maxmemory in docker-compose.yml
command: redis-server --maxmemory 512mb

# Or upgrade ElastiCache instance
# cache.t3.micro → cache.t3.small

# Clear cache manually
docker exec incollab-redis redis-cli -a password FLUSHALL
```

---

### Issue 4: Slow performance

**Solutions:**
1. **Check hit rate:**
   ```bash
   docker exec incollab-redis redis-cli -a password INFO stats
   ```

2. **Add indexes for sorted sets/lists**

3. **Reduce TTL for less important data**

4. **Use Redis pipelining for multiple operations**

5. **Upgrade instance size**

---

## Cost Summary

### Option 1: Docker Redis on EC2
```
Cost: $0 (uses existing EC2)
Memory: 256MB-512MB (part of EC2 RAM)
Performance: Good for small-medium traffic
High Availability: No (single instance)
```

### Option 2: ElastiCache cache.t3.micro
```
Cost: ~$12/month
Memory: 512 MB
Performance: Good
High Availability: No (single node)
Use case: Staging
```

### Option 3: ElastiCache cache.t3.small Multi-AZ
```
Cost: ~$50/month
Memory: 1.5 GB
Performance: Excellent
High Availability: Yes (automatic failover)
Use case: Production
```

---

## Recommended Setup

### For Staging:
✅ **Docker Redis on EC2** ($0)
- Simple setup
- No additional cost
- Sufficient for testing

### For Production:
✅ **ElastiCache cache.t3.small Multi-AZ** ($50/month)
- High availability
- Automatic backups
- Better performance
- Peace of mind

---

## Quick Reference

### Docker Redis Commands
```bash
# Start Redis
docker-compose up -d redis

# Stop Redis
docker-compose stop redis

# View logs
docker logs -f incollab-redis

# Connect to Redis CLI
docker exec -it incollab-redis redis-cli -a password

# Check memory usage
docker exec incollab-redis redis-cli -a password INFO memory

# Clear all cache
docker exec incollab-redis redis-cli -a password FLUSHALL

# Check specific key
docker exec incollab-redis redis-cli -a password GET "user:123"
```

### Useful Redis Commands
```bash
# Inside redis-cli:
PING                    # Test connection
INFO                    # Get server info
DBSIZE                  # Number of keys
KEYS *                  # List all keys (don't use in production!)
GET key                 # Get value
SET key value           # Set value
DEL key                 # Delete key
TTL key                 # Check time to live
FLUSHALL                # Clear all data
```

---

## Next Steps

After setting up Redis:

1. ✅ **Monitor cache hit rate** (aim for > 80%)
2. ✅ **Add caching to most-used endpoints**
3. ✅ **Set up CloudWatch alarms** (for ElastiCache)
4. ✅ **Test failover** (for Multi-AZ setup)
5. ✅ **Document cached endpoints** for team

---

## Performance Improvements Expected

With Redis caching:

| Metric | Before Redis | After Redis | Improvement |
|--------|--------------|-------------|-------------|
| API response time | 200-500ms | 50-100ms | **60-70% faster** |
| Database queries | 1000/min | 400/min | **60% reduction** |
| Concurrent users | 150 | 250+ | **60% increase** |
| DB CPU usage | 60% | 30% | **50% reduction** |

---

**Setup Time:** 20-30 minutes (Docker) or 45-60 minutes (ElastiCache)  
**Cost:** $0 (Docker) or $12-50/month (ElastiCache)  
**Difficulty:** Easy (Docker) or Medium (ElastiCache)

Good luck with your Redis setup! 🚀
