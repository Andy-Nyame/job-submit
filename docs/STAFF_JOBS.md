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

Fixed totals and the saved Express surcharge remain immutable submission
snapshots; they are not recalculated. Price on Request remains “Quotation
pending” until Brick 6C management issues a separate versioned quotation. No
missing amount is represented as GH₵0 and no payment is implied.

## Review, queue, and production history

Brick 6B introduced the initial review transition:

```text
SUBMITTED → UNDER_REVIEW
```

Brick 7 extends that controlled lifecycle after pricing is confirmed:

```text
UNDER_REVIEW → ACCEPTED → QUEUED → PROCESSING
→ PREPARING_FOR_PICKUP → READY_FOR_PICKUP → PICKED_UP
```

The server does not accept an arbitrary target status. Serializable,
version-checked compare-and-set updates the Job, records `reviewedAt` and the
reviewing membership, appends `JobStatusHistory`, and writes
`job.review_started` to `AuditLog`. Repeated, stale, concurrent, and unsupported
transitions are rejected. Customers see the resulting status and timestamp but
not staff actor details or internal reasons.

Express jobs appear before Regular jobs; FIFO within each priority uses the
immutable queue-entry time. Management may record a reasoned, audited exception
within a priority group. Worker shortcuts show eligible unassigned jobs and the
worker's own active assignments. Claiming and management assignment both recheck
active membership, service skill, workload capacity, and exclusive assignment
inside the authoritative transaction. Management worker choices display live
Quick, Standard, and Focus workload counts beside configured limits.

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

## Operations now available

Brick 7 adds management release, worker claim/management assignment, reasoned
reassignment, production progress, printable physical labels, encrypted
single-use pickup credentials, and explicit staff-confirmed pickup. Pickup uses
the saved request snapshot for verification, never silently awards stars, and
does not record payment. See `docs/JOB_OPERATIONS.md` for the full policy.

Payments, proof approval, external notification delivery, and customer/staff
messaging remain later milestones.
