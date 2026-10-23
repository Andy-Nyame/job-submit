# Database and core domain architecture

## Business scope and identity

Every operational record is rooted in a `Business`. Composite foreign keys carry `businessId` through relationships where cross-business linkage would be dangerous. The first seed creates only **Capt. Bob Cedi’s Artworks**, with `GHS` as its default currency, plus the six supplied service concepts. It invents no contact details, people, jobs, prices, or statistics.

`User` is the global application identity. Its nullable, unique
`supabaseAuthUserId` stores the stable Supabase user UUID; email remains a
normalized contact/claim attribute and is not a foreign key. No access,
refresh, Google, or password credentials are stored in Neon.

First authenticated access resolves by Supabase subject. A confirmed exact
normalized-email match may safely claim a pre-created unbound `User`; an
existing different binding fails closed. Provisioning and membership creation
run in a serializable transaction and rely on unique constraints plus bounded
retry to handle concurrent first requests without duplicates.

`BusinessMembership` supplies one business-specific role: `CUSTOMER`, `WORKER`,
`ADMIN`, or `OWNER`. Membership/profile deactivation preserves history and auth
resolution never reactivates it. `WorkerProfile` holds operational capacity
(`QUICK`, `STANDARD`, and `FOCUS` eligibility), while `WorkerServiceSkill` keeps
service eligibility manageable without HR/payroll modeling.

`WorkerInvitation` is business- and email-bound. It stores only a SHA-256 token
hash, lifecycle timestamps/status, authorized actors, replacement linkage, and
an optimistic version. A partial unique index permits one pending invitation per
normalized email/business. Redemption uses a serializable transaction and a
compare-and-set update so concurrent requests cannot consume a token twice or
create duplicate membership/profile state.

## Services

`Service` is business-managed data, not a permanent code enum. It supports
name, stable slug, description, active/archive state, online-submission
availability, automatic display order, synchronized complexity/workload
defaults, and versioned quantity, specification, and pricing JSON. Referenced
services are deactivated or archived, not deleted. Optimistic versions protect
concurrent edits, and create/update/deactivate/restore events use the existing
transactional audit log.

`pricingConfiguration` is nullable for safe rollout and contains version `1`
Fixed Pricing or Price on Request data. Fixed amounts are serialized as exact
integer-pesewa strings inside JSON and validated before persistence. The fixed
formula uses the saved starting quantity, saved quantity step, starting price,
and additional-step price; mixed specifications are not eligible.

`allowPriceNegotiation` is a separate service setting with a database default
of `false`. A database check permits it only for Price on Request configuration;
the migration leaves every existing service disabled.

Brick 5.1 indicative price columns remain constrained and preserved for
historical compatibility, but ordinary management and public queries do not
read them. No migration converts ranges to fixed prices. The existing
`proofRequiredByDefault` column is likewise retained but hidden until a future
plain-language artwork approval design exists.

Quantity configuration stays at version `1`. Specification version `2` stores
explicit size modes, printing options, customer-field definitions, and
variation settings. The database accepts specification versions 1 and 2; the
application adapts version 1 without destroying existing values.

## Jobs and lifecycle

`Job` supports `CUSTOMER_PORTAL`, `ADMIN_CREATED`, and `WALK_IN` sources with the same core record. Brick 6A generates an immutable, unique, non-sequential public reference and a unique client idempotency key. The immutable JSON submission snapshot records the service version/configuration, validated customer selections, variations, and server-calculated pricing treatment. `JobCustomer` links the authenticated customer and stores the minimal name/email snapshot. Guest submission is not enabled.

When the chosen service has no classification default, a newly submitted job
keeps complexity/workload null until authorized review rather than inventing a
classification. Every customer submission begins at `SUBMITTED`, with an
append-only initial history row and a `job.customer_submitted` audit event in
the same serializable transaction.

Brick 6B reuses the existing `Job`, `JobStatusHistory`, and `JobNote` models;
no schema migration is required. Active WORKER, ADMIN, and OWNER memberships
may read only jobs in their own active business. Inbox filtering and pagination
run in PostgreSQL rather than loading the complete job set into the browser.
Staff details read the immutable `submissionSnapshot`, so later service edits
cannot rewrite historical quantities, options, or pricing treatment.

The primary statuses are:

```text
SUBMITTED → UNDER_REVIEW → ACCEPTED → QUEUED → PROCESSING
→ PREPARING_FOR_PICKUP → READY_FOR_PICKUP → PICKED_UP
```

