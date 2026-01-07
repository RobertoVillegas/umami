# Multi-Domain Feature - Agent Implementation Guide

**Branch:** `feature/multi-domain-support`
**Project:** Umami (Analytics Platform)
**Goal:** Add multi-domain support for short links, similar to Dub.co

---

## 🎯 MISSION

You are implementing a **multi-domain management system** for Umami that allows users and teams to:
- Add custom domains (e.g., `links.company.com`)
- Verify DNS configuration via CNAME lookup
- Select which domain to use for each short link
- Manage domains with full CRUD operations

**CRITICAL SUCCESS FACTOR:** Your code MUST match Umami's existing patterns exactly. This is a PR into their open-source project - quality and consistency are non-negotiable.

---

## 📚 REQUIRED READING

**Before starting ANY task, you MUST:**

1. **Read the implementation plan:** `MULTI_DOMAIN_IMPLEMENTATION_PLAN.md`
2. **Study these existing features** to understand Umami's patterns:
   - `/src/app/(main)/links/` - Links feature (REFERENCE THIS)
   - `/src/app/(main)/pixels/` - Pixels feature (REFERENCE THIS)
   - `/src/queries/prisma/link.ts` - Database query patterns
   - `/src/permissions/link.ts` - Permission patterns
   - `/src/app/api/links/route.ts` - API endpoint patterns

3. **Key Pattern Files:**
   - Component pattern: `/src/app/(main)/links/LinkEditForm.tsx`
   - Dialog pattern: `/src/app/(main)/links/LinkAddButton.tsx`
   - Table pattern: `/src/app/(main)/links/LinksTable.tsx`
   - Hooks pattern: `/src/components/hooks/queries/linksQuery.ts`

**DO NOT START CODING until you understand these patterns!**

---

## 🏗️ ARCHITECTURE OVERVIEW

```
User adds domain → DNS verification → Domain verified →
Create link with domain → Generated: https://custom.com/q/abc123
```

**Tech Stack:**
- **Backend:** Next.js 15 App Router, Prisma (PostgreSQL)
- **Frontend:** React, @umami/react-zen components, TanStack React Table
- **State:** React Query with custom cache invalidation (`useModified` + `touch`)
- **Styling:** Existing Umami design system

**Key Umami Patterns You'll Use:**
- `DialogButton` for modals (NOT custom Modal components)
- `useMessages()` for ALL text (internationalization)
- `useUpdateQuery()` / `useDeleteQuery()` for mutations
- `useModified()` + `touch()` for cache invalidation
- `Form` / `FormRow` / `FormInput` from `@umami/react-zen`
- `DataGrid` + `DataTable` for list views
- Await `params` in dynamic routes (Next.js 15)

---

## 🚀 IMPLEMENTATION PHASES

### PHASE 1: Database & Backend (Complete First)
1. Database schema
2. DNS verification service
3. Prisma queries
4. Permission handlers
5. API endpoints

### PHASE 2: Frontend (After Phase 1 Complete)
6. Internationalization
7. React Query hooks
8. Page structure
9. Components
10. Integration

**Complete Phase 1 entirely before starting Phase 2.**

---

## 📋 TASK-BY-TASK INSTRUCTIONS

## TASK 1: Database Schema Setup

**Agent Type:** Database specialist
**Priority:** HIGHEST (blocking all other tasks)
**Reference:** Plan Section 3

### What You're Building
Add a new `Domain` table and update `Link`/`Pixel` tables to reference domains.

### Step-by-Step Instructions

1. **Study the existing schema:**
   ```bash
   cat prisma/schema.prisma | grep -A 20 "model Link"
   cat prisma/schema.prisma | grep -A 20 "model Pixel"
   ```
   Notice the patterns: field naming, indexes, relations.

2. **Find the next migration number:**
   ```bash
   ls prisma/migrations/ | grep -oE '^[0-9]+' | sort -n | tail -1
   ```
   Your migration will be `{N+1}_add_multi_domain_support`

3. **Add Domain model** to `prisma/schema.prisma`:
   - Copy EXACTLY from Plan Section 3.1
   - Ensure `@map()` matches pattern: `@map("domain_id")`
   - Ensure `@db.Uuid` for IDs
   - Ensure `@db.VarChar(N)` for strings
   - Add ALL indexes as specified

