# Service management

Brick 5.2 provides service catalogue administration at `/app/services` for
active `OWNER` and `ADMIN` memberships. `CUSTOMER`, `WORKER`, and
unauthenticated requests cannot invoke management operations. Every query and
Server Action verifies the Supabase identity and active Neon business
membership; navigation visibility is not an authorization boundary.

## Identity, names, sorting, and lifecycle

Managers can search, create, edit, deactivate, and restore services. IDs and
existing slugs remain stable across name edits. The six seeded records retain
their customer-friendly names and stable identities. New services receive an
automatic catalogue position; display order is not exposed in the form.

Deactivation, not deletion, is the normal removal path. It preserves job,
skill, and audit history and hides the service from the active public
catalogue. Online-submission eligibility is separate: an active service can be
publicly visible while unavailable for future online submission.

## Simplified management sections

The form is organized as Basic Information, Quantity & Pricing, Sizes &
Printing Options, Customer Information, Job Difficulty, and Availability.
Implementation-only workload values, display order, legacy price ranges, and
the printing-industry “Proof Requirement” setting are not independently
editable. The proof column is retained for historical compatibility; a future
artwork-approval feature should use plain wording such as “Customer must
approve artwork before printing.” No approval workflow exists yet.

## Quantity rules

Quantity configuration version `1` remains compatible with Brick 5.1. It has a
customer-friendly unit, optional minimum and maximum, optional multiple/step,
and up to 20 ascending unique quick choices. All values are positive safe
integers no greater than 1,000,000.

An increment advances from the configured minimum. Without a minimum, the
increment itself is the first valid quantity. A minimum of 5 and increment of
5 accepts 5, 10, 15, and so on. Quick choices must satisfy the same rule but
are shortcuts only; any other valid custom quantity remains allowed. A
minimum without a maximum is displayed as “Minimum order: 5 pieces,” never as
an invented range.

## Pricing methods

Every service resolves to one of two modes:

- **Price on Request** performs no automatic calculation. The Owner currently
  costs the work after review. Future pricing authority must be granted by an
  explicit position-based policy; accepting or producing a job does not grant
  a worker pricing authority.
- **Fixed Pricing** stores exact integer-pesewa values for a starting quantity,
  starting price, the configured quantity step, and an additional price per
  step. A required note explains what the price covers.

The fixed formula is:

```text
total = startingPrice + (numberOfAdditionalSteps × additionalStepPrice)
```

The starting quantity and requested total must satisfy the service quantity
rules. Fixed pricing requires a quantity step, uses exact `BigInt` arithmetic,
and is ineligible when variations use different specification keys. Such work
falls back to individual review instead of showing a misleading total.

Brick 5.1’s indicative-range columns and any stored values remain in the
database for compatibility and audit history. They are hidden from ordinary
management and all customer-facing pages. No range is silently converted to a
fixed price. Production contained no populated ranges when Brick 5.2 began.

## Sizes and printing options

Specification configuration version `2` supports exactly five size modes:
no size, one fixed size, standard size choices, custom size only, or standard
choices plus custom size. Fixed sizes store validated positive width, height,
and unit. Custom sizes declare the permitted units (`mm`, `cm`, `inches`, or
`feet`). No standard size or dimension is seeded or invented.

Materials and finishing remain explicit, bounded option lists with optional
required-selection flags. Version `1` Brick 5.1 configuration is read safely:
existing size options become standard choices and enabled custom dimensions
become a compatible custom-size mode. Saved edits write version `2`; old JSON
is not destructively rewritten by migration.

## Customer information and variations

Managers can define up to 16 strictly validated fields using short text, long
text, number, date, or selection inputs. Each has a stable identifier, label,
required flag, optional help text, safe limits, and `JOB` or `VARIATION` scope.
Selection choices are bounded and unique. Labels, identifiers, and options
cannot be empty, duplicated, contradictory, or executable markup.

Batch numbers should use short text, not number, so leading zeros, letters,
punctuation, hyphens, case, and meaningful spacing are preserved exactly.
Future submission validation must show the exact final values at confirmation.

When repeatable variations are enabled, each future variation has a stable
snapshot identifier, its own quantity, variation-scoped answers, and a future
specification key. At most 50 variations are accepted by the contract. Service
minimum, maximum, and increment apply to the combined quantity, not each
variation. The combined total also drives eligible fixed pricing.

Brick 5.2 defines and tests this snapshot-ready contract; it does not create a
customer submission form or production jobs.

## Difficulty defaults

Managers choose only the usual service difficulty. Workload and worker-star
defaults are derived together:

```text
Simple  → Quick    → 1 star
Medium  → Standard → 2 stars
Complex → Focus    → 3 stars
```

Production had no mismatched legacy defaults at inspection time. New and
edited services always save the derived pair. These remain review defaults:
an authorized reviewer may classify an actual future job differently.

## Preview, transactions, and future snapshots

The detail page renders a read-only preview from saved configuration. It has no
job, quotation, chat, checkout, or customer-record action. The homepage shows
active services only, concise quantity/options information, the selected
pricing mode, and accurate online-availability messaging.

Create, edit, deactivate, and restore operations remain business-scoped,
version-protected, and serializable. Each meaningful change and its `AuditLog`
entry commit together. Audit snapshots include quantity, specification,
pricing, derived workload, and preserved legacy values.

Future Brick 6A must copy the applicable configuration and entered values into
an immutable job snapshot. Later service edits must never alter historical job
specifications or prices.

## Brick 7.1 recovery profiles

The six original services now use a small, approved profile editor instead of
exposing raw JSON-style configuration. A manager chooses only business-facing
options, reviews the resulting customer experience, and saves through an
authenticated, business-scoped route handler. Shop availability and service
updates retain serializable transactions, optimistic version checks, and audit
records. The route-handler boundary also avoids deployment-stale Server Action
identifiers on these critical recovery controls.

The approved profiles are deliberately narrow: Price on Request, For Sale
stickers, custom stickers, labels, standard posters, flexi/banner area pricing,
and container-head/batch-number printing. Calculations use integer pesewas and
exact rational arithmetic. Label sheet printing and cutting are rounded to the
next GH₵5 separately. Container numbers remain text, including leading zeroes.
No migration enables online submission; an Owner or Admin must review and
enable each suitable service while the shop is open.

Production deployments must configure a stable
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` so Server Action references remain valid
across rolling instances. It must be a private base64-encoded 32-byte value and
must never be committed.

## Brick 7.2 visual catalogue and standalone services

Every active service is presented as its own catalogue card. `ServiceImage`
stores ordered gallery metadata and an optional cover while image bytes stay in
the existing private Vercel Blob store. OWNER/ADMIN may add, replace, remove,
reorder, and choose a cover through Shop & Services. Missing files use a neutral
placeholder. The five Owner-approved reference-image binaries were not supplied
in the repository and must be uploaded through this manager when available.

Poster Printing and Label Printing are standalone services for new requests.
Their approved calculations reuse existing server-authoritative strategies;
Sticker Printing now presents custom area pricing to new customers. Historical
Sticker jobs with embedded poster or label selections remain readable from
their immutable snapshots. The migration leaves both new services offline until
management reviews and enables them.

Website Design & Creation is Price on Request and also starts offline. Once
enabled, submission creates a canonical customer-owned Job plus the initial
private enquiry message. Only that CUSTOMER and active OWNER/ADMIN memberships
may continue the thread. Messages are discussion only; commercial agreement
still requires the formal versioned quotation workflow.
