# Authentication and application identity

## Ownership boundaries

Supabase Auth owns Google and email/password authentication, credentials,
verified identity, and sessions. Neon owns the JobSubmit `User`, Capt. Bob
business `BusinessMembership`, role, lifecycle status, and audit history.
Supabase metadata and client-provided role values are never authorization.

The durable bridge is the unique Supabase user UUID stored in
`User.supabaseAuthUserId`. Email is normalized with trim/lowercase and is used
only for contact data, confirmed claiming of an unbound pre-created user, and
the locked initial bootstrap policy.

## Authentication flows

- `proxy.ts` creates a request-scoped Supabase SSR client, calls `getClaims()`,
  and propagates refreshed request/browser cookies plus no-cache headers.
- Server authorization calls `getClaims()` for verified identity and
  `getUser()` for the current authoritative user/email state. It never trusts
  `getSession().user`.
- Google uses Supabase `signInWithOAuth({ provider: "google" })` and the PKCE
  callback at `/auth/callback`.
- Existing email/password users may sign in at `/login`.
- Public email/password signup is implemented but server-gated until reliable
  production SMTP is available.
- Logout uses `scope: "local"`, ending only the current application session.

## Membership policy

- Every ordinary public identity resolves to `CUSTOMER` on first access.
- Existing `WORKER`, `ADMIN`, or `OWNER` memberships are preserved.
- Verified `nyameandy8@gmail.com` resolves to `ADMIN`.
- Verified `bobcedisartworks@gmail.com` resolves to `OWNER`.
- Unverified email cannot bootstrap or claim a pre-created user.
- The locked policy can elevate a lower membership but cannot downgrade
  `OWNER`, reactivate a blocked user/membership, or create duplicate audit rows
  on repeated login.
- A privileged establishment/elevation appends an `AuditLog` row.

## Worker invitation authorization

Public auth still provisions only `CUSTOMER`. An active `OWNER` or `ADMIN` may
create a worker invitation for one normalized email. Redeeming it requires a
valid Supabase session, that exact confirmed Supabase email, the same business,
an active application account, and a live single-use token. The transaction may
promote `CUSTOMER` to `WORKER`; it cannot overwrite `ADMIN` or `OWNER`.

No Supabase metadata, hidden form role, URL role, or client value is trusted.
Workers cannot manage workers. Every Server Action repeats authentication,
active-membership authorization, business scoping, validation, and optimistic
state checks.

## Production email limitation

`EMAIL_PASSWORD_SIGNUP_ENABLED` must remain `false` until Capt. Bob has a custom
SMTP provider and sending domain. Supabase's default mail service is not treated
as reliable production delivery. Password recovery UI is intentionally not
advertised in this brick. Google authentication remains independent of SMTP.

Before enabling public email signup, complete these manual Supabase dashboard
steps:

1. Configure and verify custom SMTP/sending-domain delivery.
2. Set the production Site URL and add the production and intended local
   `/auth/callback` URLs to the Auth redirect allow list.
3. Update the Confirm signup email template for SSR token verification:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
4. Test confirmation and recovery delivery with non-privileged test accounts.
5. Set `EMAIL_PASSWORD_SIGNUP_ENABLED=true` only after those checks pass.

Google's client ID/secret remain in Supabase provider configuration. They do
not belong in this repository or Vercel application variables.
