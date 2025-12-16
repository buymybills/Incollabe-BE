# RDS PostgreSQL Setup Guide

Complete step-by-step guide to set up RDS instances for Staging and Production environments.

---

## Prerequisites

Before starting, ensure you have:
- ✅ AWS Account with admin access
- ✅ EC2 instances running (staging and production)
- ✅ VPC and Subnets configured
- ✅ Basic understanding of AWS console

---

## Part 1: Create Staging RDS Instance

### Step 1: Navigate to RDS Console

1. Log in to **AWS Console**
2. Search for **RDS** in the search bar
3. Click **Databases** in the left sidebar
4. Click **Create database** button

---

### Step 2: Choose Database Creation Method

**Select:**
- ☑️ **Standard Create** (not Easy Create)

**Why?** Standard Create gives you full control over all settings.

---

### Step 3: Engine Options

**Engine type:**
- ☑️ **PostgreSQL**

**Engine Version:**
- Select: **PostgreSQL 15.x** (latest stable version)
- Example: `PostgreSQL 15.4-R2`

**Why PostgreSQL 15?** 
- Better performance than 14
- Improved query optimization
- Your NestJS app uses Sequelize which works great with PostgreSQL 15

---

### Step 4: Templates

**Select:**
- ☑️ **Dev/Test** (for staging)

**Why Dev/Test?**
- Optimized for development/staging
- Lower cost
- Still has essential features

---

### Step 5: Settings

**DB instance identifier:**
```
incollab-staging-db
```

**Credentials Settings:**

**Master username:**
```
incollab_admin
```

**Master password:**
- ☑️ Auto generate a password (recommended)
- OR manually set a strong password (min 8 characters)

**Example strong password:**
```
Staging@2025!SecureDB#456
```

⚠️ **IMPORTANT:** Save this password immediately - you'll need it!

---

### Step 6: Instance Configuration

**DB instance class:**
- **Instance class:** Burstable classes (includes t classes)
- **Select:** `db.t3.small`
  - 2 vCPUs
  - 2 GB RAM
  - Good for staging with moderate traffic

**Cost:** ~$30-40/month

**Alternative for very light staging:**
- `db.t3.micro` (1 vCPU, 1 GB RAM) - ~$15/month
- Use this only if staging has very light traffic

---

### Step 7: Storage

**Storage type:**
- ☑️ **General Purpose SSD (gp3)**

**Allocated storage:**
```
20 GB
```

**Storage autoscaling:**
- ☑️ Enable storage autoscaling
- **Maximum storage threshold:** `50 GB`

**Why gp3?**
- Better performance than gp2
- More cost-effective
- Baseline performance of 3,000 IOPS

---

### Step 8: Availability & Durability

**Multi-AZ deployment:**
- ☐ **Do not create a standby instance** (for staging)

**Why no Multi-AZ for staging?**
- Saves ~50% cost
- Staging can tolerate brief downtime
- Can enable later if needed

---

### Step 9: Connectivity

**Compute resource:**
- ☑️ **Don't connect to an EC2 compute resource**

**Network type:**
- ☑️ **IPv4**

**Virtual private cloud (VPC):**
- Select: **Same VPC as your staging EC2 instance**
- Example: `vpc-xxxxxxxx (default VPC)` or your custom VPC

**DB subnet group:**
- ☑️ **Automatic setup** (will create if needed)
- OR select existing subnet group

**Public access:**
- ☑️ **No** (IMPORTANT for security)

**Why No public access?**
- Only EC2 instances in same VPC can connect
- More secure
- Prevents external attacks

**VPC security group:**
- ☑️ **Create new**
- **Name:** `incollab-staging-db-sg`

OR if you already have a security group:
- ☑️ **Choose existing**
- Select security group that allows PostgreSQL (port 5432)

**Availability Zone:**
- ☑️ **No preference** (let AWS choose)

**RDS Proxy:**
- ☐ **Do not create an RDS Proxy** (not needed for staging)

---

### Step 10: Database Authentication

**Database authentication options:**
- ☑️ **Password authentication** (default)

**Why password authentication?**
- Simplest to set up
- Works with Sequelize out of the box
- Can add IAM authentication later if needed

---

### Step 11: Monitoring

**Turn on Performance Insights:**
- ☐ **Disable** (for staging to save cost)

**Why disable for staging?**
- Saves ~$3-5/month
- Not critical for staging environment

**Enhanced monitoring:**
- ☐ **Disable** (for staging)

---

