<div align="center">

# 🌿 Monsoon Ridge · Jungle Resort & Spa

**A complete hotel website and staff dashboard: online booking, front desk, housekeeping, billing, reviews and reports.**
Built with React and Firebase, and it runs entirely on free plans.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20·%20Firestore%20·%20Hosting-FFCA28?logo=firebase&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white)
![Render](https://img.shields.io/badge/Render-free%20plan-46E3B7?logo=render&logoColor=black)

![Home page in the evening view: cabana lights come on after dusk](docs/screenshots/home-evening.jpg)

</div>

---

## Contents

- [What it does](#what-it-does)
- [Screenshots](#screenshots)
- [How it's built](#how-its-built)
- [Try it with demo data](#try-it-with-demo-data-no-firebase-account-needed)
- [Set up your own copy](#set-up-your-own-copy)
- [Deploy (free)](#deploy-free)
- [Security](#security)
- [Project structure](#project-structure)

## What it does

### For guests
- **Browse rooms** with live availability, photos, guest reviews and the exact price for the chosen dates (seasons, weekend rates and promo codes included).
- **Book online** with an email-verified account or Google sign-in, and get a confirmation email.
- **My Bookings:** change dates, room or guests (with the new price shown before saving), cancel, see the invoice, and print it or save it as a PDF.
- **Review the stay** after check-out, from a private link in the thank-you email.
- **Contact form** that lands in the staff inbox.

### For the front desk
- **Today at a glance:** arrivals, departures and who is in the hotel.
- **Check in and check out** with room numbers. Check-out marks the room for cleaning.
- **Walk-in and phone bookings**, plus blocked dates for maintenance.
- **Housekeeping board:** every room by number, clean, dirty or out of order.
- **Guest bill:** extras (meals, spa, transfers), payments with numbered receipts, and an invoice issued at check-out.
- **Inbox:** reply to guests from the dashboard; the reply goes out by email.
- **Occupancy calendar**, booking history and staff notes.

### For managers
- **Rooms:** add and edit rooms, photos (Cloudinary), prices and room counts.
- **Pricing:** seasons (for example +20% in December), weekend extras and promo codes with limits and expiry dates.
- **Revenue reports:** monthly revenue, best room types and busiest days. The bookings list exports to CSV.
- **Staff and roles:** *Admin* or *Front desk*, managed from the dashboard.
- **Activity log:** who did what and when; it can't be edited or deleted.
- **Reviews:** reply in public, and hide reviews that break the rules.

### Under the hood
Emails through Brevo, per-page SEO (sitemap, link previews, structured data), and server-side checks on every change (see [Security](#security)).

## Screenshots

> All screenshots use made-up demo data (`npm run seed-demo`). No real guests are shown.

### Website

| | |
|:---:|:---:|
| ![Home page, day view](docs/screenshots/home-day.jpg) | ![Rooms with filters and ratings](docs/screenshots/rooms.jpg) |
| **Home**: day and evening views | **Rooms**: filters, live availability, ratings |
| ![Room details](docs/screenshots/room.jpg) | ![Guest reviews on a room page](docs/screenshots/room-reviews.jpg) |
| **Room details** | **Verified guest reviews** with hotel replies |
| ![Booking form](docs/screenshots/booking.jpg) | ![My bookings](docs/screenshots/my-bookings.jpg) |
| **Booking** with the exact price | **My Bookings** |
| ![Changing a booking with a price preview](docs/screenshots/change-booking.jpg) | ![Invoice, ready to print or save as PDF](docs/screenshots/invoice.jpg) |
| **Change a booking**: new price before saving | **Invoice**: print or save as PDF |

### Staff dashboard

| | |
|:---:|:---:|
| ![Dashboard overview](docs/screenshots/dash-overview.jpg) | ![Bookings list](docs/screenshots/dash-bookings.jpg) |
| **Overview**: revenue, occupancy, today | **Bookings**: search, filters, CSV export |
| ![Booking details](docs/screenshots/dash-booking.jpg) | ![Guest bill with extras and payments](docs/screenshots/dash-bill.jpg) |
| **Booking details**: check-in and check-out | **Bill**: extras, payments, receipts |
| ![Occupancy calendar](docs/screenshots/dash-calendar.jpg) | ![Housekeeping board](docs/screenshots/dash-housekeeping.jpg) |
| **Occupancy calendar** | **Housekeeping** by room number |
| ![Reviews moderation](docs/screenshots/dash-reviews.jpg) | ![Revenue report](docs/screenshots/dash-reports.jpg) |
| **Reviews**: reply or hide | **Revenue report** |
| ![Seasons, weekend prices and promo codes](docs/screenshots/dash-pricing.jpg) | ![Inbox with email reply](docs/screenshots/dash-inbox.jpg) |
| **Pricing**: seasons, weekends, promo codes | **Inbox**: reply by email |

<p align="center"><img src="docs/screenshots/dash-activity.jpg" alt="Activity log" width="70%"><br><b>Activity log</b>: every change, by whom and when</p>

### On a phone

![Home, room page and dashboard on a phone](docs/screenshots/phones.jpg)

## How it's built

| Part | Technology | Hosted on (free) |
|---|---|---|
| Website and dashboard | React 18, React Router 7, Vite 6, plain CSS | Firebase Hosting |
| Sign-in | Firebase Authentication (email + Google) | Firebase Spark plan |
| Database | Cloud Firestore, live updates in the dashboard | Firebase Spark plan |
| API | Node.js 22, Express, Firebase Admin SDK | Render free plan |
| Photos | Cloudinary (signed uploads) | Cloudinary free plan |
| Email | Brevo HTTP API | Brevo free plan (300 a day) |

```mermaid
flowchart LR
  B[Browser<br/>React site + dashboard] -- read only, checked by firestore.rules --> F[(Cloud Firestore)]
  B -- sign in --> A[Firebase Auth]
  B -- every change, with the sign-in token --> S[Express API<br/>on Render]
  S -- verifies the token --> A
  S -- transactions: bookings, rooms, bills --> F
  S -- booking, receipt and reply emails --> M[Brevo]
  B -- photo upload with a signature from the API --> C[Cloudinary]
```

**The browser never writes to the database.** It reads what the rules allow (guests see their own bookings, staff see everything), and every change goes through the API. There the server checks the user's role, prices the stay itself and updates room availability night by night in a transaction, so a room can't be double-booked.

## Try it with demo data (no Firebase account needed)

The Firebase emulators run the whole thing on your computer with made-up data. You need **Node.js 22** and **Java** (for the Firestore emulator).

```bash
npm install -g firebase-tools
npm run install:all

# 1. local Firebase (keep this running)
npm run emulators

# 2. in a second terminal: fill it with demo rooms, bookings, reviews and messages
npm --prefix backend/server run seed-demo
```

Create the two settings files (any API key works with the emulators):

```bash
cp backend/server/.env.example backend/server/.env
printf "VITE_FIREBASE_API_KEY=demo-key\nVITE_FIREBASE_PROJECT_ID=monsoon-ridge\nVITE_FIREBASE_AUTH_DOMAIN=localhost\nVITE_API_URL=http://localhost:8787\nVITE_USE_EMULATORS=true\n" > frontend/.env.local
```

Start the API and the website against the emulators:

```bash
# bash / macOS / Linux
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm start
```

```powershell
# Windows PowerShell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"; npm start
```

Open **http://localhost:5173** and sign in. The password for both accounts is `Demo-pass-2026`.

| Account | Sees |
|---|---|
| `manager@monsoonridge.lk` | the staff dashboard (Admin role) |
| `nimali.perera@example.com` | a guest with a past stay, an invoice and an upcoming booking |

Emails are skipped in this mode, because no Brevo key is set.

## Set up your own copy

```bash
npm install -g firebase-tools
firebase login
npm run install:all
```

1. **Firebase project:** create one (Spark plan) and turn on Email/Password and Google sign-in. Copy the web app config into `frontend/.env.local` (see `frontend/.env.example`).
2. **Server key:** go to ⚙️ **Project settings → Service accounts → Generate new private key**, and save it as `backend/server/service-account.json`. It's a secret: it is git-ignored, and you should never share it.
3. **Server settings:** copy `backend/server/.env.example` to `.env` and put the owner's email in `ADMIN_EMAILS`. The settings for Cloudinary (photos) and Brevo (emails) are optional; without them, uploads and emails are switched off.
4. **Database rules and indexes:** `npm run deploy:rules`
5. **Rooms:** `npm --prefix backend/server run seed-rooms` copies the starter rooms. After that, manage rooms in the dashboard.

```bash
npm start       # API (:8787) + website (:5173); Ctrl+C stops both
npm test        # backend tests
```

**Becoming admin:** put the email in `ADMIN_EMAILS`, sign in with it, verify it, then refresh the page. The dashboard is at `/admin`. Add other staff later from **Dashboard → Staff**, as *Admin* or *Front desk*.

## Deploy (free)

1. **API on Render:**
   1. Go to **New → Blueprint** and pick this repo; Render reads `render.yaml`.
   2. Enter `ADMIN_EMAILS`, and paste the whole `service-account.json` into `FIREBASE_SERVICE_ACCOUNT`.
   3. Add `BREVO_API_KEY` / `MAIL_FROM` and the Cloudinary keys if you use them.
2. **Website:** set `VITE_API_URL=<the Render URL>` in `frontend/.env.local`, then run `npm run deploy`. That builds the site, writes the SEO pages and sitemap, and deploys Hosting and the database rules.
3. **Google:** add the site in [Search Console](https://search.google.com/search-console) and submit `/sitemap.xml`.

The free Render server sleeps after about 15 minutes idle, so the first request after that takes 30–60 seconds. The site wakes it up early, when a guest opens a booking page.

## Security

- **Sign-in:** Firebase Authentication, with a verified email needed to book. The API verifies every token and rejects revoked ones.
- **Roles are set by the server only.** The *Admin* and *Front desk* roles are custom claims that only the API sets. They are checked against the current staff list on every request, and removing someone signs them out everywhere.
- **The browser is read-only.** `backend/firestore.rules` allow only reads, limited by role. All writes go through the API.
- **The server prices everything.** It ignores any price, status or discount sent by the browser. Bookings, bills and room counts change in transactions.
- **Every input is checked:** types, lengths and formats are checked and unknown fields are dropped. Line breaks are stripped from fields that end up in email headers. Everything a user typed is escaped in emails.
- **Abuse limits:**
  - per IP and per account rate limits;
  - tight limits on promo-code checks, the contact form, review links and account emails;
  - a 10 KB request size limit;
  - a hidden field that catches bots.
- **Private links are hashed.** Review links contain a random token, and only its hash is stored.
- **Headers:** Helmet on the API (CORS allows only the site itself, and responses are `no-store`). On the site: CSP, HSTS, `frame-ancestors 'none'`, a Permissions-Policy and [`security.txt`](frontend/public/.well-known/security.txt).
- **Staff sessions end after 30 minutes without activity**, because front-desk computers are shared.
- **Audit trail:** every change by staff or guests goes to an activity log that can't be edited.
- **Dependencies:** `npm audit` reports 0 known vulnerabilities, and Dependabot checks for updates every week.
- **Secrets:** keys live only in `.env` (git-ignored) and in Render's settings. The browser never sees a secret.

Found a problem? Please report it privately, as described in [`security.txt`](frontend/public/.well-known/security.txt).

## Project structure

```
frontend/                   React website + staff dashboard  → Firebase Hosting
  src/pages/                guest pages (Home, Rooms, Booking, My Bookings, Invoice, Review…)
  src/pages/admin/          dashboard (Overview, Front desk, Bill, Housekeeping, Pricing, Reports…)
  src/seo/  scripts/        page titles, link previews, sitemap (built after `vite build`)
backend/
  server/src/               Express API: bookings, changes, bills, reviews, pricing, staff, emails
  server/test/              tests for the rules (prices, bills, changes, reviews, validation)
  server/scripts/           seed-rooms, seed-demo (emulators only), sync-admins
  firestore.rules           who can read what (nobody writes from the browser)
  firestore.indexes.json
docs/screenshots/           the pictures in this README
firebase.json               hosting, security headers, clean URLs
render.yaml                 API deploy settings for Render
```

<div align="center">

Made by **[Sulana Uduwana](https://github.com/Sulana-UX)** and **[Indeewari](https://github.com/Indeewari04)**

</div>
