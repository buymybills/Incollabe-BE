# Log Management Guide

## Problem

On a small EC2 instance (t3.micro), log files can grow indefinitely and consume all available disk space, causing:
- Application crashes
- Unable to SSH into server
- Data loss
- System instability

## Solution: Logrotate

**Logrotate** is a built-in Linux utility that automatically rotates, compresses, and deletes old log files.

### Benefits

✅ **Vendor-neutral** - Works on any Linux server
✅ **Zero cost** - No external services needed
✅ **Minimal disk usage** - Keeps only recent logs (~5-10MB)
✅ **Battle-tested** - Industry standard for 20+ years
✅ **No code changes** - Works with existing Winston setup
✅ **Automatic** - Runs via cron, no manual intervention

## Installation on EC2

### Step 1: Copy Configuration File

```bash
# From your local machine
scp logrotate.conf ubuntu@your-ec2-ip:/tmp/

# Or manually create on server
ssh ubuntu@your-ec2-ip
sudo nano /etc/logrotate.d/collabkaroo
# Paste the contents of logrotate.conf
```

### Step 2: Update Paths

Edit `/etc/logrotate.d/collabkaroo` and update paths to match your deployment:

```bash
# Change this line if your app is in a different location
/home/ubuntu/collabkaroo/logs/*.log {
```

### Step 3: Set Permissions

```bash
sudo chmod 644 /etc/logrotate.d/collabkaroo
sudo chown root:root /etc/logrotate.d/collabkaroo
```

### Step 4: Test Configuration

```bash
# Dry run (shows what would happen without actually doing it)
sudo logrotate -d /etc/logrotate.d/collabkaroo

# Force run once to verify it works
sudo logrotate -f /etc/logrotate.d/collabkaroo
```

### Step 5: Verify

Check that logs were rotated:

```bash
ls -lh /home/ubuntu/collabkaroo/logs/
# You should see:
# app.log (current)
# app.log.1 (yesterday)
# app.log.2.gz (compressed)
```

## How It Works

### Daily Rotation

Every day at ~3 AM (via cron), logrotate will:

1. Rename current log: `app.log` → `app.log.1`
2. Compress yesterday's log: `app.log.1` → `app.log.2.gz`
3. Create fresh `app.log` file
4. Tell PM2 to reload logs
5. Delete logs older than 7 days

### Disk Usage Example

**Without logrotate:**
```
app.log          500 MB
error.log        200 MB
Total:           700 MB (and growing!)
```

**With logrotate (7 day retention):**
```
app.log          10 MB  (today)
app.log.1        8 MB   (yesterday, uncompressed)
app.log.2.gz     1 MB   (2 days ago)
app.log.3.gz     1 MB
...
app.log.7.gz     1 MB
Total:           ~25 MB maximum!
```

## Configuration Options

### Adjust Retention Period

```bash
# Keep logs for 30 days instead of 7
rotate 30
```

### Change Rotation Frequency

```bash
# Options: daily, weekly, monthly
weekly
```

### Size-Based Rotation

```bash
# Rotate when file reaches 50MB (regardless of time)
size 50M
rotate 10  # Keep 10 files = 500MB max
```

### Different Settings for Different Logs

```bash
# Keep error logs longer
/home/ubuntu/collabkaroo/logs/error*.log {
    daily
    rotate 30    # 30 days for errors
    compress
    # ... rest of config
}

# Rotate app logs more frequently
/home/ubuntu/collabkaroo/logs/app*.log {
    daily
    rotate 7     # 7 days for regular logs
    compress
    # ... rest of config
}
```

## Viewing Logs in Production

### Current Logs

```bash
# SSH into server
ssh ubuntu@your-ec2-ip

# View live logs
tail -f /home/ubuntu/collabkaroo/logs/app.log

# View error logs
tail -f /home/ubuntu/collabkaroo/logs/error.log

# Search logs
grep "error" /home/ubuntu/collabkaroo/logs/app.log

# View PM2 logs
pm2 logs collabkaroo --lines 100
```

### Archived Logs

```bash
# View compressed logs
zcat /home/ubuntu/collabkaroo/logs/app.log.2.gz | less

# Search in compressed logs
zgrep "error" /home/ubuntu/collabkaroo/logs/app.log.*.gz

# Download logs to local machine
scp ubuntu@your-ec2-ip:/home/ubuntu/collabkaroo/logs/app.log.*.gz ./
```

## Monitoring Disk Usage

### Check Current Usage

