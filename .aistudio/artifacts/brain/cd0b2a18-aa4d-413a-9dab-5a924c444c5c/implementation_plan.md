# LGU Tracker — Bantay Proyekto, Gabay sa Progreso

An accessible, transparent Local Government Unit (LGU) Project Monitoring System built for CCC181 by Team BB (BeyondBoard) to track public infrastructure, social programs, budget allocations, and project lifecycles across Philippine local government sectors.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and UX decisions incorporate your confirmed preferences from our initial clarification step, alongside architectural migration details for the workspace.

- **Confirmed Decision 1 — "Explore Public Projects" Workflow**: Clicking **Explore Public Projects** on the landing page routes users directly to the Main Dashboard in **Public Transparency Mode**, providing full read-only visibility into LGU project progress, budgets, and timelines without requiring sign-in.
- **Confirmed Decision 2 — Dashboard Presentation & Detail Inspection**: The Main Dashboard features a view switcher allowing users to toggle seamlessly between a **Structured Data Table** and a **Project Cards Grid**, with a slide-over **Project Detail Drawer** for inspecting milestones, procurement stages, implementing offices, and budget utilization.
- **Confirmed Decision 3 — Philippine LGU Project Categories**: Filters and clearly labeled sample records are organized around four core LGU sectors: **Infrastructure and Public Works**, **Education and Youth Development**, **Disaster Risk Reduction and Management**, and **Health and Sanitation**.
- **Framework Alignment — Next.js App Router**: Because the initial workspace template was provisioned with Vite, we will transition the runtime to **Next.js with the App Router** (`next`), TypeScript, and Tailwind CSS, accompanied by a typed Supabase client configuration module prepared for future backend connectivity.

---

## 1. Overview & Core Concept

- **What It Does**: LGU Tracker provides a unified civic monitoring interface where citizens and LGU personnel can oversee local government projects from initial proposal and procurement through implementation and completion.
- **Target Audience / Persona**:
  - **Citizens & Civil Society**: Residents seeking transparent, easily verifiable updates on barangay and municipal projects and public fund utilization.
  - **LGU Project Officers & Administrators**: Local government staff monitoring project schedules, budget disbursements, and sector deliverables.
- **Key Value**: Bridges the gap between internal municipal project tracking and public accountability through clear data hierarchy, structured lifecycle tracking, and an approachable Philippine civic tech interface.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Public Landing & Orientation Flow**:
   - Visitors arrive at the Landing Page featuring the **LGU Tracker** top navigation bar, the hero section with the tagline *"Bantay Proyekto, Gabay sa Progreso."*, and a high-level summary of the system's civic mission.
   - Users review the **Core Capabilities** (Project Monitoring, Budget Tracking, Procurement Management, and Public Transparency) and the **4-Stage LGU Project Lifecycle** (Planning & Budgeting → Procurement & Bidding → Implementation & Monitoring → Completion & Public Audit).
   - Clicking **Explore Public Projects** opens the Main Dashboard in Public Transparency Mode; clicking **Access Dashboard** or **Sign In** navigates to the Login Page (or directly to the dashboard switcher).
2. **Official Authentication Flow (Supabase-Ready)**:
   - On the Login Page, LGU personnel enter their institutional email and password, toggle password visibility with the accessible show/hide control, or trigger the forgot-password recovery guidance modal/view.
   - Submitting the form executes client-side validation (checking required fields and institutional email formatting) and invokes the modular Supabase Auth handler. When Supabase environment variables are not yet connected, the interface displays a clear, honest configuration status banner explaining that live authentication awaits Supabase project credentials, while offering a clearly labeled **Continue with Demo LGU Session** action to preview the authenticated dashboard layout.
3. **Dashboard Monitoring & Filtering Flow**:
   - Users view a clearly labeled **Sample Data Notice** banner confirming that displayed figures are illustrative for the CCC181 prototype and not official government statistics.
   - Four summary KPI cards display **Total Projects**, **Projects In Progress**, **Completed Projects**, and **Total Allocated Budget** (formatted in Philippine Pesos `₱` with tabular numerals) that dynamically reflect active filters or overall totals.
   - Users search by project title, reference code, or barangay location, filter by the 4 confirmed LGU categories and project statuses (*Planned*, *Procurement*, *In Progress*, *Completed*, *Delayed*), and switch between **Table View** and **Card Grid View**.
   - Clicking any project row or "View Details" action opens the **Project Detail Drawer** displaying full budget breakdown, contractor/implementing office details, barangay location, and lifecycle stage progress.

