# 🏗️ LGU Tracker
### *Bantay Proyekto, Gabay sa Progreso.* 🇵🇭
<img width="1897" height="899" alt="image" src="https://github.com/user-attachments/assets/f17dfa2c-c6a3-4457-a79b-756b07536620" />
<img width="1343" height="810" alt="image" src="https://github.com/user-attachments/assets/8b7e1cb9-bbe9-421a-ac4a-f509da825367" />




**LGU Tracker** is a web-based infrastructure project monitoring platform designed to improve public access to project information through interactive maps, searchable project directories, and centralized project data.

Our goal is to make infrastructure projects easier to find, monitor, and understand—promoting transparency, accessibility, and public participation in local development. 💙

---

## ✨ Key Features

- 🗺️ **Interactive Project Map** — Explore infrastructure projects through a map-based interface.
- 🔎 **Project Directory** — Search, browse, and filter infrastructure project records.
- 📋 **Project Details** — View available information about individual infrastructure projects.
- 📱 **Responsive Interface** — Access the platform through a modern web interface.
- 🏛️ **Public Transparency** — Make infrastructure project information more accessible to communities.

> 🚧 Some features depend on backend integration, database configuration, and data availability. The project is currently under active development.

---

## 🚀 Upcoming Features

We're working toward making LGU Tracker more interactive, reliable, and useful for both the public and authorized project members.

- 📍 **Map Markers & Project Locations** — Display infrastructure projects as markers on the map, allowing users to explore projects by location.
- 💬 **Public Feedback System** — Allow users to submit feedback, observations, and concerns about infrastructure projects.
- 🔄 **Automated Weekly Data Synchronization** — Synchronize available DPWH project data from [BetterGov.ph](https://bettergov.ph/) on a weekly schedule.
- 📝 **Project Reporting System** — Enable registered members to submit reports about project progress, issues, and other relevant observations.
- 🔐 **Authentication & Role-Based Access Control** — Implement secure login and permissions for different user roles.
- 👥 **Member Dashboard** — Provide authorized members with a dedicated space to manage their project-related activities.
- 🗄️ **Backend & Database Integration** — Support project records, user accounts, feedback, reports, and other platform functionality through a centralized backend.
- 📊 **Project Monitoring & Status Updates** — Help users track project information and monitor reported developments.

*Feature availability may change as development progresses.*

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| ⚛️ Next.js | Web application framework |
| 📘 TypeScript | Type-safe development |
| 🎨 Tailwind CSS | User interface styling |
| 🗄️ Supabase | Database and backend services |
| 🗺️ Leaflet | Interactive maps |
| 🚀 Vercel | Planned hosting and deployment |

---

## 📚 Data Sources

| Data | Source | Retrieved | License / terms |
|---|---|---|---|
| DPWH contracts | DPWH project data via [BetterGov.ph](https://bettergov.ph) (Hugging Face snapshot) | see `/projects/dashboard` | as published by the source |
| LGU projects: Locally Funded Projects (LGSF) | [DILG SubayBAYAN (RBME)](https://subaybayan.dilg.gov.ph/rbme/projects/index?type=lgsf) | Oct 31, 2026 (Excel export snapshot) | public government data as published by DILG |
| LGU projects: Local Infrastructure Monitoring and Evaluation, 20% DF (RLIP) | [DILG SubayBAYAN (RBME)](https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip) | Oct 31, 2026 (Excel export snapshot) | public government data as published by DILG |
| PSGC boundaries (centroids for LGU projects) | [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) release v1.1.0, `geojson-lowres.zip` (PSGC 3Q 2026) | pinned by SHA-256 | MIT; underlying boundaries NAMRIA / PSA via [OCHA COD-AB](https://data.humdata.org/dataset/cod-ab-phl), CC BY-IGO |
| Base map | © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors | live tiles | ODbL |

Notes on the SubayBAYAN layer (`/projects/map?layer=subaybayan`):

- The portal needs a sign-in, so the data is a one-time export; the app never contacts the portal.
- SubayBAYAN has no coordinates. Each project is placed at the representative point of its barangay, city/municipality or province polygon (**area centroid, not the project site**).
- Categories (infrastructure, community, health, environment, disaster) are **LGU Tracker's own keyword classification**, not an official DILG category.
- Possible duplicates with DPWH contracts are recorded as review flags in `subaybayan_dpwh_matches` (admin-only); records are never merged.
- Pipeline figures and known gaps: [`docs/subaybayan/report.md`](docs/subaybayan/report.md) and [`docs/subaybayan/duplicates.md`](docs/subaybayan/duplicates.md).

### Re-running the SubayBAYAN pipeline and import

```bash
# 1. Excel exports → normalized, categorized, located rows + docs/subaybayan/report.md
#    Reads <source>/Locally_Funded_Projects/*.xlsx and <source>/LIME_20DF/*.xlsx (read-only).
#    <source> defaults to ~/Downloads/SubayBayan_RBME (or set SUBAYBAYAN_SOURCE_DIR / --source).
#    Boundaries are downloaded once into .cache/subaybayan (gitignored) and checked by SHA-256.
npm run subaybayan:build

# 2. Flag possible duplicates against dpwh_contracts (read-only; --refresh re-reads DPWH)
npm run subaybayan:dedupe

# 3. Import (needs migration 20261103000100 and SUPABASE_SECRET_KEY in .env.local, server-side only)
npm run subaybayan:import -- --dry-run     # what would change
npm run subaybayan:import -- --limit 100   # first rows, then check them
npm run subaybayan:import                  # everything; unchanged rows are skipped
```

The importer upserts in batches of 1,000, skips rows whose `source_hash` is unchanged, stops before the
database passes `SYNC_STORAGE_BUDGET_MB` (default 400 MB), and checks that `dpwh_contracts` is unchanged.

---

## 🎯 Project Goals

LGU Tracker aims to:

- 🏛️ Improve public access to infrastructure project information.
- 🗺️ Make project locations easier to identify and explore.
- 🤝 Encourage public participation through feedback and reporting.
- 🔍 Support transparency and accountability in infrastructure development.
- 📈 Provide a foundation for more accessible and organized project monitoring.

---

## 👥 Contributing

Contributions, suggestions, and feedback are welcome! 💙

If you're interested in improving LGU Tracker, you can help by:

- 🐛 Reporting bugs and issues.
- 💡 Suggesting new features.
- 🎨 Improving the user interface and user experience.
- 💻 Contributing code through feature branches and pull requests.
- 📖 Improving project documentation.

Please coordinate with the project maintainers before making significant changes.

---

## 📌 Project Status

🚧 **Currently in development.**

LGU Tracker is being developed incrementally, with ongoing work on its interface, interactive map, project directory, database integration, and supporting functionality.

Some features listed above are planned or still being integrated and may not yet be available in a deployed environment.

---

### 💙 Built with the goal of making infrastructure information more accessible to everyone.

**LGU Tracker — Bantay Proyekto, Gabay sa Progreso.** 🇵🇭
