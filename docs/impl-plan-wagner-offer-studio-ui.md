# Implementation Plan — wagner-offer-studio-ui

**Parent:** `docs/migration-plan-php-symfony.md`  
**Depends on:** `wagner-offer-studio-core` running at `https://api.example.com`  
**Repo:** `angebots-engine-migration/wagner-offer-studio-ui/`  
**Phase:** 3 of 4

---

## CLAUDE.md for this repo

When scaffolding `wagner-offer-studio-ui/`, write this file first:

```markdown
# wagner-offer-studio-ui

Vue 3 SPA — domain editor, configurator, admin. No engine logic in the browser.

## Invariants — never violate
- The Calculate button fires exactly one POST to /api/v1/domains/{id}/run. Never auto-calculate on input change.
- Access token lives in Pinia memory only — never localStorage or sessionStorage.
- Types in src/types/index.ts must exactly match deserializer.ts keys. Do not rename fields.
- All HTTP calls go through src/api/client.ts (Axios instance with interceptors). Never import axios directly.
- Read § 5 (Types) before writing any component that touches configJson.
- Do not start the next task until the current task's Verify passes.
```

---

## 1. Purpose

A Vue 3 single-page application that consumes the `wagner-offer-studio-core` REST API. No engine logic lives in the browser — all calculations go through an explicit **Calculate** button that POSTs to `/api/v1/domains/{id}/run`.

The reference for every page is the existing Next.js UI under `angebots-engine/src/app/(app)/`.

**Multi-instance architecture:** Each customer deployment has its own instance of this SPA, `wagner-offer-studio-core`, and PostgreSQL. The `wagner-rules-engine` TypeScript microservice is shared across all instances — the SPA never calls it directly. All engine calls go through the customer's own Symfony backend.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite 6 | `@vitejs/plugin-vue` |
| Framework | Vue 3.5 (Composition API) | `<script setup>` everywhere |
| State | Pinia 2 | one store per domain |
| Routing | Vue Router 4 | history mode |
| HTTP | Axios 1 | single instance with interceptors |
| Styling | Tailwind CSS 4 | postcss plugin |
| Forms | VeeValidate 4 + Zod | mirrors react-hook-form + zod pattern |
| Tests | Vitest 3 + Vue Test Utils 2 | node environment |
| Linting | ESLint 9 (flat) + Prettier | |

---

## 3. Scaffold

```bash
cd angebots-engine-migration
npm create vue@latest wagner-offer-studio-ui
# ✔ Add TypeScript? Yes
# ✔ Add Vue Router? Yes
# ✔ Add Pinia? Yes
# ✔ Add Vitest? Yes
# ✔ Add ESLint? Yes
# ✔ Add Prettier? Yes

cd wagner-offer-studio-ui
npm install axios @vueuse/core zod vee-validate @vee-validate/zod
npm install -D tailwindcss @tailwindcss/vite autoprefixer
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
```

### `src/main.ts`

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'

createApp(App).use(createPinia()).use(router).mount('#app')
```

### `src/App.vue` (startup session restore)

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth  = useAuthStore()
const route = useRoute()

onMounted(async () => {
  // Skip on /login — no cookie to restore, and the 401 would add latency + log noise
  if (route.path !== '/login') {
    await auth.tryRestoreSession()
  }
})
</script>

<template>
  <RouterView />
</template>
```

On every page load or new tab (except `/login`), `tryRestoreSession` calls `POST /auth/refresh`. If the httpOnly cookie is valid, the user is silently re-authenticated. If not, the router guard redirects to `/login`.

### `src/assets/main.css`

```css
@import "tailwindcss";
```

---

## 4. API Client

### `src/api/client.ts`

```typescript
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // sends httpOnly refresh token cookie automatically
})

// Attach in-memory access token — never read from localStorage
client.interceptors.request.use((config) => {
  const token = useAuthStore().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 handler with promise queue to prevent concurrent refresh races
let isRefreshing = false
let queue: Array<(token: string) => void> = []

function processQueue(newToken: string) {
  queue.forEach((resolve) => resolve(newToken))
  queue = []
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers['Authorization'] = `Bearer ${token}`
          resolve(client(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await client.post('/auth/refresh')
      const newToken = data.data.accessToken
      useAuthStore().setAccessToken(newToken)
      original.headers['Authorization'] = `Bearer ${newToken}`
      processQueue(newToken)
      return client(original)
    } catch {
      processQueue('')
      useAuthStore().clearSession()
      router.push('/login')
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default client
```

