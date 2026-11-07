# دعوتي (Dawati) — premium Arabic animated invitations

A working web product for selling animated wedding / engagement / party invitations to
Arabic-speaking customers, with a sales representative in Libya. Arabic RTL everywhere.

* **Guests** open a private link from WhatsApp, tap the seal of a pearl-white lace envelope,
  watch it unfold in layered 3D, read their personalised card, scroll the ivory and burgundy
  sections, and RSVP.
* **Customers** pay **cash, person to person** (no payment gateway). The owner, or a
  representative the owner trusts, then issues them a **token**. The token carries the design,
  the colour and **how many guests they may invite**. Customers sign in with that token (no email,
  no password), customise the invitation, add guests, send links and track RSVPs.
* **Representatives (affiliates)** earn **15%** of every sale credited to them, tracked in a
  ledger (pending → approved → paid, with refund reversals and claw-backs).
* **Owner** runs everything from a CRM protected by password + mandatory TOTP (2-step) login.

---

## Quick start (local, zero setup)

```bash
npm install
OWNER_SETUP_TOKEN=choose-a-long-local-secret npm run dev
```

Open:

| URL | What |
|---|---|
| http://localhost:3000 | Landing page (live phone showcase) |
| http://localhost:3000/demo | Full-screen sample invitation (`?color=white|ivory|champagne`) |
| http://localhost:3000/themes/pearl-lace | Theme preview with colour switching |
| http://localhost:3000/owner/setup | **One-time** owner creation (needs `OWNER_SETUP_TOKEN`) → scan QR in an authenticator app |
| http://localhost:3000/owner | Owner login (username + password + 6-digit code) |
| http://localhost:3000/access | Customer token entry ("لدي رمز دخول") |
| http://localhost:3000/affiliate | Representative token entry |

Without `DATABASE_URL`, an embedded PostgreSQL (PGlite) is created in `.data/pglite` and the
migrations run automatically. A development `APP_SECRET` is generated into `.data/app-secret`.

**Try the whole flow in 2 minutes:** create the owner → *المسوقون* → add `LIBYA001` with
"can issue tokens" → *الطلبات* → issue a customer token (pick a guest limit) → open `/access` in
another browser and paste the token → edit names/date → add guests → *روابط الدعوات* → open a link on
your phone (or a mobile-sized window), tap the seal → RSVP → see it in *تأكيد الحضور*, the
representative's commission at `/affiliate`, and the owner CRM.

Alternative owner creation (terminal): `npm run owner:create` (with the embedded DB, stop
`npm run dev` first: PGlite allows only one process).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on :3000 |
| `npm run build && npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Integration tests (in-memory PostgreSQL) |
| `npm run test:e2e` | Full browser walkthrough (needs a **fresh** DB and a server started with `OWNER_SETUP_TOKEN=local-dev-setup-token-123456`; base URL via `E2E_BASE`) |
| `npm run assets` | Rebuild theme layers from `assets-src/themes/pearl-lace/ref-*.jpg` (Python 3 + Pillow + NumPy) |
| `npm run db:migrate` | Apply migrations explicitly (they also run on first DB use) |
| `npm run owner:create` | Create the owner from the terminal |

Environment variables: see **`.env.example`** (`APP_SECRET`, `DATABASE_URL`, `OWNER_SETUP_TOKEN`,
`PUBLIC_BASE_URL`, `STORAGE_DRIVER` + Supabase storage keys, branding).

---

## How the business works in the software

```
buyer pays cash ──► owner (or trusted rep) dashboard: "إصدار رمز لعميل جديد"
                     name, phone, design, colour, guest limit, amount received, rep credited
                     │  one DB transaction, idempotency key (double-tap safe)
                     ├─ sale + payment record (who holds the cash)
                     ├─ customer workspace + invitation (guest_limit)
                     ├─ 15% commission (pending) if a rep sold it
                     └─ customer token dwc_… (shown once → "send via WhatsApp")
