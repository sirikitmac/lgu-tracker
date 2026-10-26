import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '@google/genai';
import { BP_MAX_RESULTS, searchProjects, toDirectoryParams, getDirectoryOverview, type BpSupabase } from '@/lib/bp/data';
import { BpGeminiError, classifyGeminiError, geminiConfig, systemInstruction } from '@/lib/bp/gemini';
import { planPreview, previewSearchAnswer } from '@/lib/bp/preview';
import { runTool, toolDeclarations } from '@/lib/bp/tools';
import { createRateLimiter, validateChatRequest } from '@/lib/bp/validate';

/** Records every builder call; resolves with the canned result for the table. */
function fakeSupabase(results: Record<string, { data?: unknown; error?: { message: string } | null; count?: number | null }>) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client: BpSupabase = {
    from(table: string) {
      const result = { data: null, error: null, count: null, ...results[table] };
      const builder: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      for (const method of ['select', 'eq', 'contains', 'ilike', 'textSearch', 'order', 'range', 'maybeSingle']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      return builder;
    },
  };
  return { client, calls };
}

const OVERVIEW_STATS = {
  computed_at: '2026-10-25T14:11:12Z',
  last_successful_sync_at: null,
  stats: {
    total_contracts: 3,
    contract_amount: { sum: '1500.5', contracts_with_value: 2 },
    by_region: [{ value: 'Region X', count: 2 }, { value: 'Region VII', count: 1 }],
    by_category: [{ value: 'roads_highways', count: 3 }],
    by_status: [{ value: 'ongoing', count: 1 }, { value: 'completed', count: 2 }],
    provinces: [
      { region: 'Region X', province: 'Lanao del Norte', count: 2 },
      { region: 'Region VII', province: 'Lanao del Norte', count: 1 },
      { region: 'Region VII', province: 'Cebu', count: 1 },
    ],
    municipalities: [],
    offices: [],
    infra_years: [{ value: 2024, count: 3 }],
  },
};

test('validateChatRequest rejects empty, oversized, and malformed input', () => {
  assert.equal(validateChatRequest(null).ok, false);
  assert.equal(validateChatRequest({ question: '   ' }).ok, false);
  assert.equal(validateChatRequest({ question: 'x'.repeat(501) }).ok, false);
  assert.equal(validateChatRequest({ question: 'hi', history: 'nope' }).ok, false);
  assert.equal(validateChatRequest({ question: 'hi', history: [{ role: 'system', content: 'x' }] }).ok, false);
});