### `src/api/index.ts`

```typescript
export { default as client } from './client'
export * from './domains'
export * from './pricelists'
export * from './users'
export * from './apiKeys'
export * from './admin'
```

### `src/api/domains.ts` (representative module)

```typescript
import client from './client'
import type { Domain, DomainConfig, SimulatorResult } from '@/types'

export const domainsApi = {
  list: () => client.get<{ data: Domain[] }>('/domains'),
  get:  (id: string) => client.get<{ data: Domain }>(`/domains/${id}`),
  create: (payload: Partial<Domain>) => client.post<{ data: Domain }>('/domains', payload),
  update: (id: string, payload: Partial<Domain>) => client.patch<{ data: Domain }>(`/domains/${id}`, payload),
  remove: (id: string) => client.delete(`/domains/${id}`),
  duplicate: (id: string) => client.post<{ data: Domain }>(`/domains/${id}/duplicate`),
  run: (id: string, inputs: Record<string, unknown>, preisItems?: PriceItem[]) =>
    client.post<{ data: SimulatorResult }>(`/domains/${id}/run`, { inputs, preisItems }),
}
```

Mirror this pattern for `pricelists.ts`, `users.ts`, `apiKeys.ts`, `admin.ts`.

---

## 5. Types

### `src/types/index.ts`

These types are the **canonical English JSON contract** shared between the Vue SPA and the engine's API. They must exactly match what `wagner-offer-studio-core` stores in `configJson` and what `wagner-rules-engine/src/engine/deserializer.ts` reads. Do not invent alternative field names.