### Step 12: Additional Configuration

**Database options:**

**Initial database name:**
```
incollab_staging
```

⚠️ **IMPORTANT:** Set this now! If you skip it, you'll need to create database manually later.

**DB parameter group:**
- ☑️ **default.postgres15** (automatic)

**Option group:**
- ☑️ **default:postgres-15** (automatic)

**Backup:**

**Backup retention period:**
```
7 days
```

**Backup window:**
- ☑️ **No preference** (let AWS choose off-peak time)

**Copy tags to snapshots:**
- ☑️ **Enable** (recommended)

**Encryption:**

**Enable encryption:**
- ☑️ **Yes** (ALWAYS enable)

**AWS KMS key:**
- ☑️ **Use default KMS key** (aws/rds)

**Why enable encryption?**
- Protects data at rest
- Compliance requirement
- No performance impact
- Free with default KMS key

**Log exports:**
- ☐ PostgreSQL log (optional for staging)
- ☐ Upgrade log (optional)

**Why skip logs for staging?**
- Saves storage cost
- Can enable later if needed for debugging

**Maintenance:**

**Auto minor version upgrade:**
- ☑️ **Enable** (recommended)

**Maintenance window:**
- ☑️ **No preference** (AWS picks low-traffic time)

**Deletion protection:**
- ☐ **Disable** (for staging)

**Why disable deletion protection for staging?**
- Makes it easier to delete/recreate staging DB
- Can enable if you want extra safety

---

### Step 13: Review & Create

1. Click **Estimated monthly costs** to see pricing
   - Should be around **$30-40/month** for db.t3.small

2. Review all settings

3. Click **Create database**

4. Wait 5-10 minutes for database to be created

---

### Step 14: Save Database Credentials

Once created, you'll see:

**Endpoint:**
```
incollab-staging-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
```

**Port:**
```
5432
```

**Master username:**
```
incollab_admin
```

**Master password:**
```
[Your saved password]
```

⚠️ **Save these in a secure location** (password manager, AWS Secrets Manager, or secure note)

---

## Part 2: Create Production RDS Instance

Follow the same steps as staging, but with these **key differences:**

### Production-Specific Settings

**Step 4: Templates**
- ☑️ **Production** (not Dev/Test)

**Step 5: DB instance identifier**
```
incollab-production-db
```

**Step 5: Credentials**
```
Master username: incollab_admin
Master password: [Strong production password - DIFFERENT from staging]
```

**Step 6: Instance Configuration**
- **Select:** `db.t3.medium` or `db.m5.large`
  - `db.t3.medium`: 2 vCPUs, 4 GB RAM (~$60/month)
  - `db.m5.large`: 2 vCPUs, 8 GB RAM (~$150/month)

**Recommendation:** Start with `db.t3.medium`, upgrade to `db.m5.large` if needed.

**Step 7: Storage**
```
Allocated storage: 100 GB
Maximum storage threshold: 500 GB
```

**Step 8: Availability & Durability**
- ☑️ **Create a standby instance (recommended for production)**

⚠️ **IMPORTANT for production:** This doubles the cost but provides:
- Automatic failover (< 1 minute)
- Zero downtime for maintenance
- Higher availability (99.95% SLA)

**Cost with Multi-AZ:** ~$120-150/month for db.t3.medium

**Step 9: VPC**
- Select: **Same VPC as production EC2**
- **Security group:** `incollab-production-db-sg`

**Step 11: Monitoring**
- ☑️ **Enable Performance Insights** (1 day retention is free)
- ☑️ **Enable Enhanced monitoring** (60 seconds granularity)

**Step 12: Additional Configuration**

**Initial database name:**
```
incollab_prod
```

**Backup retention:**
```
30 days
```

**Log exports:**
- ☑️ **PostgreSQL log** (enable for production)

**Deletion protection:**
- ☑️ **Enable** (IMPORTANT for production)

---

## Part 3: Configure Security Groups

After both databases are created, configure security groups to allow EC2 access.

### Step 1: Find RDS Security Group

1. Go to **EC2 Console** → **Security Groups**
2. Find `incollab-staging-db-sg` and `incollab-production-db-sg`

### Step 2: Edit Inbound Rules

**For Staging RDS Security Group:**

1. Select `incollab-staging-db-sg`
2. Click **Inbound rules** tab
3. Click **Edit inbound rules**
4. Click **Add rule**