4. **Update Link model** (`prisma/schema.prisma`):
   ```prisma
   model Link {
     // ... existing fields ...
     domainId  String?   @map("domain_id") @db.Uuid  // ADD THIS

     // ... existing relations ...
     domain Domain? @relation("domainLinks", fields: [domainId], references: [id], onDelete: SetNull)  // ADD THIS

     // ... existing indexes ...
     @@index([domainId])  // ADD THIS
   }
   ```

5. **Update Pixel model** (same pattern as Link)

6. **Update User model**:
   ```prisma
   model User {
     // ... existing relations ...
     domains   Domain[]   @relation("userDomains")  // ADD THIS
   }
   ```

7. **Update Team model**:
   ```prisma
   model Team {
     // ... existing relations ...
     domains  Domain[]   @relation("teamDomains")  // ADD THIS
   }
   ```

8. **Generate migration:**
   ```bash
   npx prisma migrate dev --name 15_add_multi_domain_support
   ```

9. **Verify:**
   ```bash
   npx prisma studio
   ```
   Check that `domain` table exists with all fields.

### Quality Checklist
- [ ] Domain model matches Plan Section 3.1 EXACTLY
- [ ] All field names use snake_case in DB (`@map("field_name")`)
- [ ] All camelCase in Prisma schema
- [ ] All indexes created
- [ ] Migration numbered sequentially
- [ ] Migration runs without errors
- [ ] `Link` and `Pixel` models updated
- [ ] `User` and `Team` models updated
- [ ] Prisma Client regenerated successfully

### Success Criteria
```bash
# This should work:
npx prisma studio
# Navigate to "domain" table - it should exist with all fields

# This should show domain relation:
cat src/generated/prisma/index.d.ts | grep -A 5 "interface Domain"
```

---

## TASK 2: DNS Verification Service

**Agent Type:** Backend utilities specialist
**Priority:** HIGH
**Reference:** Plan Section 4

### What You're Building
Service to verify domain DNS configuration via CNAME lookup.

### Step-by-Step Instructions

1. **Study Node.js DNS module:**
   ```bash
   # Look at examples in the codebase
   grep -r "dns" src/lib/ --include="*.ts"
   ```

2. **Create DNS utilities** - `src/lib/dns.ts`:
   - Copy EXACTLY from Plan Section 4.2
   - Pay attention to error handling
   - Normalize DNS responses (remove trailing dots)
   - Parse subdomains correctly

3. **Create DNS caching** - `src/lib/dns-cache.ts`:
   - Copy from Plan Section 4.3
   - Use Redis if available (check existing Redis usage)
   - TTL: 1 hour for success, 5 min for failures

4. **Create verification wrapper** - `src/lib/dns-verification.ts`:
   - Copy from Plan Section 4.4
   - Integrates cache with DNS lookup

5. **Test locally:**
   ```bash
   # Create a test file
   cat > test-dns.ts << 'EOF'
   import { verifyDomainDNS } from './src/lib/dns';

   (async () => {
     const result = await verifyDomainDNS('google.com');
     console.log(result);
   })();
   EOF

   npx tsx test-dns.ts
   ```

### Quality Checklist
- [ ] DNS lookup handles errors gracefully
- [ ] CNAME records normalized (trailing dots removed)
- [ ] Cache implemented with proper TTLs
- [ ] `getInstanceHostname()` reads from env vars
- [ ] `parseDomain()` correctly extracts subdomain
- [ ] `isValidDomain()` validates format
- [ ] All TypeScript types defined
- [ ] No external dependencies added (use Node.js `dns` module)

### Success Criteria
```typescript
// This should work:
import { verifyDomainDNS, parseDomain } from '@/lib/dns';

const result = await verifyDomainDNS('test.example.com');
// Returns: { verified: boolean, cnameTarget?: string, error?: string }

const parsed = parseDomain('test.example.com');
// Returns: { subdomain: 'test', root: 'example.com' }
```

---

## TASK 3: Prisma Queries

**Agent Type:** Database queries specialist
**Priority:** HIGH (blocks API endpoints)
**Reference:** Plan Section 6.1

### What You're Building
Database query functions following Umami's exact patterns.

### Step-by-Step Instructions

