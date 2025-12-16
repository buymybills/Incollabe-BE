# Production Admin Subdomain Setup Guide

## Overview
Setting up `prodapi.teamcollabkaroo.com` as the admin API subdomain for production, similar to how `api.teamcollabkaroo.com` is used for staging.

## Domain Configuration

### Environment Setup
- **Staging**: `api.teamcollabkaroo.com` → Admin API
- **Production**: `prodapi.teamcollabkaroo.com` → Admin API
- **Production Public**: `api.collabkaroo.co.in` → Public API (blocks /api/admin)

## Step-by-Step Setup

### 1. DNS Configuration

Add an A record for the new subdomain in your DNS provider (e.g., GoDaddy, Cloudflare):

```
Type: A
Name: prodapi
Value: <PRODUCTION_SERVER_IP>
TTL: Auto or 600
```

**Verify DNS propagation:**
```bash
# Check if DNS is resolving
nslookup prodapi.teamcollabkaroo.com

# Or use dig
dig prodapi.teamcollabkaroo.com
```

Wait for DNS propagation (can take 5 minutes to 48 hours, usually within 15 minutes).

### 2. Obtain SSL Certificate

SSH into your production server and run certbot:

```bash
# SSH to production server
ssh ubuntu@<PRODUCTION_SERVER_IP>

# Stop nginx temporarily
cd /home/ubuntu/Incollabe-BE
docker-compose stop nginx

# Run certbot standalone mode
sudo certbot certonly --standalone \
  -d prodapi.teamcollabkaroo.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com

# Verify certificate was created
sudo ls -la /etc/letsencrypt/live/prodapi.teamcollabkaroo.com/

# Should see:
# - fullchain.pem
# - privkey.pem
# - cert.pem
# - chain.pem
```

### 3. Deploy Updated Nginx Configuration

The nginx configuration has already been updated in `nginx.prod.conf`. Now deploy it:

```bash
# On your local machine, commit the changes
git add nginx.prod.conf PROD_ADMIN_SUBDOMAIN_SETUP.md
git commit -m "Add prodapi.teamcollabkaroo.com subdomain for production admin API"
git push origin dev

# Merge to main (for production)
git checkout main
git merge dev
git push origin main
```

The GitHub Actions workflow will automatically deploy to production.

**OR manually update on production server:**

```bash
# SSH to production
ssh ubuntu@<PRODUCTION_SERVER_IP>

# Backup current config
cd /home/ubuntu/Incollabe-BE
cp nginx.conf nginx.conf.backup

# Update nginx.conf with the new configuration
# (Either SCP the file or edit manually using the content from nginx.prod.conf)

# Restart nginx to apply changes
docker-compose restart nginx

# Check nginx logs
docker-compose logs nginx
```

### 4. Verify Setup

Test all endpoints to ensure everything works:

```bash
# Test public API (should work)
curl https://api.collabkaroo.co.in/health

# Test admin endpoint on public domain (should return 403)
curl https://api.collabkaroo.co.in/api/admin/health

# Test admin subdomain (should work)
curl https://prodapi.teamcollabkaroo.com/api/admin/health

# Test Swagger on admin subdomain
curl https://prodapi.teamcollabkaroo.com/docs
```

### 5. Update Frontend Configuration

Update your admin frontend to point to the new production admin API:

```javascript
// Production environment config
const API_BASE_URL = 'https://prodapi.teamcollabkaroo.com';
```

## Configuration Summary

### Public API Domain: api.collabkaroo.co.in
- ✅ Regular API endpoints: `/api/*` (except /api/admin)
- ❌ Admin endpoints: `/api/admin/*` (blocked with 403)
- ✅ Health check: `/health`

### Admin API Domain: prodapi.teamcollabkaroo.com
- ✅ Admin endpoints: `/api/admin/*`
- ✅ Swagger docs: `/docs`
- ✅ Health check: `/health`
- ❌ All other routes (returns 404)

## Security Features

The admin subdomain has enhanced security:

1. **Stricter Headers**:
   - `X-Frame-Options: DENY` (prevents clickjacking)
   - `Strict-Transport-Security` (forces HTTPS)
   - `X-Content-Type-Options: nosniff`

2. **Separate Domain**: Isolates admin traffic from public API

3. **Route Restrictions**: Only allows specific admin routes

## Troubleshooting

### Issue: Certificate not found
```bash
# Check if certbot ran successfully
sudo certbot certificates

# If not, re-run certbot
sudo certbot certonly --standalone -d prodapi.teamcollabkaroo.com
```

### Issue: nginx container fails to start
```bash
# Check nginx configuration
docker exec incollab-nginx nginx -t

# View detailed logs
docker-compose logs nginx --tail=100
```

### Issue: 502 Bad Gateway
```bash
# Check backend is running
docker-compose ps

# Restart backend if needed
docker-compose restart incollab-backend
```

### Issue: DNS not resolving
```bash
# Verify DNS record exists
dig prodapi.teamcollabkaroo.com

# Check propagation status
https://dnschecker.org/#A/prodapi.teamcollabkaroo.com
```

## Certificate Renewal

Let's Encrypt certificates expire after 90 days. Set up auto-renewal:

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Add to crontab for auto-renewal
sudo crontab -e

# Add this line (checks twice daily)
0 0,12 * * * certbot renew --quiet --deploy-hook "docker-compose -f /home/ubuntu/Incollabe-BE/docker-compose.yml restart nginx"
```

## Rollback Procedure

If something goes wrong, you can quickly rollback:

```bash
# SSH to production
cd /home/ubuntu/Incollabe-BE

# Restore backup
cp nginx.conf.backup nginx.conf

# Restart nginx
docker-compose restart nginx
```

## Next Steps

1. ✅ Update DNS record for prodapi.teamcollabkaroo.com
2. ✅ Obtain SSL certificate using certbot
3. ✅ Deploy updated nginx configuration
4. ✅ Test all endpoints
5. ✅ Update frontend configuration
6. ✅ Set up certificate auto-renewal
7. ✅ Monitor logs for any issues

## Support

If you encounter any issues:
1. Check nginx logs: `docker-compose logs nginx`
2. Check backend logs: `docker-compose logs incollab-backend`
3. Verify DNS: `dig prodapi.teamcollabkaroo.com`
4. Test SSL: `openssl s_client -connect prodapi.teamcollabkaroo.com:443`
