# LGU Tracker

**Bantay Proyekto, Gabay sa Progreso.**

LGU Tracker is a web-based infrastructure project monitoring platform designed to improve public access to infrastructure project information through interactive maps, searchable project directories, and centralized project data.

The project aims to make infrastructure information more accessible and easier to explore by providing a platform where users can browse projects, view available project details, and explore geographic locations.

## Overview

LGU Tracker is being developed to support transparency and accessibility in infrastructure project monitoring.

The platform is designed to provide a centralized interface for exploring infrastructure projects and their available information.

## Key Features

- **Public Project Directory** — Browse and search infrastructure project records.
- **Interactive Project Map** — Explore project locations using an interactive map.
- **Project Search and Filtering** — Find projects using available identifiers, descriptions, locations, and categories.
- **Project Details** — View available project information and source references.
- **DPWH Data Integration** — Planned integration with publicly available DPWH project data through BetterGov.ph.
- **Database Integration** — Supabase integration for project data and authentication.
- **Responsive Interface** — A web interface designed for accessibility across different screen sizes.

*Feature availability depends on the current implementation and data integration status.*

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Web application framework |
| React | User interface development |
| TypeScript | Type-safe application development |
| Tailwind CSS | Styling and interface design |
| Supabase | Database and authentication services |
| Leaflet | Interactive map rendering |
| Vercel | Intended application hosting and deployment |

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js compatible with the project's dependencies
- npm
- Git

You will also need access to the repository and any required development environment configuration.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/sirikitmac/lgu-tracker.git
   ```

2. Navigate to the project directory:

   ```bash
   cd lgu-tracker
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure the required environment variables in a local `.env.local` file. Refer to the project's environment variable documentation for the required names and values.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local development address shown in the terminal, typically:

   `http://localhost:3000`

## Project Structure

The project follows the Next.js App Router structure.

```text
src/
├── app/          # Application routes and pages
├── components/   # Reusable UI components
├── data/         # Sample or development data
├── lib/          # Application logic and integrations
└── types/        # TypeScript type definitions

supabase/
└── migrations/   # Database schema migrations
```

*The directory structure may evolve as development continues.*

## Data Sources

The project is exploring integration with publicly available DPWH infrastructure project information through BetterGov.ph.

Source attribution, available project details, and data freshness should be documented as the integration progresses.

Project information displayed by the application should be interpreted according to its source and verification status.

## Contributing

Project collaborators are encouraged to contribute through the repository's established development workflow.

Before submitting changes:

1. Review the existing code and project structure.
2. Create a branch for your changes.
3. Keep changes focused on the task being addressed.
4. Test relevant functionality.
5. Submit a pull request or follow the team's agreed review process.

## Project Status

LGU Tracker is currently under active development.

Features, integrations, and deployment configuration may change as development progresses.

## License

No license has been specified yet. Usage, modification, and redistribution permissions should be established by the project owners before the repository is distributed publicly.
