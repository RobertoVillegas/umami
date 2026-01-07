# Multi-Domain Deployment Guide

## Prerequisites

- Forked Umami repository with multi-domain changes
- VPS access (Ubuntu/Debian)
- PostgreSQL database (or managed DB)
- Redis (optional, for DNS caching)
- Domain DNS access

## Deployment Options

### Option 1: Docker (Recommended for Production)

Use your fork in docker-compose.yml:

```yaml
services:
  umami:
    image: YOUR_USERNAME/umami:multi-domain  # Your fork
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/umami
      APP_SECRET: your-random-secret
      UMAMI_HOST: umami-dev.athas.mx  # YOUR VPS HOSTNAME
      LINKS_URL: https://umami-dev.athas.mx/q
      PIXELS_URL: https://umami-dev.athas.mx/p
```

### Option 2: Bare Metal (VPS Direct)

```bash
# On your VPS:

# 1. Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/umami.git
cd umami
git checkout feature/multi-domain-support

# 3. Install dependencies
npm install

# 4. Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://user:password@localhost:5432/umami
APP_SECRET=your-random-secret-here-at-least-32-chars
UMAMI_HOST=umami-dev.athas.mx
EOF

# 5. Build the application
npm run build

# 6. Run database migrations
npx prisma migrate deploy

# 7. Start with PM2 (recommended for production)
npm install -g pm2
pm2 start npm --name "umami" -- start

# 8. Setup nginx reverse proxy
sudo nano /etc/nginx/sites-available/umami-dev
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name umami-dev.athas.mx;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/umami-dev /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 3: Dokploy (Easiest)

If using dokploy with your fork:

1. **Push your branch to your fork**
```bash
git remote add fork https://github.com/YOUR_USERNAME/umami.git
git push fork feature/multi-domain-support
```

2. **In dokploy panel**:
- Create new application
- Select your fork
- Branch: `feature/multi-domain-support`
  - Set environment variables:
  ```
  DATABASE_URL=postgresql://...
  APP_SECRET=...
  UMAMI_HOST=umami-dev.athas.mx
  ```

3. **Deploy**

## DNS Configuration for Multi-Domain

For each custom domain (e.g., `links.yourdomain.com`):

### 1. Add CNAME Record

```
Type: CNAME
Name: links
Value: umami-dev.athas.mx
TTL: 3600 (or default)
```

### 2. Wait for DNS Propagation

DNS changes can take 10 minutes to 48 hours. Check with:
```bash
dig links.yourdomain.com CNAME +short
```

### 3. Verify in Umami

1. Login to Umami
2. Navigate to `/domains`
3. Click "Add Domain"
4. Enter `links.yourdomain.com`
5. Save
6. Click "Verify DNS"
7. Should show: "Domain verified ✓"

## Testing Locally Without DNS

Since you can't actually point DNS to localhost, you can test the UI:

### Option 1: Use `/etc/hosts` (Mac/Linux)

Add to `/etc/hosts`:
```
127.0.0.1 test.example.com
```

Then `http://test.example.com:3000` will point to localhost.

### Option 2: Mock DNS Verification

Modify `src/lib/dns.ts` temporarily:
```typescript
export async function verifyDomainDNS(domain: string): Promise<DNSVerificationResult> {
  // Always return verified for testing
  return { verified: true, cnameTarget: 'umami-dev.athas.mx' };
}
```

### Option 3: Skip DNS Verification

Test the domain creation UI without verifying:
- Add domain
- See DNS instructions
- Don't click verify
- Edit/delete domain
- Verify the table shows domains correctly

## Recommended Deployment Flow

1. **Fork** umami-software/umami to your GitHub
2. **Push** your multi-domain changes to `feature/multi-domain-support` branch
3. **Use dokploy** to deploy from your fork
4. **Configure** umami-dev.athas.mx with proper env vars
5. **Add domain** in Umami UI
6. **Configure DNS** CNAME to point to umami-dev.athas.mx
7. **Verify** DNS in Umami
8. **Create links** using the custom domain

## Environment Variables Explained

### Required
- `DATABASE_URL`: PostgreSQL connection string
- `APP_SECRET`: Secret for session encryption (generate with `openssl rand -base64 32`)

### Optional (Recommended)
- `UMAMI_HOST`: Your VPS hostname (what CNAME should point TO)
  - Used for DNS verification to check if domain points to your instance
  - Example: `umami-dev.athas.mx`
  - **Without this, DNS verification will fail**

### Auto-Generated (Don't Set These)
These are automatically generated from `globalThis?.location?.origin`:
- `LINKS_URL`: Auto-generated as `${origin}/q`
- `PIXELS_URL`: Auto-generated as `${origin}/p`

You only need to set these if you want to override auto-detection.

### Note on Redis
- **Redis is NOT required** for multi-domain feature
- DNS verification works without any caching
- All references to Redis have been removed from implementation

## Troubleshooting

### DNS Verification Fails

Check if CNAME points correctly:
```bash
dig YOUR_DOMAIN CNAME +short
# Should return: umami-dev.athas.mx
```

### Database Migration Fails

```bash
# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# Or manually apply migration
npx prisma db execute --file prisma/migrations/15_add_multi_domain_support/migration.sql
```

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```
