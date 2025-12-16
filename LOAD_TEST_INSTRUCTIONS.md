# Load Testing Instructions for api.collabkaroo.co.in

## Quick Start

### Method 1: Using the Test Runner Script (Easiest)

```bash
# Make script executable
chmod +x run-load-test.sh

# Run the script
./run-load-test.sh

# Choose option 1 for quick 200 users test
```

---

## Method 2: Direct Artillery Commands

### Install Artillery
```bash
npm install -g artillery
```

### Run Tests

**1. Quick 200 Users Test (5 minutes)**
```bash
artillery run load-test-200-users.yml
```

**2. Gradual Load Test with Warm-up**
```bash
artillery run load-test-dev.yml
```

**3. Generate HTML Report**
```bash
# Run test and save output
artillery run --output results.json load-test-200-users.yml

# Generate HTML report from results
artillery report results.json

# Opens results.json.html in your browser
```

**4. Quick Test (No config file needed)**
```bash
# 200 users, 1000 requests total
artillery quick --count 200 --num 1000 https://api.collabkaroo.co.in/api/campaign
```

---

## Method 3: Apache Bench (Simple & Fast)

### Install (if not already installed)
```bash
# macOS (usually pre-installed)
which ab

# Linux
sudo apt-get install apache2-utils
```

### Run Tests

**1. Health Endpoint - 200 concurrent users**
```bash
ab -n 10000 -c 200 -t 60 https://api.collabkaroo.co.in/health
# -n 10000: Total 10,000 requests
# -c 200: 200 concurrent users
# -t 60: Timeout after 60 seconds
```

**2. Campaigns Endpoint**
```bash
ab -n 5000 -c 200 https://api.collabkaroo.co.in/api/campaign
```

**3. Save Results to File**
```bash
ab -n 10000 -c 200 -g results.tsv https://api.collabkaroo.co.in/health > ab-report.txt
```

---

## What Each Test Does

### load-test-200-users.yml
- **Duration**: 5-6 minutes total
- **Peak Load**: 200 requests per second
- **Tests**: Health, campaigns, brand profiles, city search
- **Best For**: Quick validation of system under heavy load

### load-test-dev.yml
- **Duration**: 8-9 minutes total
- **Peak Load**: 200 requests per second (sustained)
- **Phases**: Warm-up → Ramp-up → Full load → Sustained → Cool down
- **Best For**: Comprehensive load testing with gradual increase

---

## Monitoring During Test

### Option 1: Auto Monitor (in separate terminal)
```bash
./run-load-test.sh
# Choose option 4: Monitor server during test
```

### Option 2: Manual Monitoring

**Watch response times:**
```bash
watch -n 5 'curl -o /dev/null -s -w "Health: %{time_total}s\n" https://api.collabkaroo.co.in/health && curl -o /dev/null -s -w "Campaign: %{time_total}s\n" https://api.collabkaroo.co.in/api/campaign'
```

**Monitor from server (if you have SSH access):**
```bash
# SSH to server
ssh ubuntu@<SERVER_IP>

# Watch Docker stats
docker stats

# Watch logs
docker-compose logs -f incollab-backend --tail=50
```

---

## Understanding Results

### Artillery Output
```
Summary report @ 14:30:45(+0000)
  Scenarios launched:  12000
  Scenarios completed: 11998
  Requests completed:  59990
  Mean response/sec:   199.97
  Response time (msec):
    min:    45
    max:    3210
    median: 187
    p95:    456      ← 95% of requests under 456ms (GOOD!)
    p99:    1234     ← 99% of requests under 1234ms
  Codes:
    200: 59800        ← Successful requests
    500: 190          ← Server errors (check if acceptable)
```

### Key Metrics to Check

✅ **Good Performance:**
- p95 < 2000ms (95% of requests under 2 seconds)
- Error rate < 2%
- No timeouts
- Consistent response times

❌ **Poor Performance:**
- p95 > 5000ms
- Error rate > 5%
- Many timeouts (code: ETIMEDOUT)
- Response times increasing over time (memory leak?)

---

## Test Scenarios Breakdown

