/**
 * Flags possible duplicates between the DILG SubayBAYAN rows (pipeline output)
 * and the DPWH contracts already in Supabase. Read-only against the database.
 *
 *   npm run subaybayan:dedupe                 # uses the cached DPWH snapshot if present
 *   npm run subaybayan:dedupe -- --refresh    # re-read dpwh_contracts (public key, read-only)
 *
 * Needs .cache/subaybayan/out/subaybayan_projects.jsonl (npm run subaybayan:build).
 * Writes .cache/subaybayan/out/dpwh_matches.jsonl and dpwh_matches_review.csv
 * (imported by subaybayan:import into public.subaybayan_dpwh_matches) and the
 * report docs/subaybayan/duplicates.md. Never changes, merges or deletes records.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { loadDpwhSnapshot } from './lib/dpwh-snapshot';
import { loadGazetteer } from './lib/gazetteer';
import { Gazetteer } from './lib/locate';
import { normalizePlaceName } from './lib/names';
import { matchDilgToDpwh, THRESHOLDS, type DilgForMatch, type MatchClass } from './lib/dedupe';
import type { ProjectRow } from './lib/records';

const ROMAN: Record<string, string> = { I: '01', II: '02', III: '03', 'IV-A': '04', V: '05', VI: '06', VII: '07', VIII: '08', IX: '09', X: '10', XI: '11', XII: '12', XIII: '16' };

/** DPWH region labels ("Region X", "Negros Island Region", "Bangsamoro …") → PSGC region code. */
export function dpwhRegionCode(label: string | null): string | null {
  if (!label) return null;
  const m = /^region\s+([ivx]+(?:-a)?)\b/i.exec(label.trim());
  if (m) return ROMAN[m[1].toUpperCase()] ? `${ROMAN[m[1].toUpperCase()]}00000000` : null;
  if (/negros island/i.test(label)) return '1800000000';
  if (/bangsamoro|barmm/i.test(label)) return '1900000000';
  if (/national capital|ncr|metro/i.test(label)) return '1300000000';
  if (/cordillera|car\b/i.test(label)) return '1400000000';
  if (/mimaropa/i.test(label)) return '1700000000';
  return null;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '–');
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const md = (s: string | null | undefined) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 110);