test('validateChatRequest trims history and starts it with a user turn', () => {
  const history = [
    { role: 'assistant', content: 'welcome' },
    ...Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` })),
  ];
  const r = validateChatRequest({ question: '  How many?  ', history });
  assert.ok(r.ok);
  assert.equal(r.question, 'How many?');
  assert.ok(r.history.length <= 10);
  assert.equal(r.history[0].role, 'user');
});

test('rate limiter blocks after the limit and recovers after the window', () => {
  const check = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.ok(check('a', 0).ok);
  assert.ok(check('a', 10).ok);
  const blocked = check('a', 20);
  assert.equal(blocked.ok, false);
  assert.ok(check('b', 20).ok, 'other clients are unaffected');
  assert.ok(check('a', 1500).ok);
});

test('model arguments are validated by the directory parser and clamped', () => {
  const p = toDirectoryParams({ query: ' iligan ', status: 'ongoing', limit: 999, region: 42 });
  assert.equal(p.get('q'), 'iligan');
  assert.equal(p.get('status'), 'ongoing');
  assert.equal(p.get('pageSize'), String(BP_MAX_RESULTS));
  assert.equal(p.get('region'), null, 'non-string arguments are dropped');
});

test('searchProjects rejects unknown enum values before any query runs', async () => {
  const { client, calls } = fakeSupabase({});
  const res = await searchProjects(client, { status: "ongoing'; drop table dpwh_contracts; --" });
  assert.equal(res.ok, false);
  assert.equal(calls.length, 0);
});

test('searchProjects reads project_directory only, with safe filters, and maps records', async () => {
  const { client, calls } = fakeSupabase({
    project_directory: {
      count: 1117,
      data: [{
        source: 'dpwh_contracts', record_id: '21LJ0012', title: 'ROAD', contract_name: 'Construction of Road, Iligan City',
        region: 'Region X', province: 'Lanao del Norte', category: 'roads_highways', status: 'ongoing', contract_amount: '1000000.50',
        budget: null, amount_label: 'Contract amount', progress: 45, implementing_office: 'Lanao del Norte 1st DEO',
        contractor: 'ACME', start_date: '2024-01-01', completion_date: null, infra_year: 2024,
      }],
    },
  });
  const res = await searchProjects(client, { query: 'Iligan & !city | (x)', category: 'roads_highways', limit: 3 });
  assert.ok(res.ok);
  assert.equal(res.data.total_matches, 1117);
  const r = res.data.records[0];
  assert.equal(r.title, 'Construction of Road, Iligan City');
  assert.equal(r.href, '/projects/21LJ0012');
  assert.equal(r.amount_php, 1000000.5);
  assert.equal(r.status, 'On-going');

  assert.deepEqual([...new Set(calls.map((c) => c.table))], ['project_directory']);
  const methods = new Set(calls.map((c) => c.method));
  for (const write of ['insert', 'update', 'upsert', 'delete', 'rpc']) assert.ok(!methods.has(write));
  const ts = calls.find((c) => c.method === 'textSearch');
  assert.equal(ts?.args[1], 'iligan:* & city:* & x:*', 'tsquery operators in user text are stripped');
  assert.deepEqual(calls.find((c) => c.method === 'range')?.args, [0, 2]);
});

test('a failed count keeps the records but reports the total as unknown', async () => {
  let n = 0;
  const client: BpSupabase = {
    from() {
      const isCount = n++ === 1;
      const result = isCount ? { data: null, error: { message: 'canceling statement due to statement timeout' }, count: null } : { data: [], error: null, count: null };
      const b: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      for (const m of ['select', 'eq', 'contains', 'ilike', 'textSearch', 'order', 'range']) b[m] = () => b;
      return b;
    },
  };
  const res = await searchProjects(client, { status: 'terminated' });
  assert.ok(res.ok);
  assert.equal(res.data.total_matches, null);
  assert.match(previewSearchAnswer({ ...res.data, records: [] }), /No records match/);
});

test('getDirectoryOverview returns deterministic totals from the stats cache', async () => {
  const { client } = fakeSupabase({ dpwh_directory_stats: { data: OVERVIEW_STATS }, infrastructure_projects: { count: 11372 } });
  const res = await getDirectoryOverview(client);
  assert.ok(res.ok);
  const c = res.data.dpwh_contracts!;
  assert.equal(c.total_contracts, 3);
  assert.equal(c.reported_contract_amount_sum_php, 1500.5);
  assert.deepEqual(c.provinces[0], { province: 'Lanao del Norte', contracts: 3 });
  assert.equal(res.data.other_sources[0].records, 11372);
});

test('database errors surface as a failed tool run without details', async () => {
  const { client } = fakeSupabase({ dpwh_directory_stats: { error: { message: 'connection refused to db.internal:5432' } } });
  const run = await runTool(client, 'get_directory_overview', {});
  assert.equal(run.failed, true);
  assert.doesNotMatch(JSON.stringify(run.response), /5432|internal/);
});

test('only the two read-only tools exist; unknown tool names do nothing', async () => {
  const { client, calls } = fakeSupabase({});
  const run = await runTool(client, 'execute_sql', { sql: 'delete from dpwh_contracts' });
  assert.match(String(run.response.error), /Unknown tool/);
  assert.equal(calls.length, 0);
  assert.deepEqual(toolDeclarations(null).map((t) => t.name), ['get_directory_overview', 'search_projects']);
});

test('preview planner routes the suggested questions to the right query', async () => {
  const { client } = fakeSupabase({ dpwh_directory_stats: { data: OVERVIEW_STATS }, infrastructure_projects: { count: 1 } });
  const ov = await getDirectoryOverview(client);
  assert.ok(ov.ok);
  const o = ov.data;
  assert.deepEqual(planPreview('How many contracts are listed in the directory?', o), { tool: 'overview', focus: 'count' });
  assert.deepEqual(planPreview('Which region has the most reported contracts?', o), { tool: 'overview', focus: 'region' });
  assert.deepEqual(planPreview('What is the total reported contract amount?', o), { tool: 'overview', focus: 'amount' });
  assert.deepEqual(planPreview('Show me road and highway projects.', o), { tool: 'search', args: { limit: 5, category: 'roads_highways' } });
  assert.deepEqual(planPreview('Find projects in Iligan City.', o), { tool: 'search', args: { limit: 5, query: 'Iligan' } });
  assert.deepEqual(planPreview('Which contracts are marked as ongoing?', o), { tool: 'search', args: { limit: 5, status: 'ongoing' } });
  assert.deepEqual(planPreview('Bridges in Cebu', o), { tool: 'search', args: { limit: 5, category: 'bridges', province: 'Cebu' } });
});

test('Gemini config is server-env only and errors are classified without leaking', () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal(geminiConfig(), null);
  process.env.GEMINI_API_KEY = '  test-key  ';
  assert.equal(geminiConfig()?.apiKey, 'test-key');
  assert.deepEqual(geminiConfig()?.models, ['gemini-3.5-flash', 'gemini-3.5-flash-lite']);
  if (saved === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = saved;

  assert.equal(classifyGeminiError(new ApiError({ message: 'quota', status: 429 })), 'rate_limited');
  assert.equal(classifyGeminiError(new ApiError({ message: 'API key not valid', status: 400 })), 'auth');
  assert.equal(classifyGeminiError(new ApiError({ message: 'boom', status: 500 })), 'upstream');
  assert.equal(classifyGeminiError(new ApiError({ message: 'high demand', status: 503 })), 'busy');
  assert.equal(classifyGeminiError(Object.assign(new Error('t'), { name: 'TimeoutError' })), 'timeout');
  assert.equal(classifyGeminiError(new BpGeminiError('database', 'x')), 'database');
  assert.match(systemInstruction('2026-10-26'), /untrusted data/);
});
