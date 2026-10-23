# Staff job inbox and review

Brick 6B adds the staff-side view of the same canonical `Job` records created
by customer submission. It does not create a second inbox entity or copy jobs
into a dashboard-specific table.

## Access boundary

Active `WORKER`, `ADMIN`, and `OWNER` memberships may use `/app/staff/jobs` and
`/app/staff/jobs/[reference]`. Pages, queries, Server Actions, mutations, and
private attachment downloads all verify the Supabase identity, active User,
active business, active membership, permitted role, and matching `businessId`.
`CUSTOMER` memberships are redirected away from staff pages and denied by the
server authorization layer even if they call an action directly.

The inbox performs reference/customer search, status/service/priority filters,
sorting, and 20-item pagination in PostgreSQL. It never loads all jobs into a
Client Component.

## Historical submission truth

Staff details render the immutable Brick 6A `submissionSnapshot`: service name
and version, quantity, dimensions, materials, finishing, custom fields,
variations, priority, customer instructions, and saved pricing treatment.
Current Service configuration is not used to reconstruct an old request.

Fixed totals and the saved Express surcharge are display-only submission
snapshots; they are not recalculated. Price on Request remains “Quotation
pending” and creates no amount, `JobPricing` revision, payment, or implied
GH₵0 quotation.

## Review transition and history

Brick 6B enables exactly one status transition:

```text
SUBMITTED → UNDER_REVIEW
```

The server does not accept an arbitrary target status. A serializable,
version-checked compare-and-set updates the Job, records `reviewedAt` and the
reviewing membership, appends `JobStatusHistory`, and writes
`job.review_started` to `AuditLog`. Repeated, stale, concurrent, and unsupported
transitions are rejected. Customers see the resulting status and timestamp but
not staff actor details or internal reasons.

## Internal notes and files

Internal notes use the existing `JobNote` model. Input is normalized and
limited to 2,000 characters. Notes retain their author and creation time and
write a `job.internal_note_added` audit event without copying note text into
audit metadata. No note edit or deletion path is exposed, and customer queries
do not select notes.

Customer originals remain in private Vercel Blob storage. The download route
allows only the owning active customer or an active staff member in the same
business, then streams the private object with no-store and nosniff headers.
Storage paths are never returned as authorization credentials.

## Deferred

Quotation issuance/acceptance, payments, staff-customer messaging,
notifications, acceptance/decline, queueing, assignment, production statuses,
proof approval, pickup verification, and completion remain later milestones.
