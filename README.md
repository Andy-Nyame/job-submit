# JobSubmit

JobSubmit is the remote job-submission and production workflow platform for **Capt. Bob Cedi’s Artworks**. It is an independent production project with its own source tree, Git history, environment, and dedicated future infrastructure.

## Current scope: Brick 4.5

The project now contains the database, authentication, application-authorization,
and team/worker foundation:

- Next.js App Router, React, strict TypeScript, Tailwind CSS, and ESLint
- semantic light/dark visual tokens and a restrained placeholder shell
- Neon PostgreSQL modeled with Prisma
- business-scoped users, memberships, workers, services, jobs, queue metadata, assignments, attachments, communication, notifications, pickup verification, stars, and audit records
- PostgreSQL checks, partial unique indexes, and triggers for critical integrity rules
- pure integer-minor-unit pricing and complexity/star rules with focused tests
- an idempotent seed for the real business name and known service definitions only
- Supabase Auth with cookie-based SSR sessions, Google OAuth, email/password
  login, PKCE callback/confirmation handling, local-session logout, and a
  Next.js 16 `proxy.ts` refresh boundary
- a unique Supabase subject-to-Neon User binding and server-authoritative
  Capt. Bob business membership resolution
- public `CUSTOMER` onboarding, locked verified-email bootstrap for the initial
  `ADMIN` and `OWNER`, blocked-account enforcement, and reusable role guards
- `/login`, `/signup`, `/access-denied`, and a minimal protected `/app`
  verification screen
- secure, manually shareable worker invitations with random single-use tokens,
  database-only token hashes, verified-email redemption, expiry, revocation,
  and replacement links
- OWNER/ADMIN worker management for active state, display name, six seeded
  service skills, QUICK/STANDARD limits, and FOCUS eligibility
- a read-only worker profile/status page without queue or job-board behavior
- a polished public welcome page that explains the business, active service
  catalogue, planned JobSubmit customer journey, current account access, and
  the distinction between live and upcoming capabilities
- a safe server-only public service query that returns only active,
  non-archived service presentation fields for the active Capt. Bob business

Brick 4.5 does **not** implement full role dashboards, service administration,
job submission, upload endpoints, queue claiming or assignment enforcement,
live messaging, notification delivery, pickup-code generation, payments,
stars, or other business workflows. Those remain later-brick work.

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
- `EMAIL_PASSWORD_SIGNUP_ENABLED`: keep `false` until production custom SMTP and
  the SSR confirmation template are configured
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
  server/                Server-only auth/authorization and Prisma access
docs/
  ARCHITECTURE.md         Application boundaries and project decisions
  AUTHENTICATION.md       Auth flows, locked bootstrap, and manual configuration
  DATABASE.md             Domain model, integrity, lifecycle, and transactions
  TEAM.md                 Worker invitation, access, capacity, and audit policy
```

The generated Prisma client lives under `src/generated/prisma` and is intentionally ignored because it is reproducibly generated during install/build workflows.

## Visual and theme direction

The visual foundation remains premium, modern, clean, and restrained. Black and white carry the interface; gold (`#D4AF37`) and goldenrod (`#DAA520`) are deliberate accents. Components consume semantic tokens rather than scattering raw brand colors. Final role-specific theme controls remain deferred.

## Project separation

This repository is not part of Footwear Empire, Vault Commerce, CIV, Kobby’s Kitchen, or any other client system. JobSubmit must use its own database, storage, credentials, deployment, and remote repository. No other project’s code, data, credentials, or infrastructure may be connected to it.

Production transactional email and custom SMTP are deferred until a proper
sending domain is available.