### Visual Identity & Theme

- **Aesthetic Direction**: Trustworthy Philippine Civic Technology — structured, institutional, calm, and high-contrast, avoiding neon glows, dark-mode sci-fi tropes, or cluttered decorative chrome.
- **Color Palette & Mood**:
  - **Dominant Canvas (60%)**: Off-White (`#F8FAFC`) primary workspace background paired with crisp White (`#FFFFFF`) card and table surfaces.
  - **Structural & Brand Authority (30%)**: Deep Navy (`#172B4D`) for primary brand headers, sidebar shell, and authoritative headings; Slate Gray (`#64748B`) for secondary prose and metadata; Border Gray (`#E2E8F0`) for clean `1px` structural dividers.
  - **Focused Accents & Semantic States (10%)**: Civic Blue (`#2563EB`) for primary interactive CTAs and active navigation states; Warm Orange (`#F59E0B`) used sparingly for key highlights, active filter indicators, and in-progress attention states; Success Green (`#16A34A`) reserved strictly for completed states and verified milestones.
- **Typography & Hierarchy**:
  - **Display & Headings**: `Plus Jakarta Sans` (SemiBold/Bold, tight tracking) for institutional clarity across page titles and section headers.
  - **Body & UI Controls**: `Public Sans` (Regular/Medium) for high legibility in forms, descriptions, and navigation.
  - **Financial & Numerical Data**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for PHP (`₱`) budget figures, physical accomplishment percentages, project IDs, and target dates.
- **Component Styling & Layout**:
  - **Top Bar Contract**: Landing page navigation follows a clean three-zone layout separated by `gap-8` (Single-line LGU Tracker brand mark on the left, 4 single-line anchor/route links in the center, and 1 primary CTA on the right).
  - **Single-Elevation Depth**: Flat white containers bordered by `1px solid #E2E8F0` (`border-slate-200`) with generous internal padding (`24px`) and zero nested card-in-card clutter.
- **Interactive Feedback & Motion**:
  - Instant client-side filtering and view toggling (`<150ms`), keyboard-accessible slide-over drawer (`Escape` to close, focus management), and clear empty states with a single-click **Reset Filters** button when search queries match zero projects.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Next.js App Router Architecture over Vite Template**
  - *Chosen Approach*: Configure Next.js App Router as the application runtime with dedicated routes for Landing (`/`), Login (`/login`), and Dashboard (`/dashboard`), backed by shared modular components.
  - *Why*: Directly fulfills the mandatory technology stack requirement while providing clean URL-based routing, layouts, and future server/client boundary readiness for Team BB's CCC181 project.
  - *Alternatives Considered*: Keeping the default Vite SPA router was rejected because the specification explicitly mandates Next.js with the App Router and forbids Vite.
- **Decision 2 — Honest Supabase Auth & Database Readiness Layer**
  - *Chosen Approach*: Create a strongly typed Supabase client helper and service layer that reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. When credentials are not yet configured in the environment, the Login page validates inputs thoroughly and clearly informs the user that live Supabase Auth is in standby mode, rather than faking a backend login or hardcoding fake passwords.
  - *Why*: Respects the requirement not to invent credentials or misrepresent mock backend authentication as live, while giving Team BB a drop-in integration point for their Supabase tables and Auth policies.
- **Decision 3 — Unified Dashboard with Public Transparency & Staff Modes**
  - *Chosen Approach*: Use a reusable Dashboard Shell that adapts its header banner and contextual actions based on whether the user entered via **Explore Public Projects** (Public Transparency Mode) or **Access Dashboard** (LGU Monitoring View).
  - *Why*: Keeps the layout modular and extensible for future role-specific views (e.g., BAC Procurement Officer, Municipal Engineer, Barangay Captain) without duplicating table and filter logic.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Next.js App Router Layout Shell                      │
