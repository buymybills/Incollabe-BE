# CI/CD Setup: Separate Staging and Production Environments

## Overview
This document outlines all changes required to set up proper CI/CD with:
- **`main` branch** → Production environment (Existing EC2)
- **`dev` branch** → Staging environment (New EC2)

---

## Current Setup (What You Have Now)
- ✅ Single EC2 instance running production from `main` branch
- ✅ CI/CD pipeline in `.github/workflows/`
- ❌ Both `main` and `dev` branches deploying to same EC2
- ❌ No separate staging environment

---

## Required Changes

### 1. Infrastructure Setup (AWS/EC2)

#### A. Set Up New Staging EC2 Instance
**Action Items:**
1. Launch new EC2 instance for staging (can be smaller than prod)
   - Recommended: t3.medium or t3.small for staging
   - Same OS as production (Ubuntu recommended)
   - Same security group setup as production
   - Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000-3002 (if needed)

2. Install required software on staging EC2:
   ```bash
   # SSH into new staging EC2
   ssh ubuntu@<STAGING_EC2_IP>
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker ubuntu
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Create application directory
   mkdir -p /home/ubuntu/Incollabe-BE
   cd /home/ubuntu/Incollabe-BE
   ```

3. Copy `.env` file to staging EC2:
   ```bash
   # From your local machine
   scp .env ubuntu@<STAGING_EC2_IP>:/home/ubuntu/Incollabe-BE/
   
   # Update environment variables for staging:
   # - Different database (staging DB)
   # - Different Redis instance
   # - Different S3 bucket (optional)
   # - Different API keys (optional)
   ```

4. Set up DNS (Optional but Recommended):
   - Production: `api.buymybills.in` or `prod.buymybills.in`
   - Staging: `staging-api.buymybills.in` or `stag.buymybills.in`

---

### 2. GitHub Repository Secrets

#### A. Add New Secrets for Staging Environment
**Go to:** GitHub Repo → Settings → Secrets and variables → Actions

**Add these new secrets:**

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `STAGING_EC2_HOST` | `<STAGING_EC2_IP>` | IP address of staging EC2 |
| `STAGING_EC2_USER` | `ubuntu` | SSH user for staging EC2 |
| `STAGING_EC2_SSH_KEY` | `<PRIVATE_KEY>` | SSH private key for staging EC2 |

**Keep existing secrets for production:**
- `EC2_HOST` (rename to `PROD_EC2_HOST` for clarity - optional)
- `EC2_USER` (rename to `PROD_EC2_USER` - optional)
- `EC2_SSH_KEY` (rename to `PROD_EC2_SSH_KEY` - optional)

**Other secrets (shared or separate):**
- `DOCKERHUB_USERNAME` - Shared
- `DOCKERHUB_TOKEN` - Shared

---

### 3. GitHub Workflows Modifications

#### A. Update `.github/workflows/main.yml`

**Current Issues:**
- Deploys to production on `main` push
- No deployment for `dev` branch
- Only one environment configured

**Required Changes:**

