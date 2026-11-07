import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BP_MAX_RESULTS, searchProjects, toDirectoryParams, getDirectoryOverview, type BpSupabase } from '@/lib/bp/data';
import { aiConfig, AiHttpError, answerWithAi, BpAiError, classifyAiError, systemInstruction, type AiConfig } from '@/lib/bp/ai';
import { isDailyLimit } from '@/lib/bp/groq';
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
  assert.deepEqual(toolDeclarations(null).map((t) => t.function.name), ['get_directory_overview', 'search_projects']);
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

// ---------------------------------------------------------------------------
// AI client (Groq, OpenAI-compatible). fetch is mocked; no network, no real key.

const TEST_KEY = 'test-key-not-real';
const PROJECT_ROW = {
  source: 'dpwh_contracts', record_id: '21LJ0012', title: 'ROAD', contract_name: 'Construction of Road, Iligan City',
  region: 'Region X', province: 'Lanao del Norte', category: 'roads_highways', status: 'ongoing', contract_amount: '1000000.50',
  budget: null, amount_label: 'Contract amount', progress: 45, implementing_office: 'Lanao del Norte 1st DEO',
  contractor: 'ACME', start_date: '2024-01-01', completion_date: null, infra_year: 2024,
};

type FetchCall = { url: string; headers: Record<string, string>; body: Record<string, any> };
type Reply = { status?: number; json?: unknown } | ((call: FetchCall, signal: AbortSignal) => Promise<Response>);

