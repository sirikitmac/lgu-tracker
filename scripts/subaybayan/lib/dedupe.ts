/**
 * Cross-agency duplicate detection: DILG SubayBAYAN projects vs DPWH contracts.
 *
 * This only FLAGS possible duplicates. Nothing is merged or deleted: DPWH and
 * DILG can report on the same project independently, and both records stay
 * traceable to their own source. Results go to a review table.
 *
 * Signals, in order of strength:
 *   1. Identifier cross-reference: a DILG project code written in a DPWH
 *      title/name, or a DPWH contract id written in a DILG title/components.
 *      (DPWH has no DILG code field and vice versa, so this is text search.)
 *   2. Title similarity: IDF-weighted token overlap (generic words such as
 *      "construction" or "road" weigh little), after removing the DILG
 *      record's own place names from both titles.
 *   3. Location: same PSGC province (blocking); the DILG barangay or city/
 *      municipality name written in the DPWH title (DPWH has no municipality
 *      or barangay columns); distance between the DPWH coordinates and the
 *      DILG area centroid.
 *   4. Funding year vs DPWH infra year (±1 for blocking), cost vs contract
 *      amount, contractor name.
 *
 * Classes:
 *   exact      identifier cross-reference, or every attribute agrees
 *              (near-identical title, same year, cost within 1%, location agrees)
 *   potential  similar enough that a person should look (see classifyPair)
 *   none       compared, nothing close enough
 *   out_of_scope  no DPWH data to compare against (region or year outside
 *              the DPWH import, or the DILG record has no province)
 */
import { classifyProject } from './classify';
import { normalizePlaceName } from './names';

export interface DilgForMatch {
  id: string;
  project_code: string | null;
  title: string;
  component_details: string | null;
  province: string | null;
  citymun: string | null;
  barangay: string | null;
  psgc_province: string | null;
  psgc_citymun: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: string;
  funding_year: number | null;
  total_cost: number | null;
  contractor: string | null;
}

export interface DpwhForMatch {
  contract_id: string;
  title: string | null;
  contract_name: string | null;
  province: string | null;
  provinces: string[] | null;
  latitude: number | null;
  longitude: number | null;
  contract_amount: number | null;
  approved_budget: number | null;
  budget: number | null;
  infra_year: number | null;
  contractor: string | null;
}

export type MatchClass = 'exact' | 'potential' | 'none' | 'out_of_scope';

export interface PairEvidence {
  title_similarity: number;
  identifier: string | null;
  place_in_title: 'barangay' | 'citymun' | 'conflict' | null;
  distance_km: number | null;
  year_diff: number | null;
  cost_ratio: number | null;
  same_contractor: boolean;
  /** Kind of work from both titles: false when one is a road/water/flood work and the other a building. */
  same_work_kind: boolean | null;
}

export interface MatchCandidate {
  contract_id: string;
  match_class: 'exact' | 'potential';
  score: number;
  reasons: string[];
  evidence: PairEvidence;
}

// ---------------------------------------------------------------------------
// Text

const STOPWORDS = new Set(
  (
    'a an and at along as by for from in into of on or the to with within via ' +
    'brgy bgy barangay sitio purok zone prk municipality municipal city province provincial district region ' +
    'proposed project projects phase various located including package lot no nos pkg cy fy ' +
    'construction const constructed rehabilitation rehab repair repairs improvement improvements upgrading ' +
    'completion continuation establishment installation new existing'
  ).split(' ')
);

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bfmr\b/g, 'farm market road'],
  [/\bfarm\s*to\s*market\b/g, 'farm market'],
  [/\bmulti\s*purpose\b|\bmph\b|\bmpb\b/g, 'multipurpose'],
  [/\bbldg\b/g, 'building'],
  [/\bcr\b/g, 'comfort room'],
  [/\bcc\b/g, 'covered court'],
  [/\bes\b/g, 'elementary school'],
  [/\bnhs\b/g, 'national high school'],
  [/\bpccp\b/g, 'concrete pavement'],
  [/\bconcreting\b/g, 'concrete'],
  [/\bbridges\b/g, 'bridge'],
  [/\broads\b/g, 'road'],
];

