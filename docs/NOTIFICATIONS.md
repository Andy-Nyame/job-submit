# Notifications and action center

Brick 6D uses the existing PostgreSQL `Notification` entity as the durable
source of truth. Notifications are created by server-side domain operations,
never by a browser or local storage. A stable event key combined with business
and recipient identity prevents ordinary retries from duplicating an event.

## Supported events

- OWNER/ADMIN: new fixed-price job, new job requiring costing, customer quote
  acceptance or decline, and an eligible customer counteroffer.
- CUSTOMER: job moved into staff review, quotation issued or revised,
  quotation withdrawn or detected as expired, and counteroffer decline.
- WORKER: the center is available, but no notification is currently emitted.
  Brick 6D does not invent assignment or production events, and workers receive
  no costing, quotation-decision, or negotiation data.

For Price on Request submissions, management receives one combined **new job
needs costing** event instead of separate noisy new-job and costing events.
Issuing quotation version two or later is a revision event. Expiry is surfaced
when the established quotation lifecycle detects and persists it; there is no
claim of proactive scheduled expiry delivery.

## Recipients and security

Recipient resolution reads active Neon memberships in the event's business and
requires an active business and User. Management delivery is restricted to
OWNER/ADMIN. Customer delivery is restricted to the active CUSTOMER membership
that owns the job. A direct URL never grants access: the existing customer and
staff destination routes reauthorize identity, membership, business, role, and
resource ownership.

Every notification query and read-state mutation is scoped by authenticated
`businessId` and `userId`, and mutations recheck current membership state.
Reads also apply the recipient's current role allowlist, so a later role change
cannot expose prior management-only pricing alerts to a WORKER or CUSTOMER.
Client-supplied recipient, business, destination, job, price, and permission
values are never authoritative. Messages omit internal notes, counteroffer
notes, margins, and audit metadata.

## Reliability and read state

Domain notifications are inserted in the same serializable transaction as the
successful job or quotation operation. A failed operation therefore creates no
success notification, and there is no serverless fire-and-forget work. The bell
uses a focused unread count and five recent rows. `/app/notifications` loads 20
rows per page, newest first, with an unread filter. Only the recipient may mark
one or all of their current-business notifications read. Read state never
changes the underlying job, quotation, history, or audit record.

On mobile, the bell navigates directly to `/app/notifications`; it does not open
a floating panel over the page. Desktop retains a bounded recent-notification
panel with Escape and outside-click closing. Notifications are not duplicated
as a permanent main-navigation item.

Notification sounds are optional and OFF by default. The preference is stored
only in the current browser. After the user enables audio, one gentle chime may
play for a batch of genuinely new, role-permitted important notifications while
the app is active and visible. The first load seeds the seen set and never
replays old notifications. Browser autoplay policy, device mute, suspended or
closed tabs, and operating-system restrictions may prevent sound; JobSubmit does
not promise background audio or push delivery. A Test Sound action lets the user
check current browser behavior and the same control can mute sounds again.

## Delivery limits

No transactional email provider is configured. Brick 6D provides complete
in-app delivery only and does not promise email, push, SMS, WhatsApp, realtime,
or proactive scheduled alerts. Those require a separately approved, durable
delivery milestone.
