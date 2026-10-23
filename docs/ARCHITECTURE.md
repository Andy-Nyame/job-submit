# JobSubmit architecture and project decisions

## 1. Project boundary

JobSubmit is a standalone product for Capt. Bob Cedi’s Artworks. Its source, Git history, PostgreSQL database, object storage, environments, credentials, deployments, and external services must remain independent of Footwear Empire, Vault Commerce, CIV, Kobby’s Kitchen, and every other client project.

Brick 6A adds authenticated customer job submission, immutable configured-
service snapshots, private reference-file handling, and customer-owned job
visibility on top of the Brick 5.2 service contracts. It does not add
quotation negotiation or acceptance, job claiming,
assignment enforcement, live messaging, delivery mechanisms, or later business
workflows.

## 2. Application shape

- Next.js App Router is the routing and rendering foundation.
- React Server Components are the default; Client Components require an actual browser-side need.
- `src/app` owns routes and route-level composition.
- `src/components/ui` and `src/components/layout` remain presentation-only.
- `src/domain` contains pure, framework-independent rules.
- `src/server` is an explicit server-only boundary. Database access imports `server-only` and must never enter a client bundle.
- `prisma` owns the persistence model, migrations, and development seed.
- The public homepage remains a Server Component. Its catalogue query selects
  only active, non-archived services for the active Capt. Bob business and
  exposes no membership, customer, worker, job, or infrastructure data. A small
  Client Component owns only the mobile navigation interaction.

The product roles are `CUSTOMER`, `WORKER`, `ADMIN`, and `OWNER`. Roles are
persisted through business membership. Authentication uses Supabase Auth, while
authorization uses active, server-authoritative JobSubmit membership data in
Neon; client claims and identity-provider metadata do not grant application
roles.

## 3. Database decision

Neon PostgreSQL is the authoritative JobSubmit application/domain datastore and Prisma is the ORM/migration tool. Operational records are scoped through a `Business` root instead of a global singleton, without positioning the product as a public multi-tenant SaaS. Runtime code uses a pooled `DATABASE_URL`; migrations use the direct `DIRECT_DATABASE_URL`.

The initial migration combines Prisma-generated DDL with explicit PostgreSQL checks, partial indexes, and triggers for rules Prisma cannot express. See [DATABASE.md](DATABASE.md) for the complete model and transaction decisions.

## 4. Authentication and infrastructure decision

- Supabase Auth owns authentication identities, credentials, and cookie-backed
  sessions; it does not own JobSubmit domain data or roles.
- Google OAuth uses Supabase PKCE with `/auth/callback`. Email confirmation uses
  `/auth/confirm` when the hosted template is configured for token hashes.
- Every sensitive request verifies Supabase claims, fetches the current
  authoritative Supabase user when email state matters, and resolves the stable
  Supabase subject to one Neon `User` plus the Capt. Bob business membership.
- `proxy.ts` refreshes session cookies and may perform an optimistic protected
  route redirect. Pages, Server Actions, and Route Handlers still enforce the
  server-side Neon authorization boundary.
- Public provisioning creates `CUSTOMER` only. Existing legitimate staff roles
  are preserved. Future staff authority requires authorized application-side
  invitation/management flows.
- Two verified emails are the only initial bootstrap policy:
  `bobcedisartworks@gmail.com` maps to `OWNER`, and
  `nyameandy8@gmail.com` maps to `ADMIN`. The policy is server-only,
  idempotent, never trusts metadata, never downgrades stronger access, never
  reactivates blocked records, and writes an audit entry only when privileged
  authority is first established or elevated.
- Disabled users, inactive memberships, and inactive/archived business records
  remain denied after successful Supabase authentication.
- Explicit role guards are used instead of a numeric hierarchy assumption.
- Team management is restricted to active `OWNER` and `ADMIN` principals.
  Mutations re-authorize independently, scope every target to the actor's
  business, and never accept a client-selected staff role. `ADMIN` has no route
  for granting `ADMIN`/`OWNER`, removing owner authority, or changing bootstrap
  policy.
- Service management is restricted to active `OWNER` and `ADMIN` principals.
  Reads and mutations are business-scoped, every Server Action re-authorizes,
  and versioned writes reject stale changes. `CUSTOMER` and `WORKER` members do
  not receive service-management access.
- Customer job submission is restricted to active `CUSTOMER` principals. Every
  page, Server Action, upload-token request, private download, and database query
  rechecks the Supabase identity and active Neon membership. `WORKER`, `ADMIN`,
  and `OWNER` roles do not gain customer ownership implicitly.
- Worker access begins with a server-created invitation. The raw 256-bit token
  is carried in a URL fragment, retained only temporarily in the browser during
  authentication, submitted over the Server Action request, and never stored
  or audited. PostgreSQL stores only its unique SHA-256 hash. Redemption
  requires the exact verified Supabase email and atomically consumes the token,
  promotes only `CUSTOMER` to `WORKER`, creates the profile, and appends audit
  history.
