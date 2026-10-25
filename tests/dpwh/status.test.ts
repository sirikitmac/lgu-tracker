import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAP_STATUSES,
  STATUS_COLORS,
  STATUS_STYLES,
  STATUS_TEXT_COLORS,
  statusBadgeClass,
  statusColor,
  statusLabel,
} from '@/components/dpwh/format';
import { normalizeNepRow } from '@/lib/integrations/bettergov/nep/normalize';
import { normalizeDetailsRow } from '@/lib/integrations/dpwh/nationwide/normalize';
import { LGU_STATUS_TONE, STATUS_TONES, lguStatusTone } from '@/lib/statusPalette';
import { DPWH_STATUSES, DPWH_STATUS_LABELS } from '@/types/dpwh';
import type { ProjectStatus } from '@/types/project';
import { revision, rowWithId } from './fixtures';

test('status legend keeps its labels and colors', () => {
  const legend = Object.fromEntries(DPWH_STATUSES.map((s) => [DPWH_STATUS_LABELS[s], STATUS_COLORS[s]]));
  assert.deepEqual(legend, {
    'Completed': '#16A34A', // green
    'On-going': '#2563EB', // blue
    'For procurement': '#F59E0B', // orange
    'Not yet started': '#64748B', // gray
    'Terminated': '#DC2626', // red
    'Unknown': '#94A3B8', // light gray
    'Proposed (budget)': '#7C3AED', // purple
  });
});

test('every status has one distinct marker color, text color, and badge', () => {
  for (const table of [STATUS_COLORS, STATUS_TEXT_COLORS, STATUS_STYLES]) {
    assert.deepEqual(Object.keys(table).sort(), [...DPWH_STATUSES].sort());
    assert.equal(new Set(Object.values(table)).size, DPWH_STATUSES.length, 'two statuses share a color');
  }
});

/** WCAG relative-luminance contrast against white. */
function contrastOnWhite(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

test('status text colors are readable on white (WCAG AA, 4.5:1)', () => {
  for (const [tone, { text }] of Object.entries(STATUS_TONES)) {
    assert.ok(contrastOnWhite(text) >= 4.5, `${tone} text ${text} is ${contrastOnWhite(text).toFixed(2)}:1`);
  }
});

test('unrecognized values display as Unknown, never as another status', () => {
  for (const value of [null, '', 'Suspended', 'COMPLETED', 'in_progress']) {
    assert.equal(statusLabel(value), 'Unknown');
    assert.equal(statusColor(value), STATUS_COLORS.unknown);
    assert.equal(statusBadgeClass(value), STATUS_STYLES.unknown);
  }
});

test('the contract map does not offer the proposal status it can never show', () => {
  assert.deepEqual(MAP_STATUSES, DPWH_STATUSES.filter((s) => s !== 'proposed'));
});

test('contract status comes only from the source status column, kept verbatim', () => {
  const cases: [string, string][] = [
    ['Completed', 'completed'],
    ['On-Going', 'ongoing'],
    ['ONGOING', 'ongoing'],
    ['For Procurement', 'for_procurement'],
    ['Not Yet Started', 'not_yet_started'],
    ['Terminated', 'terminated'],
    // Not DPWH contract statuses: never mapped to something more specific.
    ['Suspended', 'unknown'],
    ['Proposed', 'unknown'],
  ];
  for (const [i, [source, expected]] of cases.entries()) {
    const result = normalizeDetailsRow(rowWithId(`26ST${String(i).padStart(4, '0')}`, { status: source }), revision);
    assert.ok(result.ok);
    assert.equal(result.record.status, expected, source);
    assert.equal(result.record.source_status, source);
    assert.equal(result.record.data_warnings.includes('unknown_status'), expected === 'unknown', source);
  }
});

test('a missing source status is Unknown, not inferred from progress or procurement code', () => {
  const result = normalizeDetailsRow(rowWithId('26ST0100', { status: null, progress: 100, status_1: 'F' }), revision);
  assert.ok(result.ok);
  assert.equal(result.record.status, 'unknown');
  assert.equal(result.record.source_status, null);
  assert.equal(result.record.procurement_status_code, 'F');
});

test('every NEP 2027 record is a budget proposal, whatever its other columns say', () => {
  const row = {
    code: '2027DPWH-Proposal-09999', fiscal_year: '2027', region: 'Region X', office: 'Lanao del Norte 1st DEO',
    project_name: 'Construction of Bridge', program: 'P', sub_program: 'S', project_type: 'T',
    amount_php_thousands: '1000', amount_php: '1000000', document_count: '1', document_types: 'POW',
  };
  const result = normalizeNepRow(row);
  assert.ok(result.ok);
  assert.equal(result.record.status, 'proposed');
  assert.equal(result.record.amount_label, 'Proposed amount (NEP)');
  assert.deepEqual(result.record.source_record, row);
});

test('LGU project statuses use the same colors as the matching DPWH statuses', () => {
  const pairs: [ProjectStatus, (typeof DPWH_STATUSES)[number]][] = [
    ['Completed', 'completed'],
    ['In Progress', 'ongoing'],
    ['Procurement', 'for_procurement'],
    ['Planned', 'not_yet_started'],
  ];
  for (const [lgu, dpwh] of pairs) assert.equal(lguStatusTone(lgu).fill, STATUS_COLORS[dpwh], lgu);
  assert.equal(lguStatusTone('Delayed').fill, STATUS_TONES.red.fill);
  // Planned and Procurement are separate stages and must not share a color.
  assert.notEqual(LGU_STATUS_TONE.Planned, LGU_STATUS_TONE.Procurement);
});
