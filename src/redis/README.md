# Redis Module

The Redis module provides caching, session management, and rate limiting capabilities for the Cloutsy platform using Redis as the in-memory data store.

## Overview

This module implements a centralized Redis service that handles session storage, OTP verification tracking, rate limiting, and various caching operations to improve application performance and security.

## Features

### 🔄 Session Management
- **User Sessions**: Secure session storage with automatic expiry
- **Device Tracking**: Multi-device login support with device identification
- **Session Cleanup**: Automatic cleanup of expired sessions
- **Cross-Service Access**: Centralized session access across modules

### 🛡️ Rate Limiting & Security
- **OTP Rate Limiting**: Prevents OTP spam and abuse
- **Brute Force Protection**: Failed login attempt tracking
- **Request Throttling**: API rate limiting capabilities
- **Cooldown Management**: Enforces wait periods between requests

### ⚡ Caching
- **Data Caching**: Frequently accessed data storage
- **Query Result Caching**: Database query optimization
- **Configuration Caching**: Application settings storage
- **Temporary Data**: Short-lived data storage

## Architecture

```
redis/
├── redis.service.ts           # Core Redis service
├── redis.module.ts           # Module configuration
└── README.md                 # This documentation
```

## Service Structure

### RedisService Class
```typescript
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;

  // Core operations
  async get(key: string): Promise<string | null>
  async set(key: string, value: string, ttl?: number): Promise<"OK">
  async del(key: string): Promise<number>
  async exists(key: string): Promise<number>

  // Hash operations
  async hget(key: string, field: string): Promise<string | null>
  async hset(key: string, field: string, value: string): Promise<number>
  async hdel(key: string, field: string): Promise<number>

  // Advanced operations
  getClient(): Redis
  async ping(): Promise<string>
}
```

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # Optional
REDIS_DB=0                          # Optional, default: 0

# Redis Options (Optional)
REDIS_MAX_RETRIES_PER_REQUEST=3
REDIS_RETRY_DELAY_ON_CLUSTER_DOWN=100
REDIS_RETRY_DELAY_ON_FAILOVER=50
```

### Module Setup
```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

## Usage Patterns

### Session Management

#### Storing User Sessions
```typescript
// Store session data
const sessionKey = `session:${userId}:${jti}`;
const sessionData = JSON.stringify({
  deviceId: deviceId,
  userAgent: userAgent,
  createdAt: new Date().toISOString(),
  userType: 'influencer' | 'brand'
});

await this.redisService.getClient()
  .multi()
  .set(sessionKey, sessionData, 'EX', SEVEN_DAYS)
  .sadd(`sessions:${userId}`, jti)
  .exec();
```

#### Session Retrieval
```typescript
// Get session data
const sessionData = await this.redisService.get(`session:${userId}:${jti}`);
if (sessionData) {
  const session = JSON.parse(sessionData);
  // Process session...
}
```

### Rate Limiting

#### OTP Request Limiting
```typescript
// Check cooldown
const cooldownKey = `otp:cooldown:${phone}`;
if (await this.redisService.get(cooldownKey)) {
  throw new ForbiddenException("Please wait before requesting another OTP");
}

// Track attempts
const attemptsKey = `otp:requests:${phone}`;
const attempts = parseInt((await this.redisService.get(attemptsKey)) || "0");
if (attempts >= 5) {
  throw new ForbiddenException("Too many OTP requests. Try again later.");
}

// Update counters
await this.redisService.getClient()
  .multi()
  .set(cooldownKey, "1", "EX", 60)      // 60 second cooldown
  .incr(attemptsKey)                     // Increment counter
  .expire(attemptsKey, 15 * 60)          // 15 minute window
  .exec();
```

#### Failed Login Tracking
```typescript
// Track failed attempts
const attemptsKey = `login:attempts:${identifier}`;
const attempts = parseInt((await this.redisService.get(attemptsKey)) ?? '0', 10);

if (attempts >= MAX_FAILED_ATTEMPTS) {
  throw new ForbiddenException('Account temporarily locked');
}

// Increment on failure
await this.redisService.getClient()
  .multi()
  .incr(attemptsKey)
  .expire(attemptsKey, LOCKOUT_DURATION)
  .exec();
```

### Caching Operations

#### Simple Caching
```typescript
// Cache frequently accessed data
const cacheKey = `niches:active`;
const cachedNiches = await this.redisService.get(cacheKey);

if (!cachedNiches) {
  const niches = await this.nicheModel.findAll({ where: { isActive: true } });
  await this.redisService.set(cacheKey, JSON.stringify(niches), 3600); // 1 hour
  return niches;
}

return JSON.parse(cachedNiches);
```

#### Hash-based Caching
```typescript
// Store user preferences
await this.redisService.hset(`user:${userId}:prefs`, 'theme', 'dark');
await this.redisService.hset(`user:${userId}:prefs`, 'language', 'en');

// Retrieve specific preference
const theme = await this.redisService.hget(`user:${userId}:prefs`, 'theme');
```

### OTP Verification