Side states are `WAITING_FOR_CUSTOMER`, `AWAITING_CUSTOMER_APPROVAL`, `DECLINED`, and `CANCELLED`. Future server transition policy is authoritative. Each accepted transition must append `JobStatusHistory`; database triggers prevent normal update/delete of that history.

Brick 6B deliberately enables only `SUBMITTED → UNDER_REVIEW`. The serializable
mutation compares `Job.version` and the current status, writes the review actor
and timestamp, increments the version, appends status history, and creates an
audit event in one transaction. Repeated, stale, and unsupported transitions
fail closed. Customer details expose only status names and timestamps, never
staff actors, reasons, or notes.

`Job.version` enables optimistic concurrency where appropriate. Important dates, review/accept actors, requested/promised times, and archive metadata are separate from the append-only transition history.

## Priority, pricing, and queue

Priority is `REGULAR` or `EXPRESS`. Express means priority handling, never guaranteed instant completion. Future job-specific confirmed prices use integer minor units (`BigInt`), never floating-point arithmetic. A confirmed Express snapshot is exactly the individually confirmed base price plus a 4,000-basis-point (40%) surcharge, rounded half up to the nearest minor unit. Confirmed Regular pricing has zero surcharge. Database checks enforce the calculation and confirmed pricing rows become immutable; a commercial change creates a new revision. Service fixed pricing can propose an eligible base total, but it does not create or confirm a `JobPricing` record by itself.

Brick 6C adds `JobQuotation` and `QuotationCounteroffer` specifically for manual
Price on Request costing. Quote amounts use integer minor units, itemized JSON
validated before persistence, business-scoped relationships, one draft and one
actionable issued version per job, and one pending counteroffer per quote.
PostgreSQL checks enforce the 40% Express calculation once. Triggers reject
deletion, illegal state changes, and changes to issued financial terms. Quote
versions and append-only `AuditLog` entries preserve the commercial history.

`queueEnteredAt`, not `createdAt`, is the FIFO foundation. Future selection logic will order eligible Express and Regular groups explicitly, expose old Regular work for anti-starvation handling, and exclude paused/customer-waiting work. Re-entry policy must explicitly preserve or replace queue time. `JobQueueOverride` requires a reason; a partial unique index permits one live override per job, and future service code must add an `AuditLog` entry atomically.

## Complexity and workload

These are separate closed concepts:

- complexity controls completion stars: `SIMPLE = 1`, `MEDIUM = 2`, `COMPLEX = 3`
- workload controls capacity: `QUICK`, `STANDARD`, `FOCUS`

For service defaults, the manager chooses only complexity and the application
stores the matching workload: `SIMPLE → QUICK`, `MEDIUM → STANDARD`, and
`COMPLEX → FOCUS`. This prevents contradictory service defaults while leaving
actual future jobs independently reviewable.

Future claim logic must combine current assignments, capacity settings, focus exclusion, and active service skills inside one transaction. The schema does not pretend that complexity determines capacity.

Brick 4 constrains QUICK capacity to `0..50` and STANDARD capacity to `0..20`.
FOCUS eligibility is boolean configuration: a worker handling FOCUS work cannot
simultaneously accept STANDARD or another FOCUS assignment, while QUICK remains
permissible only below the configured QUICK limit. These rules are tested as
domain policy but actual claim enforcement remains deferred to the queue and
assignment brick.

## Assignments and files

`JobAssignment` preserves claim, staff assignment, contributor, reassignment, release, completion, actors, timestamps, and reasons. A partial unique index prevents more than one live primary assignment per job while allowing historical rows and future contributors. Worker-membership triggers reject non-worker assignees.

`JobAttachment` stores metadata only: private storage key, original filename, MIME type, byte size, purpose, optional duration, uploader, and lifecycle fields. Customer originals, replacements, proofs, final production files, job documents, and message files remain distinguishable. A replacement points to its predecessor, increments the version, and must remain on the same job. Production files are not compressed or stored as database binary data.

`CustomerUpload` is a short-lived pre-job ownership reservation for direct
private Vercel Blob uploads. It is scoped to business and authenticated User,
accepts only bounded safe MIME/extension pairs, and moves from `PENDING` or
`UPLOADED` to immutable `CLAIMED` when the job transaction creates the matching
`JobAttachment`. Expired or already claimed uploads cannot be reused. Customer
download queries require both the authenticated user relationship and job
reference before the private blob is streamed as an attachment with `nosniff`.

## Two separate communication systems

### Customer ↔ shop job communication

`JobMessage` belongs to a job and records whether the sender is a customer, staff member, or system process. `JobMessageAttachment` links only attachment metadata belonging to that same job. Staff-only `JobNote` is deliberately separate and must never be exposed through customer-facing queries.

