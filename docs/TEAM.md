# Team and worker foundation

## Authority

Active `OWNER` and `ADMIN` memberships may manage workers for their own
business. `CUSTOMER` and `WORKER` are denied. No Brick 4 action can create or
promote `ADMIN`/`OWNER`, remove owner authority, or alter the locked bootstrap
policy. Server Actions treat IDs, versions, service selections, capacity values,
and intent as untrusted and re-read the authoritative records under the actor's
business ID.

## Invitation lifecycle

Invitations are `PENDING`, `ACCEPTED`, `EXPIRED`, or `REVOKED`. Creation uses a
cryptographically random 256-bit token with a seven-day lifetime. PostgreSQL
stores only the SHA-256 hash. The copyable link carries the token after `#`, so
it is not part of HTTP request URLs or referrers. During authentication the token
may be retained in same-origin `sessionStorage` for that browser tab; it is
removed after the successful flow and is never application database data.

Redemption requires an authenticated Supabase subject with the exact verified
normalized email. It atomically compare-and-sets the invitation to `ACCEPTED`,
promotes only an active `CUSTOMER` membership to `WORKER`, creates the worker
profile if absent, and appends audit entries. A pre-existing different identity
binding is still protected by Brick 3. `ADMIN` and `OWNER` memberships fail
closed. Concurrent or repeated redemption cannot consume the token twice.

Because production SMTP is not configured, managers manually copy the link.
The product does not claim an invitation email was sent. Reissue creates a new
secret and replacement record while revoking the previous pending link.

## Worker lifecycle and profile

Worker removal is non-destructive. Deactivation atomically sets the membership
inactive and profile unavailable; authorization fails on the next request.
Reactivation is explicit and is rejected while the User, Business, or archived
profile is blocked. Membership/profile optimistic versions reject stale
management forms.

Managers configure display name, active service skills from the six seeded
services, QUICK capacity (`0..50`), STANDARD capacity (`0..20`), and FOCUS
eligibility. Workers may view these settings but cannot edit capacity, skills,
roles, or permissions.

FOCUS policy is configured now and enforced later during transactional job
claiming: active FOCUS excludes STANDARD and additional FOCUS work; limited
QUICK work remains allowed only within QUICK capacity.

## Audit events

Append-only `AuditLog` rows record invitation create/revoke/accept, membership
promotion, worker activation/deactivation, and settings/skill/capacity changes.
Audit metadata never contains raw invitation tokens and avoids email/display
name payloads.