```yaml
name: Main CI/CD Pipeline

on:
  push:
    branches:
      - main
      - dev
  pull_request:
    branches:
      - main
      - dev

jobs:
  # Detect which services have changed
  detect-changes:
    name: Detect Changed Services
    runs-on: ubuntu-latest
    outputs:
      incollab: ${{ steps.changes.outputs.incollab }}
      branch: ${{ steps.branch.outputs.name }}
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get branch name
        id: branch
        run: echo "name=${GITHUB_REF#refs/heads/}" >> $GITHUB_OUTPUT

      - name: Detect changes
        uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            incollab:
              - 'src/**'
              - 'package.json'
              - 'Dockerfile'
              - 'docker-compose.yml'
              - 'nginx.conf'

  # Incollab Build (runs for both branches)
  incollab-build:
    name: Build Incollab
    if: needs.detect-changes.outputs.incollab == 'true'
    needs: detect-changes
    uses: ./.github/workflows/build.yml
    with:
      service: "incollab"
      dockerfile_path: "./Dockerfile"
      context_path: "."

  # Incollab Test (runs for both branches)
  incollab-test:
    name: Test Incollab
    if: needs.detect-changes.outputs.incollab == 'true'
    needs: [detect-changes, incollab-build]
    uses: ./.github/workflows/test.yml
    with:
      service: "incollab"
      service_path: "."
      node_version: "18"

  # Push to Docker Hub (runs for both branches)
  incollab-push:
    name: Push Incollab Image
    if: needs.detect-changes.outputs.incollab == 'true' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/dev')
    needs: [detect-changes, incollab-test]
    uses: ./.github/workflows/push.yml
    with:
      service: "incollab"
      dockerfile_path: "./Dockerfile"
      context_path: "."
      image_tag: ${{ github.ref == 'refs/heads/main' && 'latest' || 'dev' }}
    secrets:
      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
      DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}

  # Deploy to STAGING (only for dev branch)
  incollab-deploy-staging:
    name: Deploy Incollab to Staging
    if: needs.detect-changes.outputs.incollab == 'true' && github.ref == 'refs/heads/dev'
    needs: [detect-changes, incollab-push]
    uses: ./.github/workflows/deploy.yml
    with:
      service: "incollab"
      environment: "staging"
      image_tag: "dev"
    secrets:
      EC2_HOST: ${{ secrets.STAGING_EC2_HOST }}
      EC2_USER: ${{ secrets.STAGING_EC2_USER }}
      EC2_SSH_KEY: ${{ secrets.STAGING_EC2_SSH_KEY }}
      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}

  # Deploy to PRODUCTION (only for main branch)
  incollab-deploy-production:
    name: Deploy Incollab to Production
    if: needs.detect-changes.outputs.incollab == 'true' && github.ref == 'refs/heads/main'
    needs: [detect-changes, incollab-push]
    uses: ./.github/workflows/deploy.yml
    with:
      service: "incollab"
      environment: "production"
      image_tag: "latest"
    secrets:
      EC2_HOST: ${{ secrets.EC2_HOST }}
      EC2_USER: ${{ secrets.EC2_USER }}
      EC2_SSH_KEY: ${{ secrets.EC2_SSH_KEY }}
      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}

  # Summary job
  pipeline-summary:
    name: Pipeline Summary
    if: always()
    needs: [
      detect-changes,
      incollab-build,
      incollab-test,
      incollab-push,
      incollab-deploy-staging,
      incollab-deploy-production
    ]
    runs-on: ubuntu-latest
    steps:
      - name: Print Summary
        run: |
          echo "### Pipeline Summary ###"
          echo "Branch: ${{ github.ref }}"
          echo "Incollab changed: ${{ needs.detect-changes.outputs.incollab }}"
          echo "Build: ${{ needs.incollab-build.result }}"
          echo "Test: ${{ needs.incollab-test.result }}"
          echo "Push: ${{ needs.incollab-push.result }}"
          if [ "${{ github.ref }}" == "refs/heads/dev" ]; then
            echo "Staging Deploy: ${{ needs.incollab-deploy-staging.result }}"
          elif [ "${{ github.ref }}" == "refs/heads/main" ]; then
            echo "Production Deploy: ${{ needs.incollab-deploy-production.result }}"
          fi
```

#### B. Update `.github/workflows/deploy.yml`

**Add image_tag input and update Docker image pulling:**

