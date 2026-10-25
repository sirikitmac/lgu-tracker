/**
 * Collects Iligan City-related DPWH records from the pinned BetterGov
 * snapshot and writes a reviewable local export. Read-only: it never
 * touches Supabase.
 *
 *   npm run dpwh:iligan-export
 *
 * Output: exports/dpwh-iligan/<snapshot date>-<revision>/
 *   candidates.json          full report (criteria, evidence, provenance)
 *   confirmed_iligan.csv     confirmed against source data + boundary
 *   potential_iligan.csv     plausible, needs review
 *   needs_verification.csv   conflicting or insufficient evidence
 *   excluded.csv             evidence points elsewhere
 *   rejected.csv             failed validation
 *   SUMMARY.md               counts, criteria, limitations
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectIliganCandidates } from '@/lib/integrations/dpwh/iligan/collect';
import type { IliganCandidate, IliganClassification, IliganCollectionReport } from '@/types/dpwhImport';

const CLASSIFICATIONS: IliganClassification[] = [
  'confirmed_iligan',
  'potential_iligan',
  'needs_verification',
  'excluded',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = Array.isArray(value) ? value.join(' | ') : String(value);
  // Keep spreadsheet apps from evaluating cell text as a formula.
  if (/^[=+@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CANDIDATE_COLUMNS: [string, (c: IliganCandidate) => unknown][] = [
  ['classification', (c) => c.classification],
  ['contract_id', (c) => c.contractId],
  ['title', (c) => c.record.title],
  ['implementing_office', (c) => c.record.districtEngineeringOffice],
  ['region', (c) => c.record.region],
  ['source_status', (c) => c.record.sourceStatus],
  ['contract_amount_budget', (c) => c.record.budget],
  ['amount_paid', (c) => c.record.amountPaid],
  ['progress_percentage', (c) => c.record.progressPercentage],
  ['start_date', (c) => c.record.startDate],
  ['completion_date', (c) => c.record.completionDate],
  ['infra_year', (c) => c.record.infraYear],
  ['contractor', (c) => c.record.contractor],
  ['source_category', (c) => c.record.sourceCategory],
  ['latitude', (c) => c.record.latitude],
  ['longitude', (c) => c.record.longitude],
  ['coordinate_status', (c) => c.evidence.coordinates.status],
  ['coordinate_points', (c) => c.evidence.coordinates.points.length],
  ['min_distance_to_boundary_m', (c) =>
    c.evidence.coordinates.points.length ? Math.min(...c.evidence.coordinates.points.map((p) => p.distanceToBoundaryM)) : null],
  ['coordinate_spread_m', (c) => c.evidence.coordinates.spreadM],
  ['description_locates_in_iligan_city', (c) => c.evidence.descriptionLocatesInIliganCity],
  ['iligan_only_in_road_names', (c) => c.evidence.iliganOnlyInRoadNames],
  ['barangays_named', (c) => c.evidence.barangays.map((b) => `${b.name} (${b.psgcCode})`)],
  ['other_places_named', (c) => c.evidence.otherPlaces],
  ['component_provinces', (c) => c.evidence.componentProvinces],
  ['collected_because', (c) => c.collectedBecause],
  ['classification_reasons', (c) => c.reasons],
  ['data_warnings', (c) => c.record.warnings],
  ['source_revision', (c) => c.record.provenance.revision],
  ['source_file_url', (c) => c.record.provenance.fileUrl],
  ['bettergov_record_url', (c) => c.record.provenance.betterGovRecordUrl],
  ['contract_agreement_url', (c) => c.documentLinks.contractAgreement],
];

function candidatesCsv(candidates: IliganCandidate[]): string {
  const lines = [CANDIDATE_COLUMNS.map(([name]) => name).join(',')];
  for (const c of candidates) lines.push(CANDIDATE_COLUMNS.map(([, get]) => csvCell(get(c))).join(','));
  return lines.join('\n') + '\n';
}

function summaryMarkdown(report: IliganCollectionReport): string {
  const s = report.summary;
  const label: Record<IliganClassification, string> = {
    confirmed_iligan: 'Confirmed Iligan (against source data)',
    potential_iligan: 'Potential Iligan — NOT confirmed',
    needs_verification: 'Needs verification — NOT confirmed',
    excluded: 'Excluded',
  };
  return [
    '# DPWH Iligan City candidates (dry run)',
    '',
    `Generated ${report.generatedAt}. Nothing was written to Supabase.`,
    '',
    `- Dataset: \`${report.source.dataset}\``,
    `- Base file: revision \`${report.source.baseFile.sha}\` (committed ${report.source.baseFile.committedAt}), ${report.source.baseFile.rowsInFile.toLocaleString('en-US')} rows`,
    `- Details file: revision \`${report.source.detailsFile.sha}\` (committed ${report.source.detailsFile.committedAt}), ${report.source.detailsFile.rowsInFile.toLocaleString('en-US')} rows`,
    '',
    '## Counts',
    '',
    '| | Records |',
    '|---|---:|',
    `| Unique candidates | ${s.uniqueCandidates} |`,
    ...CLASSIFICATIONS.map((c) => `| ${label[c]} | ${s.byClassification[c]} |`),
    `| Collected via Iligan City DEO only / description only / both | ${s.collectedBy.iliganCityDeoOnly} / ${s.collectedBy.descriptionOnly} / ${s.collectedBy.both} |`,
    `| Duplicate source rows (same contract ID) | ${s.duplicateSourceRows} |`,
    `| Rejected (failed validation) | ${s.rejected} |`,
    `| Missing coordinates | ${s.missingCoordinates} |`,
    `| Conflicting coordinates (inside and outside) | ${s.conflictingCoordinates} |`,
    `| Coordinates near boundary | ${s.edgeCoordinates} |`,
    `| No row in details file | ${s.missingDetails} |`,
    `| Requiring manual verification (potential + needs verification) | ${s.requiringManualVerification} |`,
    '',
    '## Classification criteria',
    '',
    ...CLASSIFICATIONS.map((c) => `- **${c}**: ${report.criteria[c]}`),
    '',
    '## Reference data',
    '',
    ...Object.entries(report.reference).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Limitations',
    '',
    ...report.limitations.map((l) => `- ${l}`),
    '',
  ].join('\n');
}

async function main() {
  const startedAt = Date.now();
  const report = await collectIliganCandidates();
  const base = report.source.baseFile;
  const outDir = path.join(process.cwd(), 'exports', 'dpwh-iligan', `${base.committedAt.slice(0, 10)}-${base.sha.slice(0, 10)}`);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(path.join(outDir, 'candidates.json'), JSON.stringify(report, null, 2) + '\n');
  for (const classification of CLASSIFICATIONS) {
    writeFileSync(
      path.join(outDir, `${classification}.csv`),
      candidatesCsv(report.candidates.filter((c) => c.classification === classification))
    );
  }
  writeFileSync(
    path.join(outDir, 'rejected.csv'),
    ['contract_id,reason,collected_because', ...report.rejected.map((r) => [r.contractId, r.reason, r.collectedBecause].map(csvCell).join(','))].join('\n') + '\n'
  );
  writeFileSync(path.join(outDir, 'SUMMARY.md'), summaryMarkdown(report));

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Wrote ${outDir} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
