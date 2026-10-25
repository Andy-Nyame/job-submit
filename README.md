# JobSubmit

JobSubmit is the remote job-submission and production workflow platform for **Capt. Bob Cedi’s Artworks**. It is an independent production project with its own source tree, Git history, environment, and dedicated future infrastructure.

## Current scope: Brick 7.2

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
- `/login`, `/signup`, and `/access-denied`, with `/app` redirecting each active
  role directly to its useful starting page
- secure, manually shareable worker invitations with random single-use tokens,
  database-only token hashes, verified-email redemption, expiry, revocation,
  and replacement links
- OWNER/ADMIN worker management for active state, display name, six seeded
  service skills, QUICK/STANDARD limits, and FOCUS eligibility
- a worker profile/status page plus skill- and capacity-checked available/my-job views
- a polished public welcome page that explains the business, active service
  catalogue, planned JobSubmit customer journey, current account access, and
  the distinction between live and upcoming capabilities
- a safe server-only public service query that returns only active,
  non-archived service presentation fields for the active Capt. Bob business
- OWNER/ADMIN service management with search, lifecycle filtering, creation,
  version-protected edits, deactivation/restoration, and transactional audits
- simplified service-level quantity rules, five explicit size modes, printing
  options, bounded customer fields, repeatable-variation contracts, automatic
  difficulty/workload defaults, online eligibility, and customer preview
- exact fixed pricing for eligible uniform specifications or Price on Request;
  legacy indicative-range values remain preserved but are hidden
- authenticated CUSTOMER submission at `/app/jobs/new`, with configured
  service selection, conditional quantity/size/options/customer fields,
  repeatable variations, a review step, and unique confirmation references
- server-authoritative fixed/Express calculations, truthful Price on Request
  handling, immutable job snapshots, initial `SUBMITTED` history, idempotent
  creation, and transactional audit/attachment association
- optional private Vercel Blob uploads with bounded type/size rules, upload
  progress, expiring pre-job ownership reservations, and owner-scoped downloads
- customer-scoped `/app/jobs` history and `/app/jobs/[reference]` details;
  references alone never grant access
- a business-scoped staff inbox at `/app/staff/jobs` for active WORKER, ADMIN,
  and OWNER memberships, with server-side search, filters, sorting, and pagination
- secure staff job details sourced from immutable submission snapshots, including
  customer context, private attachments, pricing treatment, and status history
- the controlled `SUBMITTED → UNDER_REVIEW` transition with optimistic
  concurrency, append-only history, actor/timestamp attribution, and audit logging
- staff-only internal job notes with bounded input, authorship, and audit events;
  customer queries never select note data
- OWNER/ADMIN manual costing for Price on Request jobs with private drafts,
  immutable issued terms, seven-day default validity, safe withdrawal, and
  versioned revisions
- customer quotation acceptance/decline plus optional counteroffers only when
  management deliberately enables negotiation for that service
- fixed-price submissions remain immediately confirmed from their immutable
  server-calculated snapshot and never enter manual quotation
- persistent, recipient-scoped in-app notifications for meaningful job and
  quotation events, with stable retry deduplication and transactional creation
- an accessible notification bell plus `/app/notifications` action center with
  unread counts, newest-first bounded pagination, filtering, secure deep links,
  and idempotent individual/all read controls
- simplified main navigation: CUSTOMER uses Submit a Job, My Jobs, and My
  Account; OWNER/ADMIN use Jobs, Shop & Services, and Team; WORKER uses Jobs
  and My Account. Notifications stay on the bell rather than the main menu
- a business-scoped Shop Open/Closed control for OWNER/ADMIN that pauses only
  new customer submissions, preserves existing work, and remains independent
  from each service's online availability
- a three-stage customer flow—Choose what you need, Tell us the details, and
  Check and Submit—with plain customer-facing job and pricing language
- mobile notification bells that open the full center directly, plus optional
  device-local sound/voice modes that default OFF and respect browser audio
  and page-visibility limits
- Express-first/FIFO operational release, audited queue exceptions,
  skill/capacity-checked worker assignment and claims, reassignment history,
  and production progress through verified collection
- large canonical job numbers, printable QR labels for independently tracked
  physical packages, and authenticated staff scan destinations
- separate encrypted one-time pickup QR/manual credentials, full saved-request
  handover checks, replay-safe explicit confirmation, and controlled management
  fallback with a mandatory reason
