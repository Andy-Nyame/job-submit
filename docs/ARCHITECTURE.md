# JobSubmit architecture and project decisions

## 1. Project boundary

JobSubmit is a standalone product for Capt. Bob Cedi's Artworks. It has an independent source tree and Git history. Future environments, databases, object storage, deployments, credentials, and external services must also be independent. Nothing in this project may silently couple to Footwear Empire, Vault Commerce, CIV, Kobby's Kitchen, or another client project.

Brick 1 contains presentation and engineering foundations only. It deliberately contains no database, ORM, authentication, accounts, jobs, queues, uploads, notifications, payments, or business workflows.

## 2. Application shape

- Next.js App Router is the routing and rendering foundation.
- React Server Components are the default. A component becomes a Client Component only when browser state, effects, or event-driven interactivity requires it.
- `src/app` owns routes, layouts, metadata, and route-level composition.
- `src/components/ui` contains small presentation primitives with no business knowledge.
- `src/components/layout` contains reusable shell and layout elements.
- `src/config` contains factual application configuration.
- `src/lib` contains framework-agnostic utilities.
- A dedicated server-only area, domain types, and constants will be introduced when a real later-brick requirement exists. Privileged code must never be imported into a client boundary.

The initial product roles to implement later are:

- `CUSTOMER`
- `WORKER`
- `ADMIN`
- `OWNER`

These names are documentation only in Brick 1; there is no authorization model yet.

## 3. Visual system

The brand palette begins with black (`#111111`), white (`#FFFFFF`), gold (`#D4AF37`), and goldenrod (`#DAA520`). Raw palette values are defined once in global CSS. Components use semantic tokens:

- background and foreground
- surface and muted surface
- border and muted text
- primary and primary foreground
- accent and accent foreground
- destructive and destructive foreground
- focus/ring

Light and dark sets exist now. The operating-system preference selects the initial appearance, and the token selectors can support a future explicit preference without redesigning components. Theme controls are intentionally deferred:

- Customers may access theme switching from desktop navigation or the mobile menu.
- Workers will manage theme through User Settings rather than a permanent navbar toggle.

Typography uses Geist Sans for interface text and Geist Mono sparingly for precise labels. Fonts are loaded through `next/font` and bundled with the application.

## 4. Known future domains

The following domains are known but are not implemented in Brick 1:

- Services
- Jobs
- Job attachments
- Job assignments
- Job messages
- Job status history
- Queue and FIFO rules
- Regular versus Express/Urgent handling
- Notifications
- Proof approval
- Pickup verification
- Worker workload and capacity
- Stars and leaderboard
- Audit and activity

Domain boundaries and persistence models must be designed in the brick that implements them, based on the full requirements then available.

## 5. Permanent lifecycle principle

If an authorized user can create or add a persistent business entity, its lifecycle must include an appropriate safe remove, archive, or deactivate path.

Historical, commercial, and audit records must not be destructively deleted when deletion would damage business history, traceability, reporting, reconciliation, or accountability. Lifecycle operations should be explicit, authorized, and auditable.

## 6. Future business requirements

Everything in this section is a documented future requirement, not Brick 1 behavior.

### Priority and pricing

- Priority values will include `REGULAR` and `EXPRESS` / `URGENT`.
- Express is 40% above the confirmed normal or base price.
- The surcharge must be calculated by authoritative server-side logic.
- Express means priority handling; it does not guarantee instant completion.

### Job lifecycle

The high-level lifecycle is:

```text
Submitted
→ Under Review
→ Accepted
→ Queued
→ Processing
→ Preparing for Pickup
→ Ready for Pickup
→ Picked Up
```

Side states and workflows will include:

- Waiting for Customer
- Awaiting Customer Approval
- Declined
- Cancelled

State transitions must eventually be authorized, validated by server logic, and preserved in status history.

### Queue

- FIFO ordering must be enforced by authoritative server logic.
- Express work will have explicit priority rules.
- Administrative queue overrides must require a reason and produce an audit trail.

### Attachments

- Original customer files must be preserved at original quality.
- Private files must require authorization.
- Replacement must create a version rather than silently overwriting history.

### Pickup

- Jobs marked ready will receive secure, one-time pickup verification codes.
- Code generation, storage, disclosure, expiry, attempt handling, and redemption rules must be designed as a security-sensitive server workflow.

### Stars and leaderboard

- `SIMPLE` work awards 1 star.
- `MEDIUM` work awards 2 stars.
- `COMPLEX` work awards 3 stars.
- Stars are awarded only at verified completion or pickup, not when a worker accepts a job.
- Star changes must use an auditable ledger rather than relying on a mutable total alone.

## 7. Security and delivery baseline

- TypeScript remains strict.
- Production builds currently use Next.js's supported webpack backend because Turbopack's PostCSS worker cannot bind its internal localhost port in the managed build environment. This can be revisited when that environment restriction changes.
- Secrets live only in ignored environment files or the deployment platform; `.env.example` contains names and safe guidance only.
- Server-only data and privileged operations must not cross into client bundles.
- Dependencies are added for an immediate requirement, not anticipated convenience.
- Accessible HTML, visible keyboard focus, responsive behavior, and truthful metadata are baseline requirements.
- Administrative or owner authority must eventually be checked server-side; hiding controls in the UI will never count as authorization.
- Production changes must pass lint, type checking, and a production build before release.

## 8. Deferred decisions

Database vendor and schema, ORM, authentication, authorization mechanics, file storage, messaging transport, notification delivery, payment integration, hosting, and deployment topology are deliberately undecided in Brick 1. They require separate design and implementation work and must not be inferred from placeholder foundation code.