```bash
# Overall disk usage
df -h

# Log directory size
du -sh /home/ubuntu/collabkaroo/logs/

# Largest files
du -h /home/ubuntu/collabkaroo/logs/* | sort -rh | head -10
```

### Set Up Alerts

```bash
# Add to crontab
crontab -e

# Check disk usage daily and alert if > 80%
0 9 * * * USAGE=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1); if [ $USAGE -gt 80 ]; then echo "Disk usage is at ${USAGE}%" | mail -s "Disk Alert" your@email.com; fi
```

## Troubleshooting

### Logs Not Rotating

1. Check logrotate is installed:
   ```bash
   which logrotate
   # Should output: /usr/sbin/logrotate
   ```

2. Check cron is running:
   ```bash
   sudo systemctl status cron
   ```

3. Check logrotate status:
   ```bash
   cat /var/lib/logrotate/status
   ```

4. Manually run logrotate with verbose output:
   ```bash
   sudo logrotate -v /etc/logrotate.d/collabkaroo
   ```

### Permission Errors

```bash
# Fix ownership
sudo chown -R ubuntu:ubuntu /home/ubuntu/collabkaroo/logs/

# Fix permissions
sudo chmod 755 /home/ubuntu/collabkaroo/logs/
sudo chmod 644 /home/ubuntu/collabkaroo/logs/*.log
```

### PM2 Not Creating New Logs After Rotation

```bash
# Reload PM2 logs manually
pm2 reloadLogs

# Restart PM2
pm2 restart collabkaroo
```

## Alternative: Manual Cleanup Script

If you don't want to use logrotate, create a simple cleanup script:

```bash
#!/bin/bash
# cleanup-logs.sh

LOG_DIR="/home/ubuntu/collabkaroo/logs"
DAYS_TO_KEEP=7

# Delete logs older than 7 days
find $LOG_DIR -name "*.log" -type f -mtime +$DAYS_TO_KEEP -delete

# Compress logs older than 1 day
find $LOG_DIR -name "*.log" -type f -mtime +1 -exec gzip {} \;

echo "Log cleanup completed: $(date)"
```

Add to crontab:
```bash
# Run daily at 3 AM
0 3 * * * /home/ubuntu/cleanup-logs.sh >> /home/ubuntu/cleanup.log 2>&1
```

## Best Practices

### For t3.micro (1GB RAM, 8GB disk)

- ✅ Keep 7 days of app logs
- ✅ Keep 30 days of error logs
- ✅ Compress all rotated logs
- ✅ Monitor disk usage weekly
- ✅ Set max log file size to 50MB

### For Larger Instances

- Keep 30+ days of logs
- Consider shipping to external service for long-term storage
- Use centralized logging (Loki, ELK stack)

### General

- ✅ Always compress rotated logs
- ✅ Test logrotate config before deploying
- ✅ Monitor disk space regularly
- ✅ Keep error logs longer than app logs
- ✅ Use vendor-neutral solutions to avoid lock-in

## Future Improvements (Optional)

### 1. Remote Backup to S3-Compatible Storage

Use vendor-neutral object storage (DigitalOcean Spaces, Backblaze B2, Wasabi):

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure remote
rclone config

# Backup logs weekly
0 0 * * 0 rclone sync /home/ubuntu/collabkaroo/logs/*.gz remote:backup/logs/
```

### 2. Self-Hosted Grafana Loki

For better log searching and visualization:

```bash
# Docker Compose
docker-compose -f loki-stack.yml up -d
```

### 3. Log Aggregation

Collect logs from multiple servers:

- **Loki + Promtail** (lightweight, open source)
- **Graylog** (powerful, self-hosted)
- **Fluentd** (vendor-neutral log collector)

## Cost Comparison

| Solution | Monthly Cost | Disk Usage | Vendor Lock-in |
|----------|-------------|------------|----------------|
| **Logrotate** | $0 | ~10-50MB | ❌ None |
| AWS CloudWatch | $0-$10 | 0 (cloud) | ✅ AWS |
| Self-hosted Loki | $0-$5 | ~100MB | ❌ None |
| Datadog | $15-$100+ | 0 (cloud) | ✅ Datadog |
| Manual cleanup | $0 | Varies | ❌ None |

## Conclusion

**For t3.micro instances, logrotate is the best solution:**
- No vendor lock-in
- Zero cost
- Minimal resource usage
- Industry standard
- Works anywhere

Your logs are now managed automatically and will never fill up your disk! 🎉