```yaml
name: Deploy

on:
  workflow_call:
    inputs:
      service:
        description: 'Service name Incollab'
        required: true
        type: string
      environment:
        description: 'Deployment environment (staging, production)'
        required: false
        type: string
        default: 'production'
      image_tag:
        description: 'Docker image tag (latest, dev)'
        required: false
        type: string
        default: 'latest'
      docker_compose_path:
        description: 'Path to docker-compose file on server'
        required: false
        type: string
        default: '/home/ubuntu/Incollabe-BE'
    secrets:
      EC2_HOST:
        required: true
      EC2_USER:
        required: true
      EC2_SSH_KEY:
        required: true
      DOCKERHUB_USERNAME:
        required: true

jobs:
  deploy:
    name: Deploy ${{ inputs.service }} to ${{ inputs.environment }}
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Copy deployment files to EC2
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.EC2_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H ${{ secrets.EC2_HOST }} >> ~/.ssh/known_hosts

          # Copy deployment files
          scp docker-compose.yml ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/home/ubuntu/Incollabe-BE/
          scp deploy.sh ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/home/ubuntu/Incollabe-BE/
          scp nginx.conf ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/home/ubuntu/Incollabe-BE/ || echo "nginx.conf not found, skipping"

      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          timeout: 300s
          script: |
            echo "Starting deployment of ${{ inputs.service }} to ${{ inputs.environment }}..."
            cd ${{ inputs.docker_compose_path }}

            # Make deploy script executable
            chmod +x deploy.sh

            # Update .env with Docker Hub credentials and image tag
            if grep -q "DOCKERHUB_USERNAME" .env; then
              sed -i "s/DOCKERHUB_USERNAME=.*/DOCKERHUB_USERNAME=${{ secrets.DOCKERHUB_USERNAME }}/" .env
            else
              echo "DOCKERHUB_USERNAME=${{ secrets.DOCKERHUB_USERNAME }}" >> .env
            fi

            if grep -q "IMAGE_TAG" .env; then
              sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=${{ inputs.image_tag }}/" .env
            else
              echo "IMAGE_TAG=${{ inputs.image_tag }}" >> .env
            fi

            if grep -q "ENVIRONMENT" .env; then
              sed -i "s/ENVIRONMENT=.*/ENVIRONMENT=${{ inputs.environment }}/" .env
            else
              echo "ENVIRONMENT=${{ inputs.environment }}" >> .env
            fi

            # Run deployment script
            ./deploy.sh

      - name: Health Check
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ${{ inputs.docker_compose_path }}
            echo "Performing health check for ${{ inputs.service }} in ${{ inputs.environment }}..."
            
            # Wait for service to be healthy
            sleep 10
            
            # Check if container is running
            if docker-compose ps ${{ inputs.service }} | grep -q "Up"; then
              echo "✅ Container is running successfully"
              
              # Try API health check
              if curl -f http://localhost/api 2>/dev/null; then
                echo "✅ API health check passed"
              else
                echo "⚠️ API health check failed, but container is running"
              fi
            else
              echo "❌ Container is not running"
              exit 1
            fi

      - name: Deployment Success Notification
        if: success()
        run: |
          echo "✅ Successfully deployed ${{ inputs.service }} to ${{ inputs.environment }}"
          echo "Environment: ${{ inputs.environment }}"
          echo "Image Tag: ${{ inputs.image_tag }}"
          echo "Host: ${{ secrets.EC2_HOST }}"
```

---

### 4. Docker Configuration Updates

#### A. Update `docker-compose.yml`

**Add environment variable for image tag:**

```yaml
version: '3.8'

services:
  incollab-app:
    image: ${DOCKERHUB_USERNAME}/incollab:${IMAGE_TAG:-latest}
    container_name: incollab-app
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - ENVIRONMENT=${ENVIRONMENT:-production}
    ports:
      - "3002:3002"
    networks:
      - incollab-network
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: incollab-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - incollab-app
    networks:
      - incollab-network

networks:
  incollab-network:
    driver: bridge
```

#### B. Update `.env` files

**Production `.env` (on prod EC2):**
```bash
# Docker
DOCKERHUB_USERNAME=your-dockerhub-username
IMAGE_TAG=latest

# Environment
NODE_ENV=production
ENVIRONMENT=production

# Database (Production)
DB_HOST=prod-db-host
DB_PORT=5432
DB_NAME=incollab_prod
DB_USER=prod_user
DB_PASSWORD=prod_password

# Redis (Production)
REDIS_HOST=prod-redis-host
REDIS_PORT=6379

# ... other production configs
```

**Staging `.env` (on staging EC2):**
```bash
# Docker
DOCKERHUB_USERNAME=your-dockerhub-username
IMAGE_TAG=dev

# Environment
NODE_ENV=staging
ENVIRONMENT=staging

# Database (Staging)
DB_HOST=staging-db-host
DB_PORT=5432
DB_NAME=incollab_staging
DB_USER=staging_user
DB_PASSWORD=staging_password

# Redis (Staging)
REDIS_HOST=staging-redis-host
REDIS_PORT=6379

# ... other staging configs
```

---

### 5. Deploy Script Updates

#### A. Update `deploy.sh` (Optional Enhancement)

**Add environment detection:**

