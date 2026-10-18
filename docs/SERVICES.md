# Service management

Brick 5 provides service catalogue administration at `/app/services` for active
`OWNER` and `ADMIN` memberships. `CUSTOMER`, `WORKER`, and unauthenticated
requests cannot read or invoke management operations. Navigation visibility is
only a convenience; each query and Server Action verifies the Supabase identity
and active Neon business membership again.

## Catalogue and lifecycle

Managers can search by service name, filter active/inactive records, create a
service, and edit its factual catalogue configuration. Service identity is
preserved across edits, including its stable public slug. Normalized slugs and
normalized-name checks provide business-scoped conflict protection, and
optimistic versions reject stale concurrent changes.

Normal service removal is deactivation, never deletion. Deactivation preserves
job, skill, and audit history and removes the service from the public active
catalogue. Explicit restoration makes it publicly eligible again. There is no
hard-delete UI or mutation.

The six seeded Capt. Bob service records remain idempotent and are not recreated
by management code.

## Configuration and pricing boundary

Online-submission eligibility is configuration for a future job-submission
workflow. Complexity, workload class, and proof settings are optional defaults
for future review; an individual job can receive its own classification.

**Services do not define customer prices. Jobs are costed individually through
an authorized pricing workflow.** Brick 5 introduces no price, amount, rate,
range, or automatic quotation field. The OWNER normally handles costing today;
future position-based pricing authority and explicit customer quotation
acceptance are not implemented here.

## Transactions and audit

Create, edit, deactivate, and restore operations are scoped to the actor's
business and use serializable transactions. Every meaningful change and its
AuditLog record commit together. Audit metadata identifies the service and
records relevant before/after configuration without secrets or unnecessary
personal data.
