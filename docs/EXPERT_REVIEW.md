# Expert Council Review: Property Management System
**Date:** January 2026
**Version:** 0.3.0

---

## Executive Summary

This review assesses the Property Management System from multiple expert perspectives to establish a stable foundation for future development. The system is functional and serves its purpose well, but has several areas requiring attention before scaling.

**Overall Assessment:** Good foundation with critical security improvements needed.

---

## 🔒 Security Expert Review

### Critical Issues (Fix Immediately)

#### 1. Auth Cookie Not Cryptographically Signed (HIGH)
**Location:** `src/lib/auth.ts:142-148`, `src/middleware.ts:29-30`

**Problem:** The auth cookie contains plaintext JSON `{id, email, full_name, role}` with no signature or MAC. An attacker can:
- Craft a cookie with `role: "owner"` to escalate privileges
- Impersonate any user by setting their email/id

**Current Code:**
```typescript
cookieStore.set("auth_user", JSON.stringify(user), { httpOnly: true, ... })
// Later parsed with no verification:
const userData = JSON.parse(authCookie.value)
```

**Recommendation:** Sign the cookie with HMAC-SHA256 or switch to JWT:
```typescript
// Option A: HMAC signature
const payload = JSON.stringify(user)
const signature = hmac('sha256', SECRET_KEY, payload)
const cookie = base64url(payload) + '.' + base64url(signature)

// Option B: Use iron-session or next-auth for session management
```

**Priority:** 🔴 Critical - Must fix before any public exposure

---

#### 2. API Routes Unprotected by Default (MEDIUM-HIGH)
**Location:** `src/app/api/**`

**Problem:** The middleware only protects page routes (see config matcher). API routes must manually check auth, and several don't:
- `/api/calendar/events` - No auth check
- `/api/alerts` - No auth check
- Some routes check auth inconsistently

**Recommendation:** Create an API auth wrapper:
```typescript
// src/lib/api-auth.ts
export function withAuth(handler: Handler, options?: { ownerOnly?: boolean }) {
  return async (req: Request) => {
    const user = await getUser()
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
    if (options?.ownerOnly && user.role !== 'owner') {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    return handler(req, user)
  }
}
```

**Priority:** 🟠 High

---

#### 3. Cron Endpoints Allow Unauthenticated Access in Dev (MEDIUM)
**Location:** `src/app/api/cron/sync-emails/route.ts:14-18`

**Problem:** Development mode bypasses CRON_SECRET check. If dev server is exposed, anyone can trigger syncs.

**Recommendation:** Always require CRON_SECRET, use a dev-specific secret if needed.

**Priority:** 🟡 Medium

---

### Positive Security Practices ✅

- ✅ AES-256-GCM encryption for OAuth tokens
- ✅ Parameterized SQL queries throughout (no SQL injection)
- ✅ 32-byte random tokens for magic links
- ✅ Token expiration and single-use enforcement
- ✅ Sensitive field redaction in logs
- ✅ HTTP-only, Secure, SameSite cookies
- ✅ Audit logging with change tracking

---

## 🔧 Operations Expert Review

### Critical Issues

#### 1. Worker Containers Failing (CRITICAL - FIXED)
**Status:** Fix deployed this session

**Problem:** Permission denied error on scripts directory due to ownership mismatch.

**Fix Applied:** Added `--chown=nextjs:nodejs` to Dockerfile COPY commands.

---

#### 2. Disk Space at 73% (WARNING)
**Current:** 35GB used of 48GB

**Recommendation:**
- Set up Docker image pruning cron: `docker image prune -af --filter "until=168h"`
- Add log rotation for Docker: Already configured (10MB, 3 files)
- Consider adding monitoring alert at 80%

---

#### 3. No Automated Backups (MEDIUM)
**Current:** Manual backups via `scripts/backup-db.sh`

**Recommendation:** Add cron job for daily backups:
```bash
# Add to production crontab
0 3 * * * /root/app/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

Consider: Off-site backup to S3/Dropbox

---

#### 4. No Health Monitoring/Alerting (MEDIUM)
**Current:** Health endpoint exists but no monitoring

**Recommendation:** Add simple uptime monitoring:
- UptimeRobot (free tier) for `https://spmsystem.com/api/health`
- Email alerts on downtime
- Future: Add Sentry for error tracking

