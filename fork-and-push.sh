#!/bin/bash

echo "🚀 Umami Multi-Domain - Fork & Push Script"
echo ""
echo "=========================================="
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Current branch: $CURRENT_BRANCH"

# Check if fork remote exists
if git remote get-url fork > /dev/null 2>&1; then
  echo "✅ Fork remote already exists"
  FORK_URL=$(git remote get-url fork)
  echo "📍 Fork URL: $FORK_URL"
else
  echo ""
  echo "⚠️  No fork remote found."
  echo ""
  echo "STEP 1: Fork the repository"
  echo "→ Open: https://github.com/umami-software/umami"
  echo "→ Click 'Fork' button (top right)"
  echo "→ Replace 'YOUR_USERNAME' below with your actual GitHub username"
  echo ""

  read -p "Enter your GitHub username: " GITHUB_USERNAME

  if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ Username is required!"
    exit 1
  fi

  FORK_URL="https://github.com/$GITHUB_USERNAME/umami.git"
  echo ""
  echo "🔗 Adding fork remote: $FORK_URL"
  git remote add fork "$FORK_URL"
  echo "✅ Fork remote added!"
fi

echo ""
echo "=========================================="
echo ""
echo "STEP 2: Add all files"
git add .

echo ""
echo "=========================================="
echo ""
echo "STEP 3: Commit changes"
git commit -m "feat: add multi-domain support for short links

- Add Domain model with user/team ownership
- DNS verification with CNAME lookup
- Domain CRUD API endpoints
- Frontend UI for domain management
- Primary domain support
- DNS verification status tracking
- Added UMAMI_HOST env var for DNS verification

Co-authored-by: OpenCode AI <ai@opencode.ai>"

echo ""
echo "=========================================="
echo ""
echo "STEP 4: Push to your fork"
echo "→ This will push to: feature/multi-domain-support branch"
echo ""

if git push fork feature/multi-domain-support; then
  echo ""
  echo "✅ SUCCESS! Changes pushed to your fork!"
  echo ""
  echo "📋 Your fork URL: https://github.com/$GITHUB_USERNAME/umami"
  echo "📋 Branch URL: https://github.com/$GITHUB_USERNAME/umami/tree/feature/multi-domain-support"
  echo ""
  echo "🚀 Next steps:"
  echo "1. Deploy using dokploy with your fork"
  echo "2. Configure environment variables:"
  echo "   - DATABASE_URL"
  echo "   - APP_SECRET"
  echo "   - UMAMI_HOST=umami-dev.athas.mx"
  echo ""
  echo "3. Configure DNS CNAME to point to your VPS"
  echo ""
else
  echo ""
  echo "❌ Push failed. Check the error above."
  echo ""
  echo "Common issues:"
  echo "- Make sure you forked the repo on GitHub first"
  echo "- Check your GitHub credentials are configured"
  echo "- Try: git config --global user.name 'Your Name'"
  echo "        git config --global user.email 'your@email.com'"
  echo ""
  exit 1
fi