1. **CRITICAL: Study the existing query patterns:**
   ```bash
   cat src/queries/prisma/link.ts
   ```
   Notice:
   - `findLink()` - generic with criteria
   - `getLink()` - specific by ID
   - `getLinks()` - paginated with filters
   - `getUserLinks()` - user-scoped
   - `getTeamLinks()` - team-scoped
   - `createLink()` / `updateLink()` / `deleteLink()` - mutations

2. **Create** `src/queries/prisma/domain.ts`:
   - Copy EXACTLY from Plan Section 6.1
   - Match the naming pattern: `findDomain`, `getDomain`, `getDomains`, etc.
   - Use `prisma.client.domain` for all operations
   - Use `pagedQuery()` helper from `prisma`
   - Use `getSearchParameters()` helper for search

3. **Export from index:**
   Add to `src/queries/prisma/index.ts`:
   ```typescript
   export * from './domain';
   ```

4. **Test queries:**
   ```bash
   # After migration is run, test in Prisma Studio or create test script
   ```

### Quality Checklist
- [ ] Function names match pattern: `findDomain`, `getDomain`, `getDomains`
- [ ] User/team scoped queries filter `deletedAt: null`
- [ ] `pagedQuery()` used for pagination
- [ ] `getSearchParameters()` used for search
- [ ] All functions typed with Prisma types
- [ ] Exported from `index.ts`
- [ ] Primary domain queries included
- [ ] Stats function counts links/pixels

### Success Criteria
```typescript
// These should all type-check:
import { getDomain, getUserDomains, createDomain } from '@/queries/prisma';

const domain = await getDomain('some-uuid');
const domains = await getUserDomains('user-uuid', { page: 1, limit: 10 });
const newDomain = await createDomain({ id: uuid(), name: 'test.com', userId: 'user-uuid' });
```

---

## TASK 4: Permission Handlers

**Agent Type:** Security/permissions specialist
**Priority:** HIGH (blocks API endpoints)
**Reference:** Plan Section 6.2

### What You're Building
Authorization functions following Umami's permission patterns.

### Step-by-Step Instructions

1. **Study existing permissions:**
   ```bash
   cat src/permissions/link.ts
   ```
   Notice the pattern:
   - Check `user.isAdmin` first
   - Then check ownership (`userId` match)
   - Then check team membership with role permissions
   - Always return boolean

2. **Create** `src/permissions/domain.ts`:
   - Copy EXACTLY from Plan Section 6.2
   - Functions: `canViewDomain`, `canUpdateDomain`, `canDeleteDomain`, `canCreateDomain`
   - Use `hasPermission()` helper for team role checks
   - Use `PERMISSIONS` constants from `@/lib/constants`

3. **Export from index:**
   Add to `src/permissions/index.ts`:
   ```typescript
   export * from './domain';
   ```

### Quality Checklist
- [ ] Admin check always first (`if (user.isAdmin) return true`)
- [ ] Owner check (`userId` match)
- [ ] Team member check (via `getTeamUser()`)
- [ ] Team role permissions check (via `hasPermission()`)
- [ ] All functions return boolean
- [ ] All functions accept `Auth` object
- [ ] Exported from `index.ts`

### Success Criteria
```typescript
// These should all work:
import { canViewDomain, canUpdateDomain } from '@/permissions';

const canView = await canViewDomain({ user }, 'domain-id');
const canUpdate = await canUpdateDomain({ user }, 'domain-id');
```

---

## TASK 5: API Endpoints

**Agent Type:** API development specialist
**Priority:** HIGH (blocks frontend)
**Reference:** Plan Section 5

### What You're Building
REST API endpoints following Umami's exact patterns.

### Step-by-Step Instructions

**CRITICAL: Study existing API patterns first!**
```bash
cat src/app/api/links/route.ts
cat src/app/api/links/[linkId]/route.ts
```

Notice:
- Use `parseRequest()` from `@/lib/request`
- Use Zod schemas for validation
- Permission checks AFTER validation
- Use response helpers: `json()`, `unauthorized()`, `badRequest()`, `serverError()`
- Handle unique constraint errors

### 5A: Main Domain Endpoints

**Create:** `src/app/api/domains/route.ts`

