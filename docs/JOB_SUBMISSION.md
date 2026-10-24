# Customer job submission

Brick 6A provides authenticated customer submission at `/app/jobs/new`, a
customer-owned list at `/app/jobs`, and protected details at
`/app/jobs/[publicReference]`. Only an active Neon `CUSTOMER` membership may use
these routes and mutations. Guest submission is not enabled. `WORKER`, `ADMIN`,
and `OWNER` roles do not receive customer ownership merely through staff access.

Brick 6D.1 presents the same authoritative workflow in three plain-language
stages: **Choose what you need**, **Tell us the details**, and **Check and
Submit**. Back and Continue keep the in-progress answers in the same form. The
presentation does not replace or weaken the Brick 6A server mutation.

The Business-level `acceptingNewJobs` switch is separate from every service's
`onlineSubmissionEnabled` setting. Both must permit intake. A closed shop shows
a friendly pause message while existing jobs, quotations, accounts, and
notifications remain accessible. An open shop with no enabled service shows a
different message. The final serializable creation transaction rechecks shop
status, covering a concurrent closure after the form was opened.

## Service-driven request contract

The submission page reads active, non-archived services whose
`onlineSubmissionEnabled` flag is true. It never creates static service copies.
Quantity bounds/increments, size mode, custom dimensions, materials, finishing,
customer fields, variation fields, artwork arrangement, pricing mode, and
classification defaults come from the Brick 5.2 configuration and are
revalidated server-side immediately before persistence.

Not every service displays every field. Batch numbers configured as short text
preserve letters, leading zeroes, punctuation, case, and meaningful spacing.
Variation quantities are positive and their combined total must satisfy the
service quantity rule. Custom dimensions accept only the configured unit and
bounded positive decimal values. Technical proof is never mandatory. A service
explicitly configured as `CUSTOMER_PROVIDED` artwork does require at least one
supported original/reference file.

## Pricing truth

Fixed pricing uses exact integer-pesewa arithmetic and the authoritative saved
starting quantity, starting price, quantity step, and additional-step price.
Express adds exactly 40% to that base. If a fixed configuration does not apply,
the submission falls back to Price on Request rather than showing a misleading
total. Price on Request stores no fabricated submission price and the customer
sees “We’ll check your request and send you a price,” never GH₵0. Brick 6C attaches a separately
versioned management quotation to that canonical job; the immutable submission
snapshot itself is never rewritten. No payment is recorded.

## Atomic persistence and duplicate protection

The browser creates one random UUID idempotency key for the form. The server
authenticates again, re-reads the business, membership, User, and Service, and
runs a serializable transaction. That transaction creates one `Job`, the
registered `JobCustomer`, initial `SUBMITTED` history, private attachment
metadata/claims, and a safe audit event. Concurrent or repeated delivery of the
same idempotency key returns the already-owned job; another customer cannot use
that key to discover or claim it. The public reference is a random, immutable
display identifier and is never an authorization credential.

Each job saves an immutable versioned snapshot of the applicable service
configuration, exact entered values, service version, and pricing treatment.
Later service edits therefore do not rewrite historical requirements.

When a customer asks the business to create artwork for a sticker or banner,
the server creates a Design job and its dependent Print job in the same
serializable transaction. The pair receives a shared group reference while
keeping separate job numbers, immutable snapshots, histories, audit events,
and notifications. Uploaded source files belong to the Design job. Repeating
the same idempotency key returns the original pair rather than creating more
jobs. The Print job cannot enter production until its Design dependency is
cleared; Owner/Admin may explicitly clear the gate with a recorded reason.

This linkage does not make technical proof mandatory, does not merge the two
jobs, and does not change pricing authority. Services must still be active,
online-enabled, and available while the shop is open at final submission.

## Private uploads

Uploads use the existing private `job-submit-media` Vercel Blob store. Before a
direct client upload, the server verifies the customer and creates a one-hour
ownership reservation. Up to five files are accepted, with a 15 MB per-file and
50 MB aggregate limit. Supported image, PDF, AI/PostScript, PSD, text, Word, and
Excel types are checked by both filename extension and authoritative Blob MIME
metadata. HTML, SVG, archives, executables, empty files, oversize files, reused
reservations, and cross-customer references fail closed.

Upload progress is visible in the review flow. Abandoned reservations expire;
successful reservations become immutable when claimed by a job. Downloads are
served only after the server verifies the current customer owns the job and the
attachment is active. Responses are private, non-cacheable downloads with
`X-Content-Type-Options: nosniff`.

## Deliberately deferred

Brick 6B adds staff review, Brick 6C adds in-app quotation issuance and customer
price decisions, Brick 6D adds in-app notifications, and Brick 7 adds queueing,
assignment, production tracking, labels, and secure pickup verification.
Payments, customer/staff messaging, proof approval, star awards/redemption, and
attachment replacement remain deferred. Submitted jobs continue through one
canonical record; none of these workflows duplicates the customer's request.
