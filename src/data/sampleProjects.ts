import {
  FeatureCardItem,
  LGUProject,
  LifecycleStageInfo,
  ProjectCategory,
  ProjectStatus,
  SummaryMetrics,
} from '@/types/project';

/**
 * Geographic center of Iligan City, Philippines (City Hall / Poblacion area).
 */
export const ILIGAN_CITY_CENTER: [number, number] = [8.228, 124.2452];

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'Infrastructure and Public Works',
  'Education and Youth Development',
  'Disaster Risk Reduction and Management',
  'Health and Sanitation',
];

export const PROJECT_STATUSES: ProjectStatus[] = [
  'In Progress',
  'Completed',
  'Procurement',
  'Planned',
  'Delayed',
];

export const CORE_FEATURES: FeatureCardItem[] = [
  {
    id: 'project-planning',
    title: 'Project Planning',
    description:
      'Submit proposals, feasibility studies, and documents for review and prioritization in the Annual Investment Program (AIP).',
    iconName: 'file-text',
    iconBgClass: 'bg-[#2563EB]',
  },
  {
    id: 'budget-management',
    title: 'Budget Management',
    description:
      'Track approved budgets, disbursements, and fund sources with complete visibility across all projects.',
    iconName: 'dollar-sign',
    iconBgClass: 'bg-[#172B4D]',
  },
  {
    id: 'procurement-automation',
    title: 'Procurement Automation',
    description:
      'Publish bids, manage submissions, and award contracts with full audit trails and public transparency.',
    iconName: 'zap',
    iconBgClass: 'bg-[#F59E0B]',
  },
  {
    id: 'real-time-monitoring',
    title: 'Real-Time Monitoring',
    description:
      'Track project progress with milestone management, contractor reports, and approval workflows.',
    iconName: 'trending-up',
    iconBgClass: 'bg-[#16A34A]',
  },
  {
    id: 'public-transparency',
    title: 'Public Transparency',
    description:
      'Citizens can view all projects on an interactive map, track status, budget, and contractor information.',
    iconName: 'map-pin',
    iconBgClass: 'bg-[#F59E0B]',
  },
  {
    id: 'role-based-access',
    title: 'Role-Based Access',
    description:
      '9 distinct roles with tailored permissions for administrators, planners, councils, contractors, and the public.',
    iconName: 'users',
    iconBgClass: 'bg-[#2563EB]',
  },
];

export const LIFECYCLE_STAGES: LifecycleStageInfo[] = [
  {
    id: 'planning',
    stepNumber: 'Stage 01',
    title: 'Planning & Budgeting',
    subtitle: 'Local Development Investment Programming',
    description:
      'Projects are identified through Barangay Development Councils, aligned with the Annual Investment Program (AIP), and assigned approved municipal appropriations.',
    keyOutputs: [
      'Program of Works (POW) & Detailed Engineering Design',
      'Sangguniang Panlungsod Appropriation Ordinance',
      'Barangay Development Council Resolution',
    ],
    responsibleUnit: 'City Planning & Development Office (CPDO)',
  },
  {
    id: 'procurement',
    stepNumber: 'Stage 02',
    title: 'Procurement & Bidding',
    subtitle: 'Competitive Public Bidding & BAC Evaluation',
    description:
      'The Bids and Awards Committee (BAC) conducts public bidding, bid evaluation, post-qualification, and contract signing in compliance with Republic Act No. 9184.',
    keyOutputs: [
      'PhilGEPS Invitation to Bid Publication',
      'Notice of Award (NOA) & Contract Agreement',
      'Notice to Proceed (NTP) Issuance',
    ],
    responsibleUnit: 'Bids and Awards Committee (BAC) Secretariat',
  },
  {
    id: 'implementation',
    stepNumber: 'Stage 03',
    title: 'Implementation & Monitoring',
    subtitle: 'Field Execution & Physical Accomplishment Tracking',
    description:
      'Implementing offices and contracted partners execute civil works or program delivery while city engineers and project officers log verified milestones.',
    keyOutputs: [
      'Monthly Physical Accomplishment Reports',
      'Statement of Work Accomplished (SWA)',
      'Site Inspection & Quality Assurance Logs',
    ],
    responsibleUnit: 'City Engineer’s Office / Sector Lead Office',
  },
  {
    id: 'completion',
    stepNumber: 'Stage 04',
    title: 'Completion & Public Audit',
    subtitle: 'Final Inspection, Turnover & Citizen Disclosure',
    description:
      'Completed facilities and programs undergo final inspection by the LGU Inspectorate Team, formal turnover to beneficiary barangays, and public disclosure.',
    keyOutputs: [
      'Certificate of Completion & Acceptance',
      'Final Financial Liquidation & Audit Summary',
      'Barangay Turnover & Sustainability Covenant',
    ],
    responsibleUnit: 'LGU Inspectorate Team & City Accounting Office',
  },
];