```typescript
import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams } from '@/lib/schema';
import { canCreateDomain } from '@/permissions';
import { createDomain, getUserDomains } from '@/queries/prisma';

export async function GET(request: Request) {
  const schema = z.object({
    ...pagingParams,
    ...searchParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const filters = await getQueryFilters(query);
  const domains = await getUserDomains(auth.user.id, filters);

  return json(domains);
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(500).optional(),
    teamId: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
    id: z.uuid().nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { id, name, description, teamId, isPrimary } = body;

  if (!(await canCreateDomain(auth, teamId))) {
    return unauthorized();
  }

  const data: any = {
    id: id ?? uuid(),
    name,
    description,
    isPrimary: isPrimary ?? false,
    teamId,
  };

  if (!teamId) {
    data.userId = auth.user.id;
  }

  const result = await createDomain(data);

  return json(result);
}
```

### 5B: Domain Detail Endpoints

**Create:** `src/app/api/domains/[domainId]/route.ts`

**CRITICAL: Next.js 15 Pattern - params is a Promise!**

```typescript
import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, serverError, unauthorized } from '@/lib/response';
import { canUpdateDomain, canDeleteDomain, canViewDomain } from '@/permissions';
import { getDomain, updateDomain, deleteDomain } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },  // ✅ Promise wrapper
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;  // ✅ Await params!

  if (!(await canViewDomain(auth, domainId))) {
    return unauthorized();
  }

  const domain = await getDomain(domainId);

  return json(domain);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },  // ✅ Promise wrapper
) {
  const schema = z.object({
    description: z.string().max(500).optional(),
    isPrimary: z.boolean().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { domainId } = await params;  // ✅ Await params!

  if (!(await canUpdateDomain(auth, domainId))) {
    return unauthorized();
  }

  try {
    const result = await updateDomain(domainId, body);
    return json(result);
  } catch (e: any) {
    if (e.message.toLowerCase().includes('unique constraint')) {
      return badRequest({ message: 'Domain name already in use.' });
    }
    return serverError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },  // ✅ Promise wrapper
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;  // ✅ Await params!

  if (!(await canDeleteDomain(auth, domainId))) {
    return unauthorized();
  }

  await deleteDomain(domainId);

  return json({ success: true });
}
```

### 5C: Domain Verification Endpoint

**Create:** `src/app/api/domains/[domainId]/verify/route.ts`

```typescript
import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateDomain } from '@/permissions';
import { getDomain, updateDomainVerification } from '@/queries/prisma';
import { verifyDomain } from '@/lib/dns-verification';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const schema = z.object({
    forceRefresh: z.boolean().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  if (!(await canUpdateDomain(auth, domainId))) {
    return unauthorized();
  }

  const domain = await getDomain(domainId);
  const result = await verifyDomain(domain.name, body.forceRefresh);

  await updateDomainVerification(domainId, result.verified);

  return json({
    verified: result.verified,
    cnameTarget: result.cnameTarget,
    error: result.error,
    details: result.details,
  });
}
```

### 5D: Team Domain Endpoints (Read-Only)

**Create:** `src/app/api/teams/[teamId]/domains/route.ts`

```typescript
import { z } from 'zod';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams } from '@/lib/schema';
import { canViewTeam } from '@/permissions';
import { getTeamDomains } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const schema = z.object({
    ...pagingParams,
    ...searchParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { teamId } = await params;

  if (!(await canViewTeam(auth, teamId))) {
    return unauthorized();
  }

  const filters = await getQueryFilters(query);
  const domains = await getTeamDomains(teamId, filters);

  return json(domains);
}
```

### Quality Checklist - APIs
- [ ] All endpoints use `parseRequest()`
- [ ] All validation uses Zod schemas
- [ ] Permission checks after validation
- [ ] All dynamic routes await `params`
- [ ] Unique constraint errors caught and handled
- [ ] Team routes are GET only
- [ ] Response helpers used (`json`, `unauthorized`, etc.)
- [ ] UUIDs generated with `uuid()` from `@/lib/crypto`

### Success Criteria - APIs
```bash
# Test with curl (after starting dev server)
curl http://localhost:3000/api/domains -H "Cookie: ..." | jq
# Should return domains array

curl -X POST http://localhost:3000/api/domains \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"name": "test.example.com"}' | jq
# Should create domain
```

---

## TASK 6: Internationalization

**Agent Type:** Internationalization specialist
**Priority:** CRITICAL (blocks all frontend)
**Reference:** Plan Section 8

### What You're Building
Message keys for all user-facing text.