async function main() {
  const refresh = process.argv.includes('--refresh');
  config({ path: '.env.local', quiet: true });
  const cache = '.cache/subaybayan';
  const rows: ProjectRow[] = readFileSync(path.join(cache, 'out', 'subaybayan_projects.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const { rows: dpwh, fetchedAt } = await loadDpwhSnapshot(cache, refresh);
  const g = new Gazetteer(await loadGazetteer(path.join(cache, 'boundaries')));

  // DPWH province label → PSGC province: within the DPWH row's region first, then nationally if unique.
  const provinceMemo = new Map<string, string | null>();
  const provinceCode = (label: string, regionLabel: string | null = null): string | null => {
    const key = `${regionLabel ?? ''}|${label}`;
    if (provinceMemo.has(key)) return provinceMemo.get(key)!;
    const norm = normalizePlaceName(label);
    const region = dpwhRegionCode(regionLabel);
    let hit = region ? g.child('province', region, norm) : null;
    if (!hit || hit === 'ambiguous') hit = g.anywhere('province', norm);
    const code = hit && hit !== 'ambiguous' ? hit.code : null;
    provinceMemo.set(key, code);
    return code;
  };
  // Resolve with region context once, then the matcher asks by label only.
  const labelCode = new Map<string, string | null>();
  for (const d of dpwh) for (const l of [d.province, ...(d.provinces ?? [])]) if (l && !labelCode.has(l)) labelCode.set(l, provinceCode(l, d.region));
  const unmatchedDpwhProvinces = [...labelCode].filter(([, c]) => !c).map(([l]) => l);
  const dpwhRegions = new Set(dpwh.map((d) => dpwhRegionCode(d.region)).filter((c): c is string => !!c));
  const years = dpwh.map((d) => d.infra_year).filter((y): y is number => y !== null);
  const dpwhYears: [number, number] = [Math.min(...years), Math.max(...years)];

  const dilg: DilgForMatch[] = rows.map((r) => ({
    id: r.id,
    project_code: r.project_code,
    title: r.title,
    component_details: r.component_details,
    province: r.province,
    citymun: r.citymun,
    barangay: r.barangay,
    psgc_province: r.psgc_province,
    psgc_citymun: r.psgc_citymun,
    latitude: r.latitude,
    longitude: r.longitude,
    location_precision: r.location_precision,
    funding_year: r.funding_year,
    total_cost: r.total_cost,
    contractor: r.contractor,
  }));

  const started = Date.now();
  const results = matchDilgToDpwh(dilg, dpwh, {
    provinceCode: (l) => labelCode.get(l) ?? null,
    dpwhYears,
    dpwhRegions,
    regionOfProvince: (code) => g.get(code)?.parent ?? null,
    barangaysOf: (code) => g.childrenOf(code).filter((c) => c.level === 'barangay').map((c) => c.norm),
    citymunsOf: (code) => g.childrenOf(code).filter((c) => c.level === 'citymun').map((c) => c.norm),
  });
  console.log(`Compared ${fmt(dilg.length)} DILG rows with ${fmt(dpwh.length)} DPWH contracts in ${((Date.now() - started) / 1000).toFixed(1)} s.`);

  // Outputs
  const outDir = path.join(cache, 'out');
  const matchRows = results.flatMap((r) =>
    r.candidates.map((c, rank) => ({
      subaybayan_id: r.id,
      dpwh_contract_id: c.contract_id,
      match_class: c.match_class,
      rank: rank + 1,
      score: c.score,
      reasons: c.reasons,
      evidence: c.evidence,
    }))
  );
  writeFileSync(path.join(outDir, 'dpwh_matches.jsonl'), matchRows.map((m) => JSON.stringify(m)).join('\n') + (matchRows.length ? '\n' : ''));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const dpwhById = new Map(dpwh.map((d) => [d.contract_id, d]));
  writeFileSync(
    path.join(outDir, 'dpwh_matches_review.csv'),
    [
      'match_class,rank,score,subaybayan_id,dilg_title,dilg_place,dilg_year,dilg_cost,dpwh_contract_id,dpwh_title,dpwh_province,dpwh_year,dpwh_amount,reasons',
      ...matchRows.map((m) => {
        const r = byId.get(m.subaybayan_id)!;
        const d = dpwhById.get(m.dpwh_contract_id)!;
        return [m.match_class, m.rank, m.score, r.id, r.title, [r.barangay, r.citymun, r.province].filter(Boolean).join(', '), r.funding_year, r.total_cost, d.contract_id, d.contract_name ?? d.title, d.province, d.infra_year, d.contract_amount, m.reasons.join('; ')].map(csv).join(',');
      }),
    ].join('\n') + '\n'
  );

  // Report
  const counts = new Map<MatchClass, number>();
  for (const r of results) counts.set(r.match_class, (counts.get(r.match_class) ?? 0) + 1);
  const oos = new Map<string, number>();
  for (const r of results) if (r.out_of_scope_reason) oos.set(r.out_of_scope_reason, (oos.get(r.out_of_scope_reason) ?? 0) + 1);
  const inScope = results.length - (counts.get('out_of_scope') ?? 0);
  const dpwhLinked = new Set(matchRows.map((m) => m.dpwh_contract_id));
  const exactRows = results.filter((r) => r.match_class === 'exact');
  const potentialRows = results.filter((r) => r.match_class === 'potential').sort((a, b) => b.candidates[0].score - a.candidates[0].score);
  const perDataset = (cls: MatchClass, ds: string) => results.filter((r) => r.match_class === cls && byId.get(r.id)!.source_dataset === ds).length;

  const lines: string[] = [];
  const p = (s = '') => lines.push(s);
  p('# SubayBAYAN import · DILG ↔ DPWH duplicate check');
  p();
  p(`Generated by \`npm run subaybayan:dedupe\` on ${new Date().toISOString().slice(0, 10)}. DPWH snapshot read ${fetchedAt.slice(0, 16).replace('T', ' ')} UTC from \`dpwh_contracts\` (read-only, public key): ${fmt(dpwh.length)} contracts, infra years ${dpwhYears[0]}–${dpwhYears[1]}.`);
  p();
  p('**Nothing is merged, changed or deleted.** DPWH and DILG may report the same project independently; both records stay in their own tables with their own source ids. Matches are stored as review flags in `public.subaybayan_dpwh_matches` (DILG id ↔ DPWH contract id, class, score, evidence), readable only by administrators (RLS).');
  p();
  p('## Results');
  p();
  p('| Class | DILG rows | Share of all | Share of comparable | LGSF | RLIP |');
  p('|---|---:|---:|---:|---:|---:|');
  for (const cls of ['exact', 'potential', 'none', 'out_of_scope'] as MatchClass[]) {
    const n = counts.get(cls) ?? 0;
    const label = { exact: 'Exact match', potential: 'Potential duplicate (review)', none: 'No match detected', out_of_scope: 'Not comparable (no DPWH data for it)' }[cls];
    p(`| ${label} | ${fmt(n)} | ${pct(n, results.length)} | ${cls === 'out_of_scope' ? '–' : pct(n, inScope)} | ${fmt(perDataset(cls, 'lgsf'))} | ${fmt(perDataset(cls, 'rlip'))} |`);
  }
  p(`| **Total** | **${fmt(results.length)}** | | | | |`);
  p();
  p(`Not comparable, by reason: ${[...oos].map(([k, n]) => `${k} ${fmt(n)}`).join(', ')}. The DPWH import covers only Visayas and Mindanao (regions: ${[...dpwhRegions].sort().join(', ')}).`);
  p();
  p(`Flag rows written: ${fmt(matchRows.length)} (up to 3 candidates per DILG row), touching ${fmt(dpwhLinked.size)} distinct DPWH contracts.`);
  p();
  p('## Method');
  p();
  p('1. **Identifiers.** The datasets share no identifier field. A DILG project code written in a DPWH title, or a DPWH contract id written in a DILG title or component list, counts as an exact match.');
  p(`2. **Blocking.** Only DPWH contracts in the same PSGC province and infra year within ±1 of the DILG funding year, sharing at least one informative title word, are compared.`);
  p('3. **Title similarity.** IDF-weighted overlap of normalized title words (accents, punctuation, abbreviations such as FMR / MPH / CR expanded, generic verbs like "construction" removed). The DILG record\'s own province, city/municipality and barangay names are removed from both titles first, so a shared place name alone cannot make titles look alike.');
  p('4. **Location.** DPWH has no municipality or barangay columns (always empty), so location is read from the DPWH title: every PSGC barangay name of the DILG city/municipality is looked up in both titles. Same barangay = strong; only the city/municipality named = weak; a different barangay, or a different city/municipality of the province, = not the same project. Every place name found in either title is removed before titles are compared. ' +
    `DPWH coordinates within ${THRESHOLDS.nearKm.barangay_centroid} km (barangay-level DILG location) or ${THRESHOLDS.nearKm.municipality_centroid} km (municipality-level) of the DILG area centroid add a little weight; province-level DILG locations never count as near.`);
  p('5. **Cost, year, contractor.** DILG cost vs DPWH contract amount (else approved budget / budget); same year; same normalized contractor name.');
  p();
  p(`- **Exact:** identifier cross-reference, or title ≥ ${THRESHOLDS.exactTitle * 100}% similar AND same year AND cost within 1% AND the same barangay named in the DPWH title.`);
  p(`- **Potential:** title ≥ ${THRESHOLDS.strongTitle * 100}% AND same barangay; or title ≥ ${THRESHOLDS.title * 100}% AND same barangay AND (cost within 10% OR same contractor OR same year); or title ≥ ${THRESHOLDS.strongTitle * 100}% AND only the same city/municipality named AND (cost within 10% OR same contractor); or title ≥ ${THRESHOLDS.weakTitle * 100}% AND cost within 10% AND same contractor.`);
  p('- **Never flagged:** the DPWH title names a different barangay of the same city/municipality (or a different city/municipality of the province) and not the DILG one; the two titles describe different kinds of work (road / water / flood works vs a building); or one cost is over 4× the other unless title, barangay and year all agree.');
  p('- **No match:** compared, nothing met those rules.');
  p();
  p('## Exact matches');
  p();
  if (!exactRows.length) p('None. No DILG code appears in any DPWH title and no DPWH contract id appears in DILG text, and no pair agreed on every attribute.');
  else {
    p('| DILG id | DILG title | DPWH contract | DPWH title | Why |');
    p('|---|---|---|---|---|');
    for (const r of exactRows.slice(0, 100)) {
      const c = r.candidates[0];
      p(`| ${r.id} | ${md(byId.get(r.id)!.title)} | ${c.contract_id} | ${md(dpwhById.get(c.contract_id)!.contract_name ?? dpwhById.get(c.contract_id)!.title)} | ${c.reasons.join('; ')} |`);
    }
  }
  p();
  p(`## Potential duplicates (top 40 of ${fmt(potentialRows.length)} by score)`);
  p();
  p('The full list with all candidates is in `.cache/subaybayan/out/dpwh_matches_review.csv` and, after import, in `public.subaybayan_dpwh_matches`.');
  p();
  p('| Score | DILG id | DILG title (place, year, cost) | DPWH contract | DPWH title (year, amount) | Evidence |');
  p('|---:|---|---|---|---|---|');
  for (const r of potentialRows.slice(0, 40)) {
    const c = r.candidates[0];
    const x = byId.get(r.id)!;
    const d = dpwhById.get(c.contract_id)!;
    p(`| ${c.score.toFixed(2)} | ${r.id} | ${md(x.title)} (${md([x.barangay, x.citymun].filter(Boolean).join(', '))}, ${x.funding_year ?? '?'}, ${x.total_cost ? `₱${fmt(x.total_cost)}` : 'no cost'}) | ${c.contract_id} | ${md(d.contract_name ?? d.title)} (${d.infra_year ?? '?'}, ${d.contract_amount ? `₱${fmt(d.contract_amount)}` : 'no amount'}) | ${c.reasons.join('; ')} |`);
  }
  p();
  p('## Limitations');
  p();
  p('- No shared identifier exists, so every non-identifier match is probabilistic and needs a person to confirm it.');
  p('- DPWH rows carry no municipality or barangay; location agreement relies on place names inside DPWH titles and on DPWH-reported coordinates (6% of DPWH rows have none).');
  p('- DILG coordinates are area centroids, not project sites, so distance is only a coarse signal; province-level DILG rows get no distance evidence.');
  p(`- 19k RLIP rows (mostly not yet started) have no cost, removing the cost signal for them.`);
  p(`- Only DILG rows in the DPWH import scope (Visayas and Mindanao, years ${dpwhYears[0] - 1}–${dpwhYears[1] + 1}) can be compared; Luzon and NCR rows are "not comparable", not "no match".`);
  if (unmatchedDpwhProvinces.length) p(`- DPWH province labels that could not be mapped to a PSGC province (their contracts are not compared): ${unmatchedDpwhProvinces.map((l) => `"${l}"`).join(', ')}.`);
  p('- Thresholds were set by inspecting samples, not against a labelled set; expect both misses and false flags.');
  writeFileSync('docs/subaybayan/duplicates.md', lines.join('\n') + '\n');

  console.log([...counts].map(([k, n]) => `${k} ${fmt(n)}`).join(' · '));
  console.log(`Out of scope: ${[...oos].map(([k, n]) => `${k} ${fmt(n)}`).join(', ')}`);
  console.log(`Flag rows ${fmt(matchRows.length)}, DPWH contracts flagged ${fmt(dpwhLinked.size)}. Unmapped DPWH provinces: ${unmatchedDpwhProvinces.join(', ') || 'none'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