```typescript
// ─── Domain Config (write path: editor → PATCH /domains/:id) ────────────────

// Field types supported by the engine.
// 'formula' and 'output' fields are computed by the engine — editors should
// distinguish them but not allow user input for them in the configurator.
export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'formula' | 'output'

export interface Field {
  key:      string       // unique identifier used in rules, formulas, conditions
  label:    string       // human-readable display label
  type:     FieldType
  default?: unknown      // default value (NOT defaultValue)
  formula?: string       // only for type='formula'; PHP-style: round(x), not Math.round(x)
  options?: string[]     // only for type='select'
}

// A single condition evaluated against field values.
export interface Condition {
  field:        string
  operator:     '==' | '!=' | '<' | '<=' | '>' | '>=' | 'contains'
  value?:       unknown   // literal compare value
  compareField?: string   // compare against another field instead of value
}

// A compound condition — logic AND/OR over a list of Conditions.
// Note: 'logic' not 'operator' — matches the engine JSON contract.
export interface ConditionGroup {
  logic:      'AND' | 'OR'
  conditions: Condition[]
}

// One rule within a RuleGroup: if all conditions match, targetField gets value.
export interface Rule {
  conditions: Condition[]
  logic?:     'AND' | 'OR'   // how conditions are combined (defaults to AND)
  value:      unknown         // the value assigned to targetField when this rule fires
}

// A set of rules for one output field. First matching rule wins.
export interface RuleGroup {
  targetField: string   // the field key that receives the value (NOT 'label' or 'outputField')
  rules:       Rule[]
}

// A free-text string shown when its condition is met (or always if activeWhen is absent).
export interface FreeTextRule {
  text:       string
  activeWhen?: {
    field:    string
    operator: string
    value:    unknown
  } | null
}

// A validation message shown when condition matches.
// type must be present — 'error' blocks submission, 'warning' is advisory.
export interface Validation {
  type:      'error' | 'warning'    // required — do NOT omit
  message:   string
  condition: Condition | ConditionGroup
}

// One entry in a Component's activationRules array.
// logic drives AND vs OR grouping (see impl-plan-wagner-rules-engine § 8 Known Discrepancies).
export interface ActivationRule {
  field:     string
  operator:  string
  value:     unknown
  logic?:    'AND' | 'OR'
}

// A product variant — resolved by the engine to produce an articleNumber.
export interface Variant {
  articleNumber: string    // NOT 'id', 'label', 'price', or 'description'
  default?:      boolean
  whenField?:    string    // condition field for non-default variant selection
  operator?:     string
  value?:        unknown
}

// A component dependency — activates another component when parent is active.
export interface Dependency {
  componentId: string    // NOT 'fieldId' or 'variantId'
}

export interface Component {
  id:              string
  name:            string    // NOT 'label'
  quantityField:   string    // field key whose value determines quantity
  activationRules: ActivationRule[]
  variants:        Variant[]
  dependencies:    Dependency[]
}

export interface DomainConfig {
  fields:        Field[]
  ruleGroups:    RuleGroup[]
  freeTextRules: FreeTextRule[]
  validations:   Validation[]
  components:    Component[]
}

// ─── Domain / Pricelist (API responses) ─────────────────────────────────────

export interface Domain {
  id:          string
  name:        string
  slug:        string
  description?: string
  active:      boolean
  configJson:  DomainConfig
  createdAt:   string
  updatedAt:   string
}

// English-keyed price item — matches the deserializer's expected keys.
export interface PriceItem {
  articleNumber:  string
  name:           string
  unit:           string
  purchasePrice:  number
  currency?:      string
  taxPercent?:    number
}

export interface Pricelist {
  id:          string
  name:        string
  description?: string
  items:       PriceItem[]
  validFrom?:  string
  validUntil?: string
  active:      boolean
  createdAt:   string
  updatedAt:   string
}

// ─── Engine result (read path: POST /domains/:id/run) ───────────────────────

// values: all field keys with their resolved values (output fields, formula fields, inputs).
// Use domain.configJson.fields to look up each field's type for formatting.
export interface SimulatorResult {
  values:           Record<string, unknown>
  firedRules:       Array<{ targetField: string; value: unknown; ruleIndex: number }>
  activeFreeText:   Array<{ text: string }>
  activeComponents: Array<{ id: string; name: string; quantity: number; articleNumber: string | null }>
  validations:      Array<{ type: 'error' | 'warning'; message: string }>
}

// ─── Users / API Keys ───────────────────────────────────────────────────────

export interface User {
  id:                 string
  name:               string
  email:              string
  role:               'SUPER_ADMIN' | 'DOMAIN_ADMIN' | 'SELLER'
  active:             boolean
  mustChangePassword: boolean
  createdAt:          string
}

export interface ApiKey {
  id:          string
  label:       string
  prefix:      string
  active:      boolean
  lastUsedAt?: string
  createdAt:   string
}
```

---

## 6. Router

### `src/router/index.ts`

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/403',   component: () => import('@/views/ForbiddenView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '',         redirect: '/dashboard' },
        { path: 'dashboard', component: () => import('@/views/DashboardView.vue') },

        // Domains
        { path: 'domains',                          component: () => import('@/views/domains/DomainsListView.vue') },
        { path: 'domains/:id',                      component: () => import('@/views/domains/DomainEditorLayout.vue'),
          children: [
            { path: '',       redirect: 'fields' },
            { path: 'fields',      component: () => import('@/views/domains/FieldsTab.vue') },
            { path: 'rules',       component: () => import('@/views/domains/RulesTab.vue') },
            { path: 'validations', component: () => import('@/views/domains/ValidationsTab.vue') },
            { path: 'components',  component: () => import('@/views/domains/ComponentsTab.vue') },
            { path: 'simulator',   component: () => import('@/views/domains/SimulatorTab.vue') },
          ],
        },

        // Pricelists
        { path: 'pricelists',     component: () => import('@/views/pricelists/PricelistsListView.vue') },
        { path: 'pricelists/:id', component: () => import('@/views/pricelists/PricelistEditorView.vue') },

        // Configurator
        { path: 'configurator',       component: () => import('@/views/configurator/ConfiguratorListView.vue') },
        { path: 'configurator/:id',   component: () => import('@/views/configurator/ConfiguratorView.vue') },

        // Admin (SUPER_ADMIN only)
        { path: 'admin/users',    component: () => import('@/views/admin/UsersView.vue'),    meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'admin/api-keys', component: () => import('@/views/admin/ApiKeysView.vue'),  meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'admin/logs',     component: () => import('@/views/admin/LogsView.vue'),     meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'admin/webhooks', component: () => import('@/views/admin/WebhooksView.vue'), meta: { roles: ['SUPER_ADMIN'] } },

        // Profile
        { path: 'settings/profile', component: () => import('@/views/ProfileView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  // Role guard: redirect to /403 (not /dashboard — would loop if dashboard also requires a role)
  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) return '/403'
})

