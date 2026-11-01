import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { canonicalRegion, countRegionsCovered, describeError, fetchWithTimeout, listDatasets, loadLandingData } from '@/lib/landing/data';

/**
 * The landing page is prerendered by `next build`, so its loader must never
 * throw or hang, whatever the database does.
 */

const URL_ = 'https://example.supabase.co';
const client = (f: typeof fetch) => createClient(URL_, 'sb_publishable_test', { auth: { persistSession: false }, global: { fetch: f } });

test('statement timeouts and errors fall back to nulls instead of failing the build', async () => {
  const timeout: typeof fetch = async () =>
    new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  const errors = console.error;
  console.error = () => {};
  try {
    const data = await loadLandingData({ client: client(timeout) });
    assert.equal(data.totalContracts, null);
    assert.equal(data.example, null);
    assert.ok(data.regions.length > 0);
    assert.ok(data.regions.every((r) => r.points.length === 0 && r.contracts === null));
  } finally {
    console.error = errors;
  }
});

test('a hanging database still settles by the deadline', async () => {
  const hang: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
  const errors = console.error;
  console.error = () => {};
  const started = Date.now();
  try {
    const data = await loadLandingData({ client: client(fetchWithTimeout(10_000, hang)), deadlineMs: 300 });
    assert.ok(Date.now() - started < 2_000, 'resolved at the deadline, not after the per-request timeout');
    assert.equal(data.totalContracts, null);
  } finally {
    console.error = errors;
  }
});

test('fetchWithTimeout aborts a stalled request and keeps the caller signal', async () => {
  const hang: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
  await assert.rejects(fetchWithTimeout(50, hang)('https://x'), (e: Error) => e.name === 'TimeoutError');
  const caller = new AbortController();
  const pending = fetchWithTimeout(10_000, hang)('https://x', { signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, (e: Error) => e.name === 'AbortError');
});

test('DILG figures fall back to null with the rest of the page', async () => {
  const failing: typeof fetch = async () =>
    new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  const errors = console.error;
  console.error = () => {};
  try {
    const data = await loadLandingData({ client: client(failing) });
    assert.equal(data.dilgProjects, null);
    assert.equal(data.regionsCovered, null);
    assert.equal(data.datasets, null);
  } finally {
    console.error = errors;
  }
});

test('regions from both agencies are counted once, whatever the spelling', () => {
  assert.equal(canonicalRegion('Region X'), canonicalRegion('REGION X - NORTHERN MINDANAO'));
  assert.equal(canonicalRegion('Region IV-A'), canonicalRegion('REGION IV-A - CALABARZON'));
  assert.notEqual(canonicalRegion('REGION I - ILOCOS REGION'), canonicalRegion('REGION II - CAGAYAN VALLEY'));
  assert.equal(canonicalRegion('Negros Island Region'), canonicalRegion('NEGROS ISLAND REGION'));
  assert.equal(canonicalRegion('Bangsamoro Autonomous Region in Muslim Mindanao'), 'BARMM');
  const dpwh = [
    { region: 'Region X', contracts: 5 },
    { region: 'Bangsamoro Autonomous Region in Muslim Mindanao', contracts: 2 },
    { region: 'Region XI', contracts: 0 },
  ];
  assert.equal(countRegionsCovered(dpwh, ['REGION X - NORTHERN MINDANAO', 'NATIONAL CAPITAL REGION']), 3);
  assert.equal(countRegionsCovered(dpwh, null), null, 'a partial answer is not shown as the whole');
  assert.equal(countRegionsCovered([{ region: 'Region X', contracts: null }], []), null);
});

test('datasets list only those with records, and null when none was read', () => {
  assert.equal(listDatasets([{ label: 'a', records: null }, { label: 'b', records: null }]), null);
  assert.deepEqual(listDatasets([{ label: 'a', records: 3 }, { label: 'b', records: 0 }, { label: 'c', records: null }]), [{ label: 'a', records: 3 }]);
});

test('a bodiless HEAD 500 is logged with its status, not as an empty message', () => {
  const line = describeError({ message: '' }, 500);
  assert.match(line, /HTTP 500/);
  assert.match(line, /statement timeout/);
  assert.match(describeError({ message: 'permission denied for table x', code: '42501' }, 401), /permission denied.*HTTP 401.*code 42501/);
});

test('DILG counts retry a cold-cache timeout and split the total by dataset', async () => {
  const tries = new Map<string, number>();
  const fake: typeof fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const key = url.pathname + url.search;
    tries.set(key, (tries.get(key) ?? 0) + 1);
    const head = (init?.method ?? 'GET') === 'HEAD';
    if (url.pathname.endsWith('/subaybayan_projects') && head) {
      // First try times out the way PostgREST answers a HEAD: 500, no body.
      if (tries.get(key) === 1) return new Response(null, { status: 500 });
      return new Response(null, { status: 206, headers: { 'content-range': '*/41194' } });
    }
    if (url.pathname.endsWith('/project_directory') && head && url.searchParams.get('source') === 'eq.subaybayan_lgsf')
      return new Response(null, { status: 206, headers: { 'content-range': '*/6963' } });
    return new Response(JSON.stringify({ message: 'not in this test' }), { status: 400, headers: { 'content-type': 'application/json' } });
  };
  const logged: string[] = [];
  const errors = console.error;
  console.error = (...args: unknown[]) => void logged.push(args.join(' '));
  try {
    const data = await loadLandingData({ client: client(fake) });
    assert.equal(data.dilgProjects, 41194);
    assert.deepEqual(
      data.datasets?.filter((d) => d.label.startsWith('DILG')).map((d) => d.records),
      [6963, 34231]
    );
    assert.ok(logged.some((l) => l.includes('DILG count (all) failed (try 1 of 2)') && l.includes('HTTP 500')));
  } finally {
    console.error = errors;
  }
});

test('the precomputed row serves the map, NEP and DILG figures in one read, without the live queries', async () => {
  const paths: string[] = [];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const fake: typeof fetch = async (input) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    paths.push(url.pathname);
    if (url.pathname.endsWith('/landing_stats'))
      return json({
        computed_at: '2026-11-01T00:00:00Z',
        stats: {
          region_points: [{ region: 'Region X', points: [[124.2, 8.2], [124.3, 8.1]] }],
          nep_proposals: 11372,
          dilg_by_dataset: [{ dataset: 'lgsf', count: 6963 }, { dataset: 'rlip', count: 34231 }],
          dilg_regions: ['REGION X - NORTHERN MINDANAO', 'NATIONAL CAPITAL REGION'],
        },
      });
    if (url.pathname.endsWith('/dpwh_directory_stats'))
      return json({
        computed_at: '2026-10-26T00:00:00Z',
        stats: { total_contracts: 5, contract_amount: { sum: 10 }, by_region: [{ value: 'Region X', count: 5 }], by_status: [{ value: 'ongoing', count: 2 }] },
      });
    return json(null);
  };
  const data = await loadLandingData({ client: client(fake) });
  assert.deepEqual(data.regions.find((r) => r.region === 'Region X'), { region: 'Region X', contracts: 5, points: [[124.2, 8.2], [124.3, 8.1]] });
  assert.ok(data.regions.filter((r) => r.region !== 'Region X').every((r) => r.contracts === 0 && r.points.length === 0));
  assert.equal(data.nepProposals, 11372);
  assert.equal(data.dilgProjects, 41194);
  assert.equal(data.regionsCovered, 2);
  assert.equal(data.ongoingContracts, 2);
  assert.equal(paths.length, 3, `three reads, got ${paths.join(', ')}`);
});
