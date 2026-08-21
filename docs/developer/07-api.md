# API Reference

## One API Surface

All API endpoints live under `/api/v1/`. Both the UI and external integrations use the same routes.

| Auth method | How it works |
|---|---|
| Session cookie | Sent automatically by the browser after login |
| Bearer token | `Authorization: Bearer eak_live_<48-hex-chars>` |

Each request is checked for an `Authorization: Bearer` header first; if present it is validated as an API key. Otherwise the request falls back to the NextAuth session cookie.

---

## Authentication

### Session (browser / UI)

The browser automatically sends the NextAuth session cookie. No extra headers needed for UI calls.

### API key (external integrations)

```http
Authorization: Bearer eak_live_<48-hex-chars>
```

Create API keys in Admin → API-Keys. API keys carry full admin-level access (they are admin-generated and admin-managed).

---

## Response format

All endpoints return JSON in these shapes:

**Success:**
```json
{ "data": <payload> }
```

**Created (201):**
```json
{ "data": <payload> }
```

**Error:**
```json
{ "error": "Human-readable error message", "code": "OPTIONAL_CODE" }
```

Common status codes: `200`, `201`, `400`, `401`, `403`, `404`, `500`.

---

## REST API (`/api/v1/`)

### Domains

#### `GET /api/v1/domains`
Returns all domains.

```json
{
  "data": [
    { "id": "...", "name": "Solar", "slug": "solar", "config_json": "...", "updated_at": "..." }
  ]
}
```

#### `POST /api/v1/domains`
Create a domain. Role: `SUPER_ADMIN` or `DOMAIN_ADMIN`.

```json
{ "name": "Carport" }
```

#### `GET /api/v1/domains/:id`
Returns domain with its linked pricelist IDs.

```json
{
  "data": {
    "id": "...",
    "name": "Solar",
    "slug": "solar",
    "config_json": "...",
    "updated_at": "...",
    "pricelist_ids": ["pl-1", "pl-2"]
  }
}
```

#### `PATCH /api/v1/domains/:id`
Update name or config. Role: `SUPER_ADMIN` or `DOMAIN_ADMIN`.

```json
{ "name": "New Name", "config_json": "{...}" }
```

#### `DELETE /api/v1/domains/:id`
Delete a domain. Role: `SUPER_ADMIN` only.

#### `POST /api/v1/domains/:id/duplicate`
Create a copy of a domain. Role: `SUPER_ADMIN` or `DOMAIN_ADMIN`.

Optional JSON body to name the copy (1–100 chars); defaults to the source name with a `(Kopie)` suffix when omitted:
```json
{ "name": "Custom Name" }
```

#### `POST /api/v1/domains/:id/run`
**Run the engine.** The primary integration endpoint.

Request:
```json
{
  "inputs": {
    "laenge": 10,
    "breite": 5,
    "material": "holz"
  },
  "preis_items": [
    {
      "artikel_nr": "ART-001",
      "bezeichnung": "Holzbalken",
      "einheit": "m",
      "ek_preis": 12.50
    }
  ]
}
```

`preis_items` is optional. If provided, active components are matched against them for price calculation.

Response:
```json
{
  "data": {
    "values": {
      "laenge": 10,
      "breite": 5,
      "flaeche": 50,
      "tarif": "standard"
    },
    "firedRules": [
      { "ziel_feld": "tarif", "dann": "standard", "regelIndex": 0 }
    ],
    "activeFreitext": [
      { "typ": "freitext", "text": "Hinweis: Immer prüfen", "aktiv_wenn": null }
    ],
    "activeKomponenten": [
      {
        "komp": { "id": "k1", "name": "Holzbalken", ... },
        "menge": 10,
        "artikel_nr": "ART-001"
      }
    ],
    "validierungen": [],
    "trace": {
      "inputs": { "laenge": 10, "breite": 5, "material": "holz" },
      "formulas": [ { "feld": "flaeche", "formel": "laenge * breite", "ergebnis": 50 } ],
      "rule_groups": [ ... ],
      "freitext_rules": [ ... ],
      "validations": [ ... ],
      "components": [ ... ]
    }
  }
}
```

The response is an `EngineResult` — a `SimulatorResult` plus a `trace` object that records
every step the engine took (resolved inputs, formula evaluations, rule-group matches,
freitext rules, validations, and component activations). See [06 · The Engine](./06-engine.md).

---

### Pricelists

#### `GET /api/v1/pricelists`
Returns all pricelists.

#### `POST /api/v1/pricelists`
Create a pricelist. Role: `SUPER_ADMIN` or `DOMAIN_ADMIN`.

#### `GET /api/v1/pricelists/:id`
Returns a single pricelist.

#### `PATCH /api/v1/pricelists/:id`
Update name, dates, status, or items. Role: `SUPER_ADMIN` or `DOMAIN_ADMIN`.

#### `DELETE /api/v1/pricelists/:id`
Delete a pricelist. Role: `SUPER_ADMIN` only.

---

### Users

#### `GET /api/v1/users`
Returns all users (passwords excluded). Role: `SUPER_ADMIN`.

#### `POST /api/v1/users`
Create a user. Role: `SUPER_ADMIN`.

#### `GET /api/v1/users/:id`
Returns a single user.

#### `PATCH /api/v1/users/:id`
Update user fields. Role: `SUPER_ADMIN`. Providing `password` will re-hash it.

---

### API Keys

#### `GET /api/v1/api-keys`
Returns all API keys (key_hash not included). Role: `SUPER_ADMIN`.

#### `POST /api/v1/api-keys`
Create an API key. Returns the raw key **once**. Role: `SUPER_ADMIN`.

#### `DELETE /api/v1/api-keys/:id`
Revoke (soft-delete) an API key. Role: `SUPER_ADMIN`.

---

### Admin

#### `GET /api/v1/admin/logs`
Returns the last 100 API log entries. Role: `SUPER_ADMIN`.

#### `GET /api/v1/admin/webhooks`
Returns all webhook URLs.

#### `POST /api/v1/admin/webhooks`
Create a webhook URL. Role: `SUPER_ADMIN` or `DOMAIN_ADMIN`.

#### `PATCH /api/v1/admin/webhooks/:id`
Update a webhook URL.

#### `DELETE /api/v1/admin/webhooks/:id`
Delete a webhook URL. Role: `SUPER_ADMIN`.

---

### Dashboard

#### `GET /api/v1/dashboard/stats`
Returns aggregate statistics.

```json
{
  "data": {
    "domains": 5,
    "pricelists": 3,
    "users": 4,
    "apiKeys": 2,
    "webhooks": 1
  }
}
```

---

## API Logging

All requests to `/api/v1/*` are logged via the `withLogging()` middleware in `src/lib/api-logger.ts`.

Log entries contain:
- Method, path, status code, duration
- IP address (from `x-forwarded-for` or `x-real-ip`)
- Request headers (Authorization value is redacted to `Bearer XXXX***`)
- Request body (POST/PATCH/PUT, truncated to 8 KB)
- Response body (truncated to 8 KB)
- Error message if the handler threw

Logs are viewable in Admin → API-Logs.

---

## CORS

Cross-Origin Resource Sharing is configured for `/api/v1/*` in `next.config.mjs`:

```javascript
{ key: "Access-Control-Allow-Origin", value: process.env.ALLOWED_ORIGIN ?? "*" }
```

In production, set `ALLOWED_ORIGIN` to the domain of your frontend to restrict access.
