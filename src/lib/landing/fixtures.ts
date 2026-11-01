import type { LandingData } from './data';

/**
 * Dev-only stress data for the landing page (break-ui). Chosen with the
 * landing page's `landing-fixture` cookie; never read in production builds.
 *
 * - worst: realistic upper bounds (DPWH and DILG imported nationwide over
 *   every year, every region, more datasets added).
 * - partial: the DILG side and the regions count failed; one dataset left.
 * - one: every count at exactly 1 (plural labels).
 * - empty: the database is unreachable.
 */
export const LANDING_FIXTURES = ['demo', 'worst', 'partial', 'one', 'empty'] as const;
export type LandingFixture = (typeof LANDING_FIXTURES)[number];

export function applyFixture(real: LandingData, fixture: LandingFixture): LandingData {
  switch (fixture) {
    case 'worst':
      return {
        ...real,
        totalContracts: 1_284_507,
        dilgProjects: 12_486_903,
        regionsCovered: 18,
        nepProposals: 214_388,
        datasets: Array.from({ length: 12 }, (_, i) => ({ label: `Dataset ${i + 1}`, records: 1 })),
        regions: real.regions.map((r, i) => ({ ...r, contracts: i === 0 ? 1_102_773 : 9 + i })),
      };
    case 'partial':
      return { ...real, dilgProjects: null, regionsCovered: null, datasets: [{ label: 'DPWH contracts (Transparency Portal)', records: real.totalContracts ?? 1 }] };
    case 'one':
      return {
        ...real,
        totalContracts: 1,
        dilgProjects: 1,
        regionsCovered: 1,
        nepProposals: 1,
        datasets: [{ label: 'DPWH contracts (Transparency Portal)', records: 1 }],
        regions: real.regions.map((r, i) => ({ ...r, contracts: i === 0 ? 1 : 0 })),
      };
    case 'empty':
      return {
        ...real,
        totalContracts: null,
        totalAmount: null,
        ongoingContracts: null,
        completedContracts: null,
        computedAt: null,
        regions: real.regions.map((r) => ({ ...r, contracts: null, points: [] })),
        nepProposals: null,
        example: null,
        dilgProjects: null,
        regionsCovered: null,
        datasets: null,
      };
    default:
      return real;
  }
}