customer: /access → dashboard → edit / design / guests → 7-day links → WhatsApp
guest:    /i/<43-char token> → envelope → card → sections → RSVP
```

* **Price**: 350 LYD by default (theme price, editable in *القوالب*). LYD amounts are stored in
  integer dirham (×1000): 350 LYD = `350000`. No floating-point money anywhere.
* **Guest limit**: chosen per customer at issue time (default from settings: 150). The customer
  cannot exceed it; the owner can raise it later (*العملاء*).
* **Representatives** who are *not* trusted to issue tokens send the buyer's details to the owner,
  who issues the token and credits them. Trusted representatives issue tokens themselves; the cash
  is then tracked as "held by the representative" until the owner records *تم استلام النقد*.
* **Referral links** (`/?ref=LIBYA001`) are counted (bots/preview crawlers excluded) and make every
  "order" button on the site open WhatsApp to **that** representative for 30 days.
  Policy: the most recent valid referral link wins. Commission is never created from a link alone,
  only when a sale is recorded and credited.

### Commission rules
* `commission = round_half_up(basis × rate_bps / 10000)`; default rate 1500 bps (15%).
  Example: 100 LYD → 15 LYD, 200 LYD → 30 LYD, 350 LYD → 52.5 LYD.
* Basis = the amount **actually received** (minus an optional fee percentage in settings, 0 for
  cash). Each commission row stores its own basis and rate, so later rate changes never rewrite
  history.
* States: `pending` (at sale) → `approved` (owner) → `paid` (owner records an **offline** payout
  with method, date and reference; nothing is transferred by the software).
* Full refund before payout → commission `reversed`. Partial refund or chargeback → negative
  `adjustment` (proportional). Refund after payout → claw-back adjustment netted against the next
  payout. Never more than was credited.

### Guest links
* One live link per guest, 32 random bytes (base64url, 43 chars), no name or id inside.
* Valid **7 days from creation**, enforced with the database clock (client clocks are irrelevant).
* Re-issue = old URL revoked immediately, RSVP kept. States: active / expired / revoked.
* Opening ≠ attending: "opened" is counted only after a human taps the seal (crawlers never run
  that code). RSVP: سأحضر بإذن الله / أعتذر عن الحضور, optional number of attendees, changes kept in
  `rsvp_history`.
* Links are bearer URLs: whoever holds a forwarded link can open it. This is stated in the
  dashboard; stronger guest verification would be a future feature.

---

## Security model (summary)

| Credential | Format | Stored as | Grants |
|---|---|---|---|
| Customer token | `dwc_` + 32 chars (~158 bits) | HMAC-SHA256 hash | that workspace only, via a session cookie |
| Affiliate token | `dwa_` + 32 chars | HMAC-SHA256 hash | that affiliate's sales/commissions only |
| Guest link | `/i/<43 chars>` (256 bits) | HMAC hash + AES-256-GCM copy (so the customer can copy it again) | one guest's invitation + RSVP |
| Owner | username + scrypt password + TOTP | scrypt hash, TOTP secret encrypted | CRM |

* Different prefixes **and** different tables, so token types can never be interchanged (tested).
* Tokens are exchanged for **HttpOnly, SameSite, Secure (prod)** session cookies, one cookie per
  role (`dw_os` Strict / `dw_as` / `dw_cs`). Nothing is kept in localStorage or URLs (except the
  guest link itself).
* Every page **and every server action** calls a role guard (`lib/auth.ts`); every customer
  query is scoped by the session's workspace (guessing another id returns "not found" — tested).
  Representatives never see customer names, phones, tokens or guests (tested).
* CSRF: Server Actions are origin-checked by Next.js; route handlers check `Origin` /
  `Sec-Fetch-Site`; cookies are SameSite.
* Rate limits (Postgres-backed) on token entry, owner login (plus lock-out after 8 failures),
  RSVP, opens and referral capture. TOTP codes cannot be replayed.
* Headers: strict CSP with **no third-party origins** (fonts self-hosted), HSTS (prod),
  `frame-ancestors 'none'`, `nosniff`; guest pages add `Referrer-Policy: no-referrer` and
  `X-Robots-Tag: noindex`. Guest link previews in WhatsApp show generic text, never names.
* Database: RLS enabled on every table and all privileges revoked from Supabase's `anon` /
  `authenticated` roles (verified on PostgreSQL 16). Only the server's own connection can read data.
* Audit log for logins, issuing, re-issuing, refunds, approvals, payouts and settings.
* Hardening still open: CSP uses `'unsafe-inline'` for Next.js bootstrap scripts (nonce-based CSP
  is a follow-up); no WebAuthn passkeys yet (TOTP is mandatory instead).

---

## The first theme: “لؤلؤة الدانتيل” (pearl-lace v1)

**Source art**: `assets-src/themes/pearl-lace/ref-1.jpg … ref-5.jpg` (the five opening images
you sent, 561×1080 px).

**What the pipeline (`scripts/build_theme_assets.py`) actually does**:
1. Finds the dark shadow recesses between the four flaps of ref-1 and cuts **top, left, right and
   bottom flaps along their real scalloped rims**, so each flap keeps its pearls, lace and attached
   tulle. The seal becomes its own layer and carries its contact shadow.
2. Hidden areas: the top-flap area under the seal is reconstructed by diffusion in-painting; the
   other flap tips get a clean notch (they were tucked under the seal).
3. Synthesises **back faces** (mirrored debossed paper), soft **shadow** silhouettes and pearl
   **glint** positions (`manifest.json`), plus a **lace band** cut from the real lace for the
   ivory → burgundy section transitions.
4. Produces three curated colour variants as separate art files: **white (أبيض لؤلؤي, default)**,
   **ivory (عاجي وردي, identical to your references)**, **champagne**; in two sizes (1× and 2×).

**Choreography** (`components/invitation/pearl-lace/timeline.ts`: named and editable, every
duration, angle, pivot and ease), modelled on the customer's reference video, about 6 s:
closed pearl-white envelope (pearl and bead glints, light sweeping across, glossy seal) → touch →
the seal presses and lifts → the four flaps **fold back about their hinges like opening a real
envelope** (top first, then sides, then bottom), with live shading, sheen and edge shadows, while
the inside goes from shadow to light → the **seal is always the top layer**: it rides the top
flap's tip face-on and leaves through the top edge → the lace card is revealed **in place** →
names are written in champagne foil → scrolling sections (welcome, date + countdown +
add-to-calendar, venue + map, photos, message, RSVP, thank-you + replay).
Hidden flap tips under the seal are rebuilt by extending the gathered tulle radially (no round
hole when the seal leaves). The default **white** variant is a separately prepared, low-saturation
art set with local clarity so pearls and embossing keep glossy relief.
Reduced-motion users get a short fade. Music never autoplays (the guest taps a button).

**Asset requests (to make it pixel-perfect at 3× phone density)**:
1. **The three later images you sent in chat** (burgundy swan page, burgundy bow page, ornate lace
   frame card) were not saved as files in this workspace. Please put the originals at
   `assets-src/themes/pearl-lace/ref-6.jpg`, `ref-7.jpg`, `ref-8.jpg`. Until then those sections use
   the real lace band from ref-1 plus SVG swans and bows drawn to match.
2. Higher-resolution originals of ref-1 and ref-5 (≥ 1500 px wide). The current 561 px art is
   upscaled 2× (Lanczos + light sharpening): good on most phones, slightly soft on 3× iPhones.
3. Ideal (optional): layered source files (PSD/PNG with transparency) for each flap, the seal,
   the tulle and the card, which would remove the small in-painted area under the seal.

**Adding more themes**: add a renderer component under `components/invitation/<name>/`, register
it in `components/invitation/InvitationPlayer.tsx`, add a migration inserting the theme, version
and colour variants. Sales, tokens, guests, RSVP and commissions need no change. Existing
invitations keep the theme **version** they were created with.

---

## Deployment

**Recommended low-cost setup**: Vercel (or any Node host) + Supabase (Postgres + Storage).
1. Create a Supabase project; copy the **pooled** connection string into `DATABASE_URL`.
2. Create a **private** Storage bucket `invitation-media`; set `STORAGE_DRIVER=supabase`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side env only).
3. Set `APP_SECRET` (openssl rand -base64 48), `PUBLIC_BASE_URL=https://your-domain`,
   and temporarily `OWNER_SETUP_TOKEN`. Deploy, open `/owner/setup`, then remove the variable.