```bash
#!/bin/bash

# Deploy script for BMB Backend
# This script is executed on EC2 instance to deploy the latest version

set -e  # Exit on any error

# Configuration
APP_DIR="/home/ubuntu/Incollabe-BE"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Detect environment from .env
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    DEPLOY_ENV="${ENVIRONMENT:-production}"
else
    DEPLOY_ENV="production"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] [$DEPLOY_ENV] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] [$DEPLOY_ENV] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [$DEPLOY_ENV] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] [$DEPLOY_ENV] INFO: $1${NC}"
}

# Rest of the deploy script remains the same...
```

---

### 6. GitHub Environments Configuration

#### A. Create Environments in GitHub

**Go to:** GitHub Repo → Settings → Environments

**Create two environments:**

1. **`staging`**
   - Protection rules (optional):
     - No required reviewers
     - Wait timer: 0 minutes
   - Environment secrets (if different from repo secrets):
     - Can override repo-level secrets here

2. **`production`**
   - Protection rules (recommended):
     - Required reviewers: 1-2 people
     - Wait timer: 0-5 minutes
   - Environment secrets (if different from repo secrets):
     - Override if needed

---

## Step-by-Step Implementation Guide

### Phase 1: Infrastructure Setup (Day 1)
1. ✅ Launch new staging EC2 instance
2. ✅ Install Docker and Docker Compose on staging
3. ✅ Create application directory structure
4. ✅ Copy and configure staging `.env` file
5. ✅ Set up staging database (if separate)
6. ✅ Test SSH access to both EC2 instances

### Phase 2: GitHub Configuration (Day 1)
1. ✅ Add staging EC2 secrets to GitHub
   - `STAGING_EC2_HOST`
   - `STAGING_EC2_USER`
   - `STAGING_EC2_SSH_KEY`
2. ✅ Create GitHub environments (staging, production)
3. ✅ Configure environment protection rules

### Phase 3: CI/CD Updates (Day 1-2)
1. ✅ Update `.github/workflows/main.yml`
   - Add staging deployment job
   - Update production deployment condition
   - Add image tag handling
2. ✅ Update `.github/workflows/deploy.yml`
   - Add `image_tag` input
   - Add environment variables in deployment
3. ✅ Update `docker-compose.yml`
   - Use `IMAGE_TAG` environment variable
4. ✅ Commit and push changes to `dev` branch

### Phase 4: Testing (Day 2)
1. ✅ Push to `dev` branch
   - Verify build succeeds
   - Verify tests pass
   - Verify `dev` tag image is pushed to Docker Hub
   - Verify deployment to staging EC2
2. ✅ Test staging environment
   - Check API endpoints
   - Verify database connectivity
   - Test core functionality
3. ✅ Merge `dev` to `main`
   - Verify build succeeds
   - Verify `latest` tag image is pushed
   - Verify deployment to production EC2
4. ✅ Test production environment
   - Verify no breaking changes

---

## Deployment Workflow After Setup

### For Staging (dev branch):
```bash
# Work on feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "Add new feature"

# Push feature branch (triggers tests only)
git push origin feature/new-feature

# Create PR to dev
# After review, merge to dev

# This automatically triggers:
# 1. Build → Test → Push (dev tag) → Deploy to Staging
```

### For Production (main branch):
```bash
# After testing on staging, create PR from dev to main
git checkout dev
git pull origin dev

# Create PR: dev → main

# After approval and merge:
# This automatically triggers:
# 1. Build → Test → Push (latest tag) → Deploy to Production
```

---

## Environment Variables Checklist

### Staging EC2 `.env`:
- [ ] `DOCKERHUB_USERNAME`
- [ ] `IMAGE_TAG=dev`
- [ ] `ENVIRONMENT=staging`
- [ ] `NODE_ENV=staging`
- [ ] Staging database credentials
- [ ] Staging Redis credentials
- [ ] Staging S3 bucket (if different)
- [ ] Staging API keys (if different)

### Production EC2 `.env`:
- [ ] `DOCKERHUB_USERNAME`
- [ ] `IMAGE_TAG=latest`
- [ ] `ENVIRONMENT=production`
- [ ] `NODE_ENV=production`
- [ ] Production database credentials
- [ ] Production Redis credentials
- [ ] Production S3 bucket
- [ ] Production API keys

