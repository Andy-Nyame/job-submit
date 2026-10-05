# JobSubmit architecture and project decisions

## 1. Project boundary

JobSubmit is a standalone product for Capt. Bob Cedi’s Artworks. Its source, Git history, PostgreSQL database, object storage, environments, credentials, deployments, and external services must remain independent of Footwear Empire, Vault Commerce, CIV, Kobby’s Kitchen, and every other client project.

Brick 2 establishes data architecture and integrity only. It does not add authentication, authorization middleware, product screens, forms, upload endpoints, live queue behavior, delivery mechanisms, or other Brick 3+ workflows.

## 2. Application shape

- Next.js App Router is the routing and rendering foundation.
- React Server Components are the default; Client Components require an actual browser-side need.
- `src/app` owns routes and route-level composition.
- `src/components/ui` and `src/components/layout` remain presentation-only.
- `src/domain` contains pure, framework-independent rules.
- `src/server` is an explicit server-only boundary. Database access imports `server-only` and must never enter a client bundle.
- `prisma` owns the persistence model, migrations, and development seed.

The product roles are `CUSTOMER`, `WORKER`, `ADMIN`, and `OWNER`. Roles are persisted through business membership, but authentication and authorization enforcement are intentionally deferred. Future authorization must use server-authoritative membership data, never client claims.

## 3. Database decision

PostgreSQL is the authoritative datastore and Prisma is the ORM/migration tool. Operational records are scoped through a `Business` root instead of a global singleton, without positioning the product as a public multi-tenant SaaS. Runtime code uses a pooled `DATABASE_URL`; migrations use `DIRECT_DATABASE_URL` when supplied.

The initial migration combines Prisma-generated DDL with explicit PostgreSQL checks, partial indexes, and triggers for rules Prisma cannot express. See [DATABASE.md](DATABASE.md) for the complete model and transaction decisions.

## 4. Visual system

Black (`#111111`) and white (`#FFFFFF`) carry the interface; gold (`#D4AF37`) and goldenrod (`#DAA520`) are deliberate accents. Components consume semantic light/dark tokens. Customers may eventually switch theme from desktop navigation or the mobile menu; workers will manage theme in User Settings rather than through a permanent navbar toggle.

## 5. Permanent lifecycle principle

If an authorized user can create a persistent business entity, the product must provide an appropriate safe remove, archive, or deactivate path. Historical, commercial, and audit records must not be destructively deleted where that would damage traceability, reporting, reconciliation, or accountability.

Services and team memberships are deactivated; jobs are archived; attachments and messages are tombstoned where appropriate; confirmed pricing is immutable; status history, stars, and audit logs are append-only. Corrections use new records or compensating entries.

## 6. Security and delivery baseline

- TypeScript is strict, and lint warnings fail CI-style checks.
- Secrets belong only in ignored environment files or deployment configuration.
- Private file storage will require server authorization; permanent public object URLs are not part of this design.
- Pickup codes will be stored as secure hashes, not plaintext.
- Sensitive actions must combine state change, history/audit, and related notifications atomically in future service code.
- Production builds use Next.js’s webpack backend because the managed environment blocks Turbopack’s internal localhost binding.

## 7. Deferred implementation

Auth.js, login UI, route authorization, dashboards, job submission, queue claim logic, messaging UI/transport, object storage, notification delivery, secure pickup-code generation, payments, and ecommerce remain deliberately deferred.
