import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readableTitle } from '@/components/dpwh/format';

test('readable title keeps place names capitalized and lowers joining words', () => {
  assert.equal(
    readableTitle('CONSTRUCTION OF CONCRETE BRIDGE - DAVAO CITY COASTAL BYPASS ROAD (BAGO APLAYA - STA. ANA WHARF - R. CASTILLO), PACKAGE 1, DAVAO CITY'),
    'Construction of Concrete Bridge - Davao City Coastal Bypass Road (Bago Aplaya - Sta. Ana Wharf - R. Castillo), Package 1, Davao City'
  );
});

test('readable title leaves acronyms, codes, initials and roman numerals as published', () => {
  assert.equal(
    readableTitle('PR-08, R.T. LIM - SIOCON ROAD, ZAMBOANGA DEL NORTE UNDER ADB LOAN NO. 3631-PHI: MINDANAO ROAD SECTOR PROJECT (IGCMRSP)'),
    'PR-08, R.T. Lim - Siocon Road, Zamboanga del Norte under ADB Loan No. 3631-PHI: Mindanao Road Sector Project (IGCMRSP)'
  );
  assert.equal(readableTitle('PR-06, ALICIA - MALANGAS ROAD (K1769+648.00 - K1793+751.43)'), 'PR-06, Alicia - Malangas Road (K1769+648.00 - K1793+751.43)');
  assert.equal(readableTitle('DPWH REGION VII, PHASE II, INCL. ROW, JCT. ROAD'), 'DPWH Region VII, Phase II, Incl. ROW, Jct. Road');
});

test('readable title capitalizes a leading particle and keeps mixed-case titles unchanged', () => {
  assert.equal(readableTitle('OF ROADS AND BRIDGES'), 'Of Roads and Bridges');
  assert.equal(readableTitle('Rehabilitation of Iligan City Road'), 'Rehabilitation of Iligan City Road');
  assert.equal(readableTitle('NO'), 'NO');
});
