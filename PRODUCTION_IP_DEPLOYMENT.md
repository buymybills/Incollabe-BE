# Production Deployment Setup (IP-based Access)

This guide explains how to deploy to production EC2 using IP address (without domain/SSL).

## Overview

- **Staging (dev branch)**: `incollab.buymybills.in` (uses `nginx.conf` with SSL)
- **Production (main branch)**: `http://<PROD_EC2_IP>` (uses `nginx.prod.conf` without SSL)

## Files

- **`nginx.conf`**: Staging configuration with domain names and SSL certificates
- **`nginx.prod.conf`**: Production configuration for IP-based access (no SSL)

## How It Works

The deployment workflow automatically selects the correct nginx configuration:

- **Staging deployment** (dev branch) → copies `nginx.conf` (domain + SSL)
- **Production deployment** (main branch) → copies `nginx.prod.conf` as `nginx.conf` (IP-only, no SSL)

## Production EC2 Setup

### 1. Launch Production EC2 Instance

Same as staging EC2 setup:
- Instance type: t3.medium or t3.large
- Security Group: Allow ports 22 (SSH), 80 (HTTP)
- Key pair: Create/use production key pair

### 2. Add GitHub Secrets

In GitHub repository settings, add:

```
PROD_EC2_HOST = <Production EC2 IP address>
PROD_EC2_USER = ubuntu
PROD_EC2_SSH_KEY = <Production EC2 private key>
```

### 3. Install Docker on Production EC2

```bash
# SSH into production EC2
ssh -i production-key.pem ubuntu@<PROD_EC2_IP>

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and log back in for group changes to take effect
exit
ssh -i production-key.pem ubuntu@<PROD_EC2_IP>

# Verify installation
docker --version
docker-compose --version
```

### 4. Create .env File on Production EC2

```bash
# SSH into production EC2
ssh -i production-key.pem ubuntu@<PROD_EC2_IP>

# Create .env file
cd /home/ubuntu/Incollabe-BE
nano .env
```

Add production environment variables:

```env
# App Configuration
NODE_ENV=production
PORT=3002

# Database Configuration (Production RDS)
POSTGRES_HOST=<production-rds-endpoint>
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<production-rds-password>
POSTGRES_DB=collabkaroo_db

# JWT Configuration
JWT_SECRET=<production-jwt-secret>
JWT_EXPIRATION=7d

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret-key>
AWS_REGION=ap-south-1
S3_BUCKET_NAME=<production-s3-bucket>

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<production-redis-password>

# Docker Configuration
IMAGE_TAG=latest
DOCKERHUB_USERNAME=<dockerhub-username>

# Other configurations...
```

### 5. Deploy to Production

Once setup is complete, deployment happens automatically:

```bash
# On your local machine
git checkout main
git merge dev
git push origin main
```

The GitHub Actions workflow will:
1. ✅ Run detect-changes
2. ✅ Deploy staging (from previous dev push)
3. ✅ Deploy production (uses `nginx.prod.conf`)

## Accessing Production

After deployment completes:

- **API Base URL**: `http://<PROD_EC2_IP>/api`
- **Admin API**: `http://<PROD_EC2_IP>/api/admin`
- **Swagger Docs**: `http://<PROD_EC2_IP>/docs`
- **Health Check**: `http://<PROD_EC2_IP>/health`

### Example API Calls

```bash
# Health check
curl http://<PROD_EC2_IP>/health

# Get API info
curl http://<PROD_EC2_IP>/

# Admin login
curl -X POST http://<PROD_EC2_IP>/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

## Security Considerations

⚠️ **Important**: IP-based access without SSL means:

- ❌ **No encryption** - API requests are sent in plain text
- ❌ **No HTTPS** - Tokens and passwords are not encrypted in transit
- ⚠️ **Only for testing** - Do NOT use for production traffic with real users

### When to Add SSL

Once you have a domain for production:

1. **Set up domain DNS**: Point domain to production EC2 IP
2. **Install SSL certificate**: Use Let's Encrypt or AWS Certificate Manager
3. **Update nginx config**: Switch from `nginx.prod.conf` to domain-based config with SSL
4. **Update GitHub secrets**: Add `PROD_DOMAIN` secret
5. **Modify deployment workflow**: Use domain-based nginx config for production

## Monitoring Production

```bash
# SSH into production EC2
ssh -i production-key.pem ubuntu@<PROD_EC2_IP>

# Check running containers
docker-compose ps

# View logs
docker-compose logs -f incollab-app

# Check nginx logs
docker-compose logs -f nginx

# Restart services
./deploy.sh restart
```

## Troubleshooting

### Cannot access production via IP

1. **Check Security Group**: Ensure port 80 is open
   ```bash
   # On production EC2
   sudo ufw status
   ```

2. **Check nginx is running**:
   ```bash
   docker-compose ps
   docker-compose logs nginx
   ```

3. **Test nginx config**:
   ```bash
   docker-compose exec nginx nginx -t
   ```

### SSL certificate errors

If you see SSL errors, it means the wrong nginx config is being used:
- Production should use `nginx.prod.conf` (no SSL)
- Check deployment logs to verify correct file was copied

### Port conflicts

If nginx fails to start:
```bash
# Check what's using port 80
sudo lsof -i :80

# Stop conflicting service
sudo systemctl stop apache2  # If Apache is running
```

## Migration to Domain + SSL

When you're ready to add a proper domain:

1. **Get a domain** (e.g., `api.buymybills.in`)
2. **Point DNS to production EC2**
3. **Install certbot on EC2**:
   ```bash
   sudo apt-get update
   sudo apt-get install certbot
   ```
4. **Get SSL certificate**:
   ```bash
   sudo certbot certonly --standalone -d api.buymybills.in
   ```
5. **Update `nginx.conf`** with production domain and SSL paths
6. **Update deployment workflow** to use `nginx.conf` for production
7. **Deploy**: Push to main branch to apply changes

---

**Next Steps**: Once production is stable with IP access, plan to add a domain and SSL certificate for proper security.
