<div align="center">

# <img src="public/icon.svg" width="40" height="40" alt="Vinyas Logo" /> Vinyas

**Full-stack study tracker for JEE · NEET · BITSAT with a Chrome Extension that auto-syncs PhysicsWallah activity, encrypted weekly backups, and a gamified progress dashboard.**

[![Live](https://img.shields.io/badge/Live-vinyas--one.vercel.app-6366f1?style=flat-square&logo=vercel&logoColor=white)](https://vinyas-one.vercel.app)&nbsp;[![Version](https://img.shields.io/badge/version-2.3.1-6366f1?style=flat-square)](CHANGELOG.md)&nbsp;[![Last Commit](https://img.shields.io/github/last-commit/KISHLAY-AT-CODE/Vinyas?style=flat-square&color=6366f1)](https://github.com/KISHLAY-AT-CODE/Vinyas/commits/main)&nbsp;[![License](https://img.shields.io/badge/license-ISC-6366f1?style=flat-square)](#license)

</div>



![Vinyas Dashboard](public/bg1.png)

---

## Why This Exists

JEE/NEET students track study across 95+ chapters per exam, split between video lectures, DPPs (Daily Practice Problems), and textbook modules — all on PhysicsWallah, which provides no unified analytics layer across them. Vinyas is that layer: a Chrome Extension that silently intercepts PW quiz submissions and module completions, and a React SPA that turns those raw events into a structured, gamified progress matrix.

---

## Architecture


| Layer | Technology |
| --- | --- |
| **Frontend** | React 18.2, Vite 5.2, TailwindCSS 3.4, Framer Motion 12.4, Phosphor Icons 2.1 |
| **Backend** | Vercel Serverless Functions (Node.js), Nodemailer 6.9 |
| **Database** | MongoDB Atlas 7.2 — 3 collections: `users`, `rate_limits`, `telemetry` |
| **Encryption** | AES-256-GCM + PBKDF2 · 100k iterations (Web Crypto API — isomorphic) |
| **Scheduling** | Vercel Cron (`0 0 * * 0`) |
| **Analytics** | Vercel Analytics |
| **Extension** | Chrome Manifest V3 · Service Worker · Content Scripts |

---

## Key Engineering Decisions

**1 — MongoDB free tier (512MB) forced delta serialization and a full lifecycle system.**
Storing complete syllabus objects per user was unsustainable at the 512MB cap. `serializeSyllabus()` diffs each user's data against the base exam template and stores only the delta: chapters with active progress, custom additions, and deletions. A JEE student with 95 chapters but progress in 8 stores 8 records, not 95. `deserializeSyllabus()` reconstructs the full syllabus on every read by merging the delta with the server-hosted template. The same constraint forced the inactivity lifecycle: hard-deleting accounts after 6 days of inactivity keeps the database below the ceiling. Encrypted weekly backups became load-bearing infrastructure — without them, a silent purge destroys months of study data.

**2 — Two-token auth where the secret also keys the encryption.**
Plaintext Sync IDs are never stored. On registration, the `vny_sec_` Sync ID (generated via `crypto.getRandomValues()`, 16 bytes, 32 hex chars) is SHA-256 hashed server-side before storage. On first login, the server issues a `vny_sess_` session token (24 random bytes, 48 hex chars) stored in a `sessions` array on the user document with `createdAt` and `lastUsedAt` timestamps. Subsequent API calls use the session token — the plaintext ID is only transmitted once. `resolveUser()` dispatches on prefix: `vny_sess_` → session array lookup; `vny_sec_` → hash lookup. The same plaintext ID doubles as the PBKDF2 passphrase for AES-256-GCM backup encryption, so the encryption key is never on the server.

**3 — One isomorphic crypto module for browser and server.**
The weekly Cron runs on Vercel serverless (Node.js). The same AES-256-GCM encryption runs client-side for manual exports. Rather than two separate implementations with two test surfaces, the crypto module auto-detects environment: `window.crypto` in browser, `globalThis.crypto` or `import('crypto').webcrypto` in Node. One file (`src/services/crypto.js`) imported by both the React app and `api/cron-backup.js`.

**4 — MV3 Service Worker as cross-tab broadcast authority.**
The Chrome Extension POSTs telemetry to `/api/activity`; the dashboard polls the buffer. With multiple dashboard tabs open, each instance races to write state — causing stale overwrites and data corruption. Manifest V3 requires a Service Worker instead of a persistent background page, which is the right primitive here: the background Service Worker broadcasts `VINYAS_SYNC_QUESTION_UPDATE` and `VINYAS_SYNC_REFRESH` via `window.postMessage` to all open Vinyas tabs simultaneously. One tab writes; all others receive the update without independent writes. On the save side, `fetch` calls on tab close use `keepalive: true` so the browser completes the POST after the page begins unloading.

---

## Features

### Chrome Extension (Manifest V3)
Two content scripts with distinct roles. `tracker_ui.js` + `content_script.js` inject at `document_idle` into all PW pages (`all_frames: true`): they inject a draggable glassmorphic overlay for logging per-question difficulty states (Easy / Medium / Hard / Difficult), proxy the native PW submit button programmatically, and auto-scrape question counts from unconfigured chapter pages via a redirect-and-return flow. `dashboard_connector.js` injects into the live Vinyas dashboard tab, reads the Sync ID from the DOM, and completes auto-pair without persisting any credentials in extension storage. All captured events are fuzzy-matched to the configured syllabus: normalized (lowercased, singularized, `&`→`and`, synonym dictionary) → exact match → substring match ranked by specificity → `altNames` array per chapter as a fallback. Unmatched submissions queue in a Resolve Submissions modal for manual linking.

### Gamified Dashboard
XP-based leveling, GitHub-style streak heatmap calendar, Pomodoro focus timer with break cycles, spaced-repetition scheduler with self-rated review history, and 15 server-evaluated achievements that trigger full-screen particle celebrations.

### Syllabus Matrix
Chapter-level tracking across JEE Mains (95 chapters), NEET (48 chapters), and BITSAT (43 chapters) — or a fully custom syllabus. Per chapter: status (Todo / Doing / Done), lecture count, DPP accuracy and completion, module accuracy and completion, per-DPP breakdown logs, per-question difficulty states, Pomodoro focus time, and spaced repetition state. Sort by Master Score or alphabetically per subject, persisted in localStorage. Active and unstarted chapters grouped separately in the view.

### Encrypted Weekly Backups
Every Sunday at midnight UTC, Vercel Cron reconstructs each user's full syllabus from the stored delta + base template, encrypts the payload with AES-256-GCM keyed by the user's Sync ID, and emails the ciphertext bundle as a `.json` attachment. A compromised inbox cannot expose study data — decryption requires the private Sync ID. Restore via Settings → Import.

### Daily Planning Workflows
Morning Planner for scheduling lectures, DPPs, and revisions by chapter and type. Nightly Wrap-Up for logging completion percentages, DPP scores, and session notes before close.

### Privacy Lifecycle
Inactivity calculated in IST calendar days (not UTC hours) using `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` — a student who logs out at 11:58 PM IST and back in at 12:02 AM IST should not lose two days. Warning email at day 5; hard purge at day 6 across all three MongoDB collections. Any API interaction resets the timer.

---

## Project Structure

```
Vinyas/
├── api/
│   ├── _shared/
│   │   ├── achievements_config.js  # 15 server-evaluated achievement definitions
│   │   ├── auth.js                 # SHA-256 hashing + vny_sess_ token resolution
│   │   ├── db.js                   # Connection pool with ping health check, 5s timeout
│   │   ├── email.js                # Backup email, deletion warning, bug report dispatch
│   │   ├── syllabus.js             # Delta serialize/deserialize + template loader
│   │   └── timezone.js             # IST date utils via Intl.DateTimeFormat
│   ├── activity.js                 # Extension telemetry receiver + assignment matcher
│   ├── cron-backup.js              # Sunday Cron: inactivity purge + encrypted backup
│   ├── data.js                     # Core CRUD: syllabus, sessions, achievements
│   ├── extension-metadata.js       # Serve extension/APK version + file size to frontend
│   ├── logout.js                   # Sets logoutTimestamp to begin inactivity countdown
│   ├── telemetry.js                # Bug report + diagnostics receiver
│   ├── templates.js                # Serve exam syllabus JSON templates
│   └── test-backup-mail.js         # Manual backup trigger (dev)
├── src/
│   ├── components/                 # 28 React components
│   ├── hooks/
│   │   ├── useActivityProcessor.js # Reactive fuzzy-match pipeline + activity polling
│   │   ├── useDatabaseSync.js      # Debounced save, keepalive flush, session management
│   │   ├── useExtensionConnection.js # postMessage bridge, version mismatch detection
│   │   ├── useAchievements.js      # Achievement state management
│   │   └── useThemeSettings.js     # Background, blur, opacity preferences
│   ├── services/
│   │   ├── crypto.js               # Isomorphic AES-256-GCM + PBKDF2 + SHA-256
│   │   ├── logger.js               # In-memory event log bus
│   │   └── notifications.js        # Browser notification integration
│   └── shared/
│       ├── normalize.js            # normalizeChapterName (synonym dict) + normalizeUrl
│       ├── time.js                 # IST formatting utilities
│       └── utils.js                # findChapterByName, findAllChaptersByName,
│                                   # generateSecureSyncId, applyActivitiesToChapter
├── Vinyas_Extension/               # Manifest V3 Chrome Extension
│   ├── background.js               # Service Worker — cross-tab broadcast authority
│   ├── content_script.js           # PW page interceptor, submit proxy, DOM scraper
│   ├── dashboard_connector.js      # Auto-pair DOM bridge (reads Sync ID from dashboard)
│   ├── tracker_ui.js               # Glassmorphic overlay UI
│   └── manifest.json               # MV3 manifest
├── templates/
│   ├── jee_mains.json              # 95 chapters across Physics / Chemistry / Mathematics
│   ├── bitsat.json                 # 43 chapters across 5 subjects
│   └── neet.json                   # 48 chapters across Physics / Chemistry / Biology
├── Vinyas_lived.html               # Project retrospective page
└── vercel.json                     # Cron schedule, SPA rewrites, template includeFiles
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas cluster
- Vercel account (required for Cron and serverless functions)

### Local Setup

```bash
git clone https://github.com/KISHLAY-AT-CODE/Vinyas.git
cd Vinyas
npm install
```

Create `.env` in the root:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/vinyas

# Diagnostics endpoint auth
TELEMETRY_PASSWORD=your_password

# Email: backups, inactivity alerts, bug reports
SMTP_USER=your_smtp@gmail.com
SMTP_PASS=your_app_password
DEV_EMAIL=developer_recipient@gmail.com

# Vercel Cron authentication (set same value in Vercel dashboard)
CRON_SECRET=your_cron_secret

# Optional: comma-separated extra CORS origins for the extension
ALLOWED_CORS_ORIGINS=
```

```bash
npm run dev
# With Vercel serverless functions locally:
npm run vercel-dev
```

Open `http://localhost:5173` and create a Sync ID to start.

---

## Chrome Extension Setup

1. Download `Vinyas_Extension.zip` from the `/extension` page on your dashboard, or use `Vinyas_Extension/` from this repo.
2. Open `chrome://extensions/` → enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select the extracted `Vinyas_Extension/` folder.
4. Open your Vinyas dashboard tab → click the extension icon → **Auto-Pair**.

The extension reads your Sync ID from the live dashboard DOM. No credentials are stored in extension storage.

Full annotated visual walkthrough: [vinyas-one.vercel.app/extension](https://vinyas-one.vercel.app/extension)

---

## Security

- **Sync IDs** generated via `crypto.getRandomValues()` — 16 bytes, 32 hex chars, `vny_sec_` prefix. Never stored in plaintext — SHA-256 hashed server-side before insertion into MongoDB.
- **Session tokens** (`vny_sess_`) issued on first login, stored in a sessions array with timestamps. Subsequent calls use the token; the plaintext Sync ID transits the network only once.
- **AES-256-GCM + PBKDF2** (100,000 iterations, 16-byte random salt, 12-byte IV) for all backup payloads. The same isomorphic module runs in the browser for manual exports and in Node.js for the weekly Cron. The server handles only ciphertext — the plaintext Sync ID used as the passphrase never leaves the client.
- **Extension auto-pair** reads the Sync ID from the live page DOM; nothing is persisted in Chrome extension storage.
- **CORS**: `chrome-extension://` origins, `localhost:*`, and `*.vercel.app` are explicitly whitelisted at the origin header level. Additional origins configurable via `ALLOWED_CORS_ORIGINS`.
- **Payload limits**: 500KB on `/api/activity`, 2MB on `/api/data` — enforced before DB interaction.

---

## Changelog

### v2.3.1 (June 28, 2026) — Dynamic Dashboard Pages & Interactive Sorting
- Standalone Recent Activity view listing the 5 latest active chapters per subject.
- Glassmorphic segmented navbar switcher between Chapter Table and Recent Activity views.
- Chapter search now routes to the Chapter Table and scrolls to the matched row.
- Sort selector per subject: alphabetical or Master Score (ascending/descending), persisted in localStorage.
- Active and unstarted chapters divided into separate grouping rows; score-sort only reorders started chapters.

### v2.2.2 (June 23, 2026) — Critical Extension Bug Fixes
- Fixed "Finalize & Submit" permanently stuck in a submitting state.
- Eliminated full-widget flicker on every keystroke inside the self-analysis form.
- Root cause removed: premature Shadow DOM rebuild inside `autoSaveProgress()` that fired before `sendMessage`, orphaning all callbacks and creating cyclic re-renders.
- Added `isSubmittingAnalysis` flag separate from the shared `isSaving` lock to prevent UI state corruption.
- Extension errors now surface as toast notifications instead of being silently swallowed.
- Save watchdog timeout extended to 8 seconds with clean UI recovery on network hangs.

[Full changelog →](CHANGELOG.md)

---

## License

ISC — see `package.json`.

---

<div align="center">Built for Indian competitive exam students who deserved better tooling.</div><div align="center">