**Configure rule:**
```
Type: PostgreSQL
Protocol: TCP
Port range: 5432
Source: Custom
Source value: [Staging EC2 Security Group ID] or [Staging EC2 Private IP]
Description: Allow staging EC2 to access RDS
```

**To find EC2 Security Group ID:**
- Go to EC2 → Instances → Select staging EC2
- Look at **Security** tab
- Copy **Security groups** ID (sg-xxxxxxxx)

5. Click **Save rules**

**For Production RDS Security Group:**

Repeat same steps but:
- Use `incollab-production-db-sg`
- Source: Production EC2 Security Group ID

---

## Part 4: Test Database Connection

### From Your Local Machine (via EC2 as jump host)

**Step 1: SSH to EC2**
```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
```

**Step 2: Install PostgreSQL client**
```bash
sudo apt update
sudo apt install postgresql-client -y
```

**Step 3: Test connection**

**For Staging:**
```bash
psql -h incollab-staging-db.xxxxxxxxx.us-east-1.rds.amazonaws.com \
     -U incollab_admin \
     -d incollab_staging \
     -p 5432
```

Enter password when prompted.

**For Production:**
```bash
psql -h incollab-production-db.xxxxxxxxx.us-east-1.rds.amazonaws.com \
     -U incollab_admin \
     -d incollab_prod \
     -p 5432
```

**Successful connection output:**
```
psql (15.4)
SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384, bits: 256, compression: off)
Type "help" for help.

incollab_staging=>
```

**Test query:**
```sql
SELECT version();
```

**Exit:**
```
\q
```

---

## Part 5: Update Application Configuration

### Step 1: Update Staging EC2 .env

SSH to staging EC2:
```bash
ssh ubuntu@<STAGING_EC2_IP>
cd /home/ubuntu/Incollabe-BE
nano .env
```

Update these variables:
```bash
# Database - Staging RDS
DB_HOST=incollab-staging-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=incollab_staging
DB_USER=incollab_admin
DB_PASSWORD=your-staging-password
DB_DIALECT=postgres
DB_SSL=true
DB_LOGGING=false

# Optional: Connection pool settings
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

### Step 2: Update Production EC2 .env

SSH to production EC2:
```bash
ssh ubuntu@<PRODUCTION_EC2_IP>
cd /home/ubuntu/Incollabe-BE
nano .env
```

Update:
```bash
# Database - Production RDS
DB_HOST=incollab-production-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=incollab_prod
DB_USER=incollab_admin
DB_PASSWORD=your-production-password
DB_DIALECT=postgres
DB_SSL=true
DB_LOGGING=false

# Production pool settings
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
```

---

## Part 6: Run Database Migrations

### On Staging

```bash
# SSH to staging EC2
ssh ubuntu@<STAGING_EC2_IP>
cd /home/ubuntu/Incollabe-BE

# If using Docker
docker-compose exec incollab-app npm run migration:run

# Or if running directly
npm run migration:run
```

### On Production

```bash
# SSH to production EC2
ssh ubuntu@<PRODUCTION_EC2_IP>
cd /home/ubuntu/Incollabe-BE

# Run migrations
docker-compose exec incollab-app npm run migration:run
```

### Verify migrations ran successfully:

```bash
# Connect to database
psql -h <RDS_ENDPOINT> -U incollab_admin -d <DATABASE_NAME>

# List tables
\dt

# You should see tables like:
# - users
# - brands
# - influencers
# - campaigns
# - posts
# - audit_logs
# etc.

# Exit
\q
```

---

## Part 7: Verify Application Connection

### Test staging:

```bash
# Check application logs
docker-compose logs -f incollab-app | grep -i database

# You should see:
# "Database connected successfully"
# "Sequelize connection established"
```

### Test API endpoint:

```bash
# Test health endpoint
curl http://localhost:3002/api

