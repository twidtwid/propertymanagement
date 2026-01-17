# Property Management System

Property management app for 10 properties, 7 vehicles, 70+ vendors across VT, NYC, RI, CA, Paris, Martinique.

**Production:** https://spmsystem.com (143.110.229.185) · **Stack:** Next.js 14 + TypeScript + Tailwind + PostgreSQL

---

## CRITICAL RULES

1. **Env Parity** — Verify `.env.local` vars exist in prod `.env.production` before deploy
2. **Use `/deploy` Only** — Never manual docker/ssh/git push for production
3. **Cast SQL Dates** — Use `CURRENT_DATE + ($1::INTEGER)` not `+ $1`
4. **Sync Enums** — Update `scripts/init.sql` AND `src/lib/schemas/index.ts` together
5. **Build First** — Run `/build` before `/deploy`
6. **Use gen_random_uuid()** — Not `uuid_generate_v4()`
7. **TOKEN_ENCRYPTION_KEY** — NEVER change (breaks all OAuth tokens)

---

## Commands

| Cmd | Purpose |
|-----|---------|
| `/deploy` | Production deploy |
| `/build` | TypeScript check |
| `/test` | Run vitest |
| `/health` | Prod status |
| `/migrate <file>` | Run migration |
| `/prod-logs` | Tail logs |
| `/prod-db` | psql shell |

---

## Key Files

| What | Where |
|------|-------|
| Schema | `scripts/init.sql` |
| Types | `src/types/database.ts` |
| Zod | `src/lib/schemas/index.ts` |
| Queries | `src/lib/actions.ts` |
| Mutations | `src/lib/mutations.ts` |
| Workers | `scripts/unified-worker.js` |

---

## Architecture

```
Browser → Next.js App (Server Components → actions.ts/mutations.ts → PostgreSQL)
                    ↘ Unified Worker (email sync, smart pins, camera snapshots)
```

**Type flow:** PostgreSQL → database.ts → Zod schemas → Server Actions → UI

**Feature sequence:** Migration → Types → Zod → Actions → `/build` → `/test` → `/deploy`

---

## Users

| User | Role | Access |
|------|------|--------|
| Anne, Todd, Michael, Amelia | `owner` | Full |
| Barbara Brady (CBIZ) | `bookkeeper` | `/`, `/payments/**`, `/settings` only |

---

## Business Rules

- **Check alerts:** Unconfirmed >14 days triggers alert (Bank of America unreliable)
- **Smart pins:** Bills due ≤7 days, overdue bills, unconfirmed checks >14 days, urgent tickets
- **Cameras:** Modern Nest (auto-refresh), Legacy Nest (manual refresh ~30 days, Pushover alerts on 403)
- **Dark mode:** Supported via Settings → Appearance (user preference stored in localStorage)
- **Dropbox namespace:** `13490620643`

---

## Modular Docs

Read `.claude/rules/*.md` ON DEMAND for detailed context:

| File | When |
|------|------|
| `database.md` | Schema, enums, queries |
| `deployment.md` | Deploy process |
| `troubleshooting.md` | Debugging issues |
| `cameras.md` | Camera integrations |
| `payments.md` | Bills, taxes |
| `security.md` | Auth, OAuth |

---

## Claude API

Use `claude-haiku-4-5-20251001` for all AI calls (cost optimization).
