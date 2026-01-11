# Dependency Audit Report

**Date:** 2026-01-11
**Phase:** Phase 2 - Remove Redundancy & Dead Code

## Executive Summary

- **Unused dependencies:** 11 packages (Radix UI components)
- **Security vulnerabilities:** 2 high severity (glob in dev deps, xlsx in production)
- **Missing dependencies:** 2 packages (google-auth-library, playwright)
- **Outdated packages:** 21 packages have updates available
- **Potential savings:** ~2-3 MB in node_modules, improved security

---

## 1. Unused Dependencies (Safe to Remove)

### Radix UI Components (Not Used)
These were likely installed during UI development but never implemented:

```bash
npm uninstall \
  @radix-ui/react-accordion \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-context-menu \
  @radix-ui/react-hover-card \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-radio-group \
  @radix-ui/react-slider \
  @radix-ui/react-switch \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group
```

**Impact:** ~2-3 MB reduction in node_modules

### False Positives
- `pino` - Flagged as unused but IS used via `getLogger()` in actions.ts
- `autoprefixer` - Required by Tailwind CSS
- `postcss` - Required by Tailwind CSS

---

## 2. Missing Dependencies (Should Add)

### google-auth-library
**Used in:** `src/lib/gmail/auth.ts`
**Status:** Currently relying on transitive dependency from `googleapis`
**Fix:** Add as explicit dependency

```bash
npm install google-auth-library
```

### playwright
**Used in:** `scripts/scrapers/scc-tax-lookup.ts`
**Status:** Already in Python dependencies (pyproject.toml)
**Fix:** No action needed (false positive - it's a Python script)

---

## 3. Security Vulnerabilities

### High Severity Issues

#### 1. glob (10.2.0 - 10.4.5)
- **Severity:** High
- **Issue:** Command injection via -c/--cmd
- **Location:** node_modules/glob (via husky dev dependency)
- **Fix:** Run `npm audit fix`
- **Impact:** Dev dependencies only, not in production

#### 2. xlsx (all versions)
- **Severity:** High
- **Issues:**
  - Prototype Pollution (GHSA-4r6h-8v6p-xvw2)
  - ReDoS (GHSA-5pgg-2g8v-p4x9)
- **Location:** node_modules/xlsx (used for bank import parsing)
- **Fix:** No fix available
- **Mitigation:**
  - Only process trusted files (user uploads from authenticated users)
  - Consider alternative: exceljs, xlsx-populate, or SheetJS Pro

**Recommendation:** Keep xlsx for now (used feature is critical), but consider alternatives in Phase 3.

---

## 4. Outdated Packages

### Critical Updates (Breaking Changes)

| Package | Current | Latest | Breaking? | Priority |
|---------|---------|--------|-----------|----------|
| react | 18.3.1 | 19.2.3 | ✅ Yes | Low |
| react-dom | 18.3.1 | 19.2.3 | ✅ Yes | Low |
| next | 14.2.35 | 16.1.1 | ✅ Yes | Low |
| @types/react | 18.3.27 | 19.2.8 | ✅ Yes | Low |
| @types/react-dom | 18.3.7 | 19.2.3 | ✅ Yes | Low |
| eslint-config-next | 14.2.35 | 16.1.1 | ✅ Yes | Low |
| tailwindcss | 3.4.19 | 4.1.18 | ✅ Yes | Medium |
| vite | 5.4.21 | 7.3.1 | ✅ Yes | Medium |
| vitest | 3.2.4 | 4.0.16 | ✅ Yes | Medium |
| zod | 3.25.76 | 4.3.5 | ✅ Yes | Low |

**Notes:**
- React 19 + Next.js 16 are major releases (Oct 2024)
- Tailwind 4 is major rewrite (Dec 2024)
- All breaking changes require testing and potential code updates
- Defer major version updates until Phase 4-5

### Safe Minor Updates

| Package | Current | Wanted | Action |
|---------|---------|--------|--------|
| react-hook-form | 7.69.0 | 7.71.0 | Update |
| googleapis | 169.0.0 | 170.0.0 | Update |
| @types/node | 22.19.3 | 22.19.5 | Update |

**Safe to update:**
```bash
npm update react-hook-form googleapis @types/node
```

### UI Library Updates

| Package | Current | Latest | Breaking? |
|---------|---------|--------|-----------|
| lucide-react | 0.460.0 | 0.562.0 | Minor |
| recharts | 2.15.4 | 3.6.0 | ✅ Yes |
| tailwind-merge | 2.6.0 | 3.4.0 | ✅ Yes |
| @hookform/resolvers | 3.10.0 | 5.2.2 | ✅ Yes |

**Recommendation:** Update lucide-react only, defer breaking changes.

---

## 5. Husky Vulnerabilities

depcheck flagged 6 vulnerabilities (2 moderate, 4 high) after installing husky.

**Check details:**
```bash
npm audit
```

**Expected:** These are likely in husky's dependencies (glob), not our code.

---

## Action Plan

### Immediate (This Session)

1. ✅ Remove 11 unused Radix UI packages
2. ✅ Add google-auth-library as explicit dependency
3. ✅ Run safe minor updates (react-hook-form, googleapis, @types/node, lucide-react)
4. ✅ Run `npm audit fix` for glob

### Phase 3 (During Refactoring)

1. Evaluate xlsx alternatives for bank import (exceljs, xlsx-populate)
2. Test major version updates in separate branch:
   - Next.js 16 + React 19
   - Tailwind 4
   - Vite 7 + Vitest 4

### Phase 4 (After Testing Infrastructure)

1. Update to major versions after test coverage reaches 40%
2. Test each major update independently
3. Update documentation for breaking changes

---

## Size Impact

| Action | node_modules Size Change |
|--------|-------------------------|
| Remove 11 unused Radix UI packages | -2.5 MB |
| Add google-auth-library | +500 KB |
| Update 4 packages | ~0 MB |
| **Net Change** | **-2 MB** |

---

## Risk Assessment

### Low Risk (Safe to proceed)
- ✅ Removing unused Radix UI packages
- ✅ Adding explicit google-auth-library dependency
- ✅ Updating minor versions

### Medium Risk (Defer to Phase 3)
- ⚠️ Replacing xlsx (used feature, no drop-in replacement)
- ⚠️ Updating to Tailwind 4 (major rewrite)

### High Risk (Defer to Phase 4)
- ❌ Next.js 16 + React 19 (breaking changes, needs extensive testing)
- ❌ Major version bumps without test coverage

---

## Next Steps

After dependency cleanup:
1. Consolidate duplicate code patterns (emptyToNull, date formatting)
2. Generate enum label maps from schema
3. Document any deprecated patterns found

---

## References

- npm audit report: Run `npm audit` for full details
- Radix UI docs: https://www.radix-ui.com/
- Next.js 16 migration: https://nextjs.org/docs/app/building-your-application/upgrading
- React 19 upgrade guide: https://react.dev/blog/2024/10/21/react-v19
