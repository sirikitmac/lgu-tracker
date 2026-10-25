-- =============================================================================
-- LGU Tracker · LOCAL DEVELOPMENT SEED (generated from src/data/sampleProjects.ts)
-- =============================================================================
-- Development-only sample data for the CCC181 Final Project by Team BB
-- (BeyondBoard). NOT official government records.
--
-- Runs automatically on `supabase db reset` against the LOCAL stack only.
-- `supabase db push` does NOT run this file unless you pass --include-seed.
-- Do not load it into a production database.
-- =============================================================================

insert into public.organizations (name, org_type) values
  ('City Engineer’s Office (CEO)', 'lgu_office'),
  ('City Health Office (CHO)', 'lgu_office'),
  ('City Disaster Risk Reduction & Management Office (CDRRMO)', 'lgu_office'),
  ('Local School Board & City Engineer’s Office', 'lgu_office'),
  ('City Engineer’s Office & ICWS Sanitation Unit', 'lgu_office'),
  ('Local Youth Development Office (LYDO)', 'lgu_office'),
  ('City Engineer’s Office & CDRRMO', 'lgu_office')
on conflict (name) do nothing;

insert into public.organizations (name, org_type) values
  ('Kapatagan Civil Works & Construction Corp. (Sample)', 'contractor'),
  ('Mindanao MedBuild Builders Inc. (Sample)', 'contractor'),
  ('Archipelago Resilient Systems Co. (Sample)', 'contractor'),
  ('Sinag Clean Energy Builders Inc. (Sample)', 'contractor'),
  ('Northern Mindanao Hydro Engineering Services (Sample)', 'contractor'),
  ('Talino Civic Tech & Interiors Co. (Sample)', 'contractor')
on conflict (name) do nothing;

