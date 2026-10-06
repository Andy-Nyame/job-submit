# JobSubmit

JobSubmit is the remote job-submission and production workflow platform for **Capt. Bob Cedi’s Artworks**. It is an independent production project with its own source tree, Git history, environment, and dedicated future infrastructure.

## Current scope: Brick 2

The project now contains the database and core-domain foundation:

- Next.js App Router, React, strict TypeScript, Tailwind CSS, and ESLint
- semantic light/dark visual tokens and a restrained placeholder shell
- Neon PostgreSQL modeled with Prisma
- business-scoped users, memberships, workers, services, jobs, queue metadata, assignments, attachments, communication, notifications, pickup verification, stars, and audit records
- PostgreSQL checks, partial unique indexes, and triggers for critical integrity rules
- pure integer-minor-unit pricing and complexity/star rules with focused tests
- an idempotent seed for the real business name and known service definitions only

Brick 2 does **not** implement authentication, authorization middleware, application dashboards, submission or upload endpoints, queue claiming, live messaging, notifications delivery, pickup-code generation, payments, or other business workflows. Those remain later-brick work.

## Requirements

- Node.js 20.9 or newer (development currently uses Node.js 22)
- npm 10 or newer
- access to the dedicated JobSubmit Neon PostgreSQL database when applying migrations or running the seed

## Local development

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run dev
```

Set the required values in the ignored `.env.local` file. Prisma tooling loads
`.env.local` first and falls back to `.env`:

- `DATABASE_URL`: pooled/runtime connection to the dedicated JobSubmit Neon database
- `DIRECT_DATABASE_URL`: direct Neon connection for migrations and administrative checks
- `NEXT_PUBLIC_SUPABASE_URL`: dedicated Supabase project URL for future authentication
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public Supabase anon/publishable key
- `BLOB_READ_WRITE_TOKEN`: server-only Vercel Blob credential

Supabase owns authentication identity only; Neon remains authoritative for
JobSubmit application data. Vercel Blob will hold file/media objects, but future
application routes must authorize every private job or staff file access. Never
point these values at another project’s infrastructure. No credentials are
committed.

Quality commands:

```bash
npm run db:format
npm run db:validate
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
npm audit
npm audit --omit=dev
```

Production migration command:

```bash
npm run db:migrate:deploy
```

## Project structure

```text
prisma/
  migrations/            Versioned PostgreSQL DDL and integrity rules
  schema.prisma          Core persistence model
  seed.ts                Minimal idempotent business/service seed
src/
  app/                   App Router shell, metadata, page, and global tokens
  components/
    layout/              Structural presentation components
    ui/                  Small reusable UI primitives
  config/                Factual product and site configuration
  domain/                Pure domain constants, calculations, and tests
  lib/                   Framework-agnostic utilities
  server/                Server-only infrastructure, including Prisma access
docs/
  ARCHITECTURE.md         Application boundaries and project decisions
  DATABASE.md             Domain model, integrity, lifecycle, and transactions
```

The generated Prisma client lives under `src/generated/prisma` and is intentionally ignored because it is reproducibly generated during install/build workflows.

## Visual and theme direction

The visual foundation remains premium, modern, clean, and restrained. Black and white carry the interface; gold (`#D4AF37`) and goldenrod (`#DAA520`) are deliberate accents. Components consume semantic tokens rather than scattering raw brand colors. Final role-specific theme controls remain deferred.

## Project separation

This repository is not part of Footwear Empire, Vault Commerce, CIV, Kobby’s Kitchen, or any other client system. JobSubmit must use its own database, storage, credentials, deployment, and remote repository. No other project’s code, data, credentials, or infrastructure may be connected to it.

Production transactional email and custom SMTP are deferred until a proper
sending domain is available.
