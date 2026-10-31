import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeout, loadLandingData } from '@/lib/landing/data';

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
