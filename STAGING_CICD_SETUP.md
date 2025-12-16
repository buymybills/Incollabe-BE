# CI/CD Staging Setup - Dev Branch Deployment

## ✅ Changes Made

I've updated your CI/CD pipeline so that:
- **`dev` branch** → Automatically deploys to **staging** (same EC2 instance you're currently using)
- **`main` branch** → Will deploy to **production** (when you set up a separate production EC2)

---

## 🔄 How It Works Now

### For Staging (dev branch):
```
Push to dev branch
  ↓
GitHub Actions detects changes
  ↓
Builds Docker image
  ↓
Runs tests
  ↓
Pushes image to Docker Hub with tag "dev"
  ↓
Deploys to EC2 using existing secrets:
  - EC2_HOST
  - EC2_USER
  - EC2_SSH_KEY
```

### For Production (main branch):
```
Push to main branch
  ↓
GitHub Actions detects changes
  ↓
Builds Docker image
  ↓
Runs tests
  ↓
Pushes image to Docker Hub with tag "latest"
  ↓
Deploys to Production EC2 using new secrets:
  - PROD_EC2_HOST
  - PROD_EC2_USER
  - PROD_EC2_SSH_KEY
```

---

## 📋 Files Modified

### 1. `.github/workflows/main.yml`
**Changes:**
- Split deployment into two jobs:
  - `incollab-deploy-staging` (for dev branch)
  - `incollab-deploy-production` (for main branch)
- Staging uses `image_tag: "dev"`
- Production uses `image_tag: "latest"`
- Production will use separate secrets: `PROD_EC2_HOST`, `PROD_EC2_USER`, `PROD_EC2_SSH_KEY`

### 2. `.github/workflows/deploy.yml`
**Changes:**
- Added `image_tag` input parameter
- Now accepts and uses the correct Docker image tag during deployment
- Updates `.env` file on EC2 with the correct `IMAGE_TAG`

---

## 🚀 Usage

### Deploy to Staging:
```bash
# Make changes on dev branch
git checkout dev
# ... make your changes ...
git add .
git commit -m "Your changes"
git push origin dev

# GitHub Actions will automatically:
# 1. Build and test
# 2. Push image with "dev" tag
# 3. Deploy to your current EC2 (staging)
```

### Deploy to Production (Future):
```bash
# Merge dev to main
git checkout main
git merge dev
git push origin main

# GitHub Actions will automatically:
# 1. Build and test
# 2. Push image with "latest" tag
# 3. Deploy to production EC2 (when configured)
```

---

## 🔧 Current GitHub Secrets (Staging)

Your **existing secrets** are used for staging:
```
EC2_HOST → Your current EC2 IP
EC2_USER → ubuntu
EC2_SSH_KEY → Your SSH private key
DOCKERHUB_USERNAME → Your Docker Hub username
DOCKERHUB_TOKEN → Your Docker Hub token
```

✅ **No changes needed** - staging will work with your current setup!

---

## 🆕 Future Production Setup

When you're ready to set up production, you'll need to add these **new secrets** in GitHub:

1. Go to **GitHub** → Your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"** and add:

```
PROD_EC2_HOST → Your production EC2 IP
PROD_EC2_USER → ubuntu (or your production user)
PROD_EC2_SSH_KEY → Your production SSH private key
```

---

## 📊 Deployment Flow Summary

| Branch | Environment | Docker Tag | EC2 Secrets | Auto-Deploy |
|--------|-------------|------------|-------------|-------------|
| **dev** | Staging | `dev` | `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` | ✅ Yes |
| **main** | Production | `latest` | `PROD_EC2_HOST`, `PROD_EC2_USER`, `PROD_EC2_SSH_KEY` | ✅ Yes (when secrets added) |

---

## ✅ Testing the Setup

### Test Staging Deployment:

1. **Make a small change on dev branch:**
   ```bash
   git checkout dev
   echo "# Test change" >> README.md
   git add README.md
   git commit -m "test: staging deployment"
   git push origin dev
   ```

2. **Watch GitHub Actions:**
   - Go to your GitHub repository
   - Click **"Actions"** tab
   - You should see the workflow running
   - It will: Build → Test → Push → **Deploy to Staging**

3. **Verify on EC2:**
   ```bash
   ssh ubuntu@<YOUR_EC2_IP>
   cd /home/ubuntu/Incollabe-BE
   docker-compose ps
   # Should show container running with "dev" tag
   
   grep IMAGE_TAG .env
   # Should show: IMAGE_TAG=dev
   ```

---

## 🎯 What This Solves

✅ **Automatic staging deployment** from dev branch  
✅ **Separate staging and production environments**  
✅ **Different Docker image tags** (dev vs latest)  
✅ **No manual deployment needed** - just push to dev  
✅ **Production-ready workflow** for when you add prod EC2  

---

## 🔍 Troubleshooting

### If deployment fails:

1. **Check GitHub Actions logs:**
   - Go to **Actions** tab in GitHub
   - Click on the failed workflow
   - Check which step failed

2. **Common issues:**
   - **SSH connection failed:** Check `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` secrets
   - **Docker image not found:** Check `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`
   - **Container won't start:** Check `.env` file on EC2 for correct `IMAGE_TAG`

3. **Manual deployment (if needed):**
   ```bash
   ssh ubuntu@<YOUR_EC2_IP>
   cd /home/ubuntu/Incollabe-BE
   ./deploy.sh
   ```

---

## 📝 Next Steps

1. ✅ **Test the setup** by pushing to dev branch
2. ✅ **Verify deployment** on your EC2 instance
3. ✅ **Update RDS credentials** in `.env` (as discussed)
4. ⏳ **When ready for production:**
   - Set up separate production EC2
   - Add `PROD_EC2_*` secrets to GitHub
   - Push to main branch

---

## 🎉 Summary

Your staging environment is now fully automated:
- **Push to dev** → Automatic deployment to staging EC2
- **Push to main** → Ready for production (when configured)
- **Same EC2** for staging (no additional infrastructure needed)
- **Zero downtime** - deployment script handles rolling updates

You can now develop on `dev` branch and see changes automatically deployed to staging! 🚀