#### OTP Validation Tracking
```typescript
// Mark OTP as verified
const verificationKey = `otp:verified:${phone}`;
await this.redisService.getClient()
  .multi()
  .del(`otp:attempts:${phone}`)           // Clear failed attempts
  .set(verificationKey, '1', 'EX', 900)   // 15 minute verification window
  .exec();

// Check verification status
const isVerified = await this.redisService.get(verificationKey);
if (!isVerified) {
  throw new UnauthorizedException('Phone not verified');
}
```

## Key Naming Conventions

### Structured Key Patterns
```
# Sessions
session:{userId}:{jti}              # Individual session data
sessions:{userId}                   # Set of active session JTIs

# OTP Management
otp:cooldown:{phone}               # OTP request cooldown
otp:requests:{phone}               # OTP request counter
otp:attempts:{phone}               # OTP verification attempts
otp:verified:{phone}               # OTP verification status

# Rate Limiting
login:attempts:{identifier}        # Failed login attempts
api:limit:{userId}:{endpoint}      # API rate limiting

# Caching
cache:{resource}:{identifier}      # General cache pattern
user:{userId}:prefs               # User preferences (hash)
config:{section}                  # Configuration cache
```

## Redis Operations

### Atomic Operations
```typescript
// Multi-command transactions
await this.redisService.getClient()
  .multi()
  .set('key1', 'value1')
  .incr('counter')
  .expire('key1', 3600)
  .exec();
```

### Pub/Sub Operations
```typescript
// Subscribe to events
const subscriber = this.redisService.getClient().duplicate();
subscriber.subscribe('user:notifications');
subscriber.on('message', (channel, message) => {
  // Handle notification
});

// Publish events
await this.redisService.getClient().publish('user:notifications', JSON.stringify({
  userId: 123,
  type: 'message',
  data: { message: 'Hello!' }
}));
```

### Set Operations
```typescript
// Manage user sessions
await this.redisService.getClient().sadd('sessions:123', 'jti-abc-123');
await this.redisService.getClient().sadd('sessions:123', 'jti-def-456');

// Get all sessions
const sessions = await this.redisService.getClient().smembers('sessions:123');

// Remove session
await this.redisService.getClient().srem('sessions:123', 'jti-abc-123');
```

## Performance Optimization

### Connection Management
```typescript
// Optimal connection configuration
new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 50,
  enableOfflineQueue: false,
  lazyConnect: true,
})
```

### Memory Optimization
- Use appropriate TTL values to prevent memory bloat
- Implement key expiration strategies
- Monitor memory usage patterns
- Use compression for large values

### Pipeline Operations
```typescript
// Batch operations for better performance
const pipeline = this.redisService.getClient().pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.incr('counter');
await pipeline.exec();
```

## Monitoring & Debugging

### Health Checks
```typescript
// Health check implementation
async checkHealth(): Promise<boolean> {
  try {
    const result = await this.redisService.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}
```

### Monitoring Metrics
- Connection count and status
- Memory usage and peak usage
- Command execution times
- Error rates and patterns
- Key expiration rates

### Debug Commands
```typescript
// Get all keys (use cautiously in production)
const keys = await this.redisService.getClient().keys('session:*');

// Get key TTL
const ttl = await this.redisService.getClient().ttl('session:123:abc');

// Get memory usage for key
const memory = await this.redisService.getClient().memory('usage', 'session:123:abc');
```

## Error Handling

### Connection Errors
```typescript
this.redis.on('connect', () => {
  console.log('Redis connected successfully');
});

this.redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

this.redis.on('ready', () => {
  console.log('Redis is ready');
});

this.redis.on('end', () => {
  console.log('Redis connection closed');
});
```

### Graceful Degradation
```typescript
async getWithFallback<T>(key: string, fallbackFn: () => Promise<T>): Promise<T> {
  try {
    const cached = await this.redisService.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Redis get failed, using fallback:', error);
  }
  
  return await fallbackFn();
}
```

## Security Considerations

### Data Protection
- Never store sensitive data in Redis without encryption
- Use secure connection (TLS) in production
- Implement proper authentication and authorization
- Regular security updates and patches

### Key Security
```typescript
// Sanitize user input in keys
function sanitizeKey(userInput: string): string {
  return userInput.replace(/[^a-zA-Z0-9:_-]/g, '');
}

const safeKey = `user:${sanitizeKey(userId)}:data`;
```

## Best Practices

### Development Guidelines
1. **Key Naming**: Use consistent, hierarchical key naming
2. **TTL Management**: Always set appropriate expiration times
3. **Error Handling**: Implement graceful degradation
4. **Monitoring**: Track performance and error metrics
5. **Security**: Sanitize inputs and use proper authentication

### Production Considerations
- Monitor memory usage and set appropriate limits
- Implement Redis clustering for high availability
- Use Redis Sentinel for automatic failover
- Regular backup and disaster recovery planning
- Performance tuning based on usage patterns

## Troubleshooting

### Common Issues

**Memory Usage**
```bash
# Check memory usage
redis-cli info memory

# Find keys consuming most memory
redis-cli --bigkeys
```

**Connection Issues**
- Verify Redis server is running
- Check network connectivity
- Validate configuration settings
- Review firewall rules

**Performance Issues**
- Monitor slow queries with `SLOWLOG`
- Check for blocking operations
- Analyze command patterns
- Consider connection pooling

**Key Expiration**
- Verify TTL settings are appropriate
- Monitor key expiration patterns
- Implement proper cache warming strategies