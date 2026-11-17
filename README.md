<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/lockup-horizontal-on-dark.png">
    <img src="public/brand/lockup-horizontal-on-light.png" width="380" alt="Bantay Proyekto, LGU Project Tracker">
  </picture>
</p>

<h1 align="center">LGU Tracker</h1>

<p align="center"><em>Bantay Proyekto, Gabay sa Progreso.</em> 🇵🇭</p>

<p align="center">
  A free public directory and map of Philippine infrastructure projects, with a community and a reporting desk
  built around them.
</p>

<p align="center">
  <a href="https://bantayproyekta.vercel.app/"><strong>🌐 Open the live site</strong></a>
  &nbsp;·&nbsp;
  <a href="#-features">Features</a>
  &nbsp;·&nbsp;
  <a href="#-getting-started">Run it locally</a>
  &nbsp;·&nbsp;
  <a href="#-project-status">Status</a>
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white">
  <img alt="Status: under development" src="https://img.shields.io/badge/status-under%20development-F59E0B">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/landing-dark.webp">
  <img src="docs/images/landing-light.webp" width="1280" alt="LGU Tracker landing page: the headline &quot;Track every peso. See every project.&quot; over a wall of project photos, with live counts of DPWH contracts and DILG projects">
</picture>

> 🚧 **Under active development.** Features and data are changing. The data is a snapshot, not a live feed, and LGU
> Tracker is a student project, not an official government website. See [Project status](#-project-status).

---

## 🧭 What it does

| | |
|---|---|
| 🔎 **Find** | Search more than 185,000 DPWH and DILG project records, with filters, sorting, grid and table views. |
| 🗺️ **See** | A map and a dashboard on one page, sharing the same filters. |
| 💬 **Discuss** | A live public community: discussions, replies, votes, anonymous posting and role pills. |
| 📣 **Report** | Send a concern about a project, then follow it from *Sent* to *Resolved*. |
| 🤖 **Ask** | Ask BP, an assistant that answers from the database and never writes SQL. |

**CCC181 Final Project by Team BB (BeyondBoard).**

---

## ✨ Features

### Project directory
One searchable list with an **All / DPWH / DILG** agency switch, DILG categories, filters, sort, and grid or table
views. Every DPWH contract, NEP item and DILG project has its own page with the reported fields and a link to its
source (for BetterGov.ph data, the exact dataset file and revision).

<img src="docs/images/directory.webp" width="1280" alt="Projects page with a search bar, the All/DPWH/DILG agency switch, the record count, and project cards showing status, contractor and contract amount">

### Map and dashboard, together
- **One page, one set of filters.** The dashboard sits above the map. Pick a region on the dashboard and the map
  zooms to it; filter the map and the charts follow. Marker colours follow the dashboard (by region, status or
  category), and the map stays within the Philippines.
- **DPWH layer:** contracts at the coordinates DPWH reports, up to the 2,000 largest in view. Responses are cached,
  so panning and filtering stay quick.
- **LGU layer (DILG SubayBAYAN):** 41,194 projects in clustered markers (supercluster), with category chips and
  source, region, province, city, year and status filters.
- **Approximate locations:** SubayBAYAN has no coordinates, so each project sits at the centre of its barangay, city
  or province. The panel says which one, and a toggle shows or hides the approximate ones.
- **Street View cat:** drag it onto the map to see the street there.
- **Share a project:** `/projects/map?code=FALGU-26-10-13-01-000-1` opens the LGU layer and zooms to it.

<img src="docs/images/dashboard.webp" width="1280" alt="Dashboard: 135,939 DPWH contracts, reported contract value, completed and on-going counts, contracts by region and a status donut">

<img src="docs/images/map-dpwh.webp" width="1280" alt="Project map, DPWH layer: the 2,000 largest of 130,273 mapped contracts, coloured by region, with filters above and the list of contracts in view on the right">

<img src="docs/images/map-lgu.webp" width="1280" alt="Project map, LGU layer: the layer switch, SubayBAYAN category chips with counts, and source, location, year and status filters">

### Community
A public discussion board at `/community`. Anyone can read; an account is needed to post, comment and vote.
- **Live discussions, replies and votes** that update for everyone on the page, optionally linked to a project.
- **Anonymous posting.** An anonymous item stores no name, photo or role in the public row; only its author and
  administrators can see who wrote it.
- **Role pills.** A small coloured tag beside a name: **Super Admin** (purple), **Admin** (red), **LGU** (green).
  Citizens, contractors and anonymous items have none. Admins can rename and recolour them, and give themselves a
  custom pill from their profile; a change shows everywhere at once.
- Rate limits on posting and commenting, and everyone can delete their own items.

<img src="docs/images/community.webp" width="1280" alt="Bantay Community: discussions with author pictures, role pills, vote counts and comment counts">

### Report a concern
Signed-in people can send a concern about a project at `/report`, with photos. Each report gets a short number
(like `RPT-00042`) and a status the sender can follow: **Sent → Received → In review → Resolved / Closed**.
- **My reports:** your reports and their timeline. Only you and LGU staff can see them.
- **Report queue** (staff): open a report, change its status and write back to the sender.
- **Inbox:** a notification when your report moves, your role changes, or something needs your attention.

### Accounts, profiles and roles
- **Four roles people see:** Super Admin, Admin, Government Employee and Citizen. Everyone starts as a citizen;
  asking for a role at sign-up puts the account in a queue until an administrator decides. Access is enforced in the
  database (Row Level Security), not only in the interface.
- **Users and roles** (administrators): approve or change roles. Only a Super Admin manages administrator accounts.
- **Profile:** your name, job title and a picture. Upload a photo (cropped to a square first) or pick a free avatar.
- **Monitoring workspace** (`/dashboard`) with a sidebar for staff tools, pinned to the left of every signed-in page.
- **Ratings:** one 1–5 star review per person, shown live on the landing page.

### Landing page
Live record counts, a region breakdown and a dot map of contract locations, read from cached aggregates. On a first
visit, an intro animation counts up from 0 to 100%.

<img src="docs/images/landing-coverage.webp" width="640" alt="&quot;Where the records are&quot; section: contract counts for the Luzon, Visayas and Mindanao regions beside a dot map of contract locations">

### Ask BP assistant
A chat assistant for questions about the directory, built on Groq tool calling (free tier). The model never writes
SQL. It can only call two read-only tools, and the counts in its answers come from the database. See
[`docs/BP_ASSISTANT.md`](docs/BP_ASSISTANT.md).

<img src="docs/images/ask-bp.webp" width="1280" alt="Ask BP chat panel open over the landing page with a greeting and suggested questions">

### Dark mode and mobile
Light, dark or system theme, with layouts down to 360 px wide.

<img src="docs/images/landing-mobile.webp" width="300" alt="Landing page on a 360 px wide phone screen">

---

## 📚 Data sources

| Data | Source | Retrieved | License / terms |
|---|---|---|---|
| DPWH contracts (Visayas, Mindanao, and part of Luzon: Metro Manila, Central Luzon, CALABARZON) | DPWH Transparency Portal via [BetterGov.ph](https://huggingface.co/datasets/bettergovph/dpwh-transparency-data) | Oct 26, 2026 (import incomplete) | CC0 1.0 |
| DPWH FY 2027 NEP proposals (nationwide, directory only, no coordinates) | [BetterGov.ph](https://huggingface.co/datasets/bettergovph/dpwh-nep-2027) | with the DPWH data | Not stated; the NEP is a public government document |
| LGU projects: Locally Funded Projects (LGSF) | [DILG SubayBAYAN (RBME)](https://subaybayan.dilg.gov.ph/rbme/projects/index?type=lgsf) | Oct 31, 2026 (Excel export snapshot) | Public government records (DILG) |
| LGU projects: LIME 20% Development Fund (RLIP) | [DILG SubayBAYAN (RBME)](https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip) | Oct 31, 2026 (Excel export snapshot) | Public government records (DILG) |
| Boundaries (centroids for LGU projects) | NAMRIA / PSA via [OCHA COD-AB](https://data.humdata.org/dataset/cod-ab-phl), packaged by [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) v1.1.0 (PSGC 3Q 2026) | pinned by SHA-256 | CC BY-IGO (packaging: MIT) |
| Base map | © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors | live tiles | ODbL |

All values are shown as each source published them; the LGU has not verified them. Photo credits and licenses
are on the app's `/credits` page ([source](src/app/credits/page.tsx)).

---

## 🛠️ Tech stack

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) · React 19 · TypeScript | Web app |
| Tailwind CSS v4 | Styling, light and dark themes |
| Supabase (Postgres, Auth, Storage, Realtime, Row Level Security) | Database, accounts, profile photos and report photos, live community, public read access |
| Leaflet + supercluster | Maps and marker clustering |
| motion | Landing page animation |
| Groq API (plain `fetch`, no SDK) | Ask BP assistant |
| Vercel | Hosting |

---

## 🚀 Getting started

**Prerequisites:** Node.js 22 or later, and a Supabase project with the migrations in `supabase/migrations`
applied (`supabase db push`).

```bash
git clone https://github.com/sirikitmac/lgu-tracker.git
cd lgu-tracker
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

`.env.example` explains every variable. The main ones:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`) | Reading data |
| `SUPABASE_SECRET_KEY` | Server-only: data sync and import scripts |
| `CRON_SECRET` | Server-only: the scheduled sync route |
| `GROQ_API_KEY` (optional `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`) | Server-only: Ask BP (without it, dev shows a labelled non-AI preview) |
| `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | Optional: in-map Street View |

Never commit `.env.local` or put a secret key in a `NEXT_PUBLIC_` variable.

```bash
npm test          # unit tests (DPWH, BetterGov, BP, SubayBAYAN, reports, auth, community, reviews)
npm run test:db   # database tests against an in-memory Postgres (PGlite): the migrations, row-level
                  # security, roles, reports, community, anonymous posts and role pills
npm run lint      # TypeScript type check (tsc --noEmit)
npm run build     # production build
```

**Refreshing the README pictures:** `npm i --no-save playwright && npx playwright install chromium`, then
`SHOT_BASE_URL=https://bantayproyekta.vercel.app npm run docs:screenshots` rewrites the public-page images in
`docs/images`. Look at each one before committing.

### Data pipelines

- **DPWH:** `npm run dpwh:sync`. Setup and the Vercel cron are in [`docs/DPWH_DEPLOYMENT.md`](docs/DPWH_DEPLOYMENT.md).
  The sync stops before the database passes `SYNC_STORAGE_BUDGET_MB` (default 400), which is why the Luzon import
  is partial on the free Supabase plan.
- **Sample reports:** [`docs/mock-reports.md`](docs/mock-reports.md) loads sample reports to try My reports, the queue and the inbox.
- **DILG SubayBAYAN:** a one-time Excel export, since the portal needs a sign-in. The app never contacts the portal.

```bash
npm run subaybayan:build    # Excel → normalized, categorized, located rows + docs/subaybayan/report.md
npm run subaybayan:dedupe   # flag possible DPWH duplicates (read-only)
npm run subaybayan:import -- --dry-run   # preview; then --limit 100; then no flags for everything
```

- `build` reads `<source>/Locally_Funded_Projects/*.xlsx` and `<source>/LIME_20DF/*.xlsx`. `<source>` defaults to
  `~/Downloads/SubayBayan_RBME`; change it with `SUBAYBAYAN_SOURCE_DIR` or `--source`. Boundaries are cached in
  `.cache/subaybayan` and checked by SHA-256.
- `import` needs migration `20261103000100` and `SUPABASE_SECRET_KEY`. It upserts in batches of 1,000 and skips
  unchanged rows. It stops before the database passes `SYNC_STORAGE_BUDGET_MB` (default 400).
- Categories (infrastructure, community, health and social, environment, disaster) are **LGU Tracker's own keyword
  classification**, not DILG's. Where a reported total cost is over 20× the row's own contract amount or subsidy,
  the map shows the smaller amount and keeps the original in `total_cost_reported`.
- Possible DPWH duplicates go into `subaybayan_dpwh_matches` as review flags. Records are never merged.
- Figures and known gaps: [`docs/subaybayan/report.md`](docs/subaybayan/report.md) ·
  [`docs/subaybayan/duplicates.md`](docs/subaybayan/duplicates.md).

---

## 🗂️ Project structure

```
src/
  app/            routes: / (landing), /projects, /projects/map (Map & Dashboard), /projects/[contractId],
                  /projects/source/..., /community, /report, /credits, /login, /register, /dashboard,
                  (app)/ inbox, my-reports, reports, users, profile; api/
  components/     landing/, dpwh/, subaybayan/, map/, bp/, community/, reports/, reviews/, notifications/,
                  profile/, badges/, users/, workspace/, auth/, layout/, dashboard/, ui/
  lib/            supabase/, integrations/ (dpwh, bettergov), dpwh/, subaybayan/, bp/, auth/, actions/,
                  community/, reports/, reviews/, notifications/, badges/, profile/
scripts/          dpwh-sync, bettergov-sync, subaybayan/ (build, dedupe, import), reports-import
supabase/         migrations/ (28), seed.sql
tests/            dpwh/, bettergov/, bp/, subaybayan/, reports/, auth/, community/, reviews/, notifications/,
                  sources/, db/
docs/             BP_ASSISTANT.md, DPWH_DEPLOYMENT.md, mock-reports.md, subaybayan/, images/
```

---

## 🛣️ Coming soon

Planned, or partly built but not working end to end yet:

- 🌏 **Complete Luzon coverage.** Metro Manila, Central Luzon and CALABARZON are in, but the import stopped at the
  free-plan storage budget, so those three regions are partial. Finishing it needs more database space.
- 🗺️ **Every dot on the map by default.** Wide views show a sample of up to 2,000 projects (largest first). Showing
  everything needs server-side clustering.
- 🔄 **Automated weekly DPWH sync.** The cron route and schedule are written, but it has not run in production yet.
- 💬 **Public feedback on a project page.** Discussions and reports exist; comments directly on a project do not.
- 🔍 **Review tool for possible DPWH–DILG duplicates.** The flags are stored; there is no review screen.
- 📍 **Exact barangay-level locations** from geotagged photos, with the owners' permission.
- ⚡ **Faster directory sorts.** Some non-default sorts time out on the full dataset.
- 🗓️ **Scheduled SubayBAYAN refresh.**

---

## 📌 Project status

🚧 **Under development.** Features and data may change. The data is a snapshot from the dates above, not a live
feed. LGU Tracker is a student project, not an official government website.

| Area | Status |
|---|---|
| Public directory, project pages, search and filters | ✅ Working |
| Map & Dashboard (shared filters, DPWH and LGU layers) | ✅ Working |
| Ask BP assistant | ✅ Working (needs a Groq key) |
| Accounts, roles, profiles, role pills | ✅ Working |
| Community (live, anonymous posting, votes) | ✅ Working |
| Reports, report queue and inbox | ✅ Working |
| DPWH data: Visayas, Mindanao | ✅ Imported |
| DPWH data: Metro Manila, Central Luzon, CALABARZON | 🟡 Partial (storage limit) |
| Scheduled data refresh | 🟡 Written, not yet running in production |
| Duplicate review, exact locations | ⏳ Planned |

---

## 👥 Contributing

Bug reports, suggestions and pull requests are welcome. Work on a feature branch, run `npm test`, `npm run lint`
and `npm run build` before opening a PR, and talk to the maintainers before making large changes.

**CCC181 Final Project by Team BB (BeyondBoard).**

---

**LGU Tracker — Bantay Proyekto, Gabay sa Progreso.** 🇵🇭