Brick 6B creates bounded, non-empty `JobNote` entries with the active staff
membership as author and an audit event containing only the new note ID, not
the note body. There is no edit, deletion, archive, customer-message, or
notification UI in this milestone.

### Staff Messages

`StaffConversation`, `StaffConversationParticipant`, `StaffMessage`, and `StaffMessageAttachment` form an explicit-participant private messaging system. **Customers have no access.** Database triggers reject customer participants and require message senders to be active conversation participants; future routes must repeat authorization server-side.

V1 metadata supports text, audio/voice notes, and files. Message text may accompany attachments. Audio/file binary data belongs in future private object storage; PostgreSQL stores storage references, original names, MIME type, byte size, and optional audio duration. Per-participant `lastReadAt` supports unread conversation/global badge queries without fragile mutable counters. `archivedAt`/`leftAt` provide participant lifecycle, while message removal uses a tombstone with actor/reason. A canonical sorted participant-pair `directKey` will let the future service create one direct conversation safely. Admin/Owner access is not implicit: oversight policy remains a later decision and there is no hidden read backdoor.

## Notifications, pickup, stars, and audit

`Notification` is persistent and indexed for unread-recipient and event queries.
It carries safe display fields, an authorized internal destination, target
metadata, and a stable event key. The unique `(businessId, recipientUserId,
eventKey)` identity makes request retries harmless per recipient while allowing
one event to fan out to multiple eligible managers. In-app delivery and
read/unread state are implemented; email, push, and realtime transport are not.

`PickupVerification` stores only a future code hash and optional non-sensitive hint. A partial unique index allows one active code per job. Status/timestamp checks enforce one-time consumption shape, while overrides require actor, timestamp, and reason. Future verification must display the resolved job/customer/service/handler and atomically consume the code, transition the job, award stars, and audit any override.

`StarLedger` is append-only. Normal verified completion awards are 1–3, require a picked-up job plus consumed pickup verification, and are unique per worker/job. Owner bonuses, corrections, and reversals are separate compensating entries with reasons; no mutable total is authoritative. Jobs completed and weekly/monthly/all-time stars remain queryable from assignment/status/ledger dates. Multi-worker star splitting and redemption are intentionally undecided.

`AuditLog` is business-scoped and append-only. It records actor, action, target, safe structured metadata, and timestamp. Secrets must never enter metadata.

## Integrity and lifecycle

PostgreSQL enforces foreign keys, composite business scope, unique
membership/service/reference/revision/storage identities, bounded worker
capacities, normalized invitation emails, hash/lifecycle shape, one pending
invitation per email/business, nonnegative file sizes, currency format,
queue/assignment/pickup partial uniqueness, sender/participant rules,
replacement integrity, immutable public references and confirmed prices, and
append-only status/star/audit records.

Safe lifecycle policy:

- businesses, services, memberships, worker profiles, and skills deactivate/archive
- jobs archive instead of casual hard deletion
- attachment replacements create versions; removal is a recorded tombstone
- job/staff messages use safe removal or participant archive/leave state
- confirmed price snapshots, pickup proof, status history, stars, and audit history are preserved
- corrections use revisions or compensating records

Hard deletion is reserved for truly ephemeral, unreferenced data under a future explicit retention policy.

## Future transaction boundaries

Future server services must use database transactions and locking/serializable strategies where needed:

- status transition + current status/version update + history + notification/audit
- pricing confirmation + 40% calculation + immutable revision + audit
- queue selection/claim + eligibility + service skill + workload capacity + assignment
- reassignment/release + assignment history + audit
- queue override/revocation + required reason + audit
- pickup-code issue/revoke and one-time consume under concurrent attempts
- pickup confirmation + `PICKED_UP` transition + history + completion star ledger + notifications
- message creation + participant authorization + attachment links + notification
- canonical direct-conversation creation under the unique `directKey`
- worker invitation create/revoke/reissue and one-time redemption
- worker settings, service skills, and activate/deactivate changes with audit

Client-provided roles, prices, queue positions, star values, and pickup results are never authoritative.

## Migration and seed operations

The initial migration is committed at `prisma/migrations/20261005220000_core_domain` and has been verified against the dedicated JobSubmit Neon PostgreSQL database. Apply future committed migrations only after checking that both URLs target the intended JobSubmit environment:

```bash
npm run db:migrate:deploy
npm run db:seed
```

The seed is idempotent. It creates missing known services with stable slugs and
reconciles only exact legacy names. It preserves manager-customized names,
existing IDs/order, lifecycle choices, descriptions, advanced configuration,
legacy ranges, fixed pricing, workflow defaults, and online availability.
