# Angebots-Engine — Developer Documentation

> Complete technical reference for developers working on or deploying the Angebots-Engine.

## What is this application?

The **Angebots-Engine** is a web-based platform for building and running configurable product/offer configurators. It lets business users define *domains* (product types), configure their fields, rules, and pricing, and then use a live simulator or public API to calculate offers — without writing any code.

---

## Documentation Index

| Document | What it covers |
|---|---|
| [01 · Architecture](./01-architecture.md) | System overview, tech stack, component relationships |
| [02 · Getting Started](./02-getting-started.md) | Prerequisites, local setup, first run |
| [03 · Project Structure](./03-project-structure.md) | Every directory and file explained |
| [04 · Database & Prisma](./04-database.md) | Schema, models, migrations, seeding |
| [05 · Authentication & Authorization](./05-authentication.md) | NextAuth, JWT, roles, rate limiting |
| [06 · The Engine](./06-engine.md) | Core business logic — rules, formulas, components |
| [07 · API Reference](./07-api.md) | All HTTP endpoints, internal and external |
| [08 · Frontend Architecture](./08-frontend.md) | Next.js App Router, server vs client components |
| [09 · Services Layer](./09-services.md) | Service classes, data access patterns |
| [10 · Deployment](./10-deployment.md) | Docker, docker-compose, production go-live checklist |
| [11 · Testing](./11-testing.md) | Vitest setup, unit tests, integration tests, CI |
| [12 · Debugging Guide](./12-debugging.md) | Common errors, tools, log locations |

---

## Quick Reference

```bash
# Start development server (Webpack mode — required due to Turbopack bug)
npm run dev

# Run tests (requires PostgreSQL)
npm test

# Apply DB migrations
npx prisma migrate dev

# Seed the database
npm run db:seed

# Build for production
npm run build

# Start production server
npm start
```