# Test login (to verify DB read/write)
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'
```

If successful, your RDS is working!

---

## Part 8: Update GitHub Secrets (Optional)

If you want to store DB credentials in GitHub for automated deployments:

**Go to:** GitHub Repo → Settings → Secrets and variables → Actions

**Add these secrets:**

**For Staging:**
```
STAGING_DB_HOST=incollab-staging-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
STAGING_DB_USER=incollab_admin
STAGING_DB_PASSWORD=your-staging-password
STAGING_DB_NAME=incollab_staging
```

**For Production:**
```
PROD_DB_HOST=incollab-production-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
PROD_DB_USER=incollab_admin
PROD_DB_PASSWORD=your-production-password
PROD_DB_NAME=incollab_prod
```

---

## Part 9: Set Up Automated Backups (Optional but Recommended)

### Enable Point-in-Time Recovery

1. Go to **RDS Console** → **Databases**
2. Select your production database
3. Click **Modify**
4. Scroll to **Backup**
5. Ensure:
   - ☑️ **Enable automatic backups**
   - **Backup retention:** 30 days
   - ☑️ **Copy tags to snapshots**
6. Click **Continue** → **Apply immediately**

### Create Manual Snapshot (Before major changes)

```bash
# Before deploying major updates
1. Go to RDS Console → Databases
2. Select database
3. Click "Actions" → "Take snapshot"
4. Name: "incollab-prod-before-update-2025-11-06"
5. Wait for snapshot to complete
6. Then deploy changes
```

---

## Part 10: Monitoring & Maintenance

### Check Database Performance

**RDS Console → Select Database → Monitoring tab**

Watch these metrics:
- **CPU Utilization** - Should be < 70%
- **Database Connections** - Monitor active connections
- **Read/Write IOPS** - Check if storage is bottleneck
- **Free Storage Space** - Ensure autoscaling is working

### Set Up CloudWatch Alarms

**Create alarms for:**

1. **High CPU**
   - Metric: CPUUtilization
   - Threshold: > 80% for 5 minutes
   - Action: Send SNS notification

2. **Low Storage**
   - Metric: FreeStorageSpace
   - Threshold: < 5 GB
   - Action: Send SNS notification

3. **High Connections**
   - Metric: DatabaseConnections
   - Threshold: > 80% of max_connections
   - Action: Send SNS notification

### Regular Maintenance

**Weekly:**
- ✅ Check database logs for errors
- ✅ Monitor slow queries
- ✅ Review connection pool usage

**Monthly:**
- ✅ Review storage usage and projections
- ✅ Check backup retention is working
- ✅ Test database restore (staging)
- ✅ Review costs and optimize if needed

**Quarterly:**
- ✅ Review and update PostgreSQL version
- ✅ Optimize database indexes
- ✅ Test disaster recovery plan

---

## Troubleshooting Common Issues

### Issue 1: Cannot connect to RDS from EC2

**Symptoms:**
```
ETIMEDOUT
Connection timed out
```

**Solutions:**
1. Check security group allows port 5432 from EC2
2. Verify EC2 and RDS are in same VPC
3. Check RDS is not publicly accessible (should be No)
4. Verify endpoint is correct in .env

```bash
# Test connection from EC2
telnet <RDS_ENDPOINT> 5432

# Should see:
# Connected to <RDS_ENDPOINT>
```

---

### Issue 2: Authentication failed

**Symptoms:**
```
password authentication failed for user "incollab_admin"
```

**Solutions:**
1. Verify username is correct (case-sensitive)
2. Check password is correct (no extra spaces)
3. Ensure database name exists
4. Check password special characters are properly escaped in .env

```bash
# Reset password from RDS Console:
# 1. Select database
# 2. Click "Modify"
# 3. Scroll to "Settings"
# 4. Enter new master password
# 5. Apply immediately
```

---

### Issue 3: Too many connections

**Symptoms:**
```
FATAL: remaining connection slots are reserved
```

**Solutions:**
1. Increase max_connections in parameter group
2. Reduce connection pool size in application
3. Upgrade to larger instance class

```bash
# Check current connections
psql -h <RDS_ENDPOINT> -U incollab_admin -d <DB_NAME>
SELECT count(*) FROM pg_stat_activity;

# Check max connections
SHOW max_connections;

# Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < current_timestamp - INTERVAL '5 minutes';
```

---

### Issue 4: Slow queries

**Solutions:**
1. Enable Performance Insights
2. Add indexes for frequently queried columns
3. Optimize Sequelize queries (add proper indexes)
4. Consider read replica for read-heavy workload

```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Create index example
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

---

## Cost Optimization Tips

### 1. Right-size your instances
- Start small (t3.small for staging)
- Monitor CPU/memory usage
- Upgrade only when needed (> 70% utilization)

### 2. Use Reserved Instances (for production)
- Save 30-60% on production RDS
- Commit to 1 or 3 years
- Only after traffic is stable

### 3. Delete old snapshots
```bash
# Keep last 30 days only
# Delete older manual snapshots
```

### 4. Stop staging database when not in use (optional)
```bash
# If you don't need staging on weekends
# Stop database: Saves ~70% of cost
# Can't stop Multi-AZ instances
```

