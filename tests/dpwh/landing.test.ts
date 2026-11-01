import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { canonicalRegion, countRegionsCovered, fetchWithTimeout, listDatasets, loadLandingData } from '@/lib/landing/data';

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