- one coordinated 20-second visible/online application refresh with immediate
  visibility/reconnect revalidation and a clear offline state
- a visual service catalogue with one card per standalone service, safe neutral
  fallbacks, and private Blob-backed multi-image galleries managed only by
  active OWNER/ADMIN memberships
- standalone Poster Printing and Label Printing configurations that reuse the
  approved pricing strategies and stay offline until management explicitly
  reviews and enables them; historical embedded Sticker snapshots remain readable
- a standalone Website Design & Creation Price on Request service backed by a
  canonical Job, private customer-to-management enquiry messages, read state,
  retry-safe writes, and role-aware in-app notifications

Fixed pricing uses integer pesewas and configured quantity steps and remains
confirmed at submission. Price on Request performs no automatic calculation;
OWNER/ADMIN issue a versioned GHS quotation that the customer must explicitly
accept or decline. Negotiation is independently configured per manual-price
service and defaults OFF. Brick 7.2 keeps in-app notification delivery only; no
transactional email provider is configured. Its focused Website Design &
Creation enquiry thread does not replace formal quotation and is not a general
customer/staff messaging platform. It does **not** implement external
notifications, payments, stars,
leaderboards, inventory, or other later business workflows.

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
- `PICKUP_CREDENTIAL_SECRET`: at least 32 random characters used only to encrypt
  retrievable private pickup credentials
- `APP_ORIGIN`: optional canonical HTTPS origin used in printed and pickup QR links
- `EMAIL_PASSWORD_SIGNUP_ENABLED`: keep `false` until production custom SMTP and
  the SSR confirmation template are configured
- `BLOB_READ_WRITE_TOKEN`: server-only Vercel Blob credential

Supabase owns authentication identity only; Neon remains authoritative for
JobSubmit application data. Vercel Blob holds private customer reference files
and service-gallery image bytes. Customer files always recheck ownership or
business-scoped staff authority. Service images are exposed only through opaque
application-owned catalogue routes; private Blob keys are never returned. Never
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
    jobs/                Customer job-submission interaction
    staff-jobs/          Staff review and internal-note interactions
    quotations/          Management costing and customer quotation interactions
    services/            Service-management forms and interactions
    ui/                  Small reusable UI primitives
  config/                Factual product and site configuration
  domain/                Pure domain constants, calculations, and tests
  lib/                   Framework-agnostic utilities
  server/                Server-only auth/authorization and Prisma access
docs/
  ARCHITECTURE.md         Application boundaries and project decisions
  AUTHENTICATION.md       Auth flows, locked bootstrap, and manual configuration
  DATABASE.md             Domain model, integrity, lifecycle, and transactions
  JOB_SUBMISSION.md       Brick 6A customer submission, uploads, pricing, and boundaries
  STAFF_JOBS.md           Brick 6B staff inbox, review, notes, and authorization
  PRICING_AND_QUOTATIONS.md Brick 6C fixed/manual pricing and approval workflow
  SERVICES.md             Service catalogue, lifecycle, pricing boundary, and audit policy
  TEAM.md                 Worker invitation, access, capacity, and audit policy
```

The generated Prisma client lives under `src/generated/prisma` and is intentionally ignored because it is reproducibly generated during install/build workflows.

## Visual and theme direction

The visual foundation is premium, modern, clean, and restrained. Royal Blue
drives primary actions, Metallic Gold provides selective accents, and Soft
Charcoal anchors typography and dark surfaces. Accessible light and dark
palettes are centralized through semantic tokens rather than scattered raw
brand colours. The shared theme control preserves the System default and lets
visitors choose the opposite applied mode without a hydration flash.
Authenticated navigation uses a simplified role-aware desktop sidebar and an
accessible mobile drawer backed by one navigation definition. Notifications
remain in the bell and My Account remains available without duplicating
operational pages. Shared text-entry controls
remain at least 16px on mobile and tablet widths to avoid iOS Safari focus zoom
without restricting user-controlled pinch-to-zoom.

## Project separation

This repository is not part of Footwear Empire, Vault Commerce, CIV, Kobby’s Kitchen, or any other client system. JobSubmit must use its own database, storage, credentials, deployment, and remote repository. No other project’s code, data, credentials, or infrastructure may be connected to it.

Production transactional email and custom SMTP are deferred until a proper
sending domain is available.