### 5. Use gp3 instead of gp2
- Same performance
- 20% cheaper
- Better IOPS baseline

---

## Security Best Practices

### 1. Use SSL/TLS for connections
```bash
# In .env
DB_SSL=true

# Verify SSL is working
psql "sslmode=require host=<RDS_ENDPOINT> dbname=<DB_NAME> user=<USER>"
```

### 2. Rotate passwords regularly
- Change RDS master password every 90 days
- Use AWS Secrets Manager for automatic rotation

### 3. Limit access
- Only allow EC2 security groups (not IP ranges)
- Never enable public access
- Use IAM database authentication (advanced)

### 4. Enable encryption
- Always enable encryption at rest
- Use default KMS key (free)
- Can't add encryption after creation

### 5. Enable deletion protection (production)
- Prevents accidental database deletion
- Must disable before deleting

### 6. Regular security audits
```bash
# Check for public databases
aws rds describe-db-instances --query 'DBInstances[?PubliclyAccessible==`true`]'

# Should return empty [] for all databases
```

---

## Disaster Recovery Plan

### Backup Strategy

**Automated Backups (RDS):**
- Staging: 7 days retention
- Production: 30 days retention

**Manual Snapshots:**
- Before major deployments
- Before schema changes
- Monthly production snapshots (keep 1 year)

### Recovery Time Objective (RTO)

**Staging:**
- RTO: 1-2 hours (acceptable downtime)
- Restore from automated backup

**Production:**
- RTO: < 5 minutes (with Multi-AZ)
- Automatic failover to standby
- Manual failover: 1-2 minutes

### Recovery Point Objective (RPO)

**Staging:**
- RPO: 24 hours (daily backups)

**Production:**
- RPO: 5 minutes (transaction logs)
- Automated backups every 5 minutes

### How to Restore from Backup

**Point-in-time restore:**
```bash
1. RDS Console → Databases
2. Select database
3. Actions → "Restore to point in time"
4. Choose date/time (any point in last 30 days)
5. New DB identifier: "incollab-prod-restored"
6. Wait 10-15 minutes
7. Update application to use new endpoint
8. Verify data is correct
9. Delete old database or keep as backup
```

---

## Summary Checklist

### Staging RDS Setup ✅
- [ ] Created staging RDS instance (db.t3.small)
- [ ] Configured security group to allow EC2 access
- [ ] Saved endpoint and credentials securely
- [ ] Updated staging EC2 .env file
- [ ] Tested database connection from EC2
- [ ] Ran database migrations
- [ ] Verified application can connect
- [ ] Enabled automated backups (7 days)
- [ ] Enabled encryption

### Production RDS Setup ✅
- [ ] Created production RDS instance (db.t3.medium or higher)
- [ ] Enabled Multi-AZ deployment
- [ ] Configured security group to allow EC2 access
- [ ] Saved endpoint and credentials securely
- [ ] Updated production EC2 .env file
- [ ] Tested database connection from EC2
- [ ] Ran database migrations
- [ ] Verified application can connect
- [ ] Enabled automated backups (30 days)
- [ ] Enabled encryption
- [ ] Enabled deletion protection
- [ ] Enabled Performance Insights
- [ ] Set up CloudWatch alarms

### Post-Setup ✅
- [ ] Documented endpoints in secure location
- [ ] Updated CI/CD pipeline (if needed)
- [ ] Set up monitoring dashboards
- [ ] Tested backup and restore process
- [ ] Scheduled regular maintenance tasks
- [ ] Communicated new endpoints to team

---

## Quick Reference

### Staging RDS
```
Endpoint: incollab-staging-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
Port: 5432
Database: incollab_staging
Username: incollab_admin
Instance: db.t3.small
Cost: ~$35/month
```

### Production RDS
```
Endpoint: incollab-production-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
Port: 5432
Database: incollab_prod
Username: incollab_admin
Instance: db.t3.medium (Multi-AZ)
Cost: ~$130/month
```

### Connection String Format
```
postgres://username:password@host:5432/database?sslmode=require
```

---

## Need Help?

- AWS RDS Documentation: https://docs.aws.amazon.com/rds/
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Sequelize with PostgreSQL: https://sequelize.org/docs/v6/other-topics/dialect-specific-things/

---

**Setup Time:** 30-45 minutes per database
**Total Cost:** ~$165/month (staging + production)
**Maintenance:** 1-2 hours/month

Good luck with your RDS setup! 🚀