### Step-by-Step Instructions

1. **Find message files:**
   ```bash
   find src -name "*.json" | grep -i message
   # Or check package structure
   ```

2. **Study existing messages:**
   ```bash
   cat src/messages/en-US.json  # Or wherever they are
   ```
   Notice the structure: `labels` and `messages` sections.

3. **Add domain-related keys:**
   - Copy from Plan Section 8.1
   - Add to `labels` section
   - Add to `messages` section

4. **Verify no hardcoded text:**
   After frontend is built, run:
   ```bash
   grep -r "Add Domain\|Verify\|DNS" src/app/(main)/domains/
   # Should only find uses via formatMessage()
   ```

### Quality Checklist
- [ ] All keys in camelCase
- [ ] Labels for UI elements
- [ ] Messages for notifications/instructions
- [ ] No hardcoded English text in components

---

## TASK 7: React Query Hooks

**Agent Type:** Frontend hooks specialist
**Priority:** HIGH (blocks frontend components)
**Reference:** Plan Section 7.12

### What You're Building
Custom React Query hooks following Umami's cache invalidation pattern.

### Step-by-Step Instructions

1. **CRITICAL: Study existing hooks:**
   ```bash
   cat src/components/hooks/queries/linksQuery.ts
   ```
   Notice:
   - Use `useModified()` hook
   - Use `usePagedQuery()` for lists
   - Use `useApi()` hook instead of fetch
   - Include `modified` in queryKey

2. **Create:** `src/components/hooks/queries/domainsQuery.ts`
   - Copy EXACTLY from Plan Section 7.12
   - Two hooks: `useDomainsQuery()` and `useDomainQuery()`

3. **Export from index:**
   Add to `src/components/hooks/index.ts`:
   ```typescript
   export * from './queries/domainsQuery';
   ```

### Quality Checklist
- [ ] Uses `useModified()` for cache tracking
- [ ] Uses `usePagedQuery()` for list query
- [ ] Uses `useApi()` hook
- [ ] Includes `modified` in queryKey
- [ ] Supports team-scoped queries
- [ ] Exported from hooks index

### Success Criteria
```typescript
// In a component:
import { useDomainsQuery, useDomainQuery } from '@/components/hooks';

const { data, isLoading } = useDomainsQuery({ teamId });
const { data: domain } = useDomainQuery(domainId);
```

---

## TASK 8: Page Structure Components

**Agent Type:** Frontend page specialist
**Priority:** HIGH
**Reference:** Plan Sections 7.2-7.5

### What You're Building
Main page structure: metadata, page component, data table wrapper, table columns.

### Step-by-Step Instructions

**CRITICAL: Study existing page structure first!**
```bash
cat src/app/(main)/links/page.tsx
cat src/app/(main)/links/LinksPage.tsx
cat src/app/(main)/links/LinksDataTable.tsx
cat src/app/(main)/links/LinksTable.tsx
```

### 8A: Page Metadata

**Create:** `src/app/(main)/domains/page.tsx`

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

### 8B: Main Page Component

**Create:** `src/app/(main)/domains/DomainsPage.tsx`

- Copy EXACTLY from Plan Section 7.3
- Use `PageBody`, `PageHeader`, `Panel` components
- Use `Column` from `@umami/react-zen`
- Use `useMessages()` for all text
- Add `'use client'` directive at top

### 8C: DataTable Wrapper

**Create:** `src/app/(main)/domains/DomainsDataTable.tsx`

- Copy EXACTLY from Plan Section 7.4
- Use `DataGrid` component
- Pass `useDomainsQuery()` result
- Add `'use client'` directive

### 8D: Table Columns

**Create:** `src/app/(main)/domains/DomainsTable.tsx`

- Copy EXACTLY from Plan Section 7.5
- Use `@tanstack/react-table` types
- Define columns with header/accessorKey/cell
- Add action buttons in actions column
- Add `'use client'` directive

### Quality Checklist - Page Structure
- [ ] `page.tsx` only exports metadata and default component
- [ ] `DomainsPage.tsx` uses PageBody/PageHeader/Panel
- [ ] All components have `'use client'` directive
- [ ] All text via `useMessages()`
- [ ] DataGrid integrated with query hook
- [ ] Table columns defined with ColumnDef type
- [ ] Action buttons rendered in actions column

---

