# Monsoon Ridge: Jungle Resort & Spa

```
frontend/            React + Vite website (guests and staff)
backend/
  functions/         Cloud Functions: create/cancel bookings, admin role
  firestore.rules    Database security rules
  firestore.indexes.json
firebase.json        Hosting, rules, functions and emulator config
```

## How security works

- **Login**: Firebase Authentication with email/password (email must be verified before booking) and Google sign-in.
- **The browser cannot write to the database.** `firestore.rules` only allow reading: guests read their own bookings and staff read all of them. Every write goes through a Cloud Function.
- **The server sets the price.** `createBooking` takes only room, dates, guests and contact details. Price, room name and status come from `backend/functions/src/rooms.js`.
- **No double-booking.** Each room type has `units`. Nights are counted in `inventory/{room}_{date}` inside a transaction, so two guests can't take the last room at the same time.
- **Strict validation.** Every field is type-checked and length-limited, and unknown fields are dropped. Tests are in `backend/functions/test/`.
- **Rate limits.** Each user can make at most 3 bookings per 10 minutes and hold at most 10 upcoming bookings.
- **Admin is server-granted.** Staff emails live in `backend/functions/.env` (`ADMIN_EMAILS`). The server sets an `admin` custom claim and the rules check it. The browser can't make itself admin.
- **Hosting headers.** HTTPS-only (HSTS), Content Security Policy, no framing (clickjacking), nosniff and a strict referrer policy.
- **App Check (optional).** It blocks scripts that call the API from outside the site. See below.

## First-time setup

```bash
npm install -g firebase-tools
firebase login
npm run install:all
```

1. In `backend/functions/.env`, add your email: `ADMIN_EMAILS=you@example.com`
2. **Upgrade the project to the Blaze plan** (Firebase console → ⚙️ → Usage and billing). Cloud Functions require it. A small site normally stays inside the free monthly quota. Set a **budget alert** (e.g. USD 5) in Google Cloud Billing.
3. In the Firebase console, go to **Authentication → Settings**:
   - **Password policy:** require at least 8 characters, with letters and numbers.
   - **User actions:** keep **Email enumeration protection** on.
   - **Authorized domains:** add your custom domain when you get one.

## Run locally

```bash
npm run dev            # http://localhost:5173 (uses the live Firebase project)
```

Bookings need the functions deployed (`npm run deploy:functions`), or run everything locally with the emulators (needs Java 11+): set `VITE_USE_EMULATORS=true` in `frontend/.env.local`, then run `npm run emulators` and `npm run dev`.

```bash
npm test               # backend validation tests
```

## Deploy

```bash
npm run deploy         # builds frontend, deploys hosting + rules + indexes + functions
```

The site will be live at `https://monsoon-ridge.web.app`.

## Becoming admin

1. Put your email in `ADMIN_EMAILS` and deploy the functions.
2. Sign in on the site with that email and verify it.
3. Refresh the page. **Admin** now appears in the user menu.

To remove someone, delete their email from `ADMIN_EMAILS`, deploy, and the claim is removed the next time they sign in.

## App Check (recommended before going live)

1. Google Cloud console → **reCAPTCHA** → create a **Website** key for your domains.
2. Firebase console → **App Check** → register the web app with that key.
3. Put the key in `frontend/.env.local` as `VITE_RECAPTCHA_SITE_KEY`, then set `ENFORCE_APP_CHECK=true` in `backend/functions/.env`.
4. Redeploy. Watch App Check metrics first, then press **Enforce** for Firestore too.

## Changing rooms or prices

Edit **both** `frontend/src/data/rooms.js` (what guests see) and `backend/functions/src/rooms.js` (what they pay, and `units` = rooms of that type). Then deploy the functions.
