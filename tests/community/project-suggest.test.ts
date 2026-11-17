import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUGGEST_FETCH,
  SUGGEST_LIMIT,
  matchScore,
  rankSuggestions,
  shouldSearch,
  suggestParams,
  toReportTarget,
  type SuggestRow,
} from '@/lib/community/projectSuggest';

const row = (over: Partial<SuggestRow> & { record_id: string }): SuggestRow => ({
  source: 'dpwh_contracts',
  title: 'Untitled',
  ...over,
});

test('0 or 1 characters never searches', () => {
  assert.equal(shouldSearch(''), false);
  assert.equal(shouldSearch(' a '), false);
  assert.equal(suggestParams('a', { agency: '', status: '' }), null);
  assert.equal(shouldSearch('ab'), true);
});

test('the request reuses the directory query with the quick filters', () => {
  const p = suggestParams('  Iligan road ', { agency: 'DILG', status: 'ongoing' });
  assert.equal(p?.get('q'), 'Iligan road');
  assert.equal(p?.get('agency'), 'DILG');
  assert.equal(p?.get('status'), 'ongoing');
  assert.equal(p?.get('pageSize'), String(SUGGEST_FETCH));
  const plain = suggestParams('road', { agency: '', status: '' });
  assert.equal(plain?.has('agency'), false);
  assert.equal(plain?.has('status'), false);
});

test('code beats title beats place, and prefix beats contains', () => {
  const q = 'tib';
  assert.ok(matchScore(row({ record_id: 'TIB-001' }), q) < matchScore(row({ record_id: 'x1', title: 'Tibanga road' }), q));
  assert.ok(matchScore(row({ record_id: 'x1', title: 'Tibanga road' }), q) < matchScore(row({ record_id: 'x2', municipality: 'Tibungco' }), q));
  assert.ok(matchScore(row({ record_id: 'x2', municipality: 'Tibungco' }), q) < matchScore(row({ record_id: 'x3', title: 'Road to Tibanga' }), q));
  assert.ok(matchScore(row({ record_id: 'x3', title: 'Road to Tibanga' }), q) < matchScore(row({ record_id: 'x4', title: 'Altibay road' }), q));
});

test('matching ignores case and accents', () => {
  assert.equal(matchScore(row({ record_id: 'x', title: 'Parañaque Bridge' }), 'PARANAQUE'), 2);
  assert.equal(matchScore(row({ record_id: 'lime-25-13' }), 'LIME-25-13'), 0);
});

test('a project code from the DILG record wins over its record id', () => {
  const r = row({ source: 'subaybayan_lgsf', record_id: 'subaybayan_lgsf_1', project_code: 'LGSF-2024-01', title: 'Water system' });
  assert.equal(matchScore(r, 'lgsf-2024'), 1);
  assert.deepEqual(toReportTarget(r), { source: 'subaybayan_lgsf', recordId: 'subaybayan_lgsf_1', title: 'Water system', code: 'LGSF-2024-01' });
});

test('ranking is stable, de-duplicated and capped', () => {
  const rows = [
    row({ record_id: 'a', title: 'Road in Iligan' }),
    row({ record_id: 'b', title: 'Iligan bypass road' }),
    row({ record_id: 'a', title: 'Road in Iligan' }),
    row({ record_id: 'c', title: 'Something else', province: 'Iligan' }),
    row({ record_id: 'd', title: 'Iligan port' }),
  ];
  assert.deepEqual(rankSuggestions(rows, 'iligan').map((r) => r.record_id), ['b', 'd', 'c', 'a']);
  const many = Array.from({ length: 30 }, (_, i) => row({ record_id: `r${i}`, title: `Road ${i}` }));
  assert.equal(rankSuggestions(many, 'road').length, SUGGEST_LIMIT);
});

test('rows the directory matched on other fields are kept, last', () => {
  const rows = [row({ record_id: 'z', title: 'Bridge' }), row({ record_id: 'y', title: 'Abc road' })];
  assert.deepEqual(rankSuggestions(rows, 'abc').map((r) => r.record_id), ['y', 'z']);
});