insert into public.projects (
  reference_code, title, description, category, status, lifecycle_stage, visibility,
  barangay, municipality, latitude, longitude, implementing_office, contractor_or_partner,
  procurement_mode, allocated_budget, disbursed_budget, progress_percentage,
  start_date, target_completion_date, beneficiaries, image_url, image_caption, updated_at
) values
  ('LGU-2026-INF-014', 'Hinaplanon Access Road Concreting', 'Concreting of 1.85 linear kilometers of two-lane PCCP road network with reinforced concrete lined canal and solar road studs in Barangay Hinaplanon, Iligan City.',
   'infrastructure_public_works', 'in_progress', 'implementation', 'published',
   'Barangay Hinaplanon', 'Iligan City (Sample Demo Data)', 8.2458, 124.2594,
   'City Engineer’s Office (CEO)', 'Kapatagan Civil Works & Construction Corp. (Sample)', 'Competitive Public Bidding (RA 9184)',
   14850000, 9652500, 68,
   '2026-06-15', '2026-12-20', '1,420 households and agricultural commuters in Brgy. Hinaplanon',
   null, 'Site Inspection Placeholder · Brgy. Hinaplanon Road Concreting', '2026-10-18'),
  ('LGU-2026-HLT-008', 'Tubod Health Station & Birthing Facility', 'Structural expansion of the Barangay Tubod health station, installation of DOH-compliant maternal delivery room, cold-chain vaccine storage, and medical waste sanitation unit.',
   'health_sanitation', 'completed', 'completion', 'published',
   'Barangay Tubod', 'Iligan City (Sample Demo Data)', 8.2145, 124.2418,
   'City Health Office (CHO)', 'Mindanao MedBuild Builders Inc. (Sample)', 'Competitive Public Bidding (RA 9184)',
   6400000, 6320000, 100,
   '2026-02-10', '2026-08-30', '3,850 residents across Barangay Tubod and neighboring puroks',
   null, 'Completed Facility Placeholder · Brgy. Tubod Health Station', '2026-09-04'),
  ('LGU-2026-DRR-019', 'Mandulog River Flood Warning System', 'Deployment of ultrasonic water-level sensors along the Mandulog River basin, multi-directional sirens, and a 25kWp hybrid solar battery array at the evacuation center.',
   'disaster_risk_reduction', 'in_progress', 'implementation', 'published',
   'Barangay Sta. Filomena', 'Iligan City (Sample Demo Data)', 8.2612, 124.2585,
   'City Disaster Risk Reduction & Management Office (CDRRMO)', 'Archipelago Resilient Systems Co. (Sample)', 'Competitive Public Bidding (RA 9184)',
   8950000, 5370000, 60,
   '2026-07-01', '2026-11-30', '6,200 residents in flood-prone zones of Barangay Sta. Filomena',
   null, 'Sensor Tower Site Placeholder · Brgy. Sta. Filomena', '2026-10-21'),
  ('LGU-2026-EDU-011', 'Tibanga Two-Storey Academic Building', 'Construction of a typhoon-resilient two-storey public school building in Barangay Tibanga funded under the Special Education Fund (SEF), equipped with a 40-seat ICT laboratory.',
   'education_youth_development', 'procurement', 'procurement', 'published',
   'Barangay Tibanga', 'Iligan City (Sample Demo Data)', 8.2414, 124.2442,
   'Local School Board & City Engineer’s Office', 'Post-Qualification Evaluation in Progress (BAC)', 'Competitive Public Bidding (Special Education Fund)',
   18200000, 0, 15,
   '2026-11-15', '2027-06-30', '540 public school students in Barangay Tibanga',
   null, 'Proposed School Site Placeholder · Brgy. Tibanga', '2026-10-22'),
  ('LGU-2026-INF-023', 'Poblacion Solar LED Streetlights', 'Supply and installation of 180 galvanized steel tapered poles with integrated 120W lithium-iron-phosphate solar LED luminaires along Roxas and Quezon Avenue in Barangay Poblacion.',
   'infrastructure_public_works', 'completed', 'completion', 'published',
   'Barangay Poblacion', 'Iligan City (Sample Demo Data)', 8.2286, 124.2404,
   'City Engineer’s Office (CEO)', 'Sinag Clean Energy Builders Inc. (Sample)', 'Competitive Public Bidding (RA 9184)',
   5600000, 5540000, 100,
   '2026-03-01', '2026-07-15', '9,500 residents, evening commuters, and commercial establishments',
   null, 'Solar Streetlighting Placeholder · Brgy. Poblacion', '2026-07-20'),
  ('LGU-2026-HLT-015', 'Suarez Potable Water Supply Expansion', 'Elevated 50-cubic-meter steel water tank construction and 4.2km HDPE distribution pipeline with automated inline water chlorination serving upland sitios of Barangay Suarez.',
   'health_sanitation', 'delayed', 'implementation', 'published',
   'Barangay Suarez', 'Iligan City (Sample Demo Data)', 8.1915, 124.2162,
   'City Engineer’s Office & ICWS Sanitation Unit', 'Northern Mindanao Hydro Engineering Services (Sample)', 'Competitive Public Bidding (RA 9184)',
   11250000, 4500000, 44,
   '2026-04-05', '2026-10-15', '780 households in Barangay Suarez, Iligan City',
   null, 'Water Tank Foundation Placeholder · Brgy. Suarez', '2026-10-20'),
  ('LGU-2026-EDU-027', 'Pala-o Youth Digital Literacy & E-Library', 'Renovation of the community annex in Barangay Pala-o into a 35-workstation youth digital learning hub with fiber internet redundancy, study carrels, and open-access terminals.',
   'education_youth_development', 'in_progress', 'implementation', 'published',
   'Barangay Pala-o', 'Iligan City (Sample Demo Data)', 8.2254, 124.2531,
   'Local Youth Development Office (LYDO)', 'Talino Civic Tech & Interiors Co. (Sample)', 'Public Bidding / Goods & Civil Works',
   4350000, 3045000, 76,
   '2026-07-10', '2026-11-15', '2,100 youth, students, and Sangguniang Kabataan members in Brgy. Pala-o',
   null, 'E-Library Interior Placeholder · Brgy. Pala-o', '2026-10-19'),
  ('LGU-2026-DRR-031', 'Mahayahay River Flood Control Dike', 'Construction of 320 linear meters of stepped PVC-coated gabion riverbank protection wall with geotextile membrane in Barangay Mahayahay to mitigate river scouring.',
   'disaster_risk_reduction', 'planned', 'planning', 'published',
   'Barangay Mahayahay', 'Iligan City (Sample Demo Data)', 8.2192, 124.2485,
   'City Engineer’s Office & CDRRMO', 'Scheduled for Q4 2026 Bidding', 'Competitive Public Bidding (LDRRMF 70% Mitigation Fund)',
   16500000, 0, 5,
   '2026-12-01', '2027-05-30', '1,150 riverfront residents in Barangay Mahayahay, Iligan City',
   null, 'Riverbank Revetment Alignment Placeholder · Brgy. Mahayahay', '2026-10-17'),
  ('LGU-2026-HLT-034', 'Rogongon Mobile Clinic & Cold-Chain', 'Procurement of solar-powered cold-chain vaccine storage units and mobile health station equipment for upland sitios in Barangay Rogongon (exact GPS coordinates pending field survey).',
   'health_sanitation', 'planned', 'planning', 'published',
   'Barangay Rogongon', 'Iligan City (Sample Demo Data)', null, null,
   'City Health Office (CHO)', 'Pending Exact Sitio Geotagging & Pre-Procurement', 'Competitive Public Bidding (RA 9184)',
   3800000, 0, 10,
   '2026-12-10', '2027-04-15', '920 indigenous and upland households in Barangay Rogongon',
   null, 'Field Geotagging Pending · Brgy. Rogongon', '2026-10-23')
on conflict (reference_code) do nothing;

insert into public.project_milestones
  (project_id, title, target_date, sort_order, is_completed, completed_at, verified_by_name)
select p.id, m.title, m.target_date::date, m.sort_order, m.is_completed,
       case when m.is_completed then m.target_date::timestamptz end, m.verified_by_name
