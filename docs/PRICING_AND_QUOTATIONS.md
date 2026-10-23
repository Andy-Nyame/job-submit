# Pricing and quotations

Brick 6C keeps operational job status separate from commercial price approval.
Agreeing a price does not start production, record payment, or change the
existing `SUBMITTED → UNDER_REVIEW` operational transition.

## Fixed pricing

Eligible fixed-price jobs retain the authoritative integer-pesewa calculation
saved in their immutable submission snapshot. Regular jobs have no surcharge;
Express/Urgent jobs add exactly 4,000 basis points (40%) once. The customer sees
the confirmed total immediately and no manual quotation is created. Later
service edits never recalculate an existing job.

## Price on Request

Price on Request initially displays **Awaiting costing** without storing or
showing GH₵0. An active OWNER or ADMIN may create a private itemized draft,
choose a validity period (seven calendar days by default, up to ninety), and
issue it in GHS. Issuance freezes amounts, expiry, issuer, version, priority
treatment, and the current negotiation policy.

The customer may explicitly accept or decline the currently actionable quote.
Acceptance records the agreed version and amount. Decline preserves the job and
history for management follow-up. Expired, withdrawn, superseded, or already
decided versions cannot be accepted. A price change requires a new draft
version; issuing it supersedes the former active version atomically.

## Negotiation policy

`Allow Price Negotiation` is a service-level management setting independent of
pricing method. It defaults to **OFF** for existing and new services and applies
only to Price on Request. When off, customers see only Accept and Decline and
server mutations reject counteroffers. When on, a customer may have one pending
counteroffer per issued quotation. It is a proposal only: no discount is
automatically approved, and management must decline it or issue a revised quote
that the customer explicitly accepts.

## Authorization and audit

- OWNER/ADMIN: configure negotiation; create, edit, issue, revise, and withdraw
  quotations; review counteroffers.
- WORKER: retain operational review only; no draft amounts or pricing mutation.
- CUSTOMER: view issued versions belonging to their own job, decide an eligible
  active quote, and counter only when the frozen issued policy permits it.

Every action rechecks Supabase identity, active Neon user/business/membership,
role, business scope, job ownership, current state, and optimistic version.
Serializable transactions, partial unique indexes, database checks, immutable
issued terms, preserved versions, and append-only audit events protect against
duplicate and concurrent actions. Customer-facing notes never include internal
costs, margins, or staff-only job notes.

External notification delivery, payment collection, general pricing chat,
scope-change editing, and production management remain future milestones.
