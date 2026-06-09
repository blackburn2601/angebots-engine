# Services Layer

## Purpose

The service layer sits between the API routes / pages and the Prisma database client. Every service is a static class in `src/services/`.

**Rule:** Pages and API routes should call services, not Prisma directly. This keeps database logic in one place and makes it easy to change queries without touching multiple route files.

Exception: The admin config page reads `AppSetting` directly because it's a one-off admin view.

---

## `DomainService`

`src/services/DomainService.ts`

| Method | Description |
|---|---|
| `findAll()` | All domains, ordered by `updated_at desc` |
| `findAllWithCount()` | All domains + linked pricelist count |
| `findAllForConfigurator()` | All domains ordered by name, with pricelist count |
| `findById(id)` | Single domain by ID |
| `findByIdWithPricelists(id)` | Domain + full pricelist relations |
| `findByIdWithCount(id)` | Domain + pricelist count |
| `create(name)` | Creates domain, auto-generates unique slug |
| `update(id, data)` | Updates `name` and/or `config_json` |
| `delete(id)` | Hard delete (cascades to `DomainPricelist`) |
| `duplicate(id)` | Creates copy with `(Kopie)` suffix, unique slug |
| `parseConfig(json)` | `JSON.parse` with safe fallback to empty config |

### Slug generation

```typescript
const baseSlug = slugify(name);    // "Solar Anlage" → "solar-anlage"
let slug = baseSlug;
let counter = 1;
while (await prisma.domain.findUnique({ where: { slug } })) {
  slug = `${baseSlug}-${counter++}`;
}
```

Slugs must be unique. If `solar-anlage` exists, it tries `solar-anlage-1`, `solar-anlage-2`, etc.

### `slugify()` — German umlaut handling

Located in `src/lib/utils.ts`:
- `ä` → `ae`, `ö` → `oe`, `ü` → `ue`, `ß` → `ss`
- All other non-alphanumeric chars removed
- Spaces → `-`
- Lowercased

---

## `PricelistService`

`src/services/PricelistService.ts`

Manages pricelists and their many-to-many link to domains.

| Method | Description |
|---|---|
| `findAll()` | All pricelists with linked domain count |
| `findById(id)` | Single pricelist |
| `findActiveForDomain(domainId)` | Active pricelists linked to a domain |
| `create(data)` | Creates pricelist, parses `items_json` |
| `update(id, data)` | Updates fields + re-serializes `items_json` |
| `delete(id)` | Deletes pricelist (cascades to `DomainPricelist`) |
| `linkDomain(pricelistId, domainId)` | Creates join row |
| `unlinkDomain(pricelistId, domainId)` | Deletes join row |

---

## `UserService`

`src/services/UserService.ts`

| Method | Description |
|---|---|
| `findAll()` | All users, ordered by `erstellt_am asc` |
| `findById(id)` | Single user |
| `findByEmail(email)` | Used during login |
| `create(data)` | Hashes password (cost 12), sets `muss_pw_aendern = true` |
| `update(id, data)` | Updates any user field; if `password` provided, re-hashes it and sets `muss_pw_aendern = false` |

**Never return `password`** from an API route. The service returns the full Prisma model — callers must omit the `password` field before sending in a response.

---

## `ApiKeyService`

`src/services/ApiKeyService.ts`

| Method | Description |
|---|---|
| `findAll()` | All API keys (no hash) |
| `create(label)` | Generates raw key, stores hash + prefix |
| `revoke(id)` | Sets `aktiv = false` |

### Key format

```
eak_live_<48 random hex chars>
```

Generated with `crypto.randomBytes(24).toString('hex')`.

The prefix stored is the first 17 characters (`eak_live_` + 8 chars). This allows a fast `WHERE key_prefix = ?` lookup before the expensive bcrypt comparison.

---

## `WebhookService`

`src/services/WebhookService.ts`

Simple CRUD for `WebhookUrl` records.

| Method | Description |
|---|---|
| `findAll()` | All webhooks, newest first |
| `create(data)` | Creates webhook URL |
| `update(id, data)` | Updates fields |
| `delete(id)` | Deletes webhook URL |

---

## `DashboardService`

`src/services/DashboardService.ts`

| Method | Description |
|---|---|
| `getStats(rolle)` | Counts for domains, pricelists, users (SUPER_ADMIN only), API keys (SUPER_ADMIN only), webhooks |
| `getRecentDomains()` | Last 5 updated domains (id, name, slug, updated_at) |
| `getRecentLogs()` | Last 8 API log entries (key fields only) |

`getStats()` respects the caller's role — non-SUPER_ADMINs get `null` for `users` and `apiKeys`.

---

## `EngineService`

`src/services/EngineService.ts`

```typescript
static async run(domainId, inputs, preisItems) {
  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });
  const config: DomainConfig = JSON.parse(domain.config_json);
  return runEngine(config, inputs, preisItems);
}
```

Thin wrapper: loads domain from DB, parses config, delegates to the pure `runEngine()` function.

`findUniqueOrThrow` throws `PrismaClientKnownRequestError` if the domain doesn't exist. The route handler catches this and returns a 404.

---

## Adding a new service

1. Create `src/services/MyEntityService.ts`
2. Use the singleton Prisma client: `import { prisma } from "@/lib/prisma"`
3. Declare all methods as `static`
4. Return Prisma model types directly — don't create redundant DTOs
5. Use the service in routes/pages, never call Prisma directly from there