/** Lowercase, accent-free, abbreviation-expanded word list (stopwords removed). */
export function titleTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let s = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  for (const [re, to] of ABBREVIATIONS) s = s.replace(re, to);
  return s.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d$/.test(w));
}

/** Same normalization as titles, for finding a place name inside a title. */
const phrase = (raw: string | null | undefined) => normalizePlaceName(raw);

export function normalizeContractor(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '') // "J.D." → "jd"
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|opc|construction|constructions|const|builders|enterprises?|ent|trading|and|general|contractor|services|development|dev)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LINEAR = new Set(['Roads and bridges', 'Other public infrastructure', 'Water supply systems', 'Disaster mitigation and preparedness']);
const BUILDING = new Set(['Markets and multipurpose buildings', 'Public buildings', 'Community facilities', 'Health facilities', 'Evacuation centers']);

/** "linear" (roads, drainage, water, flood works), "building", or null when the title does not say. */
export function workKind(title: string | null | undefined): 'linear' | 'building' | null {
  const c = classifyProject({ title: title ?? '' });
  if (c.reason.startsWith('title keyword')) {
    if (LINEAR.has(c.subcategory)) return 'linear';
    if (BUILDING.has(c.subcategory)) return 'building';
  }
  return null;
}

export function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** IDF-weighted Jaccard over token sets. */
export function weightedJaccard(a: Set<string>, b: Set<string>, idf: (t: string) => number): number {
  let inter = 0;
  let union = 0;
  for (const t of a) {
    const w = idf(t);
    union += w;
    if (b.has(t)) inter += w;
  }
  for (const t of b) if (!a.has(t)) union += idf(t);
  return union > 0 ? inter / union : 0;
}

// ---------------------------------------------------------------------------
// Pair classification (pure; unit-tested)

const DPWH_ID = /\b\d{2}[A-Z]{1,2}\d{4,5}\b/g;

/** Identifier written in the other record's text, or null. */
export function identifierCrossReference(dilg: Pick<DilgForMatch, 'project_code' | 'title' | 'component_details'>, dpwh: Pick<DpwhForMatch, 'contract_id' | 'title' | 'contract_name'>): string | null {
  const dpwhText = `${dpwh.title ?? ''} ${dpwh.contract_name ?? ''}`.toUpperCase();
  if (dilg.project_code && dpwhText.includes(dilg.project_code.toUpperCase())) return `DILG code ${dilg.project_code} in DPWH title`;
  const dilgText = `${dilg.title} ${dilg.component_details ?? ''}`.toUpperCase();
  if (dilgText.includes(dpwh.contract_id.toUpperCase()) && new RegExp(`\\b${dpwh.contract_id}\\b`, 'i').test(dilgText)) return `DPWH contract ${dpwh.contract_id} in DILG text`;
  return null;
}

export const THRESHOLDS = {
  exactTitle: 0.9,
  exactCostRatio: 0.99,
  strongTitle: 0.75,
  title: 0.5,
  weakTitle: 0.35,
  closeCostRatio: 0.9,
  /** Below this cost ratio (one cost over 4x the other) a pair needs title, barangay and year to agree. */
  farCostRatio: 0.25,
  /** km from the DILG area centroid, by its precision (supporting evidence only). */
  nearKm: { barangay_centroid: 3, municipality_centroid: 12, province_centroid: 0 } as Record<string, number>,
};

/**
 * Decides whether one DILG/DPWH pair is worth a person's review.
 *
 * Location is the deciding signal because titles are formulaic ("Construction
 * of Multi-Purpose Building in Barangay X"): once place names are removed,
 * hundreds of titles in one province become identical.
 *   - place "barangay": the same barangay is named in the DPWH title (strong)
 *   - place "citymun":  only the city/municipality is named (weak: needs cost or contractor)
 *   - place "conflict": the DPWH title names other barangays of that city and not
 *     the DILG one, so they are different projects: never flagged
 */
