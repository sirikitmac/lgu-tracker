/**
 * SubayBAYAN processing pipeline: Excel exports → normalized, categorized,
 * located rows ready for import, plus docs/subaybayan/report.md.
 *
 *   npm run subaybayan:build
 *   npm run subaybayan:build -- --source "C:\path\to\SubayBayan_RBME" --samples 10
 *
 * Inputs (read-only):
 *   <source>/Locally_Funded_Projects/*.xlsx   LGSF
 *   <source>/LIME_20DF/*.xlsx                 RLIP
 *   default <source>: SUBAYBAYAN_SOURCE_DIR, else ~/Downloads/SubayBayan_RBME
 * Boundaries: downloaded once into .cache/subaybayan/boundaries (pinned release, SHA-256 checked).
 * Outputs (gitignored): .cache/subaybayan/out/{subaybayan_projects.jsonl, parse-issues.csv, unresolved.csv}
 * Report (committed): docs/subaybayan/report.md
 *
 * Nothing here talks to Supabase or to the SubayBAYAN website.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SUBAYBAYAN_CATEGORIES, SUBAYBAYAN_CATEGORY_LABELS, LOCATION_PRECISIONS } from '@/lib/subaybayan/categories';
import { BOUNDARY_SOURCE, SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_AT } from '@/lib/subaybayan/source';
import { classifyProject } from './lib/classify';
import { readWorkbook, type ParseIssue, type RawRecord } from './lib/extract';
import { loadGazetteer } from './lib/gazetteer';
import { Gazetteer, locate } from './lib/locate';
import { assignIds, toProjectRow, type ProjectRow } from './lib/records';

const PORTAL_COUNTS = { lgsf: 7353, rlip: 34126 } as const;
const FOLDERS = { lgsf: 'Locally_Funded_Projects', rlip: 'LIME_20DF' } as const;
const EXPECTED_FILES = { lgsf: 4, rlip: 18 } as const;

function parseArgs(argv: string[]) {
  const args = {
    source: process.env.SUBAYBAYAN_SOURCE_DIR || path.join(os.homedir(), 'Downloads', 'SubayBayan_RBME'),
    cache: '.cache/subaybayan',
    report: 'docs/subaybayan/report.md',
    samples: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value.`);
      return v;
    };
    if (flag === '--source') args.source = value();
    else if (flag === '--cache') args.cache = value();
    else if (flag === '--report') args.report = value();
    else if (flag === '--samples') args.samples = Number(value());
    else throw new Error(`Unknown option "${flag}".`);
  }
  return args;
}

/** Small deterministic PRNG so the printed samples are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '–');
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const tally = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, number>();
  for (const t of items) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();

  // 1. Extract
  const issues: ParseIssue[] = [];
  const raw: RawRecord[] = [];
  const perFile: { dataset: string; file: string; rows: number }[] = [];
  for (const dataset of ['lgsf', 'rlip'] as const) {
    const dir = path.join(args.source, FOLDERS[dataset]);
    if (!existsSync(dir)) throw new Error(`Source folder not found: ${dir}`);
    const files = readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$')).sort();
    if (files.length !== EXPECTED_FILES[dataset]) console.warn(`Warning: ${dir} has ${files.length} .xlsx files, expected ${EXPECTED_FILES[dataset]}.`);
    for (const f of files) {
      const records = readWorkbook(path.join(dir, f), issues);
      perFile.push({ dataset, file: f, rows: records.length });
      raw.push(...records);
    }
  }
  console.log(`Read ${fmt(raw.length)} rows from ${perFile.length} files in ${((Date.now() - started) / 1000).toFixed(1)} s.`);

  // 2. Locate, classify, identify
  const gazetteer = new Gazetteer(await loadGazetteer(path.join(args.cache, 'boundaries')));
  const ids = assignIds(raw);
  const notes: string[] = [];
  const rows: ProjectRow[] = raw.map((r, i) => {
    const loc = locate(gazetteer, r);
    notes.push(loc.note);
    const c = classifyProject({ title: r.title, componentDetails: r.component_details, projectType: r.project_type, program: r.program });
    return toProjectRow(ids[i], r, c, loc);
  });

  // 3. Write outputs
  const outDir = path.join(args.cache, 'out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'subaybayan_projects.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(
    path.join(outDir, 'parse-issues.csv'),
    ['file,row,field,value', ...issues.map((x) => [x.file, x.row, x.field, x.value].map(csv).join(','))].join('\n') + '\n'
  );
  const unresolved = rows.filter((r) => r.location_precision === 'unresolved');
  writeFileSync(
    path.join(outDir, 'unresolved.csv'),
    ['id,region,province,citymun,barangay,note', ...rows.flatMap((r, i) => (r.location_precision === 'unresolved' ? [[r.id, r.region, r.province, r.citymun, r.barangay, notes[i]].map(csv).join(',')] : []))].join('\n') + '\n'
  );

  // 4. Samples per category (sanity check)
  const rand = mulberry32(20261031);
  for (const cat of SUBAYBAYAN_CATEGORIES) {
    const pool = rows.filter((r) => r.sector_category === cat);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, args.samples);
    console.log(`\n== ${SUBAYBAYAN_CATEGORY_LABELS[cat]} (${fmt(pool.length)}) — ${picked.length} random examples`);
    for (const r of picked) console.log(`  [${r.sector_subcategory}] ${r.title.slice(0, 110)}  ← ${r.classification_reason}`);
  }

  // 5. Report
  const total = rows.length;
  const byDataset = (d: string) => rows.filter((r) => r.source_dataset === d);
  const noCode = rows.filter((r) => !r.project_code);
  const codeCounts = tally(rows.filter((r) => r.project_code), (r) => `${r.source_dataset}|${r.project_code}`).filter(([, n]) => n > 1);
  const repeatedRows = codeCounts.reduce((s, [, n]) => s + n, 0);
  const catTally = tally(rows, (r) => r.sector_category);
  const subTally = tally(rows, (r) => `${r.sector_category}|${r.sector_subcategory}`);
  const precTally = new Map(tally(rows, (r) => r.location_precision));
  const reasonKinds = tally(rows, (r) => r.classification_reason.replace(/".*"/, '"…"'));
  const noteTally = tally(notes.filter(Boolean).flatMap((n) => n.split('; ')), (n) => n);
  const issueTally = tally(issues, (x) => x.field);
  const statusTally = tally(rows, (r) => `${r.status} (${r.status_raw ?? 'empty'})`);

  const lines: string[] = [];
  const p = (s = '') => lines.push(s);
  p('# SubayBAYAN import · report');
  p();
  p(`Generated by \`npm run subaybayan:build\` on ${new Date().toISOString().slice(0, 10)}. Source: DILG SubayBAYAN (RBME) Excel exports, retrieved ${SUBAYBAYAN_RETRIEVED_AT} (snapshot).`);
  p(`Boundaries: ${BOUNDARY_SOURCE.name} ${BOUNDARY_SOURCE.release} \`${BOUNDARY_SOURCE.asset}\` (${BOUNDARY_SOURCE.psgc}, ${BOUNDARY_SOURCE.license}; underlying ${BOUNDARY_SOURCE.underlying}).`);
  p('Categories are LGU Tracker\'s own keyword classification, not an official DILG classification.');
  p();
  p('## Rows per file');
  p();
  p('| Dataset | File | Rows |');
  p('|---|---|---:|');
  for (const f of perFile) p(`| ${f.dataset} | ${f.file} | ${fmt(f.rows)} |`);
  p(`| | **Total** | **${fmt(total)}** |`);
  p();
  p('## Files vs portal');
  p();
  p('| Dataset | Rows in files | Portal count | Difference |');
  p('|---|---:|---:|---:|');
  for (const d of ['lgsf', 'rlip'] as const) {
    const n = byDataset(d).length;
    p(`| ${SUBAYBAYAN_DATASET_INFO[d].label} | ${fmt(n)} | ${fmt(PORTAL_COUNTS[d])} | ${n - PORTAL_COUNTS[d] > 0 ? '+' : ''}${fmt(n - PORTAL_COUNTS[d])} |`);
  }
  p();
  p('The gap is reported, not corrected: the exports are the source of truth. The portal count was read from the');
  p('portal list page at retrieval time; the exports may filter differently (for example by approval state).');
  p();
  p('## Codes and ids');
  p();
  p(`- Rows without a project code: **${fmt(noCode.length)}** (${tally(noCode, (r) => r.source_dataset).map(([d, n]) => `${d} ${fmt(n)}`).join(', ')}). Approval status of these: ${tally(noCode, (r) => r.approval_status ?? 'empty').slice(0, 5).map(([s, n]) => `${s} ${fmt(n)}`).join(', ')}.`);
  p(`- Project codes that repeat within a dataset: **${fmt(codeCounts.length)}** codes on ${fmt(repeatedRows)} rows (every row kept).`);
  if (codeCounts.length) p(`  ${codeCounts.map(([k, n]) => `\`${k.split('|')[1]}\` ×${n}`).join(', ')}`);
  p(`- Ids: the code when unique within its dataset, otherwise \`{dataset}-b{batch}-r{row}\`. All ${fmt(total)} ids are unique (asserted).`);
  p();
  p('## Status');
  p();
  p('| Status (raw) | Rows |');
  p('|---|---:|');
  for (const [k, n] of statusTally) p(`| ${k} | ${fmt(n)} |`);
  p();
  p('## Categories (LGU Tracker classification)');
  p();
  p('| Category | Rows | Share |');
  p('|---|---:|---:|');
  for (const [k, n] of catTally) p(`| ${SUBAYBAYAN_CATEGORY_LABELS[k as keyof typeof SUBAYBAYAN_CATEGORY_LABELS]} | ${fmt(n)} | ${pct(n, total)} |`);
  p();
  p('| Category | Subcategory | Rows |');
  p('|---|---|---:|');
  for (const [k, n] of subTally) {
    const [c, s] = k.split('|');
    p(`| ${c} | ${s} | ${fmt(n)} |`);
  }
  p();
  p('How rows were classified:');
  p();
  p('| Rule | Rows |');
  p('|---|---:|');
  for (const [k, n] of reasonKinds) p(`| ${k} | ${fmt(n)} |`);
  p();
  p('## Location precision');
  p();
  p('All coordinates are area centroids (a representative point inside the barangay, city/municipality or province polygon), never project sites.');
  p();
  p('| Precision | Rows | Share |');
  p('|---|---:|---:|');
  for (const k of LOCATION_PRECISIONS) p(`| ${k} | ${fmt(precTally.get(k) ?? 0)} | ${pct(precTally.get(k) ?? 0, total)} |`);
  p();
  p('Why a record stopped above barangay level (a record can have several notes):');
  p();
  p('| Note | Rows |');
  p('|---|---:|');
  for (const [k, n] of noteTally) p(`| ${k} | ${fmt(n)} |`);
  p();
  p(`### Unresolved (${fmt(unresolved.length)})`);
  p();
  if (unresolved.length === 0) p('None.');
  else {
    p('| Id | Region | Province | City/municipality | Barangay |');
    p('|---|---|---|---|---|');
    for (const r of unresolved.slice(0, 200)) p(`| ${r.id} | ${r.region ?? ''} | ${r.province ?? ''} | ${r.citymun ?? ''} | ${(r.barangay ?? '').slice(0, 60)} |`);
    if (unresolved.length > 200) p(`| … ${fmt(unresolved.length - 200)} more in .cache/subaybayan/out/unresolved.csv | | | | |`);
  }
  p();
  p('## Values that could not be parsed');
  p();
  p('Stored as null and listed in `.cache/subaybayan/out/parse-issues.csv`; never guessed.');
  p();
  if (issueTally.length === 0) p('None.');
  else {
    p('| Field | Rows |');
    p('|---|---:|');
    for (const [k, n] of issueTally) p(`| ${k} | ${fmt(n)} |`);
  }
  p();
  p('## Cost source');
  p();
  p(`- With a cost: ${fmt(rows.filter((r) => r.total_cost !== null).length)} of ${fmt(total)}; without: ${fmt(rows.filter((r) => r.total_cost === null).length)}.`);
  p('- Rule: total project cost, else contract amount, else national subsidy + LGU counterpart (zeros count as not reported).');
  const noCost = rows.filter((r) => r.total_cost === null);
  p(`- Rows without any cost, by dataset and status: ${tally(noCost, (r) => `${r.source_dataset} ${r.status}`).map(([k, n]) => `${k} ${fmt(n)}`).join(', ')}.`);
  p('  RLIP exports leave the subsidy and counterpart columns empty, and most not-yet-started RLIP projects have no cost yet.');
  mkdirSync(path.dirname(args.report), { recursive: true });
  writeFileSync(args.report, lines.join('\n') + '\n');

  console.log(`\nCategories: ${catTally.map(([k, n]) => `${k} ${fmt(n)}`).join(' · ')}`);
  console.log(`Precision:  ${LOCATION_PRECISIONS.map((k) => `${k} ${fmt(precTally.get(k) ?? 0)} (${pct(precTally.get(k) ?? 0, total)})`).join(' · ')}`);
  console.log(`Parse issues: ${fmt(issues.length)}. Output: ${path.resolve(outDir)}. Report: ${path.resolve(args.report)}.`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