/**
 * Clearly identified development-only sample data used solely to demonstrate the LGU Tracker
 * frontend interface and Iligan City Project Map for the CCC181 Final Project by Team BB (BeyondBoard).
 * Not official government records.
 */
export const SAMPLE_LGU_PROJECTS: LGUProject[] = [
  {
    id: 'prj-01',
    referenceCode: 'LGU-2026-INF-014',
    title: 'Hinaplanon Access Road Concreting',
    category: 'Infrastructure and Public Works',
    status: 'In Progress',
    barangay: 'Barangay Hinaplanon',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2458,
    longitude: 124.2594,
    implementingOffice: 'City Engineer’s Office (CEO)',
    contractorOrPartner: 'Kapatagan Civil Works & Construction Corp. (Sample)',
    procurementMode: 'Competitive Public Bidding (RA 9184)',
    allocatedBudget: 14850000,
    disbursedBudget: 9652500,
    progressPercentage: 68,
    startDate: '2026-06-15',
    targetCompletionDate: '2026-12-20',
    lastUpdated: '2026-10-18',
    lifecycleStage: 'implementation',
    description:
      'Concreting of 1.85 linear kilometers of two-lane PCCP road network with reinforced concrete lined canal and solar road studs in Barangay Hinaplanon, Iligan City.',
    beneficiaries: '1,420 households and agricultural commuters in Brgy. Hinaplanon',
    imageCaption: 'Site Inspection Placeholder · Brgy. Hinaplanon Road Concreting',
    milestones: [
      {
        id: 'm-101',
        title: 'Subgrade Preparation and Aggregate Base Course',
        targetDate: '2026-07-30',
        completed: true,
        verifiedBy: 'Engr. M. Santos (CEO)',
      },
      {
        id: 'm-102',
        title: 'Concrete Pouring — Station 0+000 to Station 1+100',
        targetDate: '2026-09-25',
        completed: true,
        verifiedBy: 'Engr. M. Santos (CEO)',
      },
      {
        id: 'm-103',
        title: 'Drainage Line Canal & Slope Protection Works',
        targetDate: '2026-11-15',
        completed: false,
      },
      {
        id: 'm-104',
        title: 'Final Curing, Core Testing & Barangay Turnover',
        targetDate: '2026-12-20',
        completed: false,
      },
    ],
  },
  {
    id: 'prj-02',
    referenceCode: 'LGU-2026-HLT-008',
    title: 'Tubod Health Station & Birthing Facility',
    category: 'Health and Sanitation',
    status: 'Completed',
    barangay: 'Barangay Tubod',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2145,
    longitude: 124.2418,
    implementingOffice: 'City Health Office (CHO)',
    contractorOrPartner: 'Mindanao MedBuild Builders Inc. (Sample)',
    procurementMode: 'Competitive Public Bidding (RA 9184)',
    allocatedBudget: 6400000,
    disbursedBudget: 6320000,
    progressPercentage: 100,
    startDate: '2026-02-10',
    targetCompletionDate: '2026-08-30',
    lastUpdated: '2026-09-04',
    lifecycleStage: 'completion',
    description:
      'Structural expansion of the Barangay Tubod health station, installation of DOH-compliant maternal delivery room, cold-chain vaccine storage, and medical waste sanitation unit.',
    beneficiaries: '3,850 residents across Barangay Tubod and neighboring puroks',
    imageCaption: 'Completed Facility Placeholder · Brgy. Tubod Health Station',
    milestones: [
      {
        id: 'm-201',
        title: 'Structural Framing and Roofing Renovation',
        targetDate: '2026-04-15',
        completed: true,
        verifiedBy: 'Engr. R. Dizon (CEO)',
      },
      {
        id: 'm-202',
        title: 'Medical Gas Piping & Sanitation Plumbing Installation',
        targetDate: '2026-06-20',
        completed: true,
        verifiedBy: 'Dr. L. Villanueva (CHO)',
      },
      {
        id: 'm-203',
        title: 'Delivery of Diagnostic & Maternal Care Equipment',
        targetDate: '2026-08-05',
        completed: true,
        verifiedBy: 'Dr. L. Villanueva (CHO)',
      },
      {
        id: 'm-204',
        title: 'Final Inspectorate Clearance & Public Turnover',
        targetDate: '2026-08-30',
        completed: true,
        verifiedBy: 'LGU City Inspectorate Team',
      },
    ],
  },
  {
    id: 'prj-03',
    referenceCode: 'LGU-2026-DRR-019',
    title: 'Mandulog River Flood Warning System',
    category: 'Disaster Risk Reduction and Management',
    status: 'In Progress',
    barangay: 'Barangay Sta. Filomena',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2612,
    longitude: 124.2585,
    implementingOffice: 'City Disaster Risk Reduction & Management Office (CDRRMO)',
    contractorOrPartner: 'Archipelago Resilient Systems Co. (Sample)',
    procurementMode: 'Competitive Public Bidding (RA 9184)',
    allocatedBudget: 8950000,
    disbursedBudget: 5370000,
    progressPercentage: 60,
    startDate: '2026-07-01',
    targetCompletionDate: '2026-11-30',
    lastUpdated: '2026-10-21',
    lifecycleStage: 'implementation',
    description:
      'Deployment of ultrasonic water-level sensors along the Mandulog River basin, multi-directional sirens, and a 25kWp hybrid solar battery array at the evacuation center.',
    beneficiaries: '6,200 residents in flood-prone zones of Barangay Sta. Filomena',
    imageCaption: 'Sensor Tower Site Placeholder · Brgy. Sta. Filomena',
    milestones: [
      {
        id: 'm-301',
        title: 'Hydrological Site Survey & Sensor Tower Foundation',
        targetDate: '2026-08-10',
        completed: true,
        verifiedBy: 'J. Macapagal (CDRRMO)',
      },
      {
        id: 'm-302',
        title: 'Evacuation Center 25kWp Solar PV Roof Array Mounting',
        targetDate: '2026-09-30',
        completed: true,
        verifiedBy: 'Engr. M. Santos (CEO)',
      },
      {
        id: 'm-303',
        title: 'Telemetry Integration with Command Center Radio Network',
        targetDate: '2026-11-05',
        completed: false,
      },
      {
        id: 'm-304',
        title: 'Barangay Community Drill & System Commissioning',
        targetDate: '2026-11-30',
        completed: false,
      },
    ],
  },
  {
    id: 'prj-04',
    referenceCode: 'LGU-2026-EDU-011',
    title: 'Tibanga Two-Storey Academic Building',
    category: 'Education and Youth Development',
    status: 'Procurement',
    barangay: 'Barangay Tibanga',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2414,
    longitude: 124.2442,
    implementingOffice: 'Local School Board & City Engineer’s Office',
    contractorOrPartner: 'Post-Qualification Evaluation in Progress (BAC)',
    procurementMode: 'Competitive Public Bidding (Special Education Fund)',
    allocatedBudget: 18200000,
    disbursedBudget: 0,
    progressPercentage: 15,
    startDate: '2026-11-15',
    targetCompletionDate: '2027-06-30',
    lastUpdated: '2026-10-22',
    lifecycleStage: 'procurement',
    description:
      'Construction of a typhoon-resilient two-storey public school building in Barangay Tibanga funded under the Special Education Fund (SEF), equipped with a 40-seat ICT laboratory.',
    beneficiaries: '540 public school students in Barangay Tibanga',
    imageCaption: 'Proposed School Site Placeholder · Brgy. Tibanga',
    milestones: [
      {
        id: 'm-401',
        title: 'Local School Board Resolution & POW Approval',
        targetDate: '2026-08-20',
        completed: true,
        verifiedBy: 'Local School Board Secretariat',
      },
      {
        id: 'm-402',
        title: 'PhilGEPS Invitation to Bid & Pre-Bid Conference',
        targetDate: '2026-09-28',
        completed: true,
        verifiedBy: 'BAC Chairperson',
      },
      {
        id: 'm-403',
        title: 'Bid Evaluation, Post-Qualification & Notice of Award',
        targetDate: '2026-11-02',
        completed: false,
      },
      {
        id: 'm-404',
        title: 'Groundbreaking & Civil Works Mobilization',
        targetDate: '2026-11-15',
        completed: false,
      },
    ],
  },
  {
    id: 'prj-05',
    referenceCode: 'LGU-2026-INF-023',
    title: 'Poblacion Solar LED Streetlights',
    category: 'Infrastructure and Public Works',
    status: 'Completed',
    barangay: 'Barangay Poblacion',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2286,
    longitude: 124.2404,
    implementingOffice: 'City Engineer’s Office (CEO)',
    contractorOrPartner: 'Sinag Clean Energy Builders Inc. (Sample)',
    procurementMode: 'Competitive Public Bidding (RA 9184)',
    allocatedBudget: 5600000,
    disbursedBudget: 5540000,
    progressPercentage: 100,
    startDate: '2026-03-01',
    targetCompletionDate: '2026-07-15',
    lastUpdated: '2026-07-20',
    lifecycleStage: 'completion',
    description:
      'Supply and installation of 180 galvanized steel tapered poles with integrated 120W lithium-iron-phosphate solar LED luminaires along Roxas and Quezon Avenue in Barangay Poblacion.',
    beneficiaries: '9,500 residents, evening commuters, and commercial establishments',
    imageCaption: 'Solar Streetlighting Placeholder · Brgy. Poblacion',
    milestones: [
      {
        id: 'm-501',
        title: 'Concrete Pedestal Footing Excavation & Pouring',
        targetDate: '2026-04-20',
        completed: true,
        verifiedBy: 'Engr. R. Dizon (CEO)',
      },
      {
        id: 'm-502',
        title: 'Pole Erection and Solar Luminaire Mounting',
        targetDate: '2026-06-15',
        completed: true,
        verifiedBy: 'Engr. R. Dizon (CEO)',
      },
      {
        id: 'm-503',
        title: 'Lux Meter Illumination Verification & Final Acceptance',
        targetDate: '2026-07-15',
        completed: true,
        verifiedBy: 'LGU City Inspectorate Team',
      },
    ],
  },
  {
    id: 'prj-06',
    referenceCode: 'LGU-2026-HLT-015',
    title: 'Suarez Potable Water Supply Expansion',
    category: 'Health and Sanitation',
    status: 'Delayed',
    barangay: 'Barangay Suarez',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.1915,
    longitude: 124.2162,
    implementingOffice: 'City Engineer’s Office & ICWS Sanitation Unit',
    contractorOrPartner: 'Northern Mindanao Hydro Engineering Services (Sample)',
    procurementMode: 'Competitive Public Bidding (RA 9184)',
    allocatedBudget: 11250000,
    disbursedBudget: 4500000,
    progressPercentage: 44,
    startDate: '2026-04-05',
    targetCompletionDate: '2026-10-15',
    lastUpdated: '2026-10-20',
    lifecycleStage: 'implementation',
    description:
      'Elevated 50-cubic-meter steel water tank construction and 4.2km HDPE distribution pipeline with automated inline water chlorination serving upland sitios of Barangay Suarez.',
    beneficiaries: '780 households in Barangay Suarez, Iligan City',
    imageCaption: 'Water Tank Foundation Placeholder · Brgy. Suarez',
    milestones: [
      {
        id: 'm-601',
        title: 'Geo-Resistivity Survey & Borehole Drilling',
        targetDate: '2026-05-30',
        completed: true,
        verifiedBy: 'Engr. M. Santos (CEO)',
      },
      {
        id: 'm-602',
        title: 'Elevated Tank Foundation & Structural Steel Fabrication',
        targetDate: '2026-08-15',
        completed: false,
      },
      {
        id: 'm-603',
        title: 'HDPE Mainline Trenching & Household Tap Stand Connections',
        targetDate: '2026-10-01',
        completed: false,
      },
    ],
  },
  {
    id: 'prj-07',
    referenceCode: 'LGU-2026-EDU-027',
    title: 'Pala-o Youth Digital Literacy & E-Library',
    category: 'Education and Youth Development',
    status: 'In Progress',
    barangay: 'Barangay Pala-o',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2254,
    longitude: 124.2531,
    implementingOffice: 'Local Youth Development Office (LYDO)',
    contractorOrPartner: 'Talino Civic Tech & Interiors Co. (Sample)',
    procurementMode: 'Public Bidding / Goods & Civil Works',
    allocatedBudget: 4350000,
    disbursedBudget: 3045000,
    progressPercentage: 76,
    startDate: '2026-07-10',
    targetCompletionDate: '2026-11-15',
    lastUpdated: '2026-10-19',
    lifecycleStage: 'implementation',
    description:
      'Renovation of the community annex in Barangay Pala-o into a 35-workstation youth digital learning hub with fiber internet redundancy, study carrels, and open-access terminals.',
    beneficiaries: '2,100 youth, students, and Sangguniang Kabataan members in Brgy. Pala-o',
    imageCaption: 'E-Library Interior Placeholder · Brgy. Pala-o',
    milestones: [
      {
        id: 'm-701',
        title: 'Interior Partitioning, Acoustic Ceiling & Electrical Rewiring',
        targetDate: '2026-08-25',
        completed: true,
        verifiedBy: 'Engr. R. Dizon (CEO)',
      },
      {
        id: 'm-702',
        title: 'Structured LAN Cabling & Workstation Furniture Delivery',
        targetDate: '2026-10-05',
        completed: true,
        verifiedBy: 'K. Mendoza (LYDO)',
      },
      {
        id: 'm-703',
        title: 'Workstation Deployment & Public Portal Orientation',
        targetDate: '2026-11-15',
        completed: false,
      },
    ],
  },
  {
    id: 'prj-08',
    referenceCode: 'LGU-2026-DRR-031',
    title: 'Mahayahay River Flood Control Dike',
    category: 'Disaster Risk Reduction and Management',
    status: 'Planned',
    barangay: 'Barangay Mahayahay',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: 8.2192,
    longitude: 124.2485,
    implementingOffice: 'City Engineer’s Office & CDRRMO',
    contractorOrPartner: 'Scheduled for Q4 2026 Bidding',
    procurementMode: 'Competitive Public Bidding (LDRRMF 70% Mitigation Fund)',
    allocatedBudget: 16500000,
    disbursedBudget: 0,
    progressPercentage: 5,
    startDate: '2026-12-01',
    targetCompletionDate: '2027-05-30',
    lastUpdated: '2026-10-17',
    lifecycleStage: 'planning',
    description:
      'Construction of 320 linear meters of stepped PVC-coated gabion riverbank protection wall with geotextile membrane in Barangay Mahayahay to mitigate river scouring.',
    beneficiaries: '1,150 riverfront residents in Barangay Mahayahay, Iligan City',
    imageCaption: 'Riverbank Revetment Alignment Placeholder · Brgy. Mahayahay',
    milestones: [
      {
        id: 'm-801',
        title: 'Topographic & Bathymetric Survey Completion',
        targetDate: '2026-10-10',
        completed: true,
        verifiedBy: 'Engr. M. Santos (CEO)',
      },
      {
        id: 'm-802',
        title: 'Detailed Engineering Design & CDRRMC Approval',
        targetDate: '2026-11-05',
        completed: false,
      },
      {
        id: 'm-803',
        title: 'Publication of Invitation to Bid via PhilGEPS',
        targetDate: '2026-11-20',
        completed: false,
      },
    ],
  },
  {
    id: 'prj-09',
    referenceCode: 'LGU-2026-HLT-034',
    title: 'Rogongon Mobile Clinic & Cold-Chain',
    category: 'Health and Sanitation',
    status: 'Planned',
    barangay: 'Barangay Rogongon',
    municipality: 'Iligan City (Sample Demo Data)',
    latitude: null,
    longitude: null,
    implementingOffice: 'City Health Office (CHO)',
    contractorOrPartner: 'Pending Exact Sitio Geotagging & Pre-Procurement',
    procurementMode: 'Competitive Public Bidding (RA 9184)',
    allocatedBudget: 3800000,
    disbursedBudget: 0,
    progressPercentage: 10,
    startDate: '2026-12-10',
    targetCompletionDate: '2027-04-15',
    lastUpdated: '2026-10-23',
    lifecycleStage: 'planning',
    description:
      'Procurement of solar-powered cold-chain vaccine storage units and mobile health station equipment for upland sitios in Barangay Rogongon (exact GPS coordinates pending field survey).',
    beneficiaries: '920 indigenous and upland households in Barangay Rogongon',
    imageCaption: 'Field Geotagging Pending · Brgy. Rogongon',
    milestones: [
      {
        id: 'm-901',
        title: 'Barangay Health Needs Assessment & Cold-Chain Specification',
        targetDate: '2026-10-18',
        completed: true,
        verifiedBy: 'Dr. L. Villanueva (CHO)',
      },
      {
        id: 'm-902',
        title: 'Upland Sitio GPS Coordinate Verification & Site Selection',
        targetDate: '2026-11-20',
        completed: false,
      },
    ],
  },
];

export const ILIGAN_BARANGAYS: string[] = Array.from(
  new Set(SAMPLE_LGU_PROJECTS.map((p) => p.barangay))
).sort();

export function computeSummaryMetrics(projects: LGUProject[]): SummaryMetrics {
  return projects.reduce<SummaryMetrics>(
    (acc, project) => {
      acc.totalProjects += 1;
      if (project.status === 'In Progress') {
        acc.inProgressProjects += 1;
      }
      if (project.status === 'Completed') {
        acc.completedProjects += 1;
      }
      acc.totalAllocatedBudget += project.allocatedBudget;
      acc.totalDisbursedBudget += project.disbursedBudget;
      return acc;
    },
    {
      totalProjects: 0,
      inProgressProjects: 0,
      completedProjects: 0,
      totalAllocatedBudget: 0,
      totalDisbursedBudget: 0,
    }
  );
}

export function formatPHP(amount: number, compact = false): string {
  if (compact && amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `₱${millions.toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}
