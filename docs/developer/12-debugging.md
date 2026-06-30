# Debugging Guide

## Local dev server issues

### Infinite page reload / FATAL Turbopack error

**Symptom:** Pages like `/admin/config` or `/domains` keep reloading. Terminal shows:

```
FATAL: An unexpected Turbopack error occurred.
...
Next.js package not found
```

**Cause:** The bundled Turbopack binary (commit `2d08397b`) has a bug in `ecmascript_client_reference_transition` that occurs when server components import `"use client"` modules.

**Fix:** The `dev` script already uses `--webpack` flag:
```json
"dev": "next dev --webpack"
```

If you see this error, verify `package.json` still has `--webpack`. Do NOT remove it.

---

### Port already in use

```
Error: Port 3000 is in use by process XXXX
```

Kill the old process:
```bash
kill XXXX
# or kill all next dev processes:
pkill -f "next dev"
```

---

### Prisma: "Can't reach database server"

```
Error: Can't reach database server at `localhost:5432`
```

The PostgreSQL container is not running.

```bash
docker compose up -d postgres
docker compose ps    # verify postgres is "healthy"
```

---

### Prisma: "Missing Prisma client"

```
Error: @prisma/client did not initialize yet
```

Regenerate the client:
```bash
npx prisma generate
```

---

### "NEXTAUTH_SECRET is not set"

Add it to your `.env`:
```env
NEXTAUTH_SECRET="any-string-at-least-32-characters-long"
```

---

## Database debugging

### Browse the database visually

```bash
npx prisma studio
# Opens at http://localhost:5555
```

### Run raw SQL

```bash
docker compose exec postgres psql -U angebots -d angebots_engine
# Now in psql:
\dt         # list tables
SELECT * FROM "User";
SELECT id, name, slug FROM "Domain";
```

### View migration status

```bash
npx prisma migrate status
```

Shows which migrations have been applied and which are pending.

### Reset dev database (DESTRUCTIVE)

```bash
npx prisma migrate reset
```

Drops everything, re-applies all migrations, and re-runs the seed. Dev only.

---

## Authentication debugging

### Session not persisting after login

1. Check `NEXTAUTH_SECRET` is set and consistent (the same value between restarts)
2. Check `NEXTAUTH_URL` matches the URL you're visiting
3. Open browser DevTools → Application → Cookies: look for `next-auth.session-token`

### "401 Not logged in" on API calls from the browser

The session cookie is missing or expired. Open Network tab, check the request headers — the `cookie` header should contain `next-auth.session-token`.

Sign out and sign back in. Sessions expire after 8 hours.

### API key authentication fails

1. Ensure the raw key (format: `eak_live_...`) is used, not the hash or ID
2. Check the key is active: `SELECT aktiv FROM "ApiKey" WHERE key_prefix = 'eak_live_XXXXXXXX';`
3. Verify the `Authorization: Bearer ...` header is correct
4. Check the `ApiKeyLog` table for the last access attempt

---

## Engine debugging

### Output field stays `null`

The rules didn't match. Check:
1. Open the domain's Simulator page — it runs the engine live
2. Look at "Berechnete Werte" — fields highlighted in rose fired a rule
3. Check the `firedRules` array in the API response (`POST /api/v1/domains/{id}/run`)

### Formula returns `0` unexpectedly

The `isSafeFormula()` check blocked it, or a referenced field doesn't exist in `values`.

1. Check that all field keys used in the formula exist in `config.felder`
2. Check the formula only uses: `+`, `-`, `*`, `/`, `()`, numbers, field keys, and whitelisted `Math.*` functions
3. Use the Simulator to step through it interactively

### Component not activating

1. Check `komponente.aktivierung` — all AND conditions must be true, or at least one OR condition
2. The `menge_feld` must be in the current `values` (it can be 0)
3. Dependencies are depth-first — if the parent doesn't activate, neither does the child

---

## API debugging

### Looking at request logs

All `/api/v1/*` calls are logged to the `ApiLog` table. View them:

- Admin UI: **Admin → API-Logs**
- Direct DB: `SELECT method, path, status_code, duration_ms, error FROM "ApiLog" ORDER BY zeitstempel DESC LIMIT 20;`

### Testing API endpoints manually

Use curl or an HTTP client like Bruno/Postman/Insomnia.

```bash
# Get a session cookie first (cookie auth — same as the browser UI):
curl -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin@example.com&password=Admin123!"

# Then use the cookie (same /api/v1/ for both UI and external):
curl -b cookies.txt http://localhost:3000/api/v1/domains

# Or with an API key instead:
curl -H "Authorization: Bearer eak_live_your-key-here" \
  http://localhost:3000/api/v1/domains
```

---

## Docker / production debugging

### View container logs

```bash
docker compose logs app          # app logs
docker compose logs postgres     # postgres logs
docker compose logs -f app       # follow live
```

### Container keeps restarting

```bash
docker compose logs app --tail=50
```

Common causes:
- `NEXTAUTH_SECRET` or `NEXTAUTH_URL` not set → app crashes on startup
- Database not reachable → Prisma migrate deploy fails → entrypoint exits
- Port conflict → container can't bind

### Database migration failed on startup

```bash
docker compose logs app 2>&1 | grep -A 5 "migrate"
```

If there's a migration conflict, you may need to manually resolve it:
```bash
docker compose exec app node node_modules/prisma/build/index.js migrate resolve --applied <migration-name>
```

### Shell into a running container

```bash
docker compose exec app sh
docker compose exec postgres sh
```

### Rebuild from scratch

```bash
docker compose down -v   # WARNING: -v removes the postgres data volume!
docker compose up --build -d
```

`-v` is DESTRUCTIVE — it deletes all database data. Only use this to start fresh.

---

## Next.js specific

### Check what route is matched

Next.js logs matched routes in the terminal. Look for lines like:

```
GET /admin/config 200 in 45ms
```

If you see repeated 200s for the same route with no user interaction → the page is reloading itself (likely the Turbopack bug — make sure `--webpack` is in the dev script).

### Hydration errors in the browser console

```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

This happens when server-rendered HTML doesn't match what the client renders. Common causes:
- Using `Date.now()` or `Math.random()` in render
- Browser extensions modifying the DOM
- Conditional rendering based on `typeof window !== 'undefined'`

Fix: use `useEffect` for any browser-only code. Avoid rendering timestamps directly.

### TypeScript errors in IDE but not in build

Run the TypeScript compiler directly:
```bash
npx tsc --noEmit
```

---

## Useful one-liners

```bash
# Count domains in DB
docker compose exec postgres psql -U angebots -d angebots_engine -c "SELECT COUNT(*) FROM \"Domain\";"

# Show all users
docker compose exec postgres psql -U angebots -d angebots_engine -c "SELECT id, name, email, rolle, aktiv FROM \"User\";"

# Show recent API errors
docker compose exec postgres psql -U angebots -d angebots_engine -c "SELECT method, path, status_code, error FROM \"ApiLog\" WHERE error IS NOT NULL ORDER BY zeitstempel DESC LIMIT 10;"

# Check which migrations are applied
docker compose exec app node node_modules/prisma/build/index.js migrate status

# Tail Next.js logs (production)
docker compose logs -f app 2>&1 | grep -v "GET /health"
```
