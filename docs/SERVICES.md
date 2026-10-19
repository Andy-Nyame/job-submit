# Service management

Brick 5.1 provides service catalogue administration at `/app/services` for
active `OWNER` and `ADMIN` memberships. `CUSTOMER`, `WORKER`, and
unauthenticated requests cannot read or invoke management operations. Every
query and Server Action verifies the Supabase identity and active Neon business
membership; navigation visibility is not an authorization boundary.

## Identity, friendly names, and lifecycle

Managers can search, filter, create, edit, deactivate, and restore services.
Service IDs and existing slugs remain stable across name edits. The six seeded
records use the customer-facing names Designing, Sticker Printing, Banner
Printing, Document Printing, For Sale Stickers, and Container Head & Batch
Number Printing.

The Brick 5.1 migration and seed reconcile only exact known legacy names on the
matching stable slug. A later manager-customized name is never overwritten, and
no duplicate service is created. New services receive the next catalogue sort
position automatically inside the serializable create transaction; display
order is not exposed as a quantity-like form field.

Normal removal is deactivation, never deletion. Deactivation preserves job,
skill, and audit history and removes the service from the public active
catalogue. Online-submission eligibility is independent: an active service can
remain publicly visible while unavailable for future online submission.

## Quantity contract

Quantity configuration is optional and snapshot-friendly. When present it has
schema version `1`, a customer-friendly unit, optional minimum, maximum and
increment, and up to 20 ascending unique presets. All values are positive safe
integers no greater than 1,000,000. A maximum cannot be below the minimum.

An increment advances from the configured minimum. If no minimum exists, the
increment itself is the first valid quantity. For example, minimum 50 and
increment 25 accepts 50, 75, 100, and so on. Presets must satisfy the same rule,
but are shortcuts only: any custom quantity satisfying the constraints remains
valid. A blank configuration means any positive quantity within the application
safety bound; services that do not use quantity can leave the section blank.

Future Brick 6A code must call the same domain eligibility rule and copy the
configuration into the job specification snapshot. It must not interpret
presets as an allow-list.

## Specifications and artwork

Optional schema-versioned configuration supports service-specific size,
material, and finishing options; required/optional flags; four artwork modes;
custom dimensions; allowed measurement units (`mm`, `cm`, `inches`, `feet`);
and a short customer instruction. Options are normalized, bounded, unique
case-insensitively, and plain text. Required option groups cannot be empty, and
required custom dimensions cannot be enabled without an allowed unit.

No sample option is seeded or advertised. A service gets only the options an
Owner/Admin explicitly saves. Future job submission must snapshot both the
selected answers and the applicable configuration so later service edits do not
rewrite historical job requirements.

## Indicative price guidance

A service may have an optional indicative GH₵ minimum and maximum, stored
exactly as integer pesewas (`BigInt`) with an optional short explanation. Both
endpoints must be supplied together, cannot be negative, and the minimum cannot
exceed the maximum. The database and application both enforce a defensive upper
bound of GH₵1,000,000.00.

This range is informational only. Wherever shown, it carries: “Estimated price
range only. Final pricing is confirmed privately after job review.” It is never
used to calculate, accept, or confirm a job price. Actual costing remains an
individual review performed by the Owner or another explicitly authorized
person. Pricing chat, quotation acceptance, payments, and invoices are not part
of Brick 5.1.

## Preview, transactions, and audit

The management detail page renders a clearly labelled read-only preview from
the saved configuration. It has no job, quotation, checkout, or customer-record
action. The homepage shows active services only and adds compact configured
details, an estimate only when present, and accurate online-availability text.

Create, edit, deactivate, and restore operations are business-scoped,
version-protected, and executed in serializable transactions. Each meaningful
change and its `AuditLog` entry commit together. Configuration and indicative
range changes are included in safe before/after audit snapshots; money is
serialized as minor-unit strings in audit JSON.
