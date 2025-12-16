# Deployment Guide: api.teamcollabkaroo.com

This guide covers deploying the backend API on `api.teamcollabkaroo.com` subdomain.

## Architecture Overview

```
teamcollabkaroo.com         → Frontend EC2 (Next.js PWA)
api.teamcollabkaroo.com     → Backend EC2 (NestJS API)
```

Frontend will make API calls to `https://api.teamcollabkaroo.com/api/admin/*`

## What Changed in Deployment

### Updated Files:
1. **`nginx.conf`**: Added server block for `api.teamcollabkaroo.com`
2. **`docker-compose.yml`**:
   - Now automatically mounts `nginx.conf` from repo
   - Added volume mounts for `api.teamcollabkaroo.com` SSL certificates
3. **`deploy.sh`**: Updated nginx config handling (now reloads instead of copying)
4. **`.env`**: Added `teamcollabkaroo.com` to `ALLOWED_ORIGINS`

### Key Points:
- ✅ nginx.conf is now automatically loaded via docker-compose (no manual copying needed)
- ✅ Both domain SSL certificates are mounted into nginx container
- ✅ Deploy script properly handles nginx config reloads
- ✅ CORS configured for frontend domain

---

## 1. DNS Configuration (GoDaddy)

### Steps:
1. Login to GoDaddy → [https://dcc.godaddy.com/domains](https://dcc.godaddy.com/domains)
2. Click on `teamcollabkaroo.com` → Manage DNS
3. Add the following A records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<FRONTEND_EC2_PUBLIC_IP>` | 600 |
| A | `api` | `<BACKEND_EC2_PUBLIC_IP>` | 600 |

4. Save and wait for DNS propagation (5-60 minutes)

### Verify DNS:
```bash
nslookup api.teamcollabkaroo.com
# Should return your Backend EC2 IP

nslookup teamcollabkaroo.com
# Should return your Frontend EC2 IP
```

---

## 2. Backend EC2 Setup

### Prerequisites:
- Ubuntu EC2 instance
- Docker and Docker Compose installed
- Port 80 and 443 open in Security Group

### Step 1: Clone Repository
```bash
cd /home/ubuntu
git clone <your-backend-repo-url>
cd Incollabe-BE
```

### Step 2: Update Environment Variables
Create/update `.env` file on EC2:
```bash
nano .env
```

**Important variables to update:**
```env
NODE_ENV=production
PORT=3002
POSTGRES_HOST=<your-rds-or-db-host>
POSTGRES_PASSWORD=<secure-password>
POSTGRES_USER=postgres
POSTGRES_PORT=5432
POSTGRES_DB=incollab_db
REDIS_HOST=<your-redis-host>
REDIS_PORT=6379
JWT_SECRET=<generate-secure-secret>
JWT_REFRESH_SECRET=<generate-secure-secret>
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=<your-bucket>
ALLOWED_ORIGINS=https://teamcollabkaroo.com,https://www.teamcollabkaroo.com
FRONTEND_URL=https://teamcollabkaroo.com
```

### Step 3: SSL Certificate Setup
**IMPORTANT: Do this BEFORE running docker-compose!**

Install Certbot for Let's Encrypt SSL certificates:

```bash
# Install Certbot
sudo apt update
sudo apt install certbot -y

# Stop any service using port 80
sudo systemctl stop nginx || true
docker stop incollab-nginx 2>/dev/null || true

# Get SSL certificates for BOTH domains
# 1. Get certificate for incollab.buymybills.in (existing domain)
sudo certbot certonly --standalone -d incollab.buymybills.in

# 2. Get certificate for api.teamcollabkaroo.com (new admin API domain)
sudo certbot certonly --standalone -d api.teamcollabkaroo.com

# Certificates will be saved to:
# /etc/letsencrypt/live/incollab.buymybills.in/
# /etc/letsencrypt/live/api.teamcollabkaroo.com/
```

**Verify certificates exist:**
```bash
ls -la /etc/letsencrypt/live/incollab.buymybills.in/
ls -la /etc/letsencrypt/live/api.teamcollabkaroo.com/
# You should see fullchain.pem and privkey.pem in both directories
```

### Step 4: Deploy with Docker Compose
```bash
# Build and start services
docker-compose up -d --build

# Check logs
docker-compose logs -f incollab-backend

# Verify services are running
docker-compose ps
```

### Step 5: Setup Auto-renewal for SSL
```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line (runs twice daily and restarts nginx to load new certs):
0 0,12 * * * certbot renew --quiet && docker restart incollab-nginx
```

**Note:** The nginx container automatically mounts certificates from `/etc/letsencrypt/live/`, so after renewal, just restart the nginx container to load the new certificates.

### Step 6: Using Deploy Script for Updates
For subsequent deployments (after initial setup), use the included deploy.sh script:

```bash
cd /home/ubuntu/Incollabe-BE

# Deploy only app updates (keeps DB and Redis running - RECOMMENDED):
./deploy.sh deploy

# Deploy everything (stops all services):
./deploy.sh full-deploy

# Other useful commands:
./deploy.sh restart-app    # Restart only the app
./deploy.sh status          # Check service status
./deploy.sh logs            # View all logs
./deploy.sh logs incollab-app  # View app logs only
```

**What the deploy script does:**
1. Pulls latest Docker image from Docker Hub
2. Stops old app container
3. Starts new app container
4. Tests and reloads nginx configuration (if nginx.conf changed)
5. Runs health checks
6. Cleans up old images

---

## 3. Testing

### Test HTTP to HTTPS Redirect:
```bash
curl -I http://api.teamcollabkaroo.com
# Should return 301 redirect to https://
```

### Test Admin API Endpoint:
```bash
curl https://api.teamcollabkaroo.com/api/admin/health
# Or use your actual health check endpoint
```

### Test Swagger Documentation:
Open in browser: `https://api.teamcollabkaroo.com/docs?admin=true`

### Test CORS:
```bash
curl -H "Origin: https://teamcollabkaroo.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://api.teamcollabkaroo.com/api/admin/login
```

---

## 4. Frontend Configuration

In your Next.js frontend repository, update the API base URL:

```javascript
// config/api.ts or similar
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.teamcollabkaroo.com';

export const ADMIN_API_URL = `${API_BASE_URL}/api/admin`;
```

Create `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://api.teamcollabkaroo.com
```

---

## 5. Monitoring & Maintenance

### View Logs:
```bash
# Backend logs
docker-compose logs -f incollab-backend

# Nginx logs
docker-compose logs -f nginx

# All logs
docker-compose logs -f
```

### Restart Services:
```bash
# Restart specific service
docker-compose restart incollab-backend

# Restart all
docker-compose restart

# Rebuild and restart
docker-compose up -d --build
```

### Update Code:
```bash
cd /home/ubuntu/Incollabe-BE
git pull origin main
docker-compose up -d --build
```

---

## 6. Security Checklist

- [ ] SSL certificates installed and auto-renewal configured
- [ ] EC2 Security Group allows only ports 80, 443, and SSH (22)
- [ ] Database not publicly accessible (use private subnet or Security Group)
- [ ] Strong JWT secrets set in production .env
- [ ] AWS credentials have minimal required permissions
- [ ] Environment variables properly set (no test/dev values)
- [ ] CORS only allows your frontend domain
- [ ] Rate limiting enabled in nginx (already configured)
- [ ] Firewall (ufw) configured if needed

---

## 7. Troubleshooting

### Issue: "Connection refused"
```bash
# Check if Docker containers are running
docker-compose ps

# Check nginx configuration
docker-compose exec nginx nginx -t

# Restart nginx
docker-compose restart nginx
```

### Issue: "502 Bad Gateway"
```bash
# Check if backend is running
docker-compose logs incollab-backend

# Check backend health
curl http://localhost:3002/health
```

### Issue: SSL Certificate Error
```bash
# Verify certificate files exist
ls -la /etc/ssl/private/

# Check certificate expiry
sudo openssl x509 -in /etc/ssl/private/api-teamcollabkaroo-fullchain.pem -noout -dates
```

### Issue: DNS not resolving
```bash
# Check DNS propagation
nslookup api.teamcollabkaroo.com

# Try with specific DNS server
nslookup api.teamcollabkaroo.com 8.8.8.8
```

---

## 8. Summary

**What you've configured:**
- ✅ `api.teamcollabkaroo.com` server block added to nginx.conf
- ✅ CORS configured to allow `teamcollabkaroo.com` origin
- ✅ SSL/HTTPS support with automatic HTTP→HTTPS redirect
- ✅ Admin API endpoints accessible at `/api/admin/*`
- ✅ Swagger docs at `/docs?admin=true`
- ✅ Health check at `/health`
- ✅ Grafana monitoring at `/grafana/`

**URLs:**
- Admin API: `https://api.teamcollabkaroo.com/api/admin/*`
- Swagger Docs: `https://api.teamcollabkaroo.com/docs?admin=true`
- Health Check: `https://api.teamcollabkaroo.com/health`
- Grafana: `https://api.teamcollabkaroo.com/grafana/`

**Frontend should call:**
```
https://api.teamcollabkaroo.com/api/admin/login
https://api.teamcollabkaroo.com/api/admin/users
etc.
```