export default router
```

---

## 7. Stores

### `src/stores/auth.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import client from '@/api/client'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // Access token in memory only — never localStorage or sessionStorage (XSS protection)
  const accessToken = ref<string | null>(null)
  const user        = ref<User | null>(null)

  const isLoggedIn = computed(() => !!accessToken.value)

  async function login(email: string, password: string) {
    const { data } = await client.post<{ data: { accessToken: string; user: User } }>('/auth/login', { email, password })
    accessToken.value = data.data.accessToken
    user.value        = data.data.user
    // httpOnly refresh token cookie is set by the server automatically
  }

  async function tryRestoreSession() {
    try {
      const { data } = await client.post<{ data: { accessToken: string; user: User } }>('/auth/refresh')
      accessToken.value = data.data.accessToken
      user.value        = data.data.user
    } catch {
      // Cookie expired or absent — user must log in
    }
  }

  async function logout() {
    try {
      await client.post('/auth/logout') // server revokes refresh token + clears cookie
    } finally {
      clearSession()
    }
  }

  function clearSession() {
    accessToken.value = null
    user.value        = null
  }

  function setAccessToken(token: string) {
    accessToken.value = token
  }

  return { accessToken, user, isLoggedIn, login, logout, tryRestoreSession, clearSession, setAccessToken }
})
```

### `src/stores/domains.ts`

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { domainsApi } from '@/api'
import type { Domain } from '@/types'

export const useDomainsStore = defineStore('domains', () => {
  const domains   = ref<Domain[]>([])
  const current   = ref<Domain | null>(null)
  const loading   = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const { data } = await domainsApi.list()
      domains.value = data.data
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string) {
    loading.value = true
    try {
      const { data } = await domainsApi.get(id)
      current.value = data.data
    } finally {
      loading.value = false
    }
  }

  async function save(domain: Domain) {
    const { data } = await domainsApi.update(domain.id, domain)
    current.value = data.data
  }

  async function remove(id: string) {
    await domainsApi.remove(id)
    domains.value = domains.value.filter((d) => d.id !== id)
  }

  return { domains, current, loading, fetchAll, fetchOne, save, remove }
})
```

Mirror for `pricelists.ts`, `users.ts`, `apiKeys.ts`.

---

## 8. Tasks

Tasks must be completed in order. Each references the Next.js source as ground truth.

---

### Task 0 — Test scaffolding

> **Depends on:** Scaffold (§ 3), API client (§ 4), stores (§ 7), router (§ 6) complete  
> **Creates:** `src/__tests__/helpers/auth.ts`, `src/__tests__/stores/auth.test.ts`, `src/__tests__/views/LoginView.test.ts`  
> **Modifies:** —  
> **Verify:** `npm test -- --run`  
> **Done when:** `npm test` runs without error; coverage report generates.

Verify Vitest runs and create the helper file.

```
src/__tests__/
  helpers/
    auth.ts        # mock auth store with token
  stores/
    auth.test.ts
  views/
    LoginView.test.ts
```

**`src/__tests__/helpers/auth.ts`**

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

export function setupAuth(role: string = 'SUPER_ADMIN') {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.setAccessToken('test-token')
  auth.user  = { id: '1', name: 'Test', email: 'test@test.com', role: role as any, active: true, mustChangePassword: false, createdAt: '' }
  return auth
}
```

DoD: `npm test` passes, coverage report emits.

---

### Task 1 — Login page

> **Depends on:** Task 0  
> **Creates:** `src/views/LoginView.vue`  
> **Modifies:** —  
> **Verify:** `npm test -- --run`; manual: submit valid credentials  
> **Done when:** Access token stored in Pinia only (never localStorage); redirect to `/dashboard`; error shown on invalid credentials.

**Reference:** `angebots-engine/src/app/(auth)/login/page.tsx`

**`src/views/LoginView.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const email    = ref('')
const password = ref('')
const error    = ref('')
const loading  = ref(false)
const auth     = useAuthStore()
const router   = useRouter()

