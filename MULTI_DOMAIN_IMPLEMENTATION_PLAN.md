# Multi-Domain Support Implementation Plan

**✅ UPDATED:** This plan has been fully aligned with Umami's codebase patterns and conventions.

**Key Alignment Updates:**
- ✅ Frontend components use DialogButton pattern (not custom modals)
- ✅ React Query hooks use useModified() and touch() for cache invalidation
- ✅ Forms use @umami/react-zen components and useUpdateQuery()
- ✅ All text internationalized via useMessages()
- ✅ Next.js 15 async params handling
- ✅ DataTable and DataGrid patterns for list views
- ✅ Exact file structure matches Links/Pixels features

**Last Updated:** 2026-01-06

---

## Table of Contents
- [1. Overview & Requirements](#1-overview--requirements)
- [2. Architecture Design](#2-architecture-design)
- [3. Database Schema Changes](#3-database-schema-changes)
- [4. DNS Verification System](#4-dns-verification-system)
- [5. API Endpoints Specification](#5-api-endpoints-specification)
- [6. Backend Services & Utilities](#6-backend-services--utilities)
- [7. Frontend Components](#7-frontend-components)
- [8. Integration Points](#8-integration-points)
- [9. Implementation Tasks](#9-implementation-tasks)
- [10. Testing Requirements](#10-testing-requirements)

---

## 1. Overview & Requirements

### 1.1 Goal
Enable users and teams to configure multiple custom domains for generating short links and tracking pixels, similar to Dub.co's domain management system.

### 1.2 Core Requirements

**Functional Requirements:**
- ✅ Users/teams can add multiple custom domains
- ✅ DNS verification: Check that domain points to Umami instance via CNAME record
- ✅ Domain ownership: Each domain owned by exactly one user OR one team
- ✅ Domain selection: Choose which domain to use per link/pixel
- ✅ Primary domain: Each user/team has one primary domain (default for new links)
- ✅ CRUD operations: Full domain management interface
- ✅ DNS status indicators: Show configuration status and instructions
- ✅ Click tracking: Track statistics per domain

**Non-Functional Requirements:**
- DNS verification does NOT check ownership - only checks correct DNS setup
- DNS checks performed via CNAME lookup (pointing to Umami instance)
- Real-time DNS verification with caching
- Graceful handling of DNS propagation delays (up to 12 hours)
- Support for both apex domains and subdomains

### 1.3 User Flow Example

```
User adds domain: test.roberto.lol
    ↓
System shows DNS instructions:
  Type: CNAME
  Name: test
  Value: umami.athas.mx (user's Umami instance)
  TTL: 86400
    ↓
User configures DNS at their provider
    ↓
User clicks "Verify DNS"
    ↓
System performs CNAME lookup
    ↓
If CNAME points to umami.athas.mx → Status: "Verified ✓"
If CNAME not found/incorrect → Status: "Not configured ❌"
    ↓
Once verified, domain available for link creation
    ↓
User creates link, selects test.roberto.lol
    ↓
Generated link: https://test.roberto.lol/q/abc123
```

---

## 2. Architecture Design

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Domain Manager │  │ Link Edit Form  │  │ Domain Badge │ │
│  │   (CRUD UI)    │  │ (w/ selector)   │  │  (Status)    │ │
│  └────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ /api/domains    │  │ /api/links       │  │ /api/config│ │
│  │ (CRUD)          │  │ (w/ domainId)    │  │ (defaults) │ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │ DNS Verification │  │ Domain Queries  │  │ Link Svc   │ │
│  │ Service          │  │ (Prisma)        │  │ (updated)  │ │
│  └──────────────────┘  └─────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │ Domain Model     │  │ Link Model      │  │ Pixel Model│ │
│  │ (new)            │  │ (+ domainId)    │  │ (+ domainId│ │
│  └──────────────────┘  └─────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌──────────────────┐  ┌─────────────────┐                  │
│  │ DNS Resolver     │  │ Redis Cache     │                  │
│  │ (CNAME lookup)   │  │ (DNS results)   │                  │
│  └──────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Domain Creation Flow:**
```
User submits domain → Validate format → Check uniqueness →
Create DB record (verified: false) → Return domain with instructions →
User sees CNAME setup instructions → User configures DNS →
User triggers verification → DNS lookup → Update verified status →
Domain ready for use
```

**Link Creation with Domain Flow:**
```
User creates link → Selects domain (or uses primary) →
Validate domain ownership → Check domain verified →
Create link with domainId → Generate URL using domain →
Return: https://{domain.name}/q/{slug}
```

**Link Access Flow:**
```
Request: https://test.roberto.lol/q/abc123 →
Lookup link by slug → Record click event (with domain context) →
Redirect to destination URL
```

### 2.3 Key Design Decisions

**Decision 1: Domain Ownership Model**
- Each domain belongs to ONE user OR ONE team (exclusive, not both)
- Similar to Link model pattern (userId XOR teamId)
- Enforced via database constraints and API validation

**Decision 2: DNS Verification Approach**
- Check CNAME record points to user's Umami instance
- User's instance hostname from environment variable: `UMAMI_HOST` or inferred from `LINKS_URL`
- No ownership validation (not checking domain registrar)
- TTL recommended: 86400 (24 hours), but accept any value

**Decision 3: Verification Storage**
- `verified` boolean flag in Domain model
- `lastCheckedAt` timestamp for tracking verification attempts
- `verifiedAt` timestamp for when domain was first verified
- Allow re-verification at any time

**Decision 4: Link-Domain Relationship**
- `domainId` nullable foreign key in Link/Pixel models
- If null, use global default from env variables (LINKS_URL/PIXELS_URL)
- If set, use domain name from Domain model
- Cascade behavior: SET NULL on domain deletion (links keep working with default)

**Decision 5: Primary Domain Logic**
- Each user/team can mark ONE domain as primary
- Primary domain auto-selected in link creation UI
- Enforced at application level (not DB constraint, for flexibility)
- Global default (from env) used if no primary domain set

---

## 3. Database Schema Changes

### 3.1 New Domain Model

**Prisma Schema Addition** (`prisma/schema.prisma`):

```prisma
model Domain {
  id             String    @id() @unique() @map("domain_id") @db.Uuid
  name           String    @unique() @db.VarChar(255)
  description    String?   @db.VarChar(500)
  isPrimary      Boolean   @default(false) @map("is_primary")
  verified       Boolean   @default(false)
  verifiedAt     DateTime? @map("verified_at") @db.Timestamptz(6)
  lastCheckedAt  DateTime? @map("last_checked_at") @db.Timestamptz(6)
  userId         String?   @map("user_id") @db.Uuid
  teamId         String?   @map("team_id") @db.Uuid
  createdAt      DateTime? @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  user   User?   @relation("userDomains", fields: [userId], references: [id])
  team   Team?   @relation("teamDomains", fields: [teamId], references: [id])
  links  Link[]  @relation("domainLinks")
  pixels Pixel[] @relation("domainPixels")

  @@index([name])
  @@index([userId])
  @@index([teamId])
  @@index([verified])
  @@index([isPrimary])
  @@index([createdAt])
  @@map("domain")
}
```

**Field Explanations:**
- `id`: UUID primary key
- `name`: Domain name (e.g., "test.roberto.lol", "links.example.com")
- `description`: Optional user description for organization
- `isPrimary`: Whether this is the default domain for the user/team
- `verified`: DNS configuration verified
- `verifiedAt`: Timestamp when domain was first verified
- `lastCheckedAt`: Last DNS check attempt timestamp
- `userId` / `teamId`: Exclusive ownership (one must be null)
- Standard audit fields: createdAt, updatedAt, deletedAt

**Constraints & Validation:**
- `name` must be unique across all domains
- Exactly one of `userId` or `teamId` must be set (enforced in API)
- Multiple domains can exist per user/team, but only one with `isPrimary = true`
- Soft delete pattern (deletedAt) for historical tracking

### 3.2 Updated Link Model

**Changes to Link Model** (`prisma/schema.prisma`):

```prisma
model Link {
  id        String    @id() @unique() @map("link_id") @db.Uuid
  name      String    @db.VarChar(100)
  url       String    @db.VarChar(500)
  slug      String    @unique() @db.VarChar(100)
  domainId  String?   @map("domain_id") @db.Uuid        // NEW FIELD
  userId    String?   @map("user_id") @db.Uuid
  teamId    String?   @map("team_id") @db.Uuid
  createdAt DateTime? @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  domain Domain? @relation("domainLinks", fields: [domainId], references: [id], onDelete: SetNull)  // NEW RELATION
  user   User?   @relation("user", fields: [userId], references: [id])
  team   Team?   @relation(fields: [teamId], references: [id])

  @@index([slug])
  @@index([domainId])  // NEW INDEX
  @@index([userId])
  @@index([teamId])
  @@index([createdAt])
  @@map("link")
}
```

**Migration Notes:**
- `domainId` is nullable (existing links work with default domain)
- `onDelete: SetNull` ensures links survive domain deletion
- New index on `domainId` for efficient domain-based queries

### 3.3 Updated Pixel Model

**Changes to Pixel Model** (`prisma/schema.prisma`):

```prisma
model Pixel {
  id        String    @id() @unique() @map("pixel_id") @db.Uuid
  name      String    @db.VarChar(100)
  slug      String    @unique() @db.VarChar(100)
  domainId  String?   @map("domain_id") @db.Uuid        // NEW FIELD
  userId    String?   @map("user_id") @db.Uuid
  teamId    String?   @map("team_id") @db.Uuid
  createdAt DateTime? @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  domain Domain? @relation("domainPixels", fields: [domainId], references: [id], onDelete: SetNull)  // NEW RELATION
  user   User?   @relation("user", fields: [userId], references: [id])
  team   Team?   @relation(fields: [teamId], references: [id])

  @@index([slug])
  @@index([domainId])  // NEW INDEX
  @@index([userId])
  @@index([teamId])
  @@index([createdAt])
  @@map("pixel")
}
```

### 3.4 Updated User & Team Models

**Changes to User Model** (`prisma/schema.prisma`):

```prisma
model User {
  id          String    @id @unique @map("user_id") @db.Uuid
  // ... existing fields ...

  websites  Website[]  @relation("user")
  createdBy Website[]  @relation("createUser")
  links     Link[]     @relation("user")
  pixels    Pixel[]    @relation("user")
  domains   Domain[]   @relation("userDomains")  // NEW RELATION
  teams     TeamUser[]
  reports   Report[]

  @@map("user")
}
```

**Changes to Team Model** (`prisma/schema.prisma`):

```prisma
model Team {
  id         String    @id() @unique() @map("team_id") @db.Uuid
  // ... existing fields ...

  websites Website[]
  members  TeamUser[]
  links    Link[]
  pixels   Pixel[]
  domains  Domain[]   @relation("teamDomains")  // NEW RELATION

  @@index([accessCode])
  @@map("team")
}
```

### 3.5 Database Migration Strategy

**Migration File Structure:**
```
prisma/migrations/
  └── YYYYMMDDHHMMSS_add_multi_domain_support/
      └── migration.sql
```

**Migration SQL** (`migration.sql`):

```sql
-- Create Domain table
CREATE TABLE "domain" (
  "domain_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" VARCHAR(500),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMPTZ(6),
  "last_checked_at" TIMESTAMPTZ(6),
  "user_id" UUID,
  "team_id" UUID,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "domain_pkey" PRIMARY KEY ("domain_id")
);

-- Add unique constraint on name
CREATE UNIQUE INDEX "domain_name_key" ON "domain"("name");

-- Add indexes for performance
CREATE INDEX "domain_domain_id_idx" ON "domain"("domain_id");
CREATE INDEX "domain_name_idx" ON "domain"("name");
CREATE INDEX "domain_user_id_idx" ON "domain"("user_id");
CREATE INDEX "domain_team_id_idx" ON "domain"("team_id");
CREATE INDEX "domain_verified_idx" ON "domain"("verified");
CREATE INDEX "domain_is_primary_idx" ON "domain"("is_primary");
CREATE INDEX "domain_created_at_idx" ON "domain"("created_at");

-- Add domainId to Link table
ALTER TABLE "link" ADD COLUMN "domain_id" UUID;
CREATE INDEX "link_domain_id_idx" ON "link"("domain_id");

-- Add domainId to Pixel table
ALTER TABLE "pixel" ADD COLUMN "domain_id" UUID;
CREATE INDEX "pixel_domain_id_idx" ON "pixel"("domain_id");

-- Note: Foreign key constraints are not created due to relationMode = "prisma"
-- Referential integrity is maintained by Prisma Client
```

**Rollback Strategy:**
```sql
-- Rollback migration
DROP INDEX IF EXISTS "pixel_domain_id_idx";
ALTER TABLE "pixel" DROP COLUMN IF EXISTS "domain_id";

DROP INDEX IF EXISTS "link_domain_id_idx";
ALTER TABLE "link" DROP COLUMN IF EXISTS "domain_id";

DROP TABLE IF EXISTS "domain";
```

**Migration Execution:**
```bash
# Generate migration
npx prisma migrate dev --name add_multi_domain_support

# Apply to production
npx prisma migrate deploy
```

---

## 4. DNS Verification System

### 4.1 DNS Verification Logic

**Overview:**
Check if domain's CNAME record points to the Umami instance hostname.

**Verification Process:**
1. Extract subdomain and root domain from input (e.g., "test.roberto.lol" → "test", "roberto.lol")
2. Perform CNAME lookup for the full domain name
3. Compare CNAME target with expected Umami instance hostname
4. Return verification result with detailed status

**Expected CNAME Configuration:**
```
Type:  CNAME
Name:  test (subdomain) OR @ (apex domain)
Value: umami.athas.mx (Umami instance hostname)
TTL:   86400 (recommended, but any value accepted)
```

### 4.2 DNS Service Implementation

**File:** `src/lib/dns.ts`

```typescript
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);
const resolve4 = promisify(dns.resolve4);

export interface DNSVerificationResult {
  verified: boolean;
  cnameTarget?: string;
  error?: string;
  details?: string;
}

export interface DNSInstructions {
  type: 'CNAME' | 'A';
  name: string;
  value: string;
  ttl: number;
}

/**
 * Get the Umami instance hostname from environment or config
 */
export function getInstanceHostname(): string {
  // Try UMAMI_HOST first (explicit config)
  if (process.env.UMAMI_HOST) {
    return process.env.UMAMI_HOST;
  }

  // Fallback: extract from LINKS_URL
  if (process.env.LINKS_URL) {
    try {
      const url = new URL(process.env.LINKS_URL);
      return url.hostname;
    } catch (e) {
      // Invalid URL, continue to default
    }
  }

  // Default fallback (should be configured in production)
  throw new Error('UMAMI_HOST or LINKS_URL must be configured for domain verification');
}

/**
 * Parse domain into subdomain and root parts
 */
export function parseDomain(domain: string): { subdomain: string | null; root: string } {
  const parts = domain.split('.');

  if (parts.length < 2) {
    throw new Error('Invalid domain format');
  }

  if (parts.length === 2) {
    // Apex domain (e.g., example.com)
    return { subdomain: null, root: domain };
  }

  // Subdomain (e.g., test.example.com)
  const subdomain = parts[0];
  const root = parts.slice(1).join('.');

  return { subdomain, root };
}

/**
 * Verify domain DNS configuration
 */
export async function verifyDomainDNS(domain: string): Promise<DNSVerificationResult> {
  const instanceHost = getInstanceHostname();

  try {
    // Attempt CNAME lookup
    const cnameRecords = await resolveCname(domain);

    if (!cnameRecords || cnameRecords.length === 0) {
      return {
        verified: false,
        error: 'No CNAME record found',
        details: `Expected CNAME pointing to ${instanceHost}`,
      };
    }

    // Get first CNAME target (should only be one)
    const cnameTarget = cnameRecords[0];

    // Normalize for comparison (remove trailing dot if present)
    const normalizedTarget = cnameTarget.replace(/\.$/, '');
    const normalizedInstance = instanceHost.replace(/\.$/, '');

    // Check if CNAME points to our instance
    if (normalizedTarget === normalizedInstance) {
      return {
        verified: true,
        cnameTarget: normalizedTarget,
      };
    }

    return {
      verified: false,
      cnameTarget: normalizedTarget,
      error: 'CNAME points to wrong target',
      details: `Found: ${normalizedTarget}, Expected: ${normalizedInstance}`,
    };
  } catch (error: any) {
    // CNAME not found - might be using A record (not supported) or not configured
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return {
        verified: false,
        error: 'Domain not configured',
        details: `No CNAME record found. Please add CNAME record pointing to ${instanceHost}`,
      };
    }

    // Other DNS errors
    return {
      verified: false,
      error: 'DNS lookup failed',
      details: error.message,
    };
  }
}

/**
 * Generate DNS setup instructions for a domain
 */
export function getDNSInstructions(domain: string): DNSInstructions {
  const { subdomain } = parseDomain(domain);
  const instanceHost = getInstanceHostname();

  return {
    type: 'CNAME',
    name: subdomain || '@',
    value: instanceHost,
    ttl: 86400,
  };
}

/**
 * Check if domain format is valid
 */
export function isValidDomain(domain: string): boolean {
  // Basic domain validation regex
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  return domainRegex.test(domain);
}
```

### 4.3 DNS Verification Caching

**Cache Strategy:**
- Cache successful verifications for 1 hour (avoid repeated DNS lookups)
- Cache failed verifications for 5 minutes (allow quick retries during setup)
- Use Redis if available, fallback to in-memory cache
- Cache key: `dns:verify:{domain}`

**File:** `src/lib/dns-cache.ts`

```typescript
import { getRedisClient } from '@/lib/redis';

const VERIFY_SUCCESS_TTL = 3600; // 1 hour
const VERIFY_FAILURE_TTL = 300;  // 5 minutes

interface CachedVerificationResult {
  verified: boolean;
  cnameTarget?: string;
  error?: string;
  details?: string;
  cachedAt: number;
}

/**
 * Get cached DNS verification result
 */
export async function getCachedVerification(
  domain: string,
): Promise<CachedVerificationResult | null> {
  try {
    const redis = getRedisClient();
    const key = `dns:verify:${domain}`;
    const cached = await redis?.get(key);

    if (!cached) return null;

    return JSON.parse(cached) as CachedVerificationResult;
  } catch (error) {
    // Cache miss or error - return null to trigger fresh lookup
    return null;
  }
}

/**
 * Cache DNS verification result
 */
export async function cacheVerification(
  domain: string,
  result: DNSVerificationResult,
): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const key = `dns:verify:${domain}`;
    const ttl = result.verified ? VERIFY_SUCCESS_TTL : VERIFY_FAILURE_TTL;

    const cached: CachedVerificationResult = {
      ...result,
      cachedAt: Date.now(),
    };

    await redis.setex(key, ttl, JSON.stringify(cached));
  } catch (error) {
    // Cache failure is non-critical, log and continue
    console.error('Failed to cache DNS verification:', error);
  }
}

/**
 * Invalidate cached verification for a domain
 */
export async function invalidateCachedVerification(domain: string): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const key = `dns:verify:${domain}`;
    await redis.del(key);
  } catch (error) {
    console.error('Failed to invalidate DNS cache:', error);
  }
}
```

### 4.4 DNS Verification with Cache Integration

**File:** `src/lib/dns-verification.ts`

```typescript
import { verifyDomainDNS, type DNSVerificationResult } from './dns';
import { getCachedVerification, cacheVerification } from './dns-cache';

/**
 * Verify domain with caching support
 */
export async function verifyDomain(
  domain: string,
  forceRefresh: boolean = false,
): Promise<DNSVerificationResult> {
  // Check cache first (unless force refresh requested)
  if (!forceRefresh) {
    const cached = await getCachedVerification(domain);
    if (cached) {
      return {
        verified: cached.verified,
        cnameTarget: cached.cnameTarget,
        error: cached.error,
        details: cached.details,
      };
    }
  }

  // Perform fresh DNS lookup
  const result = await verifyDomainDNS(domain);

  // Cache the result
  await cacheVerification(domain, result);

  return result;
}
```

### 4.5 Environment Configuration

**Required Environment Variables:**

```bash
# Umami instance hostname for DNS verification
# This is what CNAME records should point to
UMAMI_HOST=umami.athas.mx

# OR extract from existing LINKS_URL
LINKS_URL=https://umami.athas.mx/q
```

**Docker Compose Update:**

```yaml
services:
  umami:
    environment:
      # ... existing vars ...
      UMAMI_HOST: umami.athas.mx  # Add this for DNS verification
```

---

## 5. API Endpoints Specification

### 5.1 Domain Management Endpoints

#### 5.1.1 List Domains

**Endpoint:** `GET /api/domains`

**Description:** List all domains for the authenticated user

**Request:**
```typescript
// Query Parameters (optional)
interface GetDomainsQuery {
  teamId?: string;        // Filter by team (if user is team member)
  page?: number;          // Pagination
  limit?: number;         // Items per page
  search?: string;        // Search domain name/description
  verified?: boolean;     // Filter by verification status
}
```

**Response:**
```typescript
interface GetDomainsResponse {
  data: Domain[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Domain {
  id: string;
  name: string;
  description: string | null;
  isPrimary: boolean;
  verified: boolean;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  userId: string | null;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Business Logic:**
- Return user's personal domains + team domains (if teamId provided)
- Only return domains where `deletedAt IS NULL`
- Sort by: primary first, then by createdAt DESC
- Apply pagination and search filters

**Permissions:**
- Authenticated users can view their own domains
- Team members can view team domains (verify via TeamUser)
- Admins can view all domains

**Implementation File:** `src/app/api/domains/route.ts`

---

#### 5.1.2 Create Domain

**Endpoint:** `POST /api/domains`

**Description:** Add a new domain

**Request:**
```typescript
interface CreateDomainRequest {
  name: string;           // Domain name (e.g., "test.roberto.lol")
  description?: string;   // Optional description
  teamId?: string;        // Optional: assign to team (if null, assign to user)
  isPrimary?: boolean;    // Set as primary domain (default: false)
}
```

**Validation Rules:**
- `name`: Required, valid domain format, max 255 chars, unique across system
- `description`: Optional, max 500 chars
- `teamId`: If provided, user must be team member with create permissions
- `isPrimary`: If true, unset previous primary for same user/team

**Response:**
```typescript
interface CreateDomainResponse {
  domain: Domain;
  dnsInstructions: {
    type: 'CNAME';
    name: string;         // Subdomain part or '@'
    value: string;        // Umami instance hostname
    ttl: number;          // Recommended TTL (86400)
  };
}
```

**Business Logic:**
1. Validate domain format (use `isValidDomain()`)
2. Check uniqueness (no existing domain with same name)
3. Check ownership (teamId XOR userId)
4. If `isPrimary = true`, set existing primary domains to `isPrimary = false`
5. Create domain record with `verified = false`
6. Generate DNS instructions
7. Return domain + instructions

**Error Responses:**
- `400 Bad Request`: Invalid domain format
- `409 Conflict`: Domain already exists
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Cannot create domain for team (not a member)

**Implementation File:** `src/app/api/domains/route.ts`

---

#### 5.1.3 Get Domain Details

**Endpoint:** `GET /api/domains/[domainId]`

**Description:** Get details for a specific domain

**Implementation File:** `src/app/api/domains/[domainId]/route.ts`

```typescript
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canViewDomain } from '@/permissions';
import { getDomain } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },  // ✅ Promise wrapper for Next.js 15
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;  // ✅ Await params

  if (!(await canViewDomain(auth, domainId))) {
    return unauthorized();
  }

  const domain = await getDomain(domainId);

  return json(domain);
}
```

**Response:**
```typescript
interface GetDomainResponse {
  id: string;
  name: string;
  description: string | null;
  isPrimary: boolean;
  verified: boolean;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  userId: string | null;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    links: number;
    pixels: number;
  };
}
```

**Permissions:**
- User must own domain (userId match) OR be member of team (teamId match)
- Admins can view any domain

**CRITICAL: Next.js 15 Params Handling**
- `params` is now a `Promise` in dynamic routes
- Must `await params` before accessing properties
- Pattern applies to ALL dynamic route handlers

---

#### 5.1.4 Update Domain

**Endpoint:** `POST /api/domains/[domainId]`

**Description:** Update domain settings

**Request:**
```typescript
interface UpdateDomainRequest {
  description?: string;
  isPrimary?: boolean;
}
```

**Business Logic:**
- `name` cannot be changed (immutable)
- If `isPrimary = true`, unset other primary domains for same user/team
- `verified` status managed separately (via verify endpoint)

**Response:**
```typescript
interface UpdateDomainResponse {
  id: string;
  name: string;
  description: string | null;
  isPrimary: boolean;
  verified: boolean;
  // ... other fields
}
```

**Permissions:**
- User must own domain OR be team member with update permissions

**Implementation File:** `src/app/api/domains/[domainId]/route.ts`

---

#### 5.1.5 Delete Domain

**Endpoint:** `DELETE /api/domains/[domainId]`

**Description:** Soft-delete a domain

**Business Logic:**
1. Set `deletedAt = NOW()`
2. Links/pixels with this domainId will fall back to default domain (due to `onDelete: SetNull`)
3. Optionally: provide warning if domain has active links

**Response:**
```typescript
interface DeleteDomainResponse {
  success: boolean;
  message: string;
  affectedLinks: number;    // Count of links that used this domain
  affectedPixels: number;   // Count of pixels that used this domain
}
```

**Permissions:**
- User must own domain OR be team member with delete permissions
- Admins can delete any domain

**Implementation File:** `src/app/api/domains/[domainId]/route.ts`

---

#### 5.1.6 Verify Domain DNS

**Endpoint:** `POST /api/domains/[domainId]/verify`

**Description:** Trigger DNS verification check

**Request:**
```typescript
interface VerifyDomainRequest {
  forceRefresh?: boolean;   // Bypass cache (default: false)
}
```

**Business Logic:**
1. Get domain from database
2. Call `verifyDomain(domain.name, forceRefresh)`
3. Update domain record:
   - Set `lastCheckedAt = NOW()`
   - If verified: Set `verified = true`, `verifiedAt = NOW()` (if first time)
   - If not verified: Set `verified = false`
4. Return verification result

**Response:**
```typescript
interface VerifyDomainResponse {
  verified: boolean;
  cnameTarget?: string;     // What the CNAME actually points to
  error?: string;           // Error message if not verified
  details?: string;         // Additional details
  lastCheckedAt: string;
  verifiedAt: string | null;

  // DNS instructions (if not verified)
  dnsInstructions?: {
    type: 'CNAME';
    name: string;
    value: string;
    ttl: number;
  };
}
```

**Permissions:**
- User must own domain OR be team member

**Implementation File:** `src/app/api/domains/[domainId]/verify/route.ts`

---

### 5.2 Updated Link Endpoints

#### 5.2.1 Create Link (Updated)

**Endpoint:** `POST /api/links`

**Updated Request Schema:**
```typescript
interface CreateLinkRequest {
  name: string;
  url: string;
  slug: string;
  teamId?: string | null;
  domainId?: string | null;   // NEW FIELD
  id?: string | null;
}
```

**Business Logic Updates:**
1. If `domainId` provided:
   - Validate domain exists and is verified
   - Validate user owns domain (userId match OR teamId match)
2. If `domainId` not provided:
   - Try to auto-select primary domain for user/team
   - If no primary, use null (falls back to env default)

**Response:**
```typescript
interface CreateLinkResponse {
  id: string;
  name: string;
  url: string;
  slug: string;
  domainId: string | null;
  userId: string | null;
  teamId: string | null;
  createdAt: string;

  // Computed field: full link URL
  linkUrl: string;  // e.g., "https://test.roberto.lol/q/abc123"
}
```

**Link URL Generation Logic:**
```typescript
function generateLinkUrl(link: Link, domain: Domain | null): string {
  if (domain) {
    return `https://${domain.name}/q/${link.slug}`;
  }

  // Fallback to env default
  const linksUrl = process.env.LINKS_URL || `${globalThis?.location?.origin}/q`;
  return `${linksUrl}/${link.slug}`;
}
```

**Implementation File:** `src/app/api/links/route.ts` (update existing POST handler)

---

#### 5.2.2 Update Link (Updated)

**Endpoint:** `POST /api/links/[linkId]`

**Updated Request Schema:**
```typescript
interface UpdateLinkRequest {
  name?: string;
  url?: string;
  slug?: string;
  domainId?: string | null;   // NEW FIELD (can be changed)
}
```

**Business Logic:**
- Allow changing `domainId` to different verified domain (with ownership check)
- Allow setting `domainId = null` to use default domain

**Implementation File:** `src/app/api/links/[linkId]/route.ts` (update existing POST handler)

---

#### 5.2.3 Get Links (Updated)

**Endpoint:** `GET /api/links`

**Updated Response:**
```typescript
interface GetLinksResponse {
  data: Array<{
    id: string;
    name: string;
    url: string;
    slug: string;
    domainId: string | null;
    userId: string | null;
    teamId: string | null;
    createdAt: string;

    // Include domain relation
    domain: {
      id: string;
      name: string;
      verified: boolean;
    } | null;

    // Computed field
    linkUrl: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

**Prisma Query Update:**
```typescript
const links = await prisma.link.findMany({
  where: { userId, deletedAt: null },
  include: {
    domain: {
      select: {
        id: true,
        name: true,
        verified: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' },
});
```

**Implementation File:** `src/app/api/links/route.ts` (update existing GET handler)

---

### 5.3 Config Endpoint Update

#### 5.3.1 Get Config (Updated)

**Endpoint:** `GET /api/config`

**Updated Response:**
```typescript
interface GetConfigResponse {
  cloudMode: boolean;
  faviconUrl?: string;
  linksUrl?: string;
  pixelsUrl?: string;
  privateMode: boolean;
  telemetryDisabled: boolean;
  trackerScriptName?: string;
  updatesDisabled: boolean;

  // NEW FIELD
  umamiHost?: string;  // For DNS instructions display
}
```

**Implementation:**
```typescript
return json({
  // ... existing fields ...
  umamiHost: process.env.UMAMI_HOST || extractHostFromUrl(process.env.LINKS_URL),
});
```

**Implementation File:** `src/app/api/config/route.ts` (update existing handler)

---

## 6. Backend Services & Utilities

### 6.1 Prisma Queries

**File:** `src/queries/prisma/domain.ts`

```typescript
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { QueryFilters } from '@/lib/types';

/**
 * Find single domain by criteria
 */
export async function findDomain(criteria: Prisma.DomainFindUniqueArgs) {
  return prisma.client.domain.findUnique(criteria);
}

/**
 * Get domain by ID
 */
export async function getDomain(domainId: string) {
  return findDomain({
    where: { id: domainId },
  });
}

/**
 * Get domain by name
 */
export async function getDomainByName(name: string) {
  return findDomain({
    where: { name },
  });
}

/**
 * Get multiple domains with filtering
 */
export async function getDomains(
  criteria: Prisma.DomainFindManyArgs,
  filters: QueryFilters = {},
) {
  const { search } = filters;
  const { getSearchParameters, pagedQuery } = prisma;

  const where: Prisma.DomainWhereInput = {
    ...criteria.where,
    deletedAt: null,
    ...getSearchParameters(search, [
      { name: 'contains' },
      { description: 'contains' },
    ]),
  };

  return pagedQuery('domain', { ...criteria, where }, filters);
}

/**
 * Get user's personal domains
 */
export async function getUserDomains(userId: string, filters?: QueryFilters) {
  return getDomains(
    {
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    },
    filters,
  );
}

/**
 * Get team domains
 */
export async function getTeamDomains(teamId: string, filters?: QueryFilters) {
  return getDomains(
    {
      where: { teamId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    },
    filters,
  );
}

/**
 * Get primary domain for user
 */
export async function getUserPrimaryDomain(userId: string) {
  return prisma.client.domain.findFirst({
    where: {
      userId,
      isPrimary: true,
      verified: true,
      deletedAt: null,
    },
  });
}

/**
 * Get primary domain for team
 */
export async function getTeamPrimaryDomain(teamId: string) {
  return prisma.client.domain.findFirst({
    where: {
      teamId,
      isPrimary: true,
      verified: true,
      deletedAt: null,
    },
  });
}

/**
 * Create new domain
 */
export async function createDomain(data: Prisma.DomainUncheckedCreateInput) {
  return prisma.client.domain.create({ data });
}

/**
 * Update domain
 */
export async function updateDomain(
  domainId: string,
  data: Prisma.DomainUpdateInput,
) {
  return prisma.client.domain.update({
    where: { id: domainId },
    data,
  });
}

/**
 * Soft delete domain
 */
export async function deleteDomain(domainId: string) {
  return prisma.client.domain.update({
    where: { id: domainId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Unset primary flag for all user domains
 */
export async function unsetUserPrimaryDomains(userId: string) {
  return prisma.client.domain.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });
}

/**
 * Unset primary flag for all team domains
 */
export async function unsetTeamPrimaryDomains(teamId: string) {
  return prisma.client.domain.updateMany({
    where: { teamId, isPrimary: true },
    data: { isPrimary: false },
  });
}

/**
 * Update verification status
 */
export async function updateDomainVerification(
  domainId: string,
  verified: boolean,
) {
  const data: Prisma.DomainUpdateInput = {
    verified,
    lastCheckedAt: new Date(),
  };

  // Set verifiedAt timestamp on first verification
  if (verified) {
    data.verifiedAt = new Date();
  }

  return prisma.client.domain.update({
    where: { id: domainId },
    data,
  });
}

/**
 * Get domain stats (link/pixel counts)
 */
export async function getDomainStats(domainId: string) {
  const [totalLinks, totalPixels] = await Promise.all([
    prisma.client.link.count({
      where: { domainId, deletedAt: null },
    }),
    prisma.client.pixel.count({
      where: { domainId, deletedAt: null },
    }),
  ]);

  return {
    totalLinks,
    totalPixels,
    totalClicks: 0, // TODO: Implement click tracking in phase 2
  };
}
```

### 6.2 Permission Handlers

**File:** `src/permissions/domain.ts`

```typescript
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants';
import type { Auth } from '@/lib/types';
import { getDomain, getTeamUser } from '@/queries/prisma';

/**
 * Check if user can view domain
 */
export async function canViewDomain({ user }: Auth, domainId: string) {
  if (user?.isAdmin) {
    return true;
  }

  const domain = await getDomain(domainId);

  if (!domain) {
    return false;
  }

  // User owns domain
  if (domain.userId) {
    return user.id === domain.userId;
  }

  // Team owns domain - check team membership
  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);
    return !!teamUser;
  }

  return false;
}

/**
 * Check if user can update domain
 */
export async function canUpdateDomain({ user }: Auth, domainId: string) {
  if (user.isAdmin) {
    return true;
  }

  const domain = await getDomain(domainId);

  if (!domain) {
    return false;
  }

  // User owns domain
  if (domain.userId) {
    return user.id === domain.userId;
  }

  // Team owns domain - check team membership with update permission
  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);
    return teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteUpdate);
  }

  return false;
}

/**
 * Check if user can delete domain
 */
export async function canDeleteDomain({ user }: Auth, domainId: string) {
  if (user.isAdmin) {
    return true;
  }

  const domain = await getDomain(domainId);

  if (!domain) {
    return false;
  }

  // User owns domain
  if (domain.userId) {
    return user.id === domain.userId;
  }

  // Team owns domain - check team membership with delete permission
  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);
    return teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteDelete);
  }

  return false;
}

/**
 * Check if user can create domain for team
 */
export async function canCreateTeamDomain({ user }: Auth, teamId: string) {
  if (user.isAdmin) {
    return true;
  }

  const teamUser = await getTeamUser(teamId, user.id);
  return teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteCreate);
}

/**
 * Check if user can create domain (personal or team)
 */
export async function canCreateDomain({ user }: Auth, teamId?: string) {
  if (user.isAdmin) {
    return true;
  }

  // Creating for team
  if (teamId) {
    return canCreateTeamDomain({ user }, teamId);
  }

  // Creating personal domain - all authenticated users allowed
  return true;
}
```

### 6.3 Validation Schema

**File:** `src/lib/schema/domain.ts`

```typescript
import { z } from 'zod';

/**
 * Domain name validation
 * Accepts: example.com, test.example.com, sub.domain.example.com
 */
export const domainNameSchema = z
  .string()
  .min(1, 'Domain name is required')
  .max(255, 'Domain name too long')
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i,
    'Invalid domain format',
  )
  .transform((val) => val.toLowerCase()); // Normalize to lowercase

/**
 * Create domain request schema
 */
export const createDomainSchema = z.object({
  name: domainNameSchema,
  description: z.string().max(500).optional(),
  teamId: z.string().uuid().nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
  id: z.string().uuid().nullable().optional(),
});

/**
 * Update domain request schema
 */
export const updateDomainSchema = z.object({
  description: z.string().max(500).optional(),
  isPrimary: z.boolean().optional(),
});

/**
 * Verify domain request schema
 */
export const verifyDomainSchema = z.object({
  forceRefresh: z.boolean().optional().default(false),
});

/**
 * Get domains query schema
 */
export const getDomainsSchema = z.object({
  teamId: z.string().uuid().optional(),
  verified: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  search: z.string().optional(),
});
```

---

## 7. Frontend Components

**IMPORTANT:** Follow Umami's exact component patterns from Links/Pixels features.

### 7.1 Component File Structure

```
/src/app/(main)/domains/
  ├── page.tsx                      # Metadata export only
  ├── DomainsPage.tsx               # Main page component ('use client')
  ├── DomainsDataTable.tsx          # DataGrid wrapper
  ├── DomainsTable.tsx              # Table column definitions
  ├── DomainAddButton.tsx           # Add dialog button
  ├── DomainEditButton.tsx          # Edit dialog button
  ├── DomainEditForm.tsx            # Unified create/edit form
  ├── DomainDeleteButton.tsx        # Delete confirmation dialog
  └── DomainVerifyButton.tsx        # DNS verification button

/src/components/hooks/queries/
  └── domainsQuery.ts               # React Query hooks
```

### 7.2 Page Metadata Export

**File:** `src/app/(main)/domains/page.tsx`

```typescript
import type { Metadata } from 'next';
import { DomainsPage } from './DomainsPage';

export const metadata: Metadata = {
  title: 'Domains',
};

export default function () {
  return <DomainsPage />;
}
```

### 7.3 Main Page Component

**File:** `src/app/(main)/domains/DomainsPage.tsx`

```typescript
'use client';
import { Column } from '@umami/react-zen';
import { DomainsDataTable } from '@/app/(main)/domains/DomainsDataTable';
import { PageBody } from '@/components/common/PageBody';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { useMessages, useNavigation } from '@/components/hooks';
import { DomainAddButton } from './DomainAddButton';

export function DomainsPage() {
  const { formatMessage, labels } = useMessages();
  const { teamId } = useNavigation();

  return (
    <PageBody>
      <Column gap="6" margin="2">
        <PageHeader title={formatMessage(labels.domains)}>
          <DomainAddButton teamId={teamId} />
        </PageHeader>
        <Panel>
          <DomainsDataTable />
        </Panel>
      </Column>
    </PageBody>
  );
}
```

**Key Patterns:**
- Use `PageBody`, `PageHeader`, `Panel` components
- Use `Column` from `@umami/react-zen` for layout
- Use `useNavigation()` to get teamId
- All text via `useMessages()` hook
- No local state management - handled by DataGrid

---

### 7.4 DataTable Wrapper

**File:** `src/app/(main)/domains/DomainsDataTable.tsx`

```typescript
'use client';
import { DataGrid } from '@/components/common/DataGrid';
import { useDomainsQuery, useNavigation } from '@/components/hooks';
import { DomainsTable } from './DomainsTable';

export function DomainsDataTable() {
  const { teamId } = useNavigation();
  const query = useDomainsQuery({ teamId });

  return (
    <DataGrid query={query} allowSearch={true} autoFocus={false} allowPaging={true}>
      {({ data }) => <DomainsTable data={data} />}
    </DataGrid>
  );
}
```

**Key Patterns:**
- `DataGrid` handles search, pagination, loading states
- Query hook integrated with `useModified()` for cache invalidation
- Passes data to table component

---

### 7.5 Table Column Definitions

**File:** `src/app/(main)/domains/DomainsTable.tsx`

```typescript
'use client';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/common/DataTable';
import { useMessages } from '@/components/hooks';
import { DomainEditButton } from './DomainEditButton';
import { DomainDeleteButton } from './DomainDeleteButton';
import { DomainVerifyButton } from './DomainVerifyButton';

export function DomainsTable({ data = [] }: { data: any[] }) {
  const { formatMessage, labels } = useMessages();

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      header: formatMessage(labels.name),
      accessorKey: 'name',
      cell: ({ row }) => {
        const { name, isPrimary, verified } = row.original;
        return (
          <div>
            {isPrimary && <span title="Primary">⭐ </span>}
            {name}
            {verified ? ' ✓' : ' ⚠'}
          </div>
        );
      },
    },
    {
      id: 'description',
      header: formatMessage(labels.description),
      accessorKey: 'description',
    },
    {
      id: 'stats',
      header: formatMessage(labels.links),
      cell: ({ row }) => {
        const { _count } = row.original;
        return _count?.links || 0;
      },
    },
    {
      id: 'action',
      header: formatMessage(labels.actions),
      cell: ({ row }) => {
        const { id, name, verified } = row.original;
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            {!verified && <DomainVerifyButton domainId={id} />}
            <DomainEditButton domainId={id} />
            <DomainDeleteButton domainId={id} name={name} />
          </div>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={data} />;
}
```

**Key Patterns:**
- Use `@tanstack/react-table` types
- All labels via `useMessages()`
- Action buttons rendered in actions column
- Status indicators in name column

---

### 7.6 Add Button (DialogButton Pattern)

**File:** `src/app/(main)/domains/DomainAddButton.tsx`

```typescript
'use client';
import { useMessages } from '@/components/hooks';
import { Plus } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { DomainEditForm } from './DomainEditForm';

export function DomainAddButton({ teamId }: { teamId?: string }) {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton
      icon={<Plus />}
      label={formatMessage(labels.addDomain)}
      variant="primary"
      width="600px"
    >
      {({ close }) => <DomainEditForm teamId={teamId} onClose={close} />}
    </DialogButton>
  );
}
```

---

### 7.7 Edit Button (DialogButton Pattern)

**File:** `src/app/(main)/domains/DomainEditButton.tsx`

```typescript
'use client';
import { useMessages } from '@/components/hooks';
import { Pencil } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { DomainEditForm } from './DomainEditForm';

export function DomainEditButton({ domainId }: { domainId: string }) {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton
      icon={<Pencil />}
      title={formatMessage(labels.edit)}
      variant="quiet"
      width="600px"
    >
      {({ close }) => <DomainEditForm domainId={domainId} onClose={close} />}
    </DialogButton>
  );
}
```

---

### 7.8 Delete Button (ConfirmationForm Pattern)

**File:** `src/app/(main)/domains/DomainDeleteButton.tsx`

```typescript
'use client';
import { ConfirmationForm } from '@/components/common/ConfirmationForm';
import { useDeleteQuery, useMessages } from '@/components/hooks';
import { Trash } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { messages } from '@/components/messages';

export function DomainDeleteButton({
  domainId,
  name,
  onSave,
}: {
  domainId: string;
  name: string;
  onSave?: () => void;
}) {
  const { formatMessage, labels, getErrorMessage, FormattedMessage } = useMessages();
  const { mutateAsync, isPending, error, touch } = useDeleteQuery(`/domains/${domainId}`);

  const handleConfirm = async (close: () => void) => {
    await mutateAsync(null, {
      onSuccess: () => {
        touch('domains');
        onSave?.();
        close();
      },
    });
  };

  return (
    <DialogButton
      icon={<Trash />}
      title={formatMessage(labels.confirm)}
      variant="quiet"
      width="400px"
    >
      {({ close }) => (
        <ConfirmationForm
          message={
            <FormattedMessage
              {...messages.confirmRemove}
              values={{
                target: <b>{name}</b>,
              }}
            />
          }
          isLoading={isPending}
          error={getErrorMessage(error)}
          onConfirm={handleConfirm.bind(null, close)}
          onClose={close}
          buttonLabel={formatMessage(labels.delete)}
          buttonVariant="danger"
        />
      )}
    </DialogButton>
  );
}
```

**Key Patterns:**
- Use `DialogButton` for all modals (not custom Modal component)
- Use `ConfirmationForm` for delete confirmations
- Use `useDeleteQuery()` hook
- Use `touch('domains')` for cache invalidation
- All text via `useMessages()`

---

### 7.9 Verify Button (Custom Action)

**File:** `src/app/(main)/domains/DomainVerifyButton.tsx`

```typescript
'use client';
import { useMessages } from '@/components/hooks';
import { RefreshCw } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { DomainVerifyForm } from './DomainVerifyForm';

export function DomainVerifyButton({ domainId }: { domainId: string }) {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton
      icon={<RefreshCw />}
      title={formatMessage(labels.verifyDomain)}
      variant="quiet"
      width="600px"
    >
      {({ close }) => <DomainVerifyForm domainId={domainId} onClose={close} />}
    </DialogButton>
  );
}
```

---

### 7.10 Unified Edit Form (Create/Update)

**File:** `src/app/(main)/domains/DomainEditForm.tsx`

```typescript
'use client';
import { Form, FormButtons, FormInput, FormRow, SubmitButton } from '@umami/react-zen';
import { useDomainQuery, useMessages } from '@/components/hooks';
import { useUpdateQuery } from '@/components/hooks/queries/useUpdateQuery';
import { Loading } from '@/components/common/Loading';

export function DomainEditForm({
  domainId,
  teamId,
  onSave,
  onClose,
}: {
  domainId?: string;
  teamId?: string;
  onSave?: () => void;
  onClose?: () => void;
}) {
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { mutateAsync, error, isPending, touch, toast } = useUpdateQuery(
    domainId ? `/domains/${domainId}` : '/domains',
    {
      id: domainId,
      teamId,
    },
  );
  const { data, isLoading } = useDomainQuery(domainId);

  const handleSubmit = async (data: any) => {
    await mutateAsync(data, {
      onSuccess: async () => {
        toast(formatMessage(messages.saved));
        touch('domains');
        onSave?.();
        onClose?.();
      },
    });
  };

  if (domainId && isLoading) {
    return <Loading placement="absolute" />;
  }

  return (
    <Form onSubmit={handleSubmit} error={getErrorMessage(error)} defaultValues={data}>
      <FormRow>
        <FormInput
          name="name"
          label={formatMessage(labels.domainName)}
          rules={{ required: formatMessage(labels.required) }}
          disabled={!!domainId}
        />
      </FormRow>
      <FormRow>
        <FormInput name="description" label={formatMessage(labels.description)} />
      </FormRow>
      <FormButtons>
        <SubmitButton disabled={isPending}>{formatMessage(labels.save)}</SubmitButton>
      </FormButtons>
    </Form>
  );
}
```

**Key Patterns:**
- Use `Form`, `FormRow`, `FormInput`, `FormButtons` from `@umami/react-zen`
- Use `useUpdateQuery()` for both create and update
- URL determines create vs update: `/domains` vs `/domains/${id}`
- Use `touch('domains')` for cache invalidation
- Use `toast()` for success messages
- All text via `useMessages()`
- Domain name is disabled when editing (immutable)

---

### 7.11 DNS Verify Form

**File:** `src/app/(main)/domains/DomainVerifyForm.tsx`

```typescript
'use client';
import { useState } from 'react';
import { Column, Row, Text } from '@umami/react-zen';
import { useDomainQuery, useMessages } from '@/components/hooks';
import { useApi } from '@/components/hooks/useApi';
import { Loading } from '@/components/common/Loading';
import { CopyInput } from '@/components/input/CopyInput';

export function DomainVerifyForm({
  domainId,
  onClose,
}: {
  domainId: string;
  onClose?: () => void;
}) {
  const { formatMessage, labels } = useMessages();
  const { post } = useApi();
  const { data: domain, isLoading, refetch } = useDomainQuery(domainId);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await post(`/domains/${domainId}/verify`, { forceRefresh: true });
      await refetch();
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) {
    return <Loading placement="absolute" />;
  }

  const parts = domain.name.split('.');
  const subdomain = parts.length > 2 ? parts[0] : '@';
  const umamiHost = process.env.NEXT_PUBLIC_UMAMI_HOST || 'umami.athas.mx';

  return (
    <Column gap="4">
      <Text>
        {formatMessage(labels.dnsInstructions)}
      </Text>

      <table>
        <thead>
          <tr>
            <th>{formatMessage(labels.type)}</th>
            <th>{formatMessage(labels.name)}</th>
            <th>{formatMessage(labels.value)}</th>
            <th>{formatMessage(labels.ttl)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CNAME</td>
            <td>
              <CopyInput value={subdomain} />
            </td>
            <td>
              <CopyInput value={umamiHost} />
            </td>
            <td>86400</td>
          </tr>
        </tbody>
      </table>

      {domain.verified ? (
        <Text variant="success">✓ {formatMessage(labels.domainVerified)}</Text>
      ) : (
        <Text variant="error">⚠ {formatMessage(labels.domainNotConfigured)}</Text>
      )}

      <Row gap="2">
        <button onClick={handleVerify} disabled={verifying}>
          {verifying ? formatMessage(labels.verifying) : formatMessage(labels.verify)}
        </button>
        <button onClick={onClose}>{formatMessage(labels.close)}</button>
      </Row>
    </Column>
  );
}
```

---

### 7.12 React Query Hooks

**File:** `src/components/hooks/queries/domainsQuery.ts`

```typescript
import type { ReactQueryOptions } from '@/lib/types';
import { useApi } from '../useApi';
import { useModified } from '../useModified';
import { usePagedQuery } from '../usePagedQuery';

export function useDomainsQuery(
  { teamId }: { teamId?: string },
  options?: ReactQueryOptions,
) {
  const { modified } = useModified('domains');
  const { get } = useApi();

  return usePagedQuery({
    queryKey: ['domains', { teamId, modified }],
    queryFn: pageParams => {
      return get(teamId ? `/teams/${teamId}/domains` : '/domains', pageParams);
    },
    ...options,
  });
}

export function useDomainQuery(domainId: string) {
  const { get, useQuery } = useApi();
  const { modified } = useModified(`domain:${domainId}`);

  return useQuery({
    queryKey: ['domain', { domainId, modified }],
    queryFn: () => {
      return get(`/domains/${domainId}`);
    },
    enabled: !!domainId,
  });
}
```

**Export from main hooks index:**

**File:** `src/components/hooks/index.ts`

```typescript
// Add this line
export * from './queries/domainsQuery';
```

**Key Patterns:**
- Use `useModified()` for cache invalidation tracking
- Use `usePagedQuery()` for paginated list queries
- Use `useApi()` hook instead of raw fetch
- Include `modified` in queryKey
- Support team-scoped queries

---

## 8. Internationalization Requirements

**CRITICAL:** All user-facing text must be internationalized using Umami's message system.

### 8.1 Required Message Keys

Add these keys to message files (e.g., `src/messages/en-US.json`):

```json
{
  "labels": {
    "domains": "Domains",
    "domain": "Domain",
    "addDomain": "Add Domain",
    "domainName": "Domain Name",
    "verifyDomain": "Verify Domain",
    "domainVerified": "Domain Verified",
    "domainNotConfigured": "Domain Not Configured",
    "dnsInstructions": "DNS Configuration Instructions",
    "verifying": "Verifying...",
    "verify": "Verify",
    "type": "Type",
    "value": "Value",
    "ttl": "TTL"
  },
  "messages": {
    "domainAdded": "Domain added successfully",
    "domainDeleted": "Domain deleted",
    "domainVerificationSuccess": "Domain verified successfully",
    "domainVerificationFailed": "Domain verification failed. Please check your DNS configuration.",
    "dnsInstructionsText": "To configure your domain, set the following CNAME record on your DNS provider:",
    "dnsPropagationNote": "If a TTL value of 86400 is not available, choose the highest available value. Domain propagation may take up to 12 hours."
  }
}
```

### 8.2 Usage Pattern

**In all components:**
```typescript
const { formatMessage, labels, messages } = useMessages();

// For labels
<h1>{formatMessage(labels.domains)}</h1>

// For messages
toast(formatMessage(messages.saved));

// With placeholders
<FormattedMessage
  {...messages.confirmRemove}
  values={{ target: <b>{domainName}</b> }}
/>
```

**Never hardcode text:**
```typescript
// ❌ WRONG
<h1>Domains</h1>
<button>Add Domain</button>

// ✅ CORRECT
<h1>{formatMessage(labels.domains)}</h1>
<button>{formatMessage(labels.addDomain)}</button>
```

---

## 9. Integration Points

### 9.1 Navigation Updates

**File:** Navigation component (find existing navigation definition)

**Add "Domains" menu item:**
```typescript
const navigationItems = [
  { label: formatMessage(labels.websites), href: '/websites' },
  { label: formatMessage(labels.links), href: '/links' },
  { label: formatMessage(labels.domains), href: '/domains' },  // NEW
  { label: formatMessage(labels.reports), href: '/reports' },
  // ... other items
];
```

### 8.2 Link Collection Handler Update

**File:** `src/app/(collect)/q/[slug]/route.ts`

**Current implementation** (no changes needed):
```typescript
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const { slug } = params;

  // Lookup link by slug (domain not needed - slug is globally unique)
  const link = await findLink({ where: { slug } });

  if (!link) {
    return notFound();
  }

  // Track event (could include domain context in future)
  // await trackLinkClick(link.id);

  // Redirect to destination
  return redirect(link.url);
}
```

**Note:** Slug is globally unique, so domain not needed for lookup. DNS routing (e.g., test.roberto.lol → Umami instance) handled at infrastructure level (reverse proxy/load balancer).

### 8.3 Environment Variable Setup

**File:** `.env.example` (documentation)

```bash
# Existing variables
DATABASE_URL=postgresql://user:pass@localhost:5432/umami
APP_SECRET=your-secret-key

# NEW: Required for multi-domain support
UMAMI_HOST=umami.athas.mx

# OR extract from existing LINKS_URL
LINKS_URL=https://umami.athas.mx/q
```

**Docker Compose:**
```yaml
services:
  umami:
    environment:
      DATABASE_URL: postgresql://umami:umami@db:5432/umami
      APP_SECRET: ${APP_SECRET}
      UMAMI_HOST: umami.athas.mx  # NEW
```

---

## 10. Implementation Tasks

**IMPORTANT:** All tasks must follow Umami's exact patterns as documented in this plan.

### Phase 1: Database & Backend Foundation

#### Task 1.1: Database Schema Setup
**Agent:** Database specialist
**Files:**
- `prisma/schema.prisma`
- Migration files

**Steps:**
1. Add Domain model to schema (follow exact pattern from section 3.1)
2. Update Link model (add domainId field and relation)
3. Update Pixel model (add domainId field and relation)
4. Update User model (add domains relation)
5. Update Team model (add domains relation)
6. Find latest migration number: `ls prisma/migrations/ | grep -oE '^[0-9]+' | sort -n | tail -1`
7. Generate migration with next number: `npx prisma migrate dev --name {N}_add_multi_domain_support`
8. Test migration on local database
9. Verify schema changes with `npx prisma studio`

**Acceptance Criteria:**
- ✅ Domain table created with all fields matching section 3.1
- ✅ Indexes created on all foreign keys
- ✅ Migration numbered sequentially
- ✅ Migration runs without errors
- ✅ Existing data preserved
- ✅ Prisma Client regenerates successfully

---

#### Task 1.2: DNS Verification Service
**Agent:** Backend utilities specialist
**Files:**
- `src/lib/dns.ts`
- `src/lib/dns-cache.ts`
- `src/lib/dns-verification.ts`

**Steps:**
1. Implement `verifyDomainDNS()` function
2. Implement `getDNSInstructions()` helper
3. Implement `getInstanceHostname()` config helper
4. Implement caching layer (Redis-backed)
5. Add unit tests for DNS parsing
6. Test with real domains (staging environment)

**Acceptance Criteria:**
- ✅ CNAME lookup works correctly
- ✅ Handles DNS errors gracefully
- ✅ Caching reduces redundant lookups
- ✅ Returns detailed error messages

---

#### Task 1.3: Prisma Queries
**Agent:** Database queries specialist
**Files:**
- `src/queries/prisma/domain.ts`

**Steps:**
1. Implement CRUD query functions (create, read, update, delete)
2. Implement getUserDomains() and getTeamDomains()
3. Implement getPrimaryDomain() helpers
4. Implement unsetPrimaryDomains() for atomic updates
5. Implement getDomainStats() for analytics
6. Add TypeScript types for all queries

**Acceptance Criteria:**
- ✅ All query functions type-safe
- ✅ Handles soft deletes correctly
- ✅ Primary domain logic works atomically
- ✅ Queries optimized (proper indexes used)

---

#### Task 1.4: Permission Handlers
**Agent:** Security/permissions specialist
**Files:**
- `src/permissions/domain.ts`

**Steps:**
1. Implement canViewDomain()
2. Implement canUpdateDomain()
3. Implement canDeleteDomain()
4. Implement canCreateDomain() / canCreateTeamDomain()
5. Add unit tests for permission scenarios
6. Test team permission inheritance

**Acceptance Criteria:**
- ✅ User can only access own domains
- ✅ Team members can access team domains
- ✅ Team roles respected (create/update/delete permissions)
- ✅ Admins have full access

---

### Phase 2: API Endpoints

#### Task 2.1: Domain CRUD Endpoints
**Agent:** API development specialist
**Files:**
- `src/app/api/domains/route.ts` (GET, POST)
- `src/app/api/domains/[domainId]/route.ts` (GET, POST, DELETE)

**Steps:**
1. Implement GET /api/domains (list domains)
2. Implement POST /api/domains (create domain)
3. Implement GET /api/domains/[domainId] (get details + stats)
4. Implement POST /api/domains/[domainId] (update domain)
5. Implement DELETE /api/domains/[domainId] (soft delete)
6. Add validation schemas (Zod)
7. Add error handling
8. Test with Postman/curl

**Acceptance Criteria:**
- ✅ All endpoints return correct response format
- ✅ Validation errors handled properly
- ✅ Permissions enforced
- ✅ Primary domain logic works (atomic updates)

---

#### Task 2.2: Domain Verification Endpoint
**Agent:** API development specialist
**Files:**
- `src/app/api/domains/[domainId]/verify/route.ts`

**Steps:**
1. Implement POST /api/domains/[domainId]/verify
2. Integrate DNS verification service
3. Update domain verification status
4. Return DNS instructions if failed
5. Add cache invalidation on verify
6. Test with real domains

**Acceptance Criteria:**
- ✅ Performs DNS lookup correctly
- ✅ Updates verification status in DB
- ✅ Returns detailed error messages
- ✅ Caching works correctly

---

#### Task 2.3: Update Link Endpoints
**Agent:** API development specialist
**Files:**
- `src/app/api/links/route.ts` (update POST)
- `src/app/api/links/[linkId]/route.ts` (update POST)

**Steps:**
1. Add domainId to createLink schema
2. Implement domain ownership validation
3. Implement auto-select primary domain logic
4. Add domain relation to link queries (include)
5. Return linkUrl computed field
6. Update existing tests

**Acceptance Criteria:**
- ✅ Links can be created with custom domain
- ✅ Primary domain auto-selected if not specified
- ✅ Domain ownership validated
- ✅ linkUrl generated correctly

---

#### Task 2.4: Update Config Endpoint
**Agent:** API development specialist
**Files:**
- `src/app/api/config/route.ts`

**Steps:**
1. Add umamiHost to response
2. Extract from UMAMI_HOST or LINKS_URL env var
3. Update TypeScript interface

**Acceptance Criteria:**
- ✅ umamiHost returned in config response
- ✅ Fallback logic works correctly

---

### Phase 3: Frontend Components

**CRITICAL:** Follow exact Umami patterns - DialogButton, DataTable, useMessages(), etc.

#### Task 3.1: Internationalization Setup
**Agent:** Internationalization specialist
**Files:**
- Message files (e.g., `src/messages/en-US.json`)

**Steps:**
1. Add all required message keys from section 8.1
2. Verify existing message keys can be reused (e.g., `labels.save`, `labels.delete`)
3. Test message interpolation with placeholders

**Acceptance Criteria:**
- ✅ All domain-related labels added
- ✅ All domain-related messages added
- ✅ No hardcoded text in any component

---

#### Task 3.2: React Query Hooks
**Agent:** Frontend hooks specialist
**Files:**
- `src/components/hooks/queries/domainsQuery.ts`
- `src/components/hooks/index.ts`

**Steps:**
1. Implement `useDomainsQuery()` with `usePagedQuery()` and `useModified()`
2. Implement `useDomainQuery()` with `useApi()` and `useModified()`
3. Export from main hooks index
4. Test with React Query DevTools

**Acceptance Criteria:**
- ✅ Hooks return correct data structure
- ✅ Cache invalidation via `touch()` works
- ✅ Loading/error states handled
- ✅ Team-scoped queries work

---

#### Task 3.3: Domain Management Page Structure
**Agent:** Frontend page specialist
**Files:**
- `src/app/(main)/domains/page.tsx`
- `src/app/(main)/domains/DomainsPage.tsx`
- `src/app/(main)/domains/DomainsDataTable.tsx`
- `src/app/(main)/domains/DomainsTable.tsx`

**Steps:**
1. Create `page.tsx` with metadata export (section 7.2)
2. Implement `DomainsPage.tsx` with PageBody/PageHeader/Panel (section 7.3)
3. Implement `DomainsDataTable.tsx` with DataGrid (section 7.4)
4. Implement `DomainsTable.tsx` with column definitions (section 7.5)
5. Test search and pagination via DataGrid
6. Verify responsive design

**Acceptance Criteria:**
- ✅ Page structure matches Links/Pixels pages
- ✅ DataGrid handles search/pagination
- ✅ All text via `useMessages()`
- ✅ Table columns display correctly

---

#### Task 3.4: Dialog Button Components
**Agent:** Frontend components specialist
**Files:**
- `src/app/(main)/domains/DomainAddButton.tsx`
- `src/app/(main)/domains/DomainEditButton.tsx`
- `src/app/(main)/domains/DomainDeleteButton.tsx`
- `src/app/(main)/domains/DomainVerifyButton.tsx`

**Steps:**
1. Implement `DomainAddButton` with DialogButton pattern (section 7.6)
2. Implement `DomainEditButton` with DialogButton pattern (section 7.7)
3. Implement `DomainDeleteButton` with ConfirmationForm (section 7.8)
4. Implement `DomainVerifyButton` with DialogButton pattern (section 7.9)
5. Test all buttons open dialogs correctly
6. Verify icons from `@/components/icons`

**Acceptance Criteria:**
- ✅ All buttons use DialogButton (not custom modals)
- ✅ Delete uses ConfirmationForm
- ✅ All text via `useMessages()`
- ✅ Buttons render in table actions column

---

#### Task 3.5: Form Components
**Agent:** Frontend forms specialist
**Files:**
- `src/app/(main)/domains/DomainEditForm.tsx`
- `src/app/(main)/domains/DomainVerifyForm.tsx`

**Steps:**
1. Implement `DomainEditForm` with `@umami/react-zen` Form components (section 7.10)
2. Use `useUpdateQuery()` for both create and update
3. Implement `DomainVerifyForm` with DNS instructions (section 7.11)
4. Test create flow (no domainId)
5. Test edit flow (with domainId)
6. Test validation errors
7. Verify `touch('domains')` invalidates cache

**Acceptance Criteria:**
- ✅ Unified form handles create and edit
- ✅ Uses Form/FormRow/FormInput from @umami/react-zen
- ✅ Uses `useUpdateQuery()` hook
- ✅ Cache invalidation works via `touch()`
- ✅ Success messages via `toast()`
- ✅ All text via `useMessages()`
- ✅ DNS instructions show CNAME details

---

#### Task 3.3: Update Link Form
**Agent:** Frontend forms specialist
**Files:**
- `src/app/(main)/links/LinkEditForm.tsx`

**Steps:**
1. Add domain selector dropdown
2. Load verified domains
3. Implement preview URL generation
4. Auto-select primary domain
5. Update form submission to include domainId
6. Test with existing links (should show domain)

**Acceptance Criteria:**
- ✅ Domain selector works
- ✅ Preview URL updates correctly
- ✅ Primary domain auto-selected
- ✅ Existing links show current domain

---

#### Task 3.4: Custom Hooks
**Agent:** Frontend hooks specialist
**Files:**
- `src/components/hooks/useDomains.ts`
- `src/components/hooks/useConfig.ts` (update)

**Steps:**
1. Implement useDomains() hook
2. Implement useDomain(id) hook
3. Update useConfig() to include umamiHost
4. Add TypeScript types
5. Test with React Query dev tools

**Acceptance Criteria:**
- ✅ Hooks return correct data
- ✅ Caching works (React Query)
- ✅ Loading/error states handled

---

### Phase 4: Integration & Testing

#### Task 4.1: Navigation Integration
**Agent:** Frontend integration specialist
**Files:**
- Navigation component

**Steps:**
1. Add "Domains" menu item
2. Add icon/indicator
3. Test navigation
4. Update mobile menu

**Acceptance Criteria:**
- ✅ Domains page accessible from menu
- ✅ Active state works correctly

---

#### Task 4.2: Environment Configuration
**Agent:** DevOps specialist
**Files:**
- `.env.example`
- `docker-compose.yml`
- Documentation

**Steps:**
1. Add UMAMI_HOST to .env.example
2. Update Docker Compose example
3. Add deployment documentation
4. Test with Docker setup

**Acceptance Criteria:**
- ✅ Environment variable documented
- ✅ Docker setup includes UMAMI_HOST
- ✅ Works in containerized environment

---

#### Task 4.3: End-to-End Testing
**Agent:** QA specialist
**Files:**
- Test suite

**Steps:**
1. Create domain via UI
2. View DNS instructions
3. Configure DNS (staging domain)
4. Verify domain
5. Create link with custom domain
6. Access link via custom domain
7. Test click tracking
8. Delete domain (verify links still work with default)

**Acceptance Criteria:**
- ✅ Full user flow works
- ✅ DNS verification accurate
- ✅ Links work with custom domains
- ✅ Graceful degradation (domain deleted → use default)

---

#### Task 4.4: Documentation
**Agent:** Technical writer
**Files:**
- README updates
- Deployment guide
- User guide

**Steps:**
1. Write DNS setup guide
2. Document environment variables
3. Add troubleshooting section
4. Create user guide with screenshots
5. Update API documentation

**Acceptance Criteria:**
- ✅ Clear DNS setup instructions
- ✅ Deployment guide complete
- ✅ Troubleshooting covers common issues

---

## 10. Testing Requirements

### 10.1 Unit Tests

**DNS Service Tests:**
```typescript
describe('DNS Verification', () => {
  test('should verify valid CNAME', async () => {
    const result = await verifyDomainDNS('test.roberto.lol');
    expect(result.verified).toBe(true);
  });

  test('should reject incorrect CNAME target', async () => {
    const result = await verifyDomainDNS('wrong.example.com');
    expect(result.verified).toBe(false);
    expect(result.error).toContain('wrong target');
  });

  test('should parse subdomain correctly', () => {
    const { subdomain, root } = parseDomain('test.roberto.lol');
    expect(subdomain).toBe('test');
    expect(root).toBe('roberto.lol');
  });
});
```

**Permission Tests:**
```typescript
describe('Domain Permissions', () => {
  test('user can view own domain', async () => {
    const canView = await canViewDomain(userAuth, userDomain.id);
    expect(canView).toBe(true);
  });

  test('user cannot view other user domain', async () => {
    const canView = await canViewDomain(userAuth, otherUserDomain.id);
    expect(canView).toBe(false);
  });

  test('team member can view team domain', async () => {
    const canView = await canViewDomain(teamMemberAuth, teamDomain.id);
    expect(canView).toBe(true);
  });
});
```

### 10.2 Integration Tests

**API Endpoint Tests:**
```typescript
describe('POST /api/domains', () => {
  test('should create domain successfully', async () => {
    const response = await fetch('/api/domains', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test.example.com',
        description: 'Test domain',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.domain.name).toBe('test.example.com');
    expect(data.dnsInstructions).toBeDefined();
  });

  test('should reject duplicate domain', async () => {
    // Create first domain
    await createDomain('test.example.com');

    // Try to create duplicate
    const response = await fetch('/api/domains', {
      method: 'POST',
      body: JSON.stringify({ name: 'test.example.com' }),
    });

    expect(response.status).toBe(409);
  });
});
```

### 10.3 E2E Tests

**User Journey:**
1. User logs in
2. Navigates to Domains page
3. Clicks "Add Domain"
4. Enters domain name
5. Sees DNS instructions
6. Clicks "Verify DNS"
7. Sees verification status
8. Creates link with custom domain
9. Accesses link via custom domain
10. Sees click tracked

---

## 11. Future Enhancements (Phase 2)

### 11.1 Click Tracking per Domain
- Track which domain generated each click
- Add domain filter to analytics
- Domain performance dashboard

### 11.2 SSL Certificate Management
- Auto-provision SSL certificates (Let's Encrypt)
- Certificate status indicators
- Auto-renewal

### 11.3 Advanced DNS Support
- Apex domain support (A records)
- Multiple CNAME targets
- Subdomain wildcard support

### 11.4 Domain Analytics
- Click-through rate per domain
- Geographic distribution by domain
- Referrer analysis by domain

### 11.5 Bulk Operations
- Import multiple domains
- Bulk verification
- Export domain list

---

## 12. Deployment Checklist

### Pre-Deployment
- [ ] Run database migration
- [ ] Set UMAMI_HOST environment variable
- [ ] Test DNS verification with staging domain
- [ ] Review and merge all PRs
- [ ] Update documentation

### Deployment
- [ ] Deploy backend changes
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Deploy frontend changes
- [ ] Verify environment variables set
- [ ] Test domain creation in production

### Post-Deployment
- [ ] Monitor error logs
- [ ] Verify DNS verification works
- [ ] Test link generation with custom domain
- [ ] Gather user feedback
- [ ] Plan phase 2 enhancements

---

## 13. Success Metrics

**Technical Metrics:**
- DNS verification accuracy: >99%
- Domain creation time: <2 seconds
- Link generation with domain: <500ms
- Zero downtime during deployment

**User Metrics:**
- % of users who add custom domain: Target >20%
- % of links using custom domains: Target >30%
- DNS setup completion rate: Target >80%
- User satisfaction: Target 4.5/5 stars

---

## 14. Risk Mitigation

**Risk 1: DNS Propagation Delays**
- Mitigation: Clear messaging about 12-hour propagation time
- Provide retry mechanism
- Cache failed attempts short-term (5 min)

**Risk 2: CNAME Conflicts**
- Mitigation: Validate domain uniqueness
- Check for existing DNS records
- Provide clear error messages

**Risk 3: Domain Deletion Impact**
- Mitigation: Soft delete pattern
- CASCADE SET NULL for links/pixels
- Warning before deletion with count

**Risk 4: Performance (DNS Lookups)**
- Mitigation: Redis caching (1-hour TTL)
- Async verification
- Rate limiting

---

## End of Implementation Plan

**Last Updated:** 2026-01-06
**Version:** 1.0
**Author:** Implementation Planning Agent
