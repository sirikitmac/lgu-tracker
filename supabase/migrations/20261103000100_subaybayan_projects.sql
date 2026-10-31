-- =============================================================================
-- DILG SubayBAYAN projects (LGSF and RLIP / LIME 20% DF exports) and a review
-- table for possible duplicates against DPWH contracts.
--
-- Additive only: no existing table, view, function or row is changed.
-- dpwh_contracts, infrastructure_projects and project_directory are untouched;
-- duplicate candidates are recorded as flags in subaybayan_dpwh_matches and
-- are never merged. subaybayan_dpwh_matches.dpwh_contract_id deliberately has
-- no foreign key, so nothing here constrains or cascades into dpwh_contracts.
--
-- Data: written only by the service role (scripts/subaybayan/import.ts).
-- Read: public (anon + authenticated), like the other imported public data.
-- Not stored (privacy and the 500 MB plan): PCAB licence, contractor address,
-- Google Drive / MOV links, remarks and findings text, the raw source row.
-- =============================================================================

create table public.subaybayan_projects (
  id                      text primary key check (length(id) between 1 and 80),
  source_agency           text not null default 'DILG' check (source_agency = 'DILG'),
  source_dataset          text not null check (source_dataset in ('lgsf', 'rlip')),
  project_code            text,
  title                   text not null,

  -- LGU Tracker's own classification (not an official DILG category)
  sector_category         text not null check (sector_category in ('infrastructure', 'community', 'health', 'environment', 'disaster', 'uncategorized')),
  sector_subcategory      text,
  classification_reason   text not null,

  -- Location as written in the source, and the PSGC match
  region                  text,
  province                text,
  citymun                 text,
  barangay                text,
  psgc_region             text check (psgc_region ~ '^\d{10}$'),
  psgc_province           text check (psgc_province ~ '^\d{10}$'),
  psgc_citymun            text check (psgc_citymun ~ '^\d{10}$'),
  psgc_barangay           text check (psgc_barangay ~ '^\d{10}$'),
  -- Area centroid (representative point), never a project site
  latitude                double precision,
  longitude               double precision,
  location_precision      text not null check (location_precision in ('barangay_centroid', 'municipality_centroid', 'province_centroid', 'unresolved')),

  funding_year            smallint check (funding_year between 1990 and 2100),
  status                  text not null check (status in ('completed', 'ongoing', 'not_yet_started', 'cancelled', 'unknown')),
  status_raw              text,
  project_type            text,
  program                 text,
  sector                  text,
  mode_of_implementation  text,
  total_cost              numeric(16, 2) check (total_cost >= 0),
  national_subsidy        numeric(16, 2) check (national_subsidy >= 0),
  lgu_counterpart         numeric(16, 2) check (lgu_counterpart >= 0),
  owpa                    numeric(5, 2) check (owpa between 0 and 100),
  contractor              text,
  project_owner           text,
  approval_status         text,
  geotagged_photos        integer check (geotagged_photos >= 0),
  size_text               text,
  beneficiaries_text      text,
  component_details       text,
  start_date              date,
  end_date                date,

  -- Provenance
  source_file             text,
  source_batch            integer,
  source_row              integer,
  source_url              text not null check (source_url like 'https://subaybayan.dilg.gov.ph/%'),
  retrieved_at            date not null,
  source_hash             text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint subaybayan_projects_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null
        and latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint subaybayan_projects_unresolved_check check ((location_precision = 'unresolved') = (latitude is null))
);

comment on table public.subaybayan_projects is
  'DILG SubayBAYAN (RBME) project snapshot. Coordinates are PSGC area centroids, not project sites; sector_category is LGU Tracker''s own classification.';

create index subaybayan_projects_category_idx on public.subaybayan_projects (sector_category);
create index subaybayan_projects_place_idx on public.subaybayan_projects (region, province, citymun);
create index subaybayan_projects_year_idx on public.subaybayan_projects (funding_year);
create index subaybayan_projects_status_idx on public.subaybayan_projects (status);
create index subaybayan_projects_precision_idx on public.subaybayan_projects (location_precision);
create index subaybayan_projects_coords_idx on public.subaybayan_projects (latitude, longitude) where latitude is not null;
create index subaybayan_projects_code_idx on public.subaybayan_projects (project_code) where project_code is not null;

create trigger subaybayan_projects_set_updated_at before update on public.subaybayan_projects
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Possible duplicates against DPWH contracts (review flags, never merges)
-- -----------------------------------------------------------------------------
create table public.subaybayan_dpwh_matches (
  subaybayan_id     text not null references public.subaybayan_projects (id) on delete cascade,
  dpwh_contract_id  text not null,
  match_class       text not null check (match_class in ('exact', 'potential')),
  rank              smallint not null check (rank between 1 and 10),
  score             numeric(4, 3) not null check (score between 0 and 1),
  reasons           text[] not null,
  evidence          jsonb not null,
  review_status     text not null default 'unreviewed' check (review_status in ('unreviewed', 'same_project', 'different_project')),
  reviewed_at       timestamptz,
  detected_at       timestamptz not null default now(),
  primary key (subaybayan_id, dpwh_contract_id)
);

comment on table public.subaybayan_dpwh_matches is
  'Possible DILG SubayBAYAN / DPWH duplicates from scripts/subaybayan/dedupe.ts. Flags for review only: both records stay in their own tables.';

create index subaybayan_dpwh_matches_contract_idx on public.subaybayan_dpwh_matches (dpwh_contract_id);

-- -----------------------------------------------------------------------------
-- RLS and grants: public read, writes only by the service role
-- -----------------------------------------------------------------------------
alter table public.subaybayan_projects enable row level security;
alter table public.subaybayan_dpwh_matches enable row level security;

revoke all on public.subaybayan_projects, public.subaybayan_dpwh_matches from anon, authenticated;
grant select on public.subaybayan_projects, public.subaybayan_dpwh_matches to anon, authenticated;
grant select, insert, update, delete on public.subaybayan_projects, public.subaybayan_dpwh_matches to service_role;

create policy "subaybayan projects: public read"
  on public.subaybayan_projects for select to anon, authenticated using (true);
create policy "subaybayan dpwh matches: public read"
  on public.subaybayan_dpwh_matches for select to anon, authenticated using (true);