async function submit() {
  error.value   = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.response?.data?.error ?? 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <form @submit.prevent="submit" class="bg-white p-8 rounded-lg shadow w-full max-w-sm space-y-4">
      <h1 class="text-xl font-semibold">Sign in</h1>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <input v-model="email"    type="email"    placeholder="Email"    class="input" required />
      <input v-model="password" type="password" placeholder="Password" class="input" required />
      <button type="submit" :disabled="loading" class="btn-primary w-full">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
```

DoD: login succeeds, access token stored in Pinia memory only (never localStorage), httpOnly refresh cookie set by server, redirect to `/dashboard`.

---

### Task 2 — App layout + navigation

> **Depends on:** Task 1  
> **Creates:** `src/layouts/AppLayout.vue`  
> **Modifies:** —  
> **Verify:** Manual: navigate as SUPER_ADMIN and as SELLER  
> **Done when:** Route guard redirects unauthenticated users; admin nav hidden for non-SUPER_ADMIN; `<RouterView>` renders child routes.

**Reference:** `angebots-engine/src/app/(app)/layout.tsx`, `src/components/Sidebar.tsx`

**`src/layouts/AppLayout.vue`**

- Left sidebar with nav links grouped by section:
  - Dashboard
  - Domains / Pricelists / Configurator
  - Admin (only rendered when `auth.user.role === 'SUPER_ADMIN'`)
  - Settings / Profile
- Top bar: current user name + logout button
- `<RouterView />` in main content area

DoD: nav renders, route guard redirects unauthenticated users, admin section hidden for non-admins.

---

### Task 3 — Dashboard

> **Depends on:** Task 2  
> **Creates:** `src/views/DashboardView.vue`  
> **Modifies:** —  
> **Verify:** `GET /api/v1/dashboard/stats` returns data; stat cards render  
> **Done when:** Stats cards render for SUPER_ADMIN and DOMAIN_ADMIN.

**Reference:** `angebots-engine/src/app/(app)/dashboard/page.tsx`

`GET /api/v1/dashboard/stats` → display cards:
- Total domains / active domains
- Total pricelists
- Total users
- API calls last 30 days (from log count)

DoD: stats load and render correctly for SUPER_ADMIN and DOMAIN_ADMIN.

---

### Task 4 — Domains list

> **Depends on:** Task 2  
> **Creates:** `src/views/domains/DomainsListView.vue`  
> **Modifies:** —  
> **Verify:** Create, duplicate, delete in browser  
> **Done when:** CRUD round-trips; duplicate appends "(Copy)"; delete requires confirmation.

**Reference:** `angebots-engine/src/app/(app)/domains/page.tsx`

- Table: name, slug, active badge, created date, actions (edit / duplicate / delete)
- Create button → modal with name + optional description
- Delete confirmation dialog
- Duplicate calls `POST /domains/{id}/duplicate`

DoD: CRUD operations round-trip; duplicate appends "(Copy)" suffix (verified server-side).

---

### Task 5 — Domain editor layout + Fields tab

> **Depends on:** Task 4  
> **Creates:** `src/views/domains/DomainEditorLayout.vue`, `src/views/domains/FieldsTab.vue`  
> **Modifies:** —  
> **Verify:** Add a field, save, reload page  
> **Done when:** Fields persist after page reload; `domain` available in child tabs via `provide`.

**Reference:** `angebots-engine/src/app/(app)/domains/[id]/fields/page.tsx`

`DomainEditorLayout.vue`: loads domain by route param, renders tab bar (Fields / Rules / Validations / Components / Simulator), passes `domain` to child via `provide`.

**FieldsTab.vue:**
- List of `domain.config.fields`
- Add / edit / delete fields (name, label, type, default value, options for `select` type)
- Save button → PATCH `/domains/{id}` with updated `config`

DoD: fields persist after page reload.

---

### Task 6 — Rules tab

> **Depends on:** Task 5  
> **Creates:** `src/views/domains/RulesTab.vue`  
> **Modifies:** —  
> **Verify:** Add a rule group, save, reload  
> **Done when:** Rule groups and free-text rules persist; `freeTextRules[]` key used (not `freeText`).

**Reference:** `angebots-engine/src/app/(app)/domains/[id]/rules/page.tsx`

- List rule groups; each group shows its rules
- Add / edit / delete rule groups and individual rules
- Rule form: output field (dropdown of field names), optional formula (text input), optional condition or condition group
- Free-text rules section below rule groups (maps to `config.freeTextRules[]`)
- Save button

DoD: rule groups and free-text rules persist correctly.

---

### Task 7 — Validations tab

> **Depends on:** Task 5  
> **Creates:** `src/views/domains/ValidationsTab.vue`  
> **Modifies:** —  
> **Verify:** Add a validation, save, reload  
> **Done when:** Validations persist with `type` field present (`error` or `warning`).

**Reference:** `angebots-engine/src/app/(app)/domains/[id]/validations/page.tsx`

- List validations with message and condition
- Add / edit / delete
- Condition editor: field dropdown, operator dropdown, value input
- Condition group editor: AND/OR toggle + multiple condition rows
- Save button

DoD: validations persist.

---

### Task 8 — Components tab

> **Depends on:** Task 5  
> **Creates:** `src/views/domains/ComponentsTab.vue`  
> **Modifies:** —  
> **Verify:** Add a component, save, reload  
> **Done when:** Component config persists; `activationRules[]` (not `activationRule`) used.

**Reference:** `angebots-engine/src/app/(app)/domains/[id]/components/page.tsx`

- List components (id, label, price if set)
- Expand component row to show: activation rule, variants, dependencies
- Activation rule editor: conditions list (AND group), OR groups, operator toggle
- Variants sub-list: add / edit / delete (id, label, price, description)
- Dependencies sub-list: fieldId, variantId, componentId
- Save button

DoD: component config persists.

---

### Task 9 — Simulator tab (Calculate button)

> **Depends on:** Task 5; `wagner-offer-studio-core` running  
> **Creates:** `src/views/domains/SimulatorTab.vue`  
> **Modifies:** —  
> **Verify:** Fill inputs, click Calculate, observe result in right panel  
> **Done when:** Calculate fires exactly one POST; result renders; changing inputs does NOT auto-submit.

**Reference:** `angebots-engine/src/app/(app)/domains/[id]/simulator/page.tsx`

This is the most important tab. **No engine logic runs in the browser.**

Layout:
- Left panel: dynamic input form generated from `domain.config.fields`
  - `text` → `<input type="text">`
  - `number` → `<input type="number">`
  - `boolean` → `<input type="checkbox">`
  - `select` → `<select>`
- Optional pricelist selector (GET `/pricelists`, multi-select)
- **Calculate** button (primary, full-width below inputs)
- Right panel: results (shown only after a successful run)
  - Output values table
  - Active components list
  - Validation errors (shown in red)

**`src/views/domains/SimulatorTab.vue`** (key section):

```vue
<script setup lang="ts">
import { ref, inject } from 'vue'
import { domainsApi } from '@/api'
import type { Domain, SimulatorResult } from '@/types'

const domain  = inject<Domain>('domain')!
const inputs  = ref<Record<string, unknown>>({})
const result  = ref<SimulatorResult | null>(null)
const error   = ref('')
const loading = ref(false)

// Initialise inputs from field defaults
domain.config.fields.forEach((f) => {
  inputs.value[f.name] = f.defaultValue ?? ''
})

async function calculate() {
  error.value   = ''
  loading.value = true
  try {
    const { data } = await domainsApi.run(domain.id, inputs.value)
    result.value  = data.data
  } catch (e: any) {
    error.value = e.response?.data?.error ?? 'Calculation failed'
  } finally {
    loading.value = false
  }
}
</script>
```

DoD: clicking Calculate sends exactly one POST, result renders, changing inputs does NOT re-trigger automatically.

---

### Task 10 — Pricelists

> **Depends on:** Task 2  
> **Creates:** `src/views/pricelists/PricelistsListView.vue`, `src/views/pricelists/PricelistEditorView.vue`  
> **Modifies:** —  
> **Verify:** Create pricelist, add items, save, reload  
> **Done when:** Items persist; item count shown in list view.

**Reference:** `angebots-engine/src/app/(app)/pricelists/`

- List view: name, item count, actions
- Editor view: name/description form + items table (name, price)
- Add / edit / delete items inline
- Save button → PATCH `/pricelists/{id}`

DoD: items persist; item count shown in list.

---

### Task 11 — Configurator

> **Depends on:** Task 9  
> **Creates:** `src/views/configurator/ConfiguratorListView.vue`, `src/views/configurator/ConfiguratorView.vue`  
> **Modifies:** —  
> **Verify:** Login as SELLER, navigate to configurator, run calculation  
> **Done when:** SELLER can use configurator but cannot access editor tabs; results identical to simulator.

**Reference:** `angebots-engine/src/app/(app)/configurator/`

- List view: active domains only (for SELLER role this is the landing page)
- Configurator view: identical input form to Simulator tab but branded for end-user presentation
  - Domain name/description header
  - Input fields from `config.fields`
  - Calculate button
  - Results panel

DoD: SELLER can access configurator but not domain editor; results render identically to simulator.

---

### Task 12 — Admin: Users

> **Depends on:** Task 2  
> **Creates:** `src/views/admin/UsersView.vue`  
> **Modifies:** —  
> **Verify:** Create/edit/delete user as SUPER_ADMIN  
> **Done when:** CRUD round-trips; route blocked for non-SUPER_ADMIN.

**Reference:** `angebots-engine/src/app/(app)/admin/users/page.tsx`

- Table: name, email, role badge, active toggle, created date
- Create user modal: name, email, password, role
- Edit user: all fields (password optional — empty = no change)
- Delete with confirmation

DoD: CRUD round-trips; only SUPER_ADMIN can access.

---

### Task 13 — Admin: API Keys

> **Depends on:** Task 2  
> **Creates:** `src/views/admin/ApiKeysView.vue`  
> **Modifies:** —  
> **Verify:** Create key — verify it shows once; revoke  
> **Done when:** Raw key shown exactly once in copy-to-clipboard modal after creation; revoked keys appear inactive.

**Reference:** `angebots-engine/src/app/(app)/admin/api-keys/page.tsx`

- Table: name, prefix (`eak_live_…`), last used, active
- Create: POST `/api-keys` → show full key **once** in a copy-to-clipboard modal
- Revoke: DELETE `/api-keys/{id}` (sets `active=false`)

DoD: key shown exactly once after creation; revoked keys appear inactive.

---

### Task 14 — Admin: Logs

> **Depends on:** Task 2  
> **Creates:** `src/views/admin/LogsView.vue`  
> **Modifies:** —  
> **Verify:** Make several API requests; check paginated log table loads  
> **Done when:** Paginated table renders; row expansion shows request/response bodies; filter by status code works.

**Reference:** `angebots-engine/src/app/(app)/admin/logs/page.tsx`

- Paginated table: timestamp, method, path, status, duration, API key prefix
- Expand row → show request/response bodies (truncated at 8000 chars by API)
- Filter by status code range and date range

DoD: 50+ log rows load with pagination; row expansion shows bodies.

---

### Task 15 — Admin: Webhooks

> **Depends on:** Task 2  
> **Creates:** `src/views/admin/WebhooksView.vue`  
> **Modifies:** —  
> **Verify:** Add/delete webhook URL  
> **Done when:** CRUD round-trips.

**Reference:** `angebots-engine/src/app/(app)/admin/webhooks/page.tsx`

- Table: URL, active toggle, created date
- Add / delete

DoD: CRUD round-trips.

---

### Task 16 — Profile / Change Password

> **Depends on:** Task 1  
> **Creates:** `src/views/ProfileView.vue`  
> **Modifies:** `src/router/index.ts` (add `mustChangePassword` guard)  
> **Verify:** Change password; verify `mustChangePassword` flag clears  
> **Done when:** Route guard enforces profile redirect when `mustChangePassword` is true; password change succeeds and clears the flag.

**Reference:** `angebots-engine/src/app/(app)/settings/profile/page.tsx`

- Display name + email (read-only)
- Change password form: current password, new password, confirm
- If `user.mustChangePassword` is true, redirect to profile on every route navigation and show banner

DoD: password change clears `mustChangePassword` flag; route guard enforces it.

---

### Task 17 — Dockerfile (nginx)

> **Depends on:** Tasks 0–16 complete  
> **Creates:** `Dockerfile`, `nginx.conf`  
> **Modifies:** —  
> **Verify:** `docker build -t wagner-offer-studio-ui .`  
> **Done when:** Image builds; `docker run -p 80:80` serves SPA; `/api/` proxied to `wagner-offer-studio-core`.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_API_BASE_URL is baked into the bundle at build time.
# Pass as a Docker build ARG for deployments pointing to a non-default API host.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://wagner-offer-studio-core:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

DoD: `docker build -t wagner-offer-studio-ui .` succeeds; `curl localhost/` returns HTML.

---

### Task 18 — CI pipeline

> **Depends on:** Task 17  
> **Creates:** `.github/workflows/ci.yml`  
> **Modifies:** —  
> **Verify:** Push to branch → GitHub Actions green  
> **Done when:** All CI jobs pass including docker build on `main`.

**`.github/workflows/ci.yml`**

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --run
      - run: npm run build

  docker:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v6
        with:
          push: false
          tags: wagner-offer-studio-ui:latest
```

DoD: all jobs green on push to `main`.

---

## 9. Page ↔ Reference Map

| Vue view | Next.js reference |
|---|---|
| `LoginView.vue` | `src/app/(auth)/login/page.tsx` |
| `DashboardView.vue` | `src/app/(app)/dashboard/page.tsx` |
| `DomainsListView.vue` | `src/app/(app)/domains/page.tsx` |
| `DomainEditorLayout.vue` | `src/app/(app)/domains/[id]/layout.tsx` |
| `FieldsTab.vue` | `src/app/(app)/domains/[id]/fields/page.tsx` |
| `RulesTab.vue` | `src/app/(app)/domains/[id]/rules/page.tsx` |
| `ValidationsTab.vue` | `src/app/(app)/domains/[id]/validations/page.tsx` |
| `ComponentsTab.vue` | `src/app/(app)/domains/[id]/components/page.tsx` |
| `SimulatorTab.vue` | `src/app/(app)/domains/[id]/simulator/page.tsx` |
| `PricelistsListView.vue` | `src/app/(app)/pricelists/page.tsx` |
| `PricelistEditorView.vue` | `src/app/(app)/pricelists/[id]/page.tsx` |
| `ConfiguratorListView.vue` | `src/app/(app)/configurator/page.tsx` |
| `ConfiguratorView.vue` | `src/app/(app)/configurator/[domain_id]/page.tsx` |
| `UsersView.vue` | `src/app/(app)/admin/users/page.tsx` |
| `ApiKeysView.vue` | `src/app/(app)/admin/api-keys/page.tsx` |
| `LogsView.vue` | `src/app/(app)/admin/logs/page.tsx` |
| `WebhooksView.vue` | `src/app/(app)/admin/webhooks/page.tsx` |
| `ProfileView.vue` | `src/app/(app)/settings/profile/page.tsx` |

---

## 10. Definition of Done (Phase 3)

- [ ] `npm test -- --run` passes with no failures
- [ ] `npm run build` produces a production bundle without type errors
- [ ] Login → access token in Pinia memory only, httpOnly refresh cookie set by server, route guard enforced
- [ ] Page refresh / new tab → `tryRestoreSession` silently restores session via refresh cookie
- [ ] Token expiry (15 min) → 401 interceptor queue silently refreshes and retries without user action
- [ ] Logout → server revokes refresh token, cookie cleared, Pinia memory wiped
- [ ] `mustChangePassword` redirect works on every route
- [ ] Domain CRUD (create, edit, duplicate, delete) round-trips
- [ ] All five domain editor tabs persist their data correctly
- [ ] Simulator Calculate button fires exactly one POST; inputs do not auto-submit
- [ ] Configurator accessible to SELLER role; editor tabs are not
- [ ] Admin pages hidden from non-SUPER_ADMIN users
- [ ] API key shown exactly once after creation
- [ ] `docker build` succeeds; nginx serves SPA and proxies `/api/` correctly
- [ ] CI pipeline green on push to `main`