│                  (Typography, Civic Color Tokens, Metadata)                 │
└───────────────┬──────────────────────────────┬──────────────────────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────────┐  ┌──────────────────────────────────────────┐
│     Public & Auth Routes      │  │         Dashboard Workspace Shell        │
│ ┌───────────────────────────┐ │  │ ┌──────────────────┐ ┌─────────────────┐ │
│ │       Landing Page        │ │  │ │   Sidebar Nav    │ │   Top Header    │ │
│ │  - Top Navbar (3-Zone)    │ │  │ │  - Overview      │ │  - Mode Switch  │ │
│ │  - Hero & Tagline         │ │  │ │  - Public Portal │ │  - Breadcrumbs  │ │
│ │  - 4 Core Feature Cards   │ │  │ │  - Sign In Link  │ │  - Sample Badge │ │
│ │  - 4-Step Lifecycle Strip │ │  │ └──────────────────┘ └─────────────────┘ │
│ └─────────────┬─────────────┘ │  │ ┌──────────────────────────────────────┐ │
│               │               │  │ │     KPI Summary Cards (4 Metrics)    │ │
│               ▼               │  │ │ Total │ In Progress │ Done │ Budget  │ │
│ ┌───────────────────────────┐ │  │ └──────────────────┬───────────────────┘ │
│ │        Login Page         │ │  │                    ▼                     │
│ │  - Email & Password Input │ │  │ ┌──────────────────────────────────────┐ │
│ │  - Show/Hide Password     │ │  │ │   Search, Category & Status Toolbar  │ │
│ │  - Forgot Password Modal  │ │  │ │   + Table / Card Grid View Toggle    │ │
│ │  - Validation & Standby   │ │  │ └──────────────────┬───────────────────┘ │
│ └─────────────┬─────────────┘ │  │                    ▼                     │
└───────────────┼───────────────┘  │ ┌──────────────────────────────────────┐ │
                │                  │ │  Project Table / Card Grid + Drawer  │ │
                │                  │ └──────────────────┬───────────────────┘ │
                │                  └────────────────────┼─────────────────────┘
                ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               Typed Data Layer & Supabase Integration Module                │
│  - Strongly Typed Interfaces (LGUProject, ProjectCategory, ProjectStatus)   │
│  - Supabase Client & Auth Readiness Adapter (Environment-Aware)             │
│  - Clearly Labeled Sample LGU Dataset (4 Confirmed Categories)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`LGUProject` Entity**:
  - `id`: Project reference code (e.g., `PRJ-2026-INF-001`)
  - `title`: Official project name
  - `category`: Union type of `'Infrastructure and Public Works' | 'Education and Youth Development' | 'Disaster Risk Reduction and Management' | 'Health and Sanitation'`
  - `status`: Union type of `'In Progress' | 'Completed' | 'Procurement' | 'Planned' | 'Delayed'`
  - `barangay`: Specific barangay or municipal scope
  - `implementingOffice`: Responsible LGU department (e.g., *Municipal Engineering Office*, *Municipal Health Office*, *MDRRMO*)
  - `allocatedBudget`: Numeric PHP value (`number`) formatted via `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`
  - `disbursedBudget`: Numeric PHP value (`number`) for financial utilization tracking
  - `progressPercentage`: Physical accomplishment (`0`–`100`)
  - `startDate` & `targetCompletionDate`: ISO date strings formatted for display
  - `lifecycleStage`: Current stage in the 4-step LGU project lifecycle
  - `description` & `milestones`: Summary scope and checklist of verified project deliverables

### Interactive Component & State Mapping

- **Landing Page Navigation & CTAs**:
  - Top bar links smoothly scroll to `#features` and `#lifecycle` sections or navigate to `/dashboard?mode=public` and `/login`.
  - Primary CTA (**Explore Public Projects**) navigates to `/dashboard?mode=public`; Secondary CTA (**Access Dashboard**) navigates to `/dashboard`.
- **Login Form & Recovery Controls**:
  - Controlled inputs for `email` and `password` with real-time error clearing on change.
  - `showPassword` boolean state toggles input type between `password` and `text` with accessible `aria-label` updates.
  - **Forgot Password** link opens an inline recovery view explaining LGU IT administrator reset procedures and Supabase password reset email readiness.
  - Form submission validates non-empty fields and valid email structure; if Supabase environment variables are absent, it renders a transparent configuration notice alongside a button to preview the dashboard.
- **Dashboard Filtering, View Switching & Detail Drawer**:
  - `searchQuery`, `selectedCategory`, and `selectedStatus` states filter the sample project dataset in real time and optionally recalculate or highlight matching project counts.
  - `viewMode` state (`'table' | 'grid'`) switches between a high-density tabular view and a responsive 2/3-column card layout.
  - `selectedProject` state controls the slide-over **Project Detail Drawer**, allowing users to inspect complete financial, procurement, and milestone information for any project.
