# Monsoon Ridge: Jungle Resort & Spa

Everything runs on free plans: **Firebase Spark** (login, database, website hosting) and **Render Free** (API server). No card needed.

```
frontend/              React + Vite website (guests + staff dashboard)  → Firebase Hosting
backend/
  server/              Node.js + Express API (bookings, cancel, admin role) → Render
  firestore.rules      Database security rules
  firestore.indexes.json
firebase.json          Hosting, security headers, rules
render.yaml            Render deploy config for backend/server
```

## How security works

- **Login**: Firebase Authentication with email/password (email must be verified before booking) and Google sign-in.
- **API authentication**: the website sends the user's Firebase ID token with every request. The server verifies it with the Firebase Admin SDK, rejecting revoked tokens and unverified emails.
- **The browser cannot write to the database.** `firestore.rules` only allow reading: guests read their own bookings and staff read all of them. Every write goes through the API.
- **The server sets the price.** The API takes only room, dates, guests and contact details. Price, room name and status come from `backend/server/src/rooms.js`.
- **No double-booking.** Each room type has `units`. Nights are counted in `inventory/{room}_{date}` inside a Firestore transaction.
- **Strict validation.** Every field is type-checked and length-limited, and unknown fields are dropped (`backend/server/test/`).
- **Abuse limits.**
  - Per IP address: 60 requests a minute and 20 bookings or cancellations per 10 minutes.
  - Per account: 3 bookings per 10 minutes and at most 10 upcoming bookings.
  - Requests larger than 10 KB are rejected.
- **CORS**: only the site's own addresses can call the API.
- **Admin is server-granted.** `ADMIN_EMAILS` on the server sets an `admin` custom claim. The rules and the API both check it.
- **Headers**: Helmet on the API, plus CSP, HSTS and no-framing on the website.
- **Secrets**: the service-account key is never committed (`.gitignore`) and only lives in Render's environment settings.

## First-time setup

```bash
npm install -g firebase-tools
firebase login
npm run install:all
```

**Get the server key (free):** in the Firebase console, go to ⚙️ **Project settings → Service accounts → Generate new private key**. Save the file as `backend/server/service-account.json`. It's a secret: never share it or commit it.

Then copy `backend/server/.env.example` to `.env` and put the staff email in `ADMIN_EMAILS`.

In the Firebase console, go to **Authentication → Settings** and set the password policy to at least 8 characters with letters and numbers.

## Run locally

```bash
npm start       # API (:8787) + website (:5173) together; Ctrl+C stops both
npm run api     # or just the API
npm run dev     # or just the website
npm test        # backend validation tests
```

## Deploy (free)

1. **Database rules:** `npm run deploy:rules`
2. **API on Render:**
   1. Sign in at render.com with GitHub, then go to **New → Blueprint** and pick this repo. It reads `render.yaml`.
   2. When asked, enter `ADMIN_EMAILS`, and paste the whole contents of `service-account.json` into `FIREBASE_SERVICE_ACCOUNT`.
   3. Copy the service URL, e.g. `https://monsoon-ridge-api.onrender.com`.
3. **Website:** set `VITE_API_URL=<that URL>` in `frontend/.env.local`, then run `npm run deploy`. The site goes live at `https://monsoon-ridge.web.app`.

The free Render server sleeps after about 15 minutes idle; the first request after that takes 30–60 seconds. The site pings it when a guest signs in or opens a booking page, to hide most of that delay.

## Becoming admin

1. Put the email in `ADMIN_EMAILS`: in `backend/server/.env` locally, and in the Render dashboard for the live site.
2. Sign in on the site with that email and verify it.
3. Refresh the page. **Admin** appears in the user menu and opens the dashboard at `/admin`.

## Rooms and prices

Staff manage rooms in the dashboard (**Admin → Rooms**): add rooms, edit details and photos, change prices and room counts, hide rooms, or feature them on the home page. Categories are **Single**, **Double** and **Family**.

- Rooms are stored in Firestore (`rooms`). The website updates live, and the server reads price and room count from there for every booking.
- A price change applies to new bookings only. Existing bookings keep the price they were booked at.
- A room that has bookings can't be deleted. Hide it instead (turn off "Show on website").
- Starter rooms: `npm run seed-rooms` (in `backend/server`) copies `frontend/src/data/rooms.js` into Firestore once. Rooms that already exist are skipped.