/** Replaces global fetch for one test; each request takes the next reply. */
async function withFetch<T>(replies: Reply[], run: (calls: FetchCall[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: FetchCall = { url: String(input), headers: { ...(init?.headers as Record<string, string>) }, body: JSON.parse(String(init?.body)) };
    calls.push(call);
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`unexpected request #${calls.length}`);
    if (typeof reply === 'function') return reply(call, init!.signal!);
    return new Response(JSON.stringify(reply.json ?? {}), { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const reply = (message: Record<string, unknown>) => ({ json: { choices: [{ message: { role: 'assistant', ...message } }] } });
const fnCall = (id: string, name: string, args: unknown) => ({ id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
const toolCall = (name: string, args: unknown, id = 'call_1') => reply({ content: null, tool_calls: [fnCall(id, name, args)] });
const finalAnswer = (content: string) => reply({ content });
const apiError = (status: number, message: string, code?: string) => ({ status, json: { error: { message, type: 'x', code } } });
/** Never answers; rejects when the request is aborted, like fetch does. */
const hang = (_call: FetchCall, signal: AbortSignal) =>
  new Promise<Response>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));

/** Each test uses its own model names: the busy cooldown is per model and per process. */
const cfg = (...models: string[]): AiConfig => ({ baseUrl: 'https://groq.example/openai/v1', apiKey: TEST_KEY, models });
const ask = (config: AiConfig, supabase: BpSupabase, extra: { signal?: AbortSignal; attemptTimeoutMs?: number } = {}) =>
  answerWithAi({ config, supabase, overview: null, history: [], question: 'Projects in Iligan?', signal: extra.signal ?? AbortSignal.timeout(5_000), attemptTimeoutMs: extra.attemptTimeoutMs });

function withEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
}

test('AI config is server-env only; no GROQ_API_KEY means preview / not configured', () => {
  const none = { GROQ_API_KEY: undefined, GROQ_MODEL: undefined, GROQ_FALLBACK_MODEL: undefined };
  withEnv(none, () => assert.equal(aiConfig(), null, 'the route serves the preview (dev) or "not configured" (prod)'));
  withEnv({ ...none, GROQ_API_KEY: `  ${TEST_KEY}  ` }, () => {
    assert.deepEqual(aiConfig(), { baseUrl: 'https://api.groq.com/openai/v1', apiKey: TEST_KEY, models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] });
  });
  withEnv({ ...none, GROQ_API_KEY: TEST_KEY, GROQ_MODEL: 'qwen/qwen3-32b', GROQ_FALLBACK_MODEL: 'qwen/qwen3-32b' }, () => {
    assert.deepEqual(aiConfig()?.models, ['qwen/qwen3-32b']);
  });
  assert.match(systemInstruction('2026-10-26'), /untrusted data/);
});

test('tools are declared in OpenAI function format with lowercase JSON Schema types', () => {
  for (const t of toolDeclarations(null)) {
    assert.equal(t.type, 'function');
    assert.equal(t.function.parameters.type, 'object');
    assert.ok(t.function.description.length > 20);
  }
  const props = toolDeclarations(null)[1].function.parameters.properties as Record<string, { type: string }>;
  for (const p of Object.values(props)) assert.match(p.type, /^(string|integer)$/);
});

test('a tool round: the model calls search_projects, gets the rows, and answers', async () => {
  const { client, calls: db } = fakeSupabase({ project_directory: { count: 1, data: [PROJECT_ROW] } });
  await withFetch([toolCall('search_projects', { query: 'iligan', limit: 3 }, 'call_abc'), finalAnswer('One contract matches: 21LJ0012.')], async (calls) => {
    const res = await ask(cfg('t1-a', 't1-b'), client);
    assert.equal(res.answer, 'One contract matches: 21LJ0012.');
    assert.deepEqual(res.records.map((r) => r.record_id), ['21LJ0012']);

    assert.equal(calls.length, 2);
    const [first, second] = calls;
    assert.equal(first.url, 'https://groq.example/openai/v1/chat/completions');
    assert.equal(first.headers.Authorization, `Bearer ${TEST_KEY}`);
    assert.equal(first.body.model, 't1-a');
    assert.equal(first.body.stream, false);
    assert.equal(first.body.tool_choice, 'auto');
    assert.equal(first.body.messages[0].role, 'system');
    assert.deepEqual(first.body.tools.map((t: any) => t.function.name), ['get_directory_overview', 'search_projects']);

    const msgs = second.body.messages;
    const assistant = msgs.at(-2);
    const tool = msgs.at(-1);
    assert.equal(assistant.role, 'assistant');
    assert.equal(assistant.tool_calls[0].id, 'call_abc');
    assert.equal(assistant.tool_calls[0].type, 'function');
    assert.equal(assistant.tool_calls[0].function.name, 'search_projects');
    assert.equal(typeof assistant.tool_calls[0].function.arguments, 'string');
    assert.deepEqual(Object.keys(tool).sort(), ['content', 'role', 'tool_call_id']);
    assert.equal(tool.tool_call_id, 'call_abc');
    assert.equal(JSON.parse(tool.content).result.total_matches, 1);
  });
  assert.ok(db.some((c) => c.table === 'project_directory' && c.method === 'textSearch'));
});

test('tool arguments that fail validation run no query; the model is told and answers', async () => {
  const { client, calls: db } = fakeSupabase({});
  await withFetch([toolCall('search_projects', { status: "ongoing'; drop table dpwh_contracts; --" }), finalAnswer('That status does not exist.')], async (calls) => {
    const res = await ask(cfg('t2-a'), client);
    assert.equal(res.answer, 'That status does not exist.');
    const tool = calls[1].body.messages.at(-1);
    assert.equal(tool.role, 'tool');
    assert.match(JSON.parse(tool.content).error, /^invalid_arguments/);
  });
  assert.equal(db.length, 0, 'no database call for rejected arguments');
});

test('unknown tools are refused and the per-round call limit applies', async () => {
  const { client, calls: db } = fakeSupabase({ dpwh_directory_stats: { data: OVERVIEW_STATS }, infrastructure_projects: { count: 1 } });
  const many = reply({ content: null, tool_calls: [
    fnCall('c0', 'execute_sql', { sql: 'delete from dpwh_contracts' }),
    ...Array.from({ length: 5 }, (_, i) => fnCall(`c${i + 1}`, 'get_directory_overview', {})),
  ] });
  await withFetch([many, finalAnswer('Done.')], async (calls) => {
    await ask(cfg('t3-a'), client);
    const toolMsgs = calls[1].body.messages.filter((m: any) => m.role === 'tool');
    assert.equal(toolMsgs.length, 4, 'MAX_CALLS_PER_ROUND');
    assert.match(JSON.parse(toolMsgs[0].content).error, /Unknown tool/);
  });
  assert.ok(db.every((c) => c.method !== 'rpc'));
});

test('tool calls without an id get one, so every result is paired', async () => {
  const { client } = fakeSupabase({ dpwh_directory_stats: { data: OVERVIEW_STATS }, infrastructure_projects: { count: 1 } });
  const noId = reply({ content: null, tool_calls: [{ type: 'function', function: { name: 'get_directory_overview', arguments: '{}' } }] });
  await withFetch([noId, finalAnswer('Ok.')], async (calls) => {
    await ask(cfg('t10-a'), client);
    const msgs = calls[1].body.messages;
    assert.ok(msgs.at(-2).tool_calls[0].id);
    assert.equal(msgs.at(-1).tool_call_id, msgs.at(-2).tool_calls[0].id);
  });
});

test('after MAX_TOOL_ROUNDS the last request carries no tools, so the model must answer', async () => {
  const { client } = fakeSupabase({ dpwh_directory_stats: { data: OVERVIEW_STATS }, infrastructure_projects: { count: 1 } });
  const loop = toolCall('get_directory_overview', {});
  await withFetch([loop, loop, loop, finalAnswer('Final.')], async (calls) => {
    assert.equal((await ask(cfg('t4-a'), client)).answer, 'Final.');
    assert.equal(calls.length, 4);
    assert.ok(calls.slice(0, 3).every((c) => Array.isArray(c.body.tools)));
    assert.equal(calls[3].body.tools, undefined);
    assert.equal(calls[3].body.tool_choice, undefined);
  });
});

test('429 on the primary falls back to the second model, which then keeps the conversation', async () => {
  const { client } = fakeSupabase({ dpwh_directory_stats: { data: OVERVIEW_STATS }, infrastructure_projects: { count: 1 } });
  await withFetch([apiError(429, 'Rate limit reached on requests per minute (RPM)'), toolCall('get_directory_overview', {}), finalAnswer('Three contracts.')], async (calls) => {
    assert.equal((await ask(cfg('t5-a', 't5-b'), client)).answer, 'Three contracts.');
    assert.deepEqual(calls.map((c) => c.body.model), ['t5-a', 't5-b', 't5-b']);
  });
  // The busy model is skipped for a while: the next question goes straight to the fallback.
  await withFetch([finalAnswer('Hi.')], async (calls) => {
    await ask(cfg('t5-a', 't5-b'), client);
    assert.equal(calls[0].body.model, 't5-b');
  });
});

test('daily limit falls back to the second model; both exhausted maps to "daily_limit"', async () => {
  const { client } = fakeSupabase({});
  const daily = apiError(429, 'Rate limit reached for model `x` on tokens per day (TPD): Limit 200000, Used 199999', 'rate_limit_exceeded');
  await withFetch([daily, finalAnswer('From the fallback.')], async (calls) => {
    assert.equal((await ask(cfg('t11-a', 't11-b'), client)).answer, 'From the fallback.');
    assert.deepEqual(calls.map((c) => c.body.model), ['t11-a', 't11-b']);
  });
  await withFetch([daily], async () => {
    assert.equal(classifyAiError(await ask(cfg('t11-c'), client).catch((e) => e)), 'daily_limit');
  });
  assert.ok(isDailyLimit(429, 'on requests per day (RPD): Limit 1000'));
  assert.ok(!isDailyLimit(429, 'on tokens per minute (TPM): Limit 8000'));
});

test('a slow primary times out per attempt and falls back; a slow last model is a timeout', async () => {
  const { client } = fakeSupabase({});
  await withFetch([hang, finalAnswer('From the fallback.')], async (calls) => {
    assert.equal((await ask(cfg('t6-a', 't6-b'), client, { attemptTimeoutMs: 30 })).answer, 'From the fallback.');
    assert.deepEqual(calls.map((c) => c.body.model), ['t6-a', 't6-b']);
  });
  await withFetch([hang], async () => {
    const error = await ask(cfg('t6-c'), client, { signal: AbortSignal.timeout(50) }).catch((e) => e);
    assert.equal(classifyAiError(error), 'timeout');
  });
});

test('a rejected key (401) maps to "auth", is not retried on the fallback, and does not leak the key', async () => {
  const { client } = fakeSupabase({});
  await withFetch([apiError(401, 'Invalid API Key', 'invalid_api_key')], async (calls) => {
    const error = await ask(cfg('t7-a', 't7-b'), client).catch((e) => e);
    assert.equal(calls.length, 1, 'no retry on another model');
    assert.ok(error instanceof AiHttpError);
    assert.equal(classifyAiError(error), 'auth');
    assert.doesNotMatch(`${error.message} ${JSON.stringify(error)}`, new RegExp(TEST_KEY));
  });
});

test('AI errors are classified for the route', () => {
  assert.equal(classifyAiError(new AiHttpError(429, 'x')), 'rate_limited');
  assert.equal(classifyAiError(new AiHttpError(429, 'x', 'daily_limit')), 'daily_limit');
  assert.equal(classifyAiError(new AiHttpError(413, 'Request too large')), 'too_large');
  assert.equal(classifyAiError(new AiHttpError(403, 'x')), 'auth');
  assert.equal(classifyAiError(new AiHttpError(500, 'x')), 'upstream');
  assert.equal(classifyAiError(new AiHttpError(503, 'x')), 'busy');
  assert.equal(classifyAiError(new AiHttpError(504, 'x')), 'timeout');
  assert.equal(classifyAiError(Object.assign(new Error('t'), { name: 'TimeoutError' })), 'timeout');
  assert.equal(classifyAiError(new TypeError('fetch failed')), 'upstream');
  assert.equal(classifyAiError(new BpAiError('database', 'x')), 'database');
});

test('an empty model reply is an "empty" failure, not a blank answer', async () => {
  const { client } = fakeSupabase({});
  await withFetch([finalAnswer('   ')], async () => {
    assert.equal(classifyAiError(await ask(cfg('t8-a'), client).catch((e) => e)), 'empty');
  });
});