## TASK 9: Dialog Button Components

**Agent Type:** Frontend components specialist
**Priority:** HIGH
**Reference:** Plan Sections 7.6-7.9

### What You're Building
Button components that open dialogs (Add, Edit, Delete, Verify).

### Step-by-Step Instructions

**CRITICAL: Study existing button patterns!**
```bash
cat src/app/(main)/links/LinkAddButton.tsx
cat src/app/(main)/links/LinkEditButton.tsx
cat src/app/(main)/links/LinkDeleteButton.tsx
```

Notice:
- Use `DialogButton` component (NOT custom modals)
- `DialogButton` provides `close` callback
- Delete uses `ConfirmationForm`
- Icons from `@/components/icons`

### 9A: Add Button

**Create:** `src/app/(main)/domains/DomainAddButton.tsx`

- Copy EXACTLY from Plan Section 7.6
- Use `DialogButton` with `Plus` icon
- Pass `close` to form component

### 9B: Edit Button

**Create:** `src/app/(main)/domains/DomainEditButton.tsx`

- Copy EXACTLY from Plan Section 7.7
- Use `DialogButton` with `Pencil` icon
- Pass `domainId` to form

### 9C: Delete Button

**Create:** `src/app/(main)/domains/DomainDeleteButton.tsx`

- Copy EXACTLY from Plan Section 7.8
- Use `DialogButton` + `ConfirmationForm`
- Use `useDeleteQuery()` hook
- Use `touch('domains')` on success
- Use `FormattedMessage` for message with placeholders

### 9D: Verify Button

**Create:** `src/app/(main)/domains/DomainVerifyButton.tsx`

- Copy EXACTLY from Plan Section 7.9
- Use `DialogButton` with `RefreshCw` icon
- Opens verify form

### Quality Checklist - Buttons
- [ ] All use `DialogButton` (not custom modals)
- [ ] All have `'use client'` directive
- [ ] All text via `useMessages()`
- [ ] Icons from `@/components/icons`
- [ ] Delete uses `ConfirmationForm`
- [ ] Delete uses `useDeleteQuery()`
- [ ] All use `touch('domains')` for cache invalidation

---

## TASK 10: Form Components

**Agent Type:** Frontend forms specialist
**Priority:** HIGH
**Reference:** Plan Sections 7.10-7.11

### What You're Building
Forms for creating/editing domains and verifying DNS.

### Step-by-Step Instructions

**CRITICAL: Study existing form pattern!**
```bash
cat src/app/(main)/links/LinkEditForm.tsx
```

Notice:
- Use `Form`, `FormRow`, `FormInput`, `FormButtons` from `@umami/react-zen`
- Use `useUpdateQuery()` hook (NOT useMutation)
- URL determines create vs update
- Use `touch()` for cache invalidation
- Use `toast()` for success messages
- Show `<Loading placement="absolute" />` while loading data

### 10A: Edit Form (Unified Create/Edit)

**Create:** `src/app/(main)/domains/DomainEditForm.tsx`

- Copy EXACTLY from Plan Section 7.10
- Use `@umami/react-zen` form components
- Use `useUpdateQuery()` hook
- Disable domain name field when editing
- Handle both create (no domainId) and edit (with domainId)

### 10B: Verify Form

**Create:** `src/app/(main)/domains/DomainVerifyForm.tsx`

- Copy EXACTLY from Plan Section 7.11
- Show DNS instructions (CNAME table)
- Use `CopyInput` for easy copying
- Show verification status
- Call `/api/domains/${domainId}/verify` endpoint

### Quality Checklist - Forms
- [ ] All have `'use client'` directive
- [ ] Use Form/FormRow/FormInput from @umami/react-zen
- [ ] Use `useUpdateQuery()` for mutations
- [ ] Use `touch('domains')` on success
- [ ] Use `toast()` for success messages
- [ ] All text via `useMessages()`
- [ ] Loading state shows `<Loading />`
- [ ] Edit form disables name field when editing
- [ ] Verify form shows DNS table with CNAME details

---

## 🎨 CODING STANDARDS

### TypeScript
```typescript
// ✅ CORRECT
type Props = {
  domainId?: string;
  onClose?: () => void;
};

// ❌ WRONG
interface Props {  // Prefer 'type' over 'interface'
  domainId?: string;
  onClose?: () => void;
}
```

