---
name: build
description: Run the Next.js build to check for TypeScript errors and build issues. Use to verify changes compile correctly.
---

# Build Verification Skill

Run the Next.js production build to catch TypeScript errors and build-time issues.

## When to Use
- After making significant TypeScript changes
- Before deploying to verify build success
- When debugging type errors
- After adding new dependencies

## Commands

### Run build in Docker
```bash
docker compose exec app npm run build
```

### Run build locally (if not using Docker)
```bash
npm run build
```

### Run lint only (faster, catches many issues)
```bash
docker compose exec app npm run lint
```

## Common Build Errors

### Type Errors
- Missing exports: Check that all imported functions exist
- Wrong types: Verify Zod schemas match TypeScript interfaces
- Null checks: Use optional chaining or add guards

### Import Errors
- Circular dependencies: Check import graph
- Missing modules: Run `npm install`

### Build Output
- Success: "✓ Compiled successfully"
- Failure: Specific file:line with error details

## After Build
- If build succeeds: Safe to deploy
- If build fails: Fix errors before continuing
- Report any errors with file locations to user