---

## Rollback Strategy

### If Staging Deployment Fails:
```bash
# SSH to staging EC2
ssh ubuntu@<STAGING_EC2_IP>
cd /home/ubuntu/Incollabe-BE

# Rollback to previous image
docker-compose down
docker-compose pull  # or specify previous tag
docker-compose up -d
```

### If Production Deployment Fails:
```bash
# SSH to production EC2
ssh ubuntu@<PROD_EC2_IP>
cd /home/ubuntu/Incollabe-BE

# Quick rollback
docker-compose down
sed -i 's/IMAGE_TAG=latest/IMAGE_TAG=<PREVIOUS_TAG>/' .env
docker-compose up -d
```

---

## Monitoring and Verification

### After Each Deployment:

1. **Check Container Status:**
   ```bash
   docker-compose ps
   docker-compose logs -f incollab-app
   ```

2. **API Health Check:**
   ```bash
   curl http://localhost/api
   curl http://<DOMAIN>/api
   ```

3. **Check Database Connectivity:**
   ```bash
   docker-compose exec incollab-app npm run db:test
   ```

4. **Monitor Logs:**
   ```bash
   tail -f logs/combined/*.log
   tail -f logs/error/*.log
   ```

---

## Cost Considerations

### Additional Costs for Staging:
- EC2 instance: ~$15-30/month (t3.small/medium)
- EBS storage: ~$5-10/month
- Data transfer: Minimal
- **Total: ~$20-40/month**

### Cost Savings:
- Can use smaller instance for staging (t3.small)
- Can stop staging EC2 when not in use
- Can use RDS multi-AZ only for production

---

## Security Best Practices

1. **Separate SSH Keys:**
   - Use different SSH key pairs for staging and production
   - Rotate keys regularly

2. **Separate Database Credentials:**
   - Never use production DB credentials in staging
   - Use read-only replicas for staging (optional)

3. **Environment Isolation:**
   - Separate VPCs for staging and production (optional)
   - Different security groups

4. **Secrets Management:**
   - Use GitHub environment secrets
   - Never commit `.env` files to git

---

## Troubleshooting

### Issue: Staging deployment fails with "image not found"
**Solution:** Check if Docker Hub push succeeded and image tag is correct

### Issue: Cannot SSH to staging EC2
**Solution:** Verify security group allows SSH (port 22), check SSH key is correct

### Issue: Database connection fails on staging
**Solution:** Verify staging DB credentials in `.env`, check security group rules

### Issue: Both environments deploying same image
**Solution:** Verify `IMAGE_TAG` is set correctly in each `.env` file

---

## Next Steps After Implementation

1. **Set up monitoring:**
   - CloudWatch for EC2 metrics
   - Application Performance Monitoring (APM)
   - Log aggregation (ELK/Grafana)

2. **Add automated tests:**
   - Integration tests on staging
   - Smoke tests after deployment
   - Performance testing

3. **Improve deployment:**
   - Blue-green deployment
   - Canary releases
   - Automated rollback on failure

4. **Documentation:**
   - Update team wiki
   - Create runbook for common issues
   - Document environment differences

---

## Summary of Key Changes

| File/Resource | Change Required | Priority |
|---------------|----------------|----------|
| New Staging EC2 | Launch and configure | 🔴 Critical |
| GitHub Secrets | Add `STAGING_EC2_*` secrets | 🔴 Critical |
| `.github/workflows/main.yml` | Add staging deployment job | 🔴 Critical |
| `.github/workflows/deploy.yml` | Add `image_tag` input | 🔴 Critical |
| `docker-compose.yml` | Use `IMAGE_TAG` variable | 🟡 Important |
| GitHub Environments | Create staging/production | 🟡 Important |
| Staging `.env` | Configure with staging values | 🔴 Critical |
| Production `.env` | Add `IMAGE_TAG=latest` | 🟡 Important |
| DNS Records | Add staging subdomain | 🟢 Optional |
| `deploy.sh` | Add environment detection | 🟢 Optional |

---

**Total Estimated Time:** 4-6 hours
**Estimated Cost:** $20-40/month additional

**Questions?** Review each section carefully and test in non-production first!