### Scenario Distribution in load-test-200-users.yml:
1. **Health check** (20%) - Simple endpoint to verify server is up
2. **Browse campaigns** (30%) - Most common user action
3. **View campaign details** (25%) - Second most common
4. **Search & filter** (15%) - Moderate usage
5. **OTP requests** (10%) - Less frequent but important

---

## Troubleshooting

### Issue: "artillery: command not found"
```bash
# Install Artillery globally
npm install -g artillery

# Or use npx
npx artillery run load-test-200-users.yml
```

### Issue: "Error: ECONNREFUSED"
```bash
# Check if server is running
curl https://api.collabkaroo.co.in/health

# If down, check server status
```

### Issue: "Too many open files"
```bash
# Increase file descriptor limit (macOS/Linux)
ulimit -n 10000

# Then re-run test
```

### Issue: High error rate (>5%)
```bash
# Possible causes:
1. Rate limiting (429 errors) - expected for OTP endpoints
2. Server overload (500 errors) - check server resources
3. Database connection pool exhausted - check DB settings
4. Memory issues - check for memory leaks

# Check server logs for details
```

---

## Recommended Testing Flow

### Step 1: Baseline Test (No Load)
```bash
# Test single request to establish baseline
curl -w "\nTime: %{time_total}s\n" https://api.collabkaroo.co.in/api/campaign
```

### Step 2: Light Load (50 users)
```bash
artillery quick --count 50 --num 500 https://api.collabkaroo.co.in/api/campaign
```

### Step 3: Medium Load (100 users)
```bash
artillery quick --count 100 --num 1000 https://api.collabkaroo.co.in/api/campaign
```

### Step 4: Full Load (200 users)
```bash
artillery run load-test-200-users.yml
```

### Step 5: Analyze Results
- Check p95 and p99 response times
- Verify error rate is acceptable
- Check server CPU and memory usage
- Review application logs for errors

---

## Advanced: Stress Testing (Beyond 200 Users)

If you want to test breaking point:

```yaml
# Create load-test-stress.yml
config:
  target: "https://api.collabkaroo.co.in"
  phases:
    - duration: 60
      arrivalRate: 300    # 300 users/sec
      name: "Stress test"
    - duration: 60
      arrivalRate: 500    # 500 users/sec
      name: "Breaking point"
```

**WARNING:** Only run stress tests when:
- Users are notified
- During off-peak hours
- You have access to scale resources if needed

---

## Quick Commands Reference

```bash
# Install Artillery
npm install -g artillery

# Quick 200 users test
artillery run load-test-200-users.yml

# With HTML report
artillery run --output report.json load-test-200-users.yml
artillery report report.json

# Apache Bench quick test
ab -n 10000 -c 200 https://api.collabkaroo.co.in/health

# Monitor response times
watch -n 2 'curl -o /dev/null -s -w "%{time_total}s\n" https://api.collabkaroo.co.in/health'
```

---

## Expected Results for Healthy System

For a well-performing API with 200 concurrent users:

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| p50 response time | <200ms | <500ms | >500ms |
| p95 response time | <1000ms | <2000ms | >2000ms |
| p99 response time | <2000ms | <5000ms | >5000ms |
| Error rate | <1% | <2% | >5% |
| Requests/sec | >150 | >100 | <100 |

---

## Next Steps After Testing

1. **If results are good:**
   - Document baseline performance
   - Set up monitoring alerts
   - Schedule regular load tests

2. **If results need improvement:**
   - Check database query performance
   - Review N+1 query issues
   - Consider caching strategies
   - Scale server resources
   - Optimize slow endpoints

3. **Production readiness:**
   - Run load tests on staging first
   - Test during peak hours simulation
   - Have rollback plan ready
   - Monitor closely after deployment

---

## Support

If you encounter issues:
1. Check server logs: `docker-compose logs -f incollab-backend`
2. Check database connections
3. Monitor server resources (CPU, memory, disk)
4. Review error logs for specific issues

---

**Target Environment**: api.collabkaroo.co.in (Dev)
**Last Updated**: 2025-01-11
