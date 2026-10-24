# Job operations and secure pickup

Brick 7 extends the canonical `Job` record from reviewed request through
verified handover. It does not create a second queue or job identity.

## Queue eligibility and ordering

An OWNER or ADMIN must explicitly release a job from `UNDER_REVIEW`. Release is
allowed only when the immutable submission contains confirmed fixed pricing or
a Price on Request quotation was accepted. Price agreement alone never starts
production. Released jobs enter `ACCEPTED` (Ready to Assign) with
`queueEnteredAt` set once.

Ready work is ordered Express before Regular, then by audited override tier,
then oldest `queueEnteredAt` first. A management override can move a job ahead
or behind only inside its priority group and requires a reason. The original
queue timestamp is preserved.

OWNER/ADMIN may assign or reassign eligible jobs. WORKER may claim an unassigned
eligible job. Every write rechecks the active business, User, membership,
service skill, profile, QUICK/STANDARD capacity, and FOCUS exclusion inside a
serializable transaction. The unique active-primary-assignment index and job
version prevent competing claims. Reassignment releases the former assignment
with a reason; rows are never overwritten.

## Production transitions

```text
UNDER_REVIEW → ACCEPTED → QUEUED → PROCESSING
→ PREPARING_FOR_PICKUP → READY_FOR_PICKUP → PICKED_UP
```

Assignment moves `ACCEPTED → QUEUED`. An assigned worker or management may
start work, finish production, and complete final checks. Every transition uses
compare-and-set state/version checks and appends history and audit records.
`READY_FOR_PICKUP → PICKED_UP` is available only through secure handover.

## Physical identification

The immutable public job reference is the physical job number. Authorized staff
can print one label per configured physical package. Labels contain the business,
large job number, service, quantity, useful saved size/material/finishing,
priority, package `N of M`, and a genuine QR code to the authenticated staff job
detail. They contain no customer contact details and never contain the pickup
credential. Package count is `1..100` and is independent from printed quantity.

## Private pickup credential

Entering `READY_FOR_PICKUP` issues a 24-character random one-time credential
with a 30-day validity window. PostgreSQL stores a SHA-256 lookup hash, a
non-sensitive last-four hint, and AES-256-GCM ciphertext so the owning customer
can retrieve it later. `PICKUP_CREDENTIAL_SECRET` supplies the encryption key
and must contain at least 32 random characters. Raw codes never enter audit,
notification, physical-label, or URL-request data.

The customer sees a QR and grouped manual code only on their authorized job
detail. The QR keeps the secret in the URL fragment, which is not sent in the
initial HTTP request or referrer. Active staff scan or enter it at
`/app/staff/pickup`. The view uses the immutable submission snapshot to show
service, quantity, variations, batch/custom fields, size, material, finishing,
instructions, priority, and package count. It excludes internal notes, costing,
and unrelated customer data.

Scanning never completes pickup. Staff explicitly confirm the correct job,
saved specifications, all packages, and authorized collector. Confirmation
atomically consumes the credential, changes the job to `PICKED_UP`, appends
history/audit, and creates deduplicated customer/management notifications.
Replays and concurrent attempts fail. OWNER/ADMIN may use the active credential
through a manual fallback only with all checks and a recorded reason. Reissue
revokes the former active credential before creating a replacement.

Pickup provides the reliable completion event needed by a future star ledger,
but Brick 7 deliberately awards no stars.

## Refresh and alerts

The authenticated shell has one foreground refresh coordinator. It revalidates
the current Server Component tree every 20 seconds only while visible and
online, refreshes immediately on visibility return or reconnection, performs no
full-page reload, and cleans up every timer/listener. Hidden-tab throttling still
applies and a small offline message explains stale data.

Device-local modes are Silent, Sound only, Voice only, and Sound + Voice;
Silent is the default. Web Audio and browser SpeechSynthesis announce genuinely
new, role-allowed important events once, with volume, voice, test, preview, and
mute controls. Initial data never plays and batches produce one alert. Audio is
best-effort only while the app is visible; autoplay, mute, suspended tabs, and
closed browsers can prevent it.

## Manual QA still required

Use legitimate CUSTOMER, WORKER, ADMIN, and OWNER sessions to exercise a real
non-production workflow. Physical printing, camera scanning, audible speaker
output, and iPhone Safari behavior require suitable real devices and must not
be inferred from desktop emulation.
