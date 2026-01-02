---
name: test
description: Run the test suite to verify code changes. Use before committing or deploying to catch regressions.
---

# Test Runner Skill

Run the project's test suite to verify code changes work correctly.

## When to Use
- Before committing significant changes
- After refactoring code
- Before deploying (the /deploy skill handles this automatically)
- When debugging a suspected regression

## Commands

### Run all tests once
```bash
docker compose exec app npm run test:run
```

### Run tests in watch mode (for development)
```bash
docker compose exec app npm run test
```

### Run tests with coverage
```bash
docker compose exec app npm run test:coverage
```

### Run a specific test file
```bash
docker compose exec app npx vitest run src/lib/session.test.ts
```

## Test Configuration
- Framework: Vitest
- Location: Tests are co-located with source files (*.test.ts)
- Currently limited coverage - only session.test.ts exists

## After Running Tests
- If tests pass: Proceed with commit/deploy
- If tests fail: Fix the failing tests before continuing
- Report results to user with pass/fail counts