from (values
  ('LGU-2026-INF-014', 'Subgrade Preparation and Aggregate Base Course', '2026-07-30', 1, true, 'Engr. M. Santos (CEO)'),
  ('LGU-2026-INF-014', 'Concrete Pouring — Station 0+000 to Station 1+100', '2026-09-25', 2, true, 'Engr. M. Santos (CEO)'),
  ('LGU-2026-INF-014', 'Drainage Line Canal & Slope Protection Works', '2026-11-15', 3, false, null),
  ('LGU-2026-INF-014', 'Final Curing, Core Testing & Barangay Turnover', '2026-12-20', 4, false, null),
  ('LGU-2026-HLT-008', 'Structural Framing and Roofing Renovation', '2026-04-15', 1, true, 'Engr. R. Dizon (CEO)'),
  ('LGU-2026-HLT-008', 'Medical Gas Piping & Sanitation Plumbing Installation', '2026-06-20', 2, true, 'Dr. L. Villanueva (CHO)'),
  ('LGU-2026-HLT-008', 'Delivery of Diagnostic & Maternal Care Equipment', '2026-08-05', 3, true, 'Dr. L. Villanueva (CHO)'),
  ('LGU-2026-HLT-008', 'Final Inspectorate Clearance & Public Turnover', '2026-08-30', 4, true, 'LGU City Inspectorate Team'),
  ('LGU-2026-DRR-019', 'Hydrological Site Survey & Sensor Tower Foundation', '2026-08-10', 1, true, 'J. Macapagal (CDRRMO)'),
  ('LGU-2026-DRR-019', 'Evacuation Center 25kWp Solar PV Roof Array Mounting', '2026-09-30', 2, true, 'Engr. M. Santos (CEO)'),
  ('LGU-2026-DRR-019', 'Telemetry Integration with Command Center Radio Network', '2026-11-05', 3, false, null),
  ('LGU-2026-DRR-019', 'Barangay Community Drill & System Commissioning', '2026-11-30', 4, false, null),
  ('LGU-2026-EDU-011', 'Local School Board Resolution & POW Approval', '2026-08-20', 1, true, 'Local School Board Secretariat'),
  ('LGU-2026-EDU-011', 'PhilGEPS Invitation to Bid & Pre-Bid Conference', '2026-09-28', 2, true, 'BAC Chairperson'),
  ('LGU-2026-EDU-011', 'Bid Evaluation, Post-Qualification & Notice of Award', '2026-11-02', 3, false, null),
  ('LGU-2026-EDU-011', 'Groundbreaking & Civil Works Mobilization', '2026-11-15', 4, false, null),
  ('LGU-2026-INF-023', 'Concrete Pedestal Footing Excavation & Pouring', '2026-04-20', 1, true, 'Engr. R. Dizon (CEO)'),
  ('LGU-2026-INF-023', 'Pole Erection and Solar Luminaire Mounting', '2026-06-15', 2, true, 'Engr. R. Dizon (CEO)'),
  ('LGU-2026-INF-023', 'Lux Meter Illumination Verification & Final Acceptance', '2026-07-15', 3, true, 'LGU City Inspectorate Team'),
  ('LGU-2026-HLT-015', 'Geo-Resistivity Survey & Borehole Drilling', '2026-05-30', 1, true, 'Engr. M. Santos (CEO)'),
  ('LGU-2026-HLT-015', 'Elevated Tank Foundation & Structural Steel Fabrication', '2026-08-15', 2, false, null),
  ('LGU-2026-HLT-015', 'HDPE Mainline Trenching & Household Tap Stand Connections', '2026-10-01', 3, false, null),
  ('LGU-2026-EDU-027', 'Interior Partitioning, Acoustic Ceiling & Electrical Rewiring', '2026-08-25', 1, true, 'Engr. R. Dizon (CEO)'),
  ('LGU-2026-EDU-027', 'Structured LAN Cabling & Workstation Furniture Delivery', '2026-10-05', 2, true, 'K. Mendoza (LYDO)'),
  ('LGU-2026-EDU-027', 'Workstation Deployment & Public Portal Orientation', '2026-11-15', 3, false, null),
  ('LGU-2026-DRR-031', 'Topographic & Bathymetric Survey Completion', '2026-10-10', 1, true, 'Engr. M. Santos (CEO)'),
  ('LGU-2026-DRR-031', 'Detailed Engineering Design & CDRRMC Approval', '2026-11-05', 2, false, null),
  ('LGU-2026-DRR-031', 'Publication of Invitation to Bid via PhilGEPS', '2026-11-20', 3, false, null),
  ('LGU-2026-HLT-034', 'Barangay Health Needs Assessment & Cold-Chain Specification', '2026-10-18', 1, true, 'Dr. L. Villanueva (CHO)'),
  ('LGU-2026-HLT-034', 'Upland Sitio GPS Coordinate Verification & Site Selection', '2026-11-20', 2, false, null)
) as m(reference_code, title, target_date, sort_order, is_completed, verified_by_name)
join public.projects p on p.reference_code = m.reference_code;

-- Link sample contractor organizations to their projects so contractor-role
-- RLS can be exercised locally.
insert into public.project_assignments (project_id, organization_id, assignment_role)
select p.id, o.id, 'contractor'
from public.projects p
join public.organizations o on o.name = p.contractor_or_partner and o.org_type = 'contractor'
on conflict do nothing;
