# Fork & Push Instructions

## Step 1: Create Your Fork

1. Go to https://github.com/umami-software/umami
2. Click "Fork" button (top right)
3. This creates a copy in your account: `https://github.com/YOUR_USERNAME/umami`

## Step 2: Add Your Fork as Remote

```bash
# In your local umami directory:
cd /Users/rob/Developer/umami

# Add your fork as remote (replace YOUR_USERNAME)
git remote add fork https://github.com/YOUR_USERNAME/umami.git

# Verify remotes
git remote -v
# Should show:
# origin  https://github.com/umami-software/umami.git
# fork    https://github.com/YOUR_USERNAME/umami.git
```

## Step 3: Push to Your Fork

```bash
# Push your branch to your fork
git push fork feature/multi-domain-support

# Verify it pushed
# Visit: https://github.com/YOUR_USERNAME/umami/tree/feature/multi-domain-support
```

## Step 4: Deploy with Dokploy

1. Login to your dokploy panel
2. Create new application
3. Select repository: `YOUR_USERNAME/umami`
4. Select branch: `feature/multi-domain-support`
5. Set environment variables:
   ```
   DATABASE_URL=postgresql://...
   APP_SECRET=...
   UMAMI_HOST=umami-dev.athas.mx
   ```
6. Deploy!

## Optional: Sync Upstream Changes

To keep your fork in sync with original umami repo:

```bash
# Add upstream if not exists
git remote add upstream https://github.com/umami-software/umami.git

# Fetch latest changes
git fetch upstream

# Merge into your branch
git checkout feature/multi-domain-support
git merge upstream/main

# Push to your fork
git push fork feature/multi-domain-support
```

## Current Git Status

```bash
# Check current status
git status

# See current branch
git branch

# View recent commits
git log --oneline -5
```