- Vercel hosts the application at `https://capt-bob-cedis-artworks.vercel.app`.
- Vercel Blob is the object-storage provider. The JobSubmit store is private.
  Customer uploads receive a short-lived business/user-bound reservation before
  a job exists, then the reservation, `JobAttachment`, job, customer snapshot,
  initial status history, and audit event are associated in one serializable
  database transaction. Private downloads query job ownership before streaming;
  possession of a reference, attachment ID, or Blob URL is not authorization.
- Production transactional email/custom SMTP remains deferred until a proper
  sending domain exists. Public email signup stays gated through
  `EMAIL_PASSWORD_SIGNUP_ENABLED=false`; password login remains available for
  existing accounts and Google remains the usable public path.

## 5. Visual system

JobSubmit supports Light, Dark, and System appearance preferences throughout
public, authentication, and authenticated routes. Components consume semantic
tokens rather than palette values. The selected preference is available in the
shared navigation and persists locally; System is the default and follows live
operating-system colour-scheme changes. See [THEMING.md](THEMING.md) for the
palette and implementation conventions.

The public welcome page uses the same semantic tokens in both system light and
dark modes. Its abstract print-production artwork is implemented with HTML,
CSS, and accessible text rather than an invented company logo or unverified
stock imagery.

## 6. Permanent lifecycle principle

If an authorized user can create a persistent business entity, the product must provide an appropriate safe remove, archive, or deactivate path. Historical, commercial, and audit records must not be destructively deleted where that would damage traceability, reporting, reconciliation, or accountability.

Services and team memberships are deactivated; jobs are archived; attachments and messages are tombstoned where appropriate; confirmed pricing is immutable; status history, stars, and audit logs are append-only. Corrections use new records or compensating entries.

Service deactivation removes a service from the public active catalogue without
deleting its row or historical references. Explicit restoration makes it
publicly eligible again. Create, update, deactivate, and restore operations are
written with their audit records in the same serializable database transaction.

Services choose Fixed Pricing or Price on Request. Fixed pricing stores exact
integer-pesewa inputs and applies only to valid quantity steps and uniform
specifications. Price on Request never calculates a total. Legacy indicative
range columns remain preserved but hidden; they are not converted into fixed
prices. The Owner currently handles individual costing. Position-based pricing
authority, pricing chat, and customer quotation acceptance remain future
workflow concerns.

Quantity, pricing, and specification settings are versioned, strictly validated
JSON contracts. Specification version 2 adds five explicit size modes, bounded
custom customer fields, and repeatable variation metadata while reading Brick
5.1 version 1 safely. Brick 6A copies applicable service settings, validated
customer values, and the server-calculated pricing treatment into an immutable
job snapshot so later service edits cannot alter historical requirements.

Service difficulty is the only manager-editable classification default. It
derives `SIMPLE → QUICK → 1`, `MEDIUM → STANDARD → 2`, and
`COMPLEX → FOCUS → 3`. Actual future jobs may be reclassified during authorized
review; service defaults do not permanently constrain a job.

## 7. Homepage diagnostic record

The Brick 5.2 audit confirmed `src/app/page.tsx` as a Server Component with
parallel authentication/catalogue loading, safe catalogue failure handling,
valid imports, and no hydration boundary. TypeScript, ESLint, browser console,
axe WCAG A/AA checks, and a direct comparison of referenced CSS variables to
the global token definitions found no remaining undefined variable. VS Code
editor diagnostics were unavailable, so the earlier undefined-variable report
could not be reproduced and is classified as historical or editor-only.

Confirmed presentation defects were corrected: the service card reduced
configured quantity rules to a unit-only sentence and still rendered retired
indicative ranges. Catalogue rendering now uses a focused tested component,
shows minimum-only rules without inventing a maximum, and displays only Fixed
Pricing or Price on Request. The catalogue failure state and semantic theme
classes have render regression coverage.

## 8. Security and delivery baseline

- TypeScript is strict, and lint warnings fail CI-style checks.
- Secrets belong only in ignored environment files or deployment configuration.
- Private file storage requires server authorization; permanent public object URLs are not part of this design.
- Pickup codes will be stored as secure hashes, not plaintext.
- Sensitive actions must combine state change, history/audit, and related notifications atomically in future service code.
- Production builds use Next.js’s webpack backend because the managed environment blocks Turbopack’s internal localhost binding.

## 9. Deferred implementation

Full role dashboards, staff job review, pricing communication and quotation
acceptance, queue/assignment claiming, messaging UI/transport, attachment
replacement, notification delivery, transactional email, secure
pickup-code generation, payments, stars, and ecommerce remain deliberately
deferred.
