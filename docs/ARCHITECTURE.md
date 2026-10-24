# JobSubmit architecture and project decisions

## 1. Project boundary

JobSubmit is a standalone product for Capt. Bob Cedi’s Artworks. Its source, Git history, PostgreSQL database, object storage, environments, credentials, deployments, and external services must remain independent of Footwear Empire, Vault Commerce, CIV, Kobby’s Kitchen, and every other client project.

Brick 6A adds authenticated customer job submission, immutable configured-
service snapshots, private reference-file handling, and customer-owned job
visibility on top of the Brick 5.2 service contracts. Brick 6B adds the
business-scoped staff inbox, snapshot-based staff detail, internal notes, and
the single controlled `SUBMITTED → UNDER_REVIEW` transition. Brick 6C adds
fixed-price confirmation messaging and a separate, versioned manual quotation
lifecycle with explicit customer decisions. Negotiation is service-specific,
defaults off, and is frozen when management issues a quote. It does not add
payment, general pricing chat, job claiming, assignment enforcement, live
messaging, delivery mechanisms, or later business workflows.

## 2. Application shape

- Next.js App Router is the routing and rendering foundation.
- React Server Components are the default; Client Components require an actual browser-side need.
- `src/app` owns routes and route-level composition.
- `src/components/ui` and `src/components/layout` remain presentation-only.
- `src/domain` contains pure, framework-independent rules.
- `src/server` is an explicit server-only boundary. Database access imports `server-only` and must never enter a client bundle.
- `prisma` owns the persistence model, migrations, and development seed.
- Authenticated routes use one role-aware navigation definition. A persistent
  desktop sidebar and accessible mobile drawer render the same permitted links;
  visibility is a convenience layer and never replaces server authorization.
- Main navigation is intentionally small: CUSTOMER has Submit a Job, My Jobs,
  and My Account; OWNER/ADMIN have Jobs, Shop & Services, and Team; WORKER has
  Jobs and My Account. `/app` sends CUSTOMER to `/app/jobs/new` and staff roles
  to `/app/staff/jobs`. Explicit authorized deep links and notification links
  remain unchanged, and notifications are reached through the bell.
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
- New customer intake additionally requires that the same active Business has
  `acceptingNewJobs=true`. OWNER/ADMIN may change this business-scoped setting
  through Shop & Services; the mutation is serializable and audited. Closing
  intake does not deactivate the Business, change service flags, block sign-in,
  or affect existing jobs and quotations. The final job transaction rechecks
  the switch, so a form opened before closure cannot create a new job afterward.
- Staff job access is restricted to active `WORKER`, `ADMIN`, and `OWNER`
  memberships. Every inbox/detail read, Server Action, transition, note write,
  and staff file download rechecks the Supabase identity and current Neon
  membership, then scopes the resource to the same active business. Customers
  cannot access staff routes or notes.
- Quotation costing authority is restricted to active `OWNER` and `ADMIN`
  memberships. `WORKER` retains operational job review but cannot read draft
  amounts, issue/revise prices, change negotiation policy, or decide customer
  proposals. Customer quote reads and decisions require ownership of the
  associated job in the same active business.
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

All mobile text-entry controls must maintain a computed font-size of at least
16px to avoid unwanted iOS Safari focus zoom. User-controlled pinch-to-zoom
must remain available. Shared form controls enforce this below the desktop
breakpoint; the viewport never disables scaling.

The customer submission interface presents the existing service-driven form as
three stages: Choose what you need, Tell us the details, and Check and Submit.
State stays in one client form while moving backward and forward; all existing
server validation, uploads, pricing, immutable snapshots, and idempotency remain
authoritative.

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
prices. Manual quotations are issued only by OWNER/ADMIN; service negotiation
is a separate boolean that defaults off and is valid only with Price on Request.
Issued financial terms and the negotiation policy are immutable. A changed
amount requires a new version, and customer acceptance records the agreed
version without starting production or recording payment.

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
- Pickup codes use a database hash for lookup plus AES-256-GCM ciphertext for
  authorized customer retrieval; raw codes never enter logs, audits, or labels.
- Implemented Brick 6D events combine the successful job/quotation state
  change, existing history/audit, and recipient notifications in one database
  transaction. Future events must preserve this boundary.
- On mobile, the notification bell links directly to `/app/notifications`; the
  desktop bell may show its bounded recent-notification panel. Optional sound is
  OFF by default, device-local, plays only for important newly observed allowed
  events while the app is visible, and never claims closed-tab/background
  delivery. Initial loads do not replay old notifications.
- Production builds use Next.js’s webpack backend because the managed environment blocks Turbopack’s internal localhost binding.

## 9. Deferred implementation

Standalone role dashboards, general pricing communication,
messaging UI/transport, attachment replacement, transactional email/external
notification delivery, payments, stars, and ecommerce remain deliberately
deferred.

The simplified navigation now integrates Express-first/FIFO queueing,
assignment history, production, and pickup inside Jobs while preserving future
integration points for the auditable worker-star ledger/leaderboard and private
staff text/voice/file messaging. No empty main-navigation pages were added.