### Imports Order
```typescript
// 1. External packages
import { useEffect, useState } from 'react';
import { Button, Form } from '@umami/react-zen';

// 2. @/ internal imports
import { useMessages, useDomainQuery } from '@/components/hooks';
import { RefreshCw } from '@/components/icons';

// 3. Relative imports
import { DomainEditForm } from './DomainEditForm';
```

### Component Structure
```typescript
'use client';  // Always first line for client components

import ...

export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks
  const { formatMessage, labels } = useMessages();
  const [state, setState] = useState();

  // 2. Event handlers
  const handleSubmit = async () => { ... };

  // 3. Effects
  useEffect(() => { ... }, []);

  // 4. Render
  return ( ... );
}
```

### Text Handling
```typescript
// ✅ CORRECT - Always use useMessages()
const { formatMessage, labels } = useMessages();
<h1>{formatMessage(labels.domains)}</h1>

// ❌ WRONG - Never hardcode text
<h1>Domains</h1>
```

### Cache Invalidation
```typescript
// ✅ CORRECT - Use touch()
const { mutateAsync, touch, toast } = useUpdateQuery('/domains');
await mutateAsync(data, {
  onSuccess: () => {
    touch('domains');  // Invalidate cache
    toast(formatMessage(messages.saved));
  }
});

// ❌ WRONG - Don't use invalidateQueries
queryClient.invalidateQueries(['domains']);  // DON'T DO THIS
```

---

## ✅ QUALITY VERIFICATION

### Before Submitting EACH Task

1. **Code Review Against Reference:**
   ```bash
   # Compare your code with reference implementations
   diff -u src/app/(main)/links/LinksPage.tsx src/app/(main)/domains/DomainsPage.tsx
   ```
   Structure should be nearly identical.

2. **TypeScript Check:**
   ```bash
   npm run type-check
   # OR
   npx tsc --noEmit
   ```
   Must pass with ZERO errors.

3. **Lint Check:**
   ```bash
   npm run lint
   # OR
   npx biome check src/
   ```
   Must pass.

4. **Pattern Compliance:**
   - [ ] Uses exact Umami patterns from reference files
   - [ ] No custom implementations where Umami has helpers
   - [ ] All text internationalized
   - [ ] No hardcoded strings

5. **Test Manually:**
   ```bash
   npm run dev
   # Navigate to http://localhost:3000/domains
   ```
   - [ ] Page loads without errors
   - [ ] Can create domain
   - [ ] Can edit domain
   - [ ] Can delete domain
   - [ ] Can verify DNS
   - [ ] Search works
   - [ ] Pagination works

---

## 🚨 COMMON PITFALLS TO AVOID

### ❌ DON'T DO THIS:

1. **Custom Modals:**
   ```typescript
   // ❌ WRONG
   const [showModal, setShowModal] = useState(false);
   {showModal && <Modal><Form /></Modal>}

   // ✅ CORRECT
   <DialogButton>{({ close }) => <Form onClose={close} />}</DialogButton>
   ```

2. **Hardcoded Text:**
   ```typescript
   // ❌ WRONG
   <button>Add Domain</button>

   // ✅ CORRECT
   const { formatMessage, labels } = useMessages();
   <button>{formatMessage(labels.addDomain)}</button>
   ```

3. **Wrong Cache Invalidation:**
   ```typescript
   // ❌ WRONG
   queryClient.invalidateQueries(['domains']);

   // ✅ CORRECT
   const { touch } = useUpdateQuery('/domains');
   touch('domains');
   ```

4. **Not Awaiting Params (Next.js 15):**
   ```typescript
   // ❌ WRONG
   export async function GET(request, { params }: { params: { domainId: string } }) {
     const { domainId } = params;  // Error!
   }

   // ✅ CORRECT
   export async function GET(request, { params }: { params: Promise<{ domainId: string }> }) {
     const { domainId } = await params;  // Must await!
   }
   ```

5. **Wrong Form Components:**
   ```typescript
   // ❌ WRONG
   <form onSubmit={handleSubmit}>
     <input type="text" />
   </form>

   // ✅ CORRECT
   import { Form, FormRow, FormInput } from '@umami/react-zen';
   <Form onSubmit={handleSubmit}>
     <FormRow>
       <FormInput name="domain" />
     </FormRow>
   </Form>
   ```