---

### Deployment Improvements ✅ (Completed This Session)

- ✅ Fast deploy via GitHub Container Registry (30s vs 5-6 min)
- ✅ `./scripts/fast-deploy.sh` for local build + push
- ✅ `--skip-build` option for code-only changes

---

## 🎨 UI/UX Expert Review

### Strengths

- ✅ Mobile-first design with large touch targets
- ✅ Consistent use of shadcn/ui components
- ✅ Clear navigation structure
- ✅ Good use of tabs for organizing content (Insurance, Properties)

### Areas for Improvement

#### 1. Loading States (LOW)
**Observation:** Some pages lack loading indicators during data fetches.

**Recommendation:** Add Suspense boundaries with skeleton loaders for key pages.

---

#### 2. Error Feedback (LOW)
**Observation:** Some form errors show generic messages.

**Recommendation:** Improve validation error messages to be more specific and actionable.

---

#### 3. Offline Support (FUTURE)
**Observation:** App requires connectivity; no offline caching.

**Recommendation:** Consider PWA with service worker for viewing cached data offline (low priority).

---

## 🧹 Code Quality Expert Review

### Strengths

- ✅ Consistent TypeScript usage with strict mode
- ✅ Clear separation: actions.ts (reads) vs mutations.ts (writes)
- ✅ Zod validation on all form inputs
- ✅ Structured logging with Pino
- ✅ Audit trail for sensitive operations

### Areas for Improvement

#### 1. Test Coverage (MEDIUM)
**Current:** No automated tests

**Recommendation:** Add tests for critical paths:
1. Auth flow (magic link → session)
2. Payment status transitions
3. Visibility filtering logic
4. API route protection

Start with: `npm install -D vitest @testing-library/react`

---

#### 2. TypeScript Strict Null Checks (LOW)
**Observation:** Some `queryOne` results used without null checks.

**Recommendation:** Enable `strictNullChecks` in tsconfig and fix resulting errors.

---

#### 3. Error Handling Consistency (LOW)
**Observation:** Mix of try/catch patterns across API routes.

**Recommendation:** Standardize with error handling wrapper (see API auth wrapper above).

---

## 📋 Prioritized Action Plan

### Phase 1: Security Hardening (Do First)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Sign auth cookies (HMAC or JWT) | 4 hours | Critical |
| 🔴 P0 | Add API route auth wrapper | 2 hours | High |
| 🟠 P1 | Audit all API routes for auth | 1 hour | High |
| 🟠 P1 | Fix cron auth in dev mode | 30 min | Medium |

### Phase 2: Operations Stability (Do Second)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🟠 P1 | Set up automated daily backups | 1 hour | High |
| 🟠 P1 | Add uptime monitoring (UptimeRobot) | 30 min | High |
| 🟡 P2 | Add disk space monitoring/alerts | 1 hour | Medium |
| 🟡 P2 | Docker image pruning cron | 30 min | Low |

### Phase 3: Code Quality (Do Third)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🟡 P2 | Add vitest + first auth tests | 4 hours | Medium |
| 🟡 P2 | Enable strictNullChecks | 2 hours | Low |
| 🟢 P3 | Standardize error handling | 2 hours | Low |

### Phase 4: Future Enhancements (Backlog)

| Priority | Task | Notes |
|----------|------|-------|
| 🟢 P3 | Add Sentry error tracking | When budget allows |
| 🟢 P3 | Loading skeletons for pages | Nice to have |
| 🟢 P4 | PWA offline support | Future consideration |
| 🟢 P4 | Database RLS policies | Defense in depth |

---

## Summary

The Property Management System has a solid foundation with good practices in place for database access, logging, and UI consistency. The most urgent work is **security hardening** of the authentication system - the unsigned cookie is a significant vulnerability that should be addressed before any broader exposure.

With the fast deploy workflow now in place, iteration speed is excellent. The recommended Phase 1 security work can be completed in a single focused session (~8 hours).

---

*Review conducted by Claude Opus 4.5 Expert Council*