export function classifyPair(e: PairEvidence, dilgPrecision: string): { match_class: 'exact' | 'potential' | null; score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (e.identifier) return { match_class: 'exact', score: 1, reasons: [e.identifier] };

  const near = e.distance_km !== null && (THRESHOLDS.nearKm[dilgPrecision] ?? 0) > 0 && e.distance_km <= THRESHOLDS.nearKm[dilgPrecision];
  const sameBarangay = e.place_in_title === 'barangay';
  const sameCity = e.place_in_title === 'citymun';
  const conflict = e.place_in_title === 'conflict';
  const costEqual = e.cost_ratio !== null && e.cost_ratio >= THRESHOLDS.exactCostRatio;
  const costClose = e.cost_ratio !== null && e.cost_ratio >= THRESHOLDS.closeCostRatio;
  const costFar = e.cost_ratio !== null && e.cost_ratio < THRESHOLDS.farCostRatio;
  const sameYear = e.year_diff === 0;

  reasons.push(`title ${Math.round(e.title_similarity * 100)}%`);
  if (sameBarangay) reasons.push('same barangay named in DPWH title');
  else if (sameCity) reasons.push('same city/municipality named in DPWH title (no barangay)');
  else if (conflict) reasons.push('DPWH title names a different barangay');
  if (near) reasons.push(`${e.distance_km!.toFixed(1)} km from DILG area centroid`);
  if (e.year_diff !== null) reasons.push(sameYear ? 'same year' : `year ±${e.year_diff}`);
  if (costEqual) reasons.push('cost within 1%');
  else if (costClose) reasons.push(`cost within ${Math.round((1 - e.cost_ratio!) * 100)}%`);
  else if (e.cost_ratio !== null) reasons.push(`costs differ (ratio ${e.cost_ratio.toFixed(2)})`);
  if (e.same_contractor) reasons.push('same contractor');

  const score =
    0.5 * e.title_similarity +
    (sameBarangay ? 0.2 : sameCity ? 0.08 : 0) +
    (near ? 0.05 : 0) +
    (costEqual ? 0.15 : costClose ? 0.1 : costFar ? -0.1 : 0) +
    (e.same_contractor ? 0.1 : 0) +
    (sameYear ? 0.05 : 0);
  const rounded = Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));

  if (e.same_work_kind === false) reasons.push('different kind of work (road/water vs building)');
  if (conflict || e.same_work_kind === false) return { match_class: null, score: rounded, reasons };
  if (e.title_similarity >= THRESHOLDS.exactTitle && sameYear && costEqual && sameBarangay) return { match_class: 'exact', score: rounded, reasons };
  if (costFar && !(e.title_similarity >= THRESHOLDS.strongTitle && sameBarangay && sameYear)) return { match_class: null, score: rounded, reasons };

  const potential =
    (e.title_similarity >= THRESHOLDS.strongTitle && sameBarangay) ||
    (e.title_similarity >= THRESHOLDS.title && sameBarangay && (costClose || e.same_contractor || sameYear)) ||
    (e.title_similarity >= THRESHOLDS.strongTitle && sameCity && (costClose || e.same_contractor)) ||
    (e.title_similarity >= THRESHOLDS.weakTitle && costClose && e.same_contractor);
  return { match_class: potential ? 'potential' : null, score: rounded, reasons };
}

// ---------------------------------------------------------------------------
// Matcher

export interface MatcherOptions {
  /** PSGC province code for a DPWH province label, or null if it cannot be matched. */
  provinceCode: (label: string) => string | null;
  /** Years present in the DPWH import (inclusive). */
  dpwhYears: [number, number];
  /** Regions (PSGC) covered by the DPWH import. */
  dpwhRegions: Set<string>;
  regionOfProvince: (provinceCode: string) => string | null;
  /** Normalized barangay names of a city/municipality (PSGC code). */
  barangaysOf: (citymunCode: string) => string[];
  /** Normalized city/municipality names of a province (PSGC code). */
  citymunsOf: (provinceCode: string) => string[];
  maxCandidates?: number;
}

export interface DilgMatchResult {
  id: string;
  match_class: MatchClass;
  out_of_scope_reason?: string;
  candidates: MatchCandidate[];
  compared: number;
}

const dpwhAmount = (d: DpwhForMatch) => d.contract_amount ?? d.approved_budget ?? d.budget ?? null;