---

## 📊 PROGRESS TRACKING

### Task Completion Checklist

**Phase 1: Backend**
- [ ] Task 1: Database schema ✅
- [ ] Task 2: DNS verification service ✅
- [ ] Task 3: Prisma queries ✅
- [ ] Task 4: Permission handlers ✅
- [ ] Task 5: API endpoints ✅

**Phase 2: Frontend**
- [ ] Task 6: Internationalization ✅
- [ ] Task 7: React Query hooks ✅
- [ ] Task 8: Page structure ✅
- [ ] Task 9: Dialog buttons ✅
- [ ] Task 10: Forms ✅

### Final Integration Checklist
- [ ] Navigation link added
- [ ] All pages load without errors
- [ ] All CRUD operations work
- [ ] DNS verification works
- [ ] Search works
- [ ] Pagination works
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No lint errors

---

## 🎯 SUCCESS CRITERIA

### You're Done When:

1. **All tasks completed** ✅
2. **Manual testing passes:**
   - Go to `/domains`
   - Add a domain
   - Verify DNS (shows instructions)
   - Edit domain
   - Delete domain
   - Search works
   - Pagination works

3. **Code quality checks pass:**
   ```bash
   npm run type-check  # 0 errors
   npm run lint        # 0 errors
   npm run build       # Succeeds
   ```

4. **Pattern compliance verified:**
   - All components match Links/Pixels patterns
   - No custom implementations where Umami has helpers
   - All text internationalized
   - Cache invalidation via `touch()`

5. **Ready for PR:**
   - All code follows Umami conventions
   - No breaking changes
   - No external dependencies added
   - Git history clean

---

## 🆘 GET HELP

### If You're Stuck:

1. **Pattern Questions:**
   - Look at Links feature: `/src/app/(main)/links/`
   - Look at Pixels feature: `/src/app/(main)/pixels/`
   - Patterns are identical - just replace "Link" with "Domain"

2. **API Questions:**
   - Reference: `/src/app/api/links/`
   - Same patterns apply

3. **Hook Questions:**
   - Reference: `/src/components/hooks/queries/linksQuery.ts`
   - Same pattern with different resource name

4. **Can't Find Something:**
   ```bash
   # Find component
   find src -name "*Link*" -type f

   # Find usage
   grep -r "DialogButton" src/app

   # Find hook
   grep -r "useMessages" src/components
   ```

---

## 🎁 BONUS: Quick Reference

### Key Files by Pattern
```
Pattern: Page Structure
Reference: src/app/(main)/links/page.tsx
Your file: src/app/(main)/domains/page.tsx

Pattern: Main Page Component
Reference: src/app/(main)/links/LinksPage.tsx
Your file: src/app/(main)/domains/DomainsPage.tsx

Pattern: Add Button
Reference: src/app/(main)/links/LinkAddButton.tsx
Your file: src/app/(main)/domains/DomainAddButton.tsx

Pattern: Edit Form
Reference: src/app/(main)/links/LinkEditForm.tsx
Your file: src/app/(main)/domains/DomainEditForm.tsx

Pattern: Delete Button
Reference: src/app/(main)/links/LinkDeleteButton.tsx
Your file: src/app/(main)/domains/DomainDeleteButton.tsx

Pattern: Queries
Reference: src/queries/prisma/link.ts
Your file: src/queries/prisma/domain.ts

Pattern: Permissions
Reference: src/permissions/link.ts
Your file: src/permissions/domain.ts

Pattern: API Endpoints
Reference: src/app/api/links/route.ts
Your file: src/app/api/domains/route.ts

Pattern: React Query Hooks
Reference: src/components/hooks/queries/linksQuery.ts
Your file: src/components/hooks/queries/domainsQuery.ts
```

### Environment Setup
```bash
# Required environment variable
UMAMI_HOST=umami.athas.mx  # Add to .env

# Start dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build
```

---

## 🏁 FINAL WORDS

**Remember:**
- Quality over speed
- Match patterns exactly
- Test everything manually
- No shortcuts on internationalization
- No custom implementations

**When in doubt:**
- Check the Links feature
- Copy the pattern
- Adapt for domains

**You got this! 🚀**

The implementation plan has everything you need. Follow it exactly, and you'll deliver production-ready code that fits perfectly into Umami's codebase.

Good luck! 💪