4. Migrations run automatically on first request (or `npm run db:migrate` locally against the URL).

**Single small server** (VPS): `npm run build && npm start` behind HTTPS (Caddy/Nginx) with a
local PostgreSQL. Local file storage works on one server; back up `.data/uploads`.

---

## Status — what is verified

Verified in this workspace:
* `npm test`: 15 integration tests on PostgreSQL (PGlite) covering the acceptance criteria (money,
  token types, idempotent issuing, isolation, 7-day expiry by DB clock, RSVP history, reissue keeps
  RSVP, refunds/chargebacks/payouts, rate snapshots, TOTP replay).
* `npm run test:e2e`: full browser walkthrough (owner MFA → rep → sale → customer → guest on an
  iPhone-13-sized Chromium viewport → RSVP → commission → payout), passing against **both** the dev
  server with PGlite **and** a production build (`next start`, strict CSP, secure cookies) on real
  **PostgreSQL 16**.
* RLS enabled on all 27 tables, zero grants for `anon`/`authenticated`, no raw secrets stored.
* No horizontal overflow at 390 px; reduced-motion path works.

Not verified (be aware):
* **Real iPhone Safari / Android Chrome devices and WebKit**: only Chromium is available here.
  The 3D uses standard `preserve-3d` + `backface-visibility` with `-webkit-` prefixes; please test
  on a real iPhone before launch.
* The **Supabase Storage** adapter is written to the documented REST API but was not run against
  a live Supabase project. No production deployment was made.
* WhatsApp link previews are designed (generic Open Graph tags), not observed in the app.
