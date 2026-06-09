# Frontend Architecture

## Next.js App Router

The frontend is built with **Next.js 16 App Router**. This is a significant departure from the older Pages Router — if you're familiar with React but not Next.js 15+, read this carefully.

### The fundamental rule: Server vs. Client Components

In the App Router, **every component is a Server Component by default**. Server Components:

- Run on the server only (never in the browser)
- Can be `async` and `await` database calls directly
- Cannot use `useState`, `useEffect`, event handlers
- Are streamed as HTML to the browser

To make a component interactive, add `"use client"` as the first line of the file. Client Components:

- Are rendered on the server initially (SSR), then hydrated in the browser
- Can use `useState`, `useEffect`, event handlers, browser APIs
- Cannot be `async`

### The pattern used in this project

Every interactive page follows the **server-client split pattern**:

```
domains/[id]/fields/
├── page.tsx            (Server Component)
│   - async: loads data from DB via DomainService
│   - passes data as props to FieldsEditor
└── fields-editor.tsx   (Client Component — "use client")
    - receives initialConfig as prop
    - manages state locally
    - calls /api/... to save changes
```

This keeps data fetching on the server (fast, no API round-trip) and interactivity on the client.

---

## Route Group `(app)`

The `(app)` directory is a **Route Group** — the parentheses tell Next.js not to include it in the URL path.

Its layout `src/app/(app)/layout.tsx` runs for every page inside it:

```typescript
export default async function AppLayout({ children }) {
  const user = await requireAuth();  // Redirects to /login if no session
  return (
    <div className="flex h-full">
      <NavigationProgress />
      <Sidebar userRolle={user.rolle} userName={user.name} userEmail={user.email} />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
```

`requireAuth()` is the session gate. If there's no valid JWT cookie, Next.js redirects to `/login` automatically.

---

## `loading.tsx`

`src/app/(app)/loading.tsx` defines the **Suspense fallback** shown while a page is loading. Next.js automatically wraps the page content in a `<Suspense>` boundary and shows the loading component while the async server component is executing.

---

## Layout hierarchy

```
src/app/layout.tsx          Root: <html>, <body>, fonts
  └── (app)/layout.tsx      Auth check, Sidebar, NavigationProgress
      └── page.tsx           The actual page
```

Layouts are cached and not re-rendered on navigation between pages in the same group.

---

## Navigation and Links

Use `<Link href="...">` from `next/link` for all navigation. This enables:
- Client-side navigation (no full page reload)
- Automatic prefetching on hover
- Back/forward browser history

Do NOT use `<a href="...">` for internal links — it causes a full page reload.

---

## Sidebar Component

`src/components/layout/sidebar.tsx` is a `"use client"` component that handles:

- Desktop: collapsible sidebar (60px ↔ 240px), state persisted in `localStorage`
- Mobile: full-screen overlay drawer triggered by a hamburger button
- Role-based nav item visibility (SUPER_ADMIN sees more items)
- Active state based on `usePathname()` — highlights the current route

---

## NavigationProgress

`src/components/layout/navigation-progress.tsx` renders a thin progress bar at the top of the page during navigation. It uses `usePathname()` and `useSearchParams()` to detect route changes, and `setInterval` to animate the bar width.

---

## Styling — Tailwind CSS v4

Tailwind v4 is configured via `postcss.config.mjs`. The design system uses CSS custom properties (`--background`, `--foreground`, `--primary`, etc.) defined in `src/app/globals.css`.

Key utility patterns used throughout:
- `cn(...)` from `src/lib/utils.ts` — merges class names conditionally (uses `clsx` + `tailwind-merge`)
- `bg-card`, `bg-muted`, `text-muted-foreground` — semantic color tokens
- `rounded-xl`, `shadow-sm` — card styling
- `space-y-4`, `grid grid-cols-2 gap-4` — layout utilities

---

## UI Component Library

All UI primitives are in `src/components/ui/`. They wrap **Radix UI** headless components with Tailwind styling.

Key components:

| Component | Based on | Use for |
|---|---|---|
| `Button` | Radix Slot | All clickable actions |
| `Input` | native `<input>` | Text/number inputs |
| `Select` | Radix Select | Dropdowns |
| `Dialog` | Radix Dialog | Modals |
| `Collapsible` | Radix Collapsible | Expandable sections |
| `Badge` | div | Status labels |
| `Alert` | div | Error/warning messages |
| `Switch` | Radix Switch | Boolean toggles |
| `Tabs` | Radix Tabs | Tab navigation |
| `Tooltip` | Radix Tooltip | Hover hints |

`FormulaInput` (`src/components/ui/formula-input.tsx`) is a custom component — a text input with field-name autocomplete for formula editing.

---

## Form handling

Forms use **React Hook Form** with **Zod** validation:

```typescript
const schema = z.object({
  name: z.string().min(1, "Pflichtfeld").max(100),
  email: z.string().email(),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
});
```

The user settings, new user dialog, and new domain form all follow this pattern.

---

## Toast notifications

`sonner` provides toast notifications. Import from `sonner`:

```typescript
import { toast } from "sonner";
toast.success("Gespeichert");
toast.error("Fehler beim Speichern");
```

The `<Toaster />` is rendered in the root layout.

---

## Editor components

The domain editor pages (fields, rules, components, validations, form layout) are large, complex client components. They all share the same save pattern:

```typescript
async function save() {
  setSaving(true);
  try {
    const res = await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_json: JSON.stringify(config) }),
    });
    if (!res.ok) throw new Error("Fehler");
    setSaved(true);
  } catch {
    setError("Fehler beim Speichern.");
  } finally {
    setSaving(false);
  }
}
```

The entire `DomainConfig` object is serialized to JSON on every save — there is no partial-update mechanism for the config.

---

## TypeScript tips for this codebase

### Path aliases

`@/` maps to `src/`. Configured in `tsconfig.json`:

```json
{ "paths": { "@/*": ["./src/*"] } }
```

So `import { prisma } from "@/lib/prisma"` resolves to `src/lib/prisma.ts`.

### Implicit `any` workarounds

NextAuth v5 beta does not export all types cleanly. You'll see `(user as any).rolle` casts in `src/lib/auth.ts`. This is a known limitation of the beta version.

### Server Component async pattern

```typescript
// page.tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  // params is a Promise in Next.js 15+
  const domain = await DomainService.findById(id);
  if (!domain) notFound();      // triggers the 404 page
  return <ClientComponent initialData={domain} />;
}
```

Note: In Next.js 15+, dynamic route `params` are `Promise<...>` and must be awaited.
