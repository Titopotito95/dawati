# Put Dawati online (free to start) — نشر الموقع

Everything runs on **Vercel** (hosting) with a **Postgres database created inside Vercel**
(Neon). Photos and music are stored in that same database, so there is nothing else to set up.

## 1. Code on GitHub
The code lives in your GitHub repository (for example `Titopotito95/dawati`).

## 2. Create the site on Vercel
1. Go to **https://vercel.com/signup** → *Continue with GitHub*.
2. **Add New… → Project** → pick the `dawati` repository → **Import**.
3. Open **Environment Variables** and add these two (values given to you privately):
   | Name | Value |
   |---|---|
   | `APP_SECRET` | a long random secret (keep it forever; changing it logs everyone out and breaks old links) |
   | `OWNER_SETUP_TOKEN` | a one-time secret used once to create your owner account |
4. Press **Deploy**. The first build takes 2–3 minutes. It will fail at runtime until step 3 is done; that's expected.

## 3. Add the database (one click)
1. In the project: **Storage → Create Database → Neon (Postgres) → Continue**, region
   **Frankfurt (eu-central-1)** (closest to Libya), plan *Free*.
2. Connect it to the project for **Production, Preview and Development**. Vercel adds
   `DATABASE_URL` automatically.
3. **Deployments → … → Redeploy** so the site picks up the database.
   The tables are created automatically on the first visit.

## 4. Create your owner account
1. Open `https://<your-project>.vercel.app/owner/setup`.
2. Enter the `OWNER_SETUP_TOKEN`, choose a username and a strong password.
3. Scan the QR code with **Google Authenticator** (or Microsoft Authenticator), type the 6-digit code.
4. Then go to `/owner` and log in. After that, delete `OWNER_SETUP_TOKEN` in Vercel
   (Settings → Environment Variables) — the setup page is disabled anyway once an owner exists.

## 5. Your own domain (optional)
Vercel → project → **Settings → Domains → Add**, e.g. `dawati.ly` or `dawati.com`, and follow the
DNS instructions shown. Then add `PUBLIC_BASE_URL=https://your-domain` in Environment Variables and
redeploy, so guest links use your domain.

## 6. Daily use
* Owner CRM: `/owner` → *الطلبات* → «إصدار رمز لعميل جديد» after receiving cash.
* Representative: give them the token from *المسوقون*; they log in at `/affiliate`.
* Customer: logs in at `/access` with their token.

## Costs
Vercel Hobby and Neon Free are free for a small start (Vercel's Hobby plan is meant for
non-commercial use; for a paying business, Vercel **Pro** is about 20 USD/month). The Neon free tier
has 0.5 GB of storage, enough for hundreds of invitations with photos. Upgrade when needed.