export function matchDilgToDpwh(dilg: DilgForMatch[], dpwh: DpwhForMatch[], opts: MatcherOptions): DilgMatchResult[] {
  const maxCandidates = opts.maxCandidates ?? 3;

  // Tokens and document frequencies over both corpora.
  const dpwhTokens = dpwh.map((d) => new Set(titleTokens(d.contract_name ?? d.title)));
  const dilgTokens = dilg.map((d) => new Set(titleTokens(d.title)));
  const df = new Map<string, number>();
  for (const set of [...dpwhTokens, ...dilgTokens]) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  const n = dpwhTokens.length + dilgTokens.length;
  const idf = (t: string) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  // Tokens too common to propose candidates on their own (still counted in similarity).
  const informative = (t: string) => (df.get(t) ?? 0) < Math.max(5, n * 0.02);

  // Index DPWH by province code → year → token → contract indexes.
  const index = new Map<string, Map<number, Map<string, number[]>>>();
  const dpwhNormTitles = dpwh.map((d) => ` ${phrase(d.contract_name ?? d.title)} `);
  const dpwhKinds = new Map<number, ReturnType<typeof workKind>>();
  const dpwhKind = (i: number) => {
    if (!dpwhKinds.has(i)) dpwhKinds.set(i, workKind(dpwh[i].contract_name ?? dpwh[i].title));
    return dpwhKinds.get(i)!;
  };
  dpwh.forEach((d, i) => {
    const labels = [d.province, ...(d.provinces ?? [])].filter((p): p is string => !!p);
    const codes = new Set(labels.map((l) => opts.provinceCode(l)).filter((c): c is string => !!c));
    for (const code of codes) {
      const byYear = index.get(code) ?? index.set(code, new Map()).get(code)!;
      const year = d.infra_year ?? 0;
      const byToken = byYear.get(year) ?? byYear.set(year, new Map()).get(year)!;
      for (const t of dpwhTokens[i]) if (informative(t)) (byToken.get(t) ?? byToken.set(t, []).get(t)!).push(i);
    }
  });

  const dpwhByIdText = new Map<string, number>();
  dpwh.forEach((d, i) => dpwhByIdText.set(d.contract_id.toUpperCase(), i));

  return dilg.map((r, k) => {
    const region = r.psgc_province ? opts.regionOfProvince(r.psgc_province) : null;
    if (!r.psgc_province || !region) return { id: r.id, match_class: 'out_of_scope', out_of_scope_reason: 'no province', candidates: [], compared: 0 };
    if (!opts.dpwhRegions.has(region)) return { id: r.id, match_class: 'out_of_scope', out_of_scope_reason: 'region not in DPWH import', candidates: [], compared: 0 };
    if (r.funding_year !== null && (r.funding_year < opts.dpwhYears[0] - 1 || r.funding_year > opts.dpwhYears[1] + 1)) {
      return { id: r.id, match_class: 'out_of_scope', out_of_scope_reason: 'year outside DPWH import', candidates: [], compared: 0 };
    }

    // Candidate DPWH contracts: same province, year ±1 (any year if unknown), sharing an informative token.
    const byYear = index.get(r.psgc_province);
    const candidateIdx = new Set<number>();
    // A DPWH contract id quoted in the DILG text is always a candidate.
    for (const m of `${r.title} ${r.component_details ?? ''}`.toUpperCase().matchAll(DPWH_ID)) {
      const i = dpwhByIdText.get(m[0]);
      if (i !== undefined) candidateIdx.add(i);
    }
    if (byYear) {
      const years = r.funding_year === null ? [...byYear.keys()] : [r.funding_year - 1, r.funding_year, r.funding_year + 1];
      for (const y of years) {
        const byToken = byYear.get(y);
        if (!byToken) continue;
        for (const t of dilgTokens[k]) for (const i of byToken.get(t) ?? []) candidateIdx.add(i);
      }
    }

    // Place names of this DILG record: removed from both titles before comparing, used as location evidence.
    const basePlaceTokens = new Set([...titleTokens(r.province), ...titleTokens(r.citymun), ...titleTokens(r.barangay)]);
    const cityPhrase = phrase(r.citymun);
    // Barangays of this city named by the DILG record: its barangay field (when matched) plus any named in its title.
    const cityBarangays = r.psgc_citymun ? opts.barangaysOf(r.psgc_citymun).filter((b) => b.length > 2) : [];
    const dilgTitleNorm = ` ${phrase(r.title)} `;
    const dilgBarangays = new Set(cityBarangays.filter((b) => dilgTitleNorm.includes(` ${b} `)));
    if (r.barangay && r.location_precision === 'barangay_centroid') dilgBarangays.add(phrase(r.barangay));
    const provinceCities = opts.citymunsOf(r.psgc_province).filter((c) => c.length > 2);
    const provincePhrase = phrase(r.province);
    const placeOf = (dpwhTitle: string): PairEvidence['place_in_title'] => {
      // A DPWH title naming another city/municipality of the province, and not this one, is elsewhere
      // (barangay names repeat across towns: Jampason, Initao vs Jampason, Jasaan).
      // The province name ("Surigao del Norte") must not count as the city it contains ("Surigao").
      const withoutProvince = provincePhrase ? dpwhTitle.split(` ${provincePhrase} `).join(' ') : dpwhTitle;
      const cities = provinceCities.filter((c) => withoutProvince.includes(` ${c} `));
      if (cityPhrase && cities.length && !cities.includes(cityPhrase)) return 'conflict';
      const named = cityBarangays.filter((b) => dpwhTitle.includes(` ${b} `));
      if (named.some((b) => dilgBarangays.has(b))) return 'barangay';
      if (named.length && dilgBarangays.size) return 'conflict';
      return cityPhrase.length > 2 && cities.includes(cityPhrase) ? 'citymun' : null;
    };
    const contractor = normalizeContractor(r.contractor);

    const dilgNamedTokens = [...dilgBarangays].flatMap((b) => b.split(' '));
    const dilgKind = workKind(r.title);
    const candidates: MatchCandidate[] = [];
    for (const i of candidateIdx) {
      const d = dpwh[i];
      const amount = dpwhAmount(d);
      const placeTokens = new Set([...basePlaceTokens, ...dilgNamedTokens]);
      for (const b of cityBarangays) if (dpwhNormTitles[i].includes(` ${b} `)) for (const t of b.split(' ')) placeTokens.add(t);
      for (const c of provinceCities) if (dpwhNormTitles[i].includes(` ${c} `)) for (const t of c.split(' ')) placeTokens.add(t);
      const strip = (set: Set<string>) => new Set([...set].filter((t) => !placeTokens.has(t)));
      const evidence: PairEvidence = {
        title_similarity: Math.round(weightedJaccard(strip(dilgTokens[k]), strip(dpwhTokens[i]), idf) * 1000) / 1000,
        identifier: identifierCrossReference(r, d),
        place_in_title: placeOf(dpwhNormTitles[i]),
        distance_km: r.latitude !== null && r.longitude !== null && d.latitude !== null && d.longitude !== null ? Math.round(haversineKm([r.latitude, r.longitude], [d.latitude, d.longitude]) * 10) / 10 : null,
        year_diff: r.funding_year !== null && d.infra_year !== null ? Math.abs(r.funding_year - d.infra_year) : null,
        cost_ratio: r.total_cost && amount ? Math.round((Math.min(r.total_cost, amount) / Math.max(r.total_cost, amount)) * 1000) / 1000 : null,
        same_contractor: contractor.length > 3 && contractor === normalizeContractor(d.contractor),
        same_work_kind: dilgKind && dpwhKind(i) ? dilgKind === dpwhKind(i) : null,
      };
      const c = classifyPair(evidence, r.location_precision);
      if (c.match_class) candidates.push({ contract_id: d.contract_id, match_class: c.match_class, score: c.score, reasons: c.reasons, evidence });
    }
    candidates.sort((x, y) => (x.match_class === y.match_class ? y.score - x.score : x.match_class === 'exact' ? -1 : 1));
    const top = candidates.slice(0, maxCandidates);
    return { id: r.id, match_class: top[0]?.match_class ?? 'none', candidates: top, compared: candidateIdx.size };
  });
}
