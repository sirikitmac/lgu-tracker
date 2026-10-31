# Amount audit (2026-11-01)

Every amount the app shows was compared with the source file the import used,
same field, same row. **No parsing or import bug was found; no stored value was
changed.** Reported values stay as reported; suspicious ones are flagged, not edited.

The audit scripts are throw-away and lived in the gitignored `.cache/audit/`; the
method is described here so it can be repeated.

## Summary

| Dataset | Rows in DB | Compared | Matched the source exactly | Mismatches | Bugs |
|---|--:|--:|--:|--:|--:|
| DPWH contracts (`dpwh_contracts`) | 92,581 | **all** rows × 4 amount fields | 92,581 / 92,581 on every field (nulls only where the source is null) | 0 | 0 |
| DPWH NEP 2027 (`infrastructure_projects`, source `dpwh_nep_2027`) | 11,372 | all rows | 11,372 / 11,372 | 0 | 0 |
| DILG SubayBAYAN (`subaybayan_projects`) | 41,194 | **all** rows × subsidy, counterpart, total, contract | 41,194 / 41,194 for the cost shown; subsidy and counterpart 41,194 / 41,194 | 0 (17 reported totals of `0.0` are stored as null — documented rule, see below) | 0 |

The requested samples (DPWH top 50 + 20 random; DILG top 50 + 30 random) are
listed row by row in the appendix. They are a subset of the full comparison and
all match.

## 1. DPWH

**Source.** BetterGov.ph `bettergovph/dpwh-transparency-data`,
`dpwh_transparency_data_all_details.parquet` at revision
`9617fe6833de522e7151947b2ca7529a4e46273c` (the revision stored on every
`dpwh_contracts` row). 248,421 source rows, no duplicated contract IDs, so each
DB row maps to exactly one source row.

**Field mapping** (`src/lib/integrations/dpwh/nationwide/normalize.ts`), confirmed not swapped:

| DB column | Source column | Source type | Shown as |
|---|---|---|---|
| `contract_amount` | `awardAmount` | text (`"26,000,000.00"`, `"4781700"`, `"9698080.08"`, `"null"`) | "Contract amount" |
| `approved_budget` | `abc` | text (`"4950000.00"`) | "Approved budget (ABC)" |
| `budget` | `budget` | double | "DPWH budget" (detail page only) |
| `amount_paid` | `amountPaid` | int64 | "Amount paid — as reported; DPWH usually reports 0" |

**How it was checked.** All 248,421 source rows were read for these four
columns, and every DB row was compared with the value our parser should produce
from its source row (tolerance ₱0.005). Separately, a lenient reading
(any digits in the cell) was compared, to catch digits the parser might drop.

- Exact matches: budget 92,581; approved_budget 92,522 + 59 null in source;
  contract_amount 92,311 + 270 null in source; amount_paid 92,581.
- Values the parser dropped: **0**. Every text amount has one of the shapes
  `9.9`, `9`, `9,9.9`, `9,9,9.9`, `9,9,9,9.9`, or the literal `null`.
- In the source, 1,124 `budget` values (of 248,421 rows) have more than two decimals (a double); they are
  stored as given.

**Units.** Pesos, not centavos or thousands: no contract amount or budget is
below ₱10,000. `contract_amount / approved_budget` is between 0.8 and 1.0 for
91,036 of the 92,311 rows that have both, which is what an award against its ceiling looks like.

**Exact ×10 / ×100 / ×1000 / ×10⁴ / ×10⁵ / ×10⁶ multiples** between budget, ABC
and contract amount in the same record: **0**.

**Fields that disagree by 2× or more: 87 rows**, all reported exactly as the
source has them. Two patterns, neither a fixed scale factor:

- `budget` far below the contract amount (e.g. 22KA0100: contract
  ₱4,856,673.14, budget ₱26,250.00). The source `budget` is often a partial or
  current-year figure; the app does not use it as the headline amount.
- Foreign-assisted "Z" contracts awarded above the ABC (e.g. 21Z00007:
  ₱9,109,964,205.23 award on a ₱7,661,870,651.55 ABC).

**amount_paid is 0 on every row.** The detail page already labels it "As reported;
DPWH usually reports 0. Not disbursement data."

## 2. NEP 2027

**Source.** `bettergovph/dpwh-nep-2027`, `dpwh-nep-projects-2027.csv` at revision
`a7594ab73161db54d8b237bca79cc89c61288a54`.

The source has both `amount_php_thousands` (budget-document units) and `amount_php`.
We store `amount_php`, which is exactly `amount_php_thousands × 1000` on all
11,372 rows (13 rows have a fractional thousands value, e.g. `1234.5`; their
`amount_php` is still the exact peso value). The importer already warns
`amount_mismatch` if the two ever disagree; none do. The label is
"Proposed amount (NEP)". Range ₱600,000 – ₱2,589,421,000, median ₱13,000,000:
consistent with pesos, not thousands.

## 3. DILG SubayBAYAN

**Source.** The 22 Excel exports in `~/Downloads/SubayBayan_RBME`
(4 LGSF, 18 RLIP), as used by `npm run subaybayan:build`.

**How it was checked.** For every DB row, the cells at its `source_file` /
`source_row` were re-read straight from the worksheet XML with an independent
reader (not `scripts/subaybayan/lib/xlsx.ts`). Columns: Q national subsidy,
R LGU counterpart, AQ total project cost, EE contract amount.

| Column | Excel number | Text `#,###.##` | Blank | Other text |
|---|--:|--:|--:|--:|
| AQ total project cost | 71 | 17,601 | 23,522 | 0 |
| Q national subsidy | 1 | 6,924 | 34,269 | 0 |
| R LGU counterpart | 1,338 | 163 | 39,693 | 0 |
| EE contract amount | 7,167 | 0 | 34,027 | 0 |

Every amount cell uses the General number format (no custom format such as
`#,##0,` that would display thousands).

- National subsidy and LGU counterpart: 41,194 / 41,194 match.
- Total project cost: 41,177 match the cell (incl. the 10 replaced totals,
  stored in `total_cost_reported`). The other **17 are cells containing `0.0`**
  with no other amount on the row; by the documented rule ("a ₱0 total means
  not reported") they are stored as null and shown as "No cost". Not a bug.
- **Cost shown** (`total_cost`), re-derived independently from the four cells
  with the documented order (reported total unless > 20× the row's own
  reference amount; else contract amount; else subsidy + counterpart):
  41,194 / 41,194 match.
- The DB has no contract-amount column; the contract amount is used only as the
  fallback above.

**Parser** (`parseMoney` in `scripts/subaybayan/lib/extract.ts`): tests already
cover `"3,900,169.00"` → 3900169, Excel number 2490000, blank → null, and text
(`"about 2M"` → null with a parse issue). Excel numbers are rounded to centavos
(`Math.round(v*100)/100`), which keeps every value in the files exactly.
One looseness, not a bug in this data: commas are stripped without checking
their position, so a hypothetical `"12,34"` would read as 1234. No cell has a
misplaced comma (0 "other text" cells above).

### The 10 replaced totals

The reported total is kept in `total_cost_reported` and shown in the panel as a
note; `total_cost` holds the row's own contract amount or subsidy + counterpart.
Five are ~100× / ~1000× decimal slips. The others are less clear-cut and are
worth a human look (they are replaced by the > 20× rule, not because they are a
power of ten):

- SBDP-2025-10-43-08-076-01 — 50,667× (₱101.07 B against ₱1.99 M); certainly an entry error.
- LIME-25-16-85-05-000-1 — 620×; LIME-25-11-23-17-000-11 — 252×.
- GEF-26-14-44-09-000-16 — 38× (₱147.8 M reported, ₱3,900,169.00 shown).
- SBDP-26-05-17-08-000-1 — 20.8× (₱208.4 M against a ₱10 M subsidy), just over the threshold.

See the appendix table for every row (reported vs shown, basis, ratio).

### The 25 "Amount not verified" rows

All 25 show the reported total unchanged (≥ ₱100 M and ≥ 100× the
subcategory median). Reasons, from the table in the appendix:

- 15 have a reported total and **no** subsidy, counterpart or contract amount
  to compare with (e.g. LIME-26-11-23-17-000-11, ₱8.79 B for a public market in
  Samal; RLIP-25-10-13-01-000-2, ₱7.16 B water system in Baungon). Nothing in
  the row supports or contradicts the figure.
- 9 FALGU rows where the national subsidy itself equals the total
  (₱164 M – ₱500 M): internally consistent, but extreme for the subcategory.
  These may well be real large LGU grants (e.g. Pamantasan ng Lungsod ng Maynila,
  Valenzuela local roads).
- 1 (FALGU-25-08-60-00-000-2, Calbayog) where the total ₱326,986,093.97 is
  ~10.9× its own subsidy (₱30 M) and contract amount (₱29,956,093.97) — below the
  20× replacement rule, so kept and flagged. Likely an entry slip, left for review.

## 4. Proposed DPWH "Amount not verified" rule (dry run, not enabled)

Rule tried: amount (contract amount, else budget) ≥ 100× the median of its
category **and** ≥ ₱1 B, unless the title, programme or funding instrument names
a large programme (by-pass, expressway, flood control / mitigation, mega,
diversion road, coastal road, circumferential, viaduct, interchange, flyover,
ADB, JICA, WB / World Bank, loan, foreign-assisted, ODA), or the record's own
ABC or budget is within 2× of the amount.

Category medians: roads ₱16.9 M, bridges ₱18.5 M, flood control ₱42.7 M,
buildings ₱3.9 M, water ₱3.5 M.

| Contract ID | Contract amount | × median | ABC | Budget | Exempt because | Would flag |
|---|--:|--:|--:|--:|---|:-:|
| 21Z00007 | ₱9,109,964,205 | 539× | ₱7,661,870,652 | ₱9,109,964,205 | "BYPASS", JICA loan; ABC/budget agree | no |
| 22L00004 | ₱2,017,277,778 | 109× | ₱2,048,214,430 | ₱2,041,419,051 | "BYPASS"; ABC/budget agree | no |
| 19Z00012 | ₱1,962,139,191 | 106× | ₱2,161,807,603 | ₱2,395,824,623 | ADB loan; ABC/budget agree | no |

**Result: the rule would flag 0 contracts.** Looser thresholds also flag 0,
because every large DPWH contract has an ABC or budget within 2× of it:

| Thresholds | Candidates | Keyword-exempt | ABC / budget disagree | Would flag |
|---|--:|--:|--:|--:|
| ≥ 100× and ≥ ₱1 B | 3 | 3 | 0 | 0 |
| ≥ 50× and ≥ ₱500 M | 12 | 12 | 0 | 0 |
| ≥ 20× and ≥ ₱200 M | 162 | 65 | 0 | 0 |
| ≥ 10× and ≥ ₱100 M | 1,006 | 297 | 0 | 0 |

Recommendation: don't add the flag for DPWH. Unlike SubayBAYAN, each DPWH
contract carries three independent amounts (ABC, budget, award), and none of
the big ones disagree. Revisit if a future snapshot has rows where they do.

## 5. Presentation

**Labels.** Each surface was checked for what the amount is and where it is from:

| Surface | Label | Source shown |
|---|---|---|
| Directory card, DPWH | "Contract amount" | record ID · source |
| Directory card, NEP | "Proposed amount (NEP)" | record ID · source |
| Directory card, DILG | "Total project cost" (+ "adjusted" / "Amount not verified") | code · DILG |
| Directory table "Amount" column | **was unlabelled for DPWH rows** → now shows the amount label on every row | Agency column |
| DPWH contract page / map panel / map popup | "Contract amount (reported)" / "Contract amount" | page source block |
| NEP record page | "Proposed amount (NEP)" + explanation | page source block |
| DILG detail / map panel | "Total project cost" + notes | page source block |
| SubayBAYAN map list rows | **was a bare peso figure** → now "FY 2025 · Total cost" | layer is DILG-only |

Changed in this audit (labels only, no values): `DpwhProjectTable.tsx` and
`SubaybayanPanel.tsx`. The NEP label stays "Proposed amount (NEP)": it is
stored per record and a rename needs a re-import.

**Default sort (not changed; your pick).** Today the directory opens on
"Contract amount / total cost: high to low", so the first screen is
billion-peso projects. Options:

| Option | What the first screen shows | Cost to build |
|---|---|---|
| **A. Start date, newest first** (recommended) | What is being built now; mixed sizes | Sort already exists; the All view needs a `start_date` index on the directory arms (today non-default sorts can time out). NEP rows have no start date and go last. |
| B. Contract / award date, newest first | Newest awards | Exists, DPWH-only (DILG has no contract date) |
| C. Relevance when searching, otherwise A | Best text match first | New: needs full-text ranking |
| D. Near Iligan / Region X first, then A | Local projects first (fits an LGU tracker) | New: region-priority sort key |
| E. Keep amount, but verified amounts only | Still billion-peso first | Minimal |

---

## Appendix A — DPWH row-by-row samples

Every row below matched its source row on all four amount fields (✓).

### Top 50 by contract_amount

| Contract ID | contract_amount (DB) | awardAmount (source) | approved_budget (DB) | abc (source) | budget (DB) | budget (source) | match | Title |
|---|--:|--:|--:|--:|--:|--:|:-:|---|
| 21Z00007 | ₱9,109,964,205.23 | "9,109,964,205.23" | ₱7,661,870,651.55 | "7661870651.55" | ₱9,109,964,205.23 | 9109964205.23 | ✓ | DAVAO CITY BYPASS CONSTRUCTION PROJECT (DCBCP) PACKAGE I-2, STA. 0+000 |
| 22L00004 | ₱2,017,277,778.00 | "2017277778" | ₱2,048,214,430.00 | "2048214430.00" | ₱2,041,419,050.77 | 2041419050.77 | ✓ | CONSTRUCTION OF CONCRETE BRIDGE - DAVAO CITY COASTAL BYPASS ROAD (BAGO |
| 19Z00012 | ₱1,962,139,191.00 | "1962139191" | ₱2,161,807,602.51 | "2161807602.51" | ₱2,395,824,623.25 | 2395824623.25 | ✓ | PR-08, R.T. LIM - SIOCON ROAD, ZAMBOANGA SIBUGAY AND ZAMBOANGA DEL NOR |
| 21L00041 | ₱1,693,858,778.00 | "1693858778" | ₱1,747,730,800.00 | "1747730800.00" | ₱1,747,730,781.43 | 1747730781.43 | ✓ | CONSTRUCTION OF CONCRETE BRIDGE - TALOMO - MATINA BRIDGE ALONG DAVAO C |
| 19Z00013 | ₱1,677,539,692.00 | "1677539692" | ₱1,981,691,584.32 | "1981691584.32" | ₱2,088,144,104.77 | 2088144104.77 | ✓ | CURUAN-SIBUCO ROAD, ZAMBOANGA DEL NORTE, UNDER ADB LOAN NO. 3631-PHI:  |
| 24Z00009 | ₱1,378,888,884.00 | "1378888884" | ₱1,180,059,307.67 | "1180059307.67" | ₱1,378,888,883.81 | 1378888883.81 | ✓ | SUB-PROJECT 8, PARANG EAST DIVERSION ROAD, STA. 0+000 - STA. 7+074.29 |
| 18Z00023 | ₱1,318,905,595.73 | "1,318,905,595.73" | ₱1,145,039,762.15 | "1145039762.15" | ₱1,422,910,094.22 | 1422910094.22 | ✓ | PR-06, ALICIA - MALANGAS ROAD, ZAMBOANGA SIBUGAY (K1769+648.00 - K1793 |
| 23I00039 | ₱1,051,022,117.00 | "1051022117" | ₱1,062,279,645.04 | "1062279645.04" | ₱1,061,098,426.33 | 1061098426.33 | ✓ | CONSTRUCTION OF STORM SURGE PROTECTION/TIDE EMBANKMENT, LEYTE |
| 17Z00002 | ₱997,500,000.74 | "997,500,000.74" | ₱847,166,675.98 | "847166675.98" | ₱997,500,000.74 | 997500000.74 | ✓ | CONSTRUCTION OF SAMAR PACIFIC COASTAL ROAD(SPCR) PROJECT, PROVINCE OF  |
| 23L00066 | ₱974,197,777.90 | "974197777.9" | ₱989,125,000.00 | "989125000.00" | ₱989,121,662.39 | 989121662.39 | ✓ | DAVAO CITY COASTAL BYPASS ROAD (BAGO APLAYA - TIMES BEACH - ROXAS AVEN |
| 21Z00001 | ₱893,726,836.55 | "893,726,836.55" | ₱700,711,359.58 | "700711359.58" | ₱893,726,836.55 | 893726836.55 | ✓ | BRIDGE NO. 1, NALIL - SIKKIAT BRIDGE, TAWI-TAWI, BARMM (K0+031.00 - K0 |
| 18L00194 | ₱865,908,777.90 | "865908777.9" | ₱895,349,079.20 | "895349079.20" | ₱895,348,998.64 | 895348998.64 | ✓ | DAVAO CITY COASTAL BYPASS ROAD AT JCT. DAVAO-COTABATO ROAD-BAGO APLAYA |
| 19Z00011 | ₱854,787,339.40 | "854787339.4" | ₱987,808,177.75 | "987808177.75" | ₱1,064,377,226.90 | 1064377226.9 | ✓ | PR-01A, GUTALAC-BALIGUIAN ALTERNATIVE ROAD, ZAMBOANGA DEL NORTE, K2027 |
| 24L00121 | ₱815,467,777.90 | "815467777.9" | ₱820,250,000.00 | "820250000.00" | ₱815,467,777.88 | 815467777.88 | ✓ | DAVAO CITY COASTAL BYPASS ROAD (BAGO APLAYA - TIMES BEACH - ROXAS AVEN |
| 20L00155 | ₱784,798,777.90 | "784798777.9" | ₱810,600,000.00 | "810600000.00" | ₱809,998,442.54 | 809998442.54 | ✓ | CONSTRUCTION OF CONCRETE BRIDGE (SUBSTRUCTURE ONLY) - DAVAO CITY COAST |
| 24L00122 | ₱719,767,777.90 | "719767777.9" | ₱723,750,000.00 | "723750000.00" | ₱719,767,777.88 | 719767777.88 | ✓ | DAVAO CITY COASTAL BYPASS ROAD (BAGO APLAYA - TIMES BEACH - ROXAS AVEN |
| 17H00040 | ₱711,815,488.35 | "711,815,488.35" | ₱890,202,981.17 | "890202981.17" | ₱711,815,488.35 | 711815488.35 | ✓ | NETWORK DEVELOPMENT-NEW CONSTRUCTION OF FLYOVER/INTERCHANGES/UNDERPASS |
| 23L00065 | ₱667,969,219.00 | "667969219" | ₱675,500,000.00 | "675500000.00" | ₱667,969,218.97 | 667969218.97 | ✓ | DAVAO CITY COASTAL BYPASS ROAD (BAGO APLAYA - TIMES BEACH - ROXAS AVEN |
| 21L00153 | ₱615,264,777.90 | "615264777.9" | ₱633,040,000.00 | "633040000.00" | ₱620,999,993.36 | 620999993.36 | ✓ | CONSTRUCTION OF CONCRETE BRIDGE AT STA. ANA SECTION (SUBSTRUCTURE ONLY |
| 18L00108 | ₱614,286,324.30 | "614286324.3" | ₱627,250,000.00 | "627250000.00" | ₱627,076,990.63 | 627076990.63 | ✓ | DAVAO CITY COASTAL BYPASS RD AT JCT. DAVAO-COTABATO RD-BAGO APLAYA-TAL |
| 22L00172 | ₱570,317,659.00 | "570317659" | ₱579,000,000.00 | "579000000.00" | ₱570,317,658.99 | 570317658.99 | ✓ | CONSTRUCTION OF DAVAO CITY COASTAL ROAD (TALOMO SECTION) - DAVAO - BUK |
| 18N00054 | ₱560,183,846.47 | "560,183,846.47" | ₱579,000,000.00 | "579000000.00" | ₱578,999,813.33 | 578999813.33 | ✓ | CLUSTER 2: 2.1 CONSTRUCTION OF MISSING LINKS, COMPLETION OF THE EAST-W |
| 18K00225 | ₱555,609,571.80 | "555609571.8" | ₱574,175,000.00 | "574175000.00" | ₱555,609,571.83 | 555609571.83 | ✓ | CLUSTER 21 CONSTRUCTION OF MISSING LINKS/ NEW ROADS, BUKIDNON |
| 18K00226 | ₱550,992,963.40 | "550992963.4" | ₱579,000,000.00 | "579000000.00" | ₱550,992,963.43 | 550992963.43 | ✓ | CLUSTER 22 CONST. OF MISSING LINKS/ NEW ROADS, BUKIDNON |
| 18K00220 | ₱550,718,337.30 | "550718337.3" | ₱579,000,000.00 | "579000000.00" | ₱550,718,337.32 | 550718337.32 | ✓ | CLUSTER 16  CONSTRUCTION OF MISSING LINKS/ NEW ROADS, BUKIDNON |
| 18K00218 | ₱549,835,734.90 | "549835734.9" | ₱579,000,000.00 | "579000000.00" | ₱549,835,734.90 | 549835734.9 | ✓ | CLUSTER 14 CONSTRUCTION OF MISSING LINKS/NEW ROADS, MISAMIS ORIENTAL |
| 18K00222 | ₱549,364,105.40 | "549364105.4" | ₱577,051,305.72 | "577051305.72" | ₱549,364,105.41 | 549364105.41 | ✓ | CLUSTER 18 CONSTRUCTION OF MISSING LINKS/ NEW ROADS, BUKIDNON |
| 18L00163 | ₱543,484,777.90 | "543484777.9" | ₱560,703,600.00 | "560703600.00" | ₱559,614,270.96 | 559614270.96 | ✓ | BUKIDNON-COMPOSTELA VALLEY RD (BRGY. NAMNAM,SAN FERNANDO,BUKIDNON-LAAK |
| 18L00162 | ₱543,183,203.84 | "543,183,203.84" | ₱560,703,600.00 | "560703600.00" | ₱551,000,672.54 | 551000672.54 | ✓ | BUKIDNON-COMPOSTELA VALLEY RD (BRGY. NAMNAM,SAN FERNANDO,BUKIDNON-LAAK |
| 18L00160 | ₱534,052,406.03 | "534,052,406.03" | ₱551,015,000.00 | "551015000.00" | ₱549,908,718.49 | 549908718.49 | ✓ | MARAGUSAN-PANTUKAN ROAD (PANTUKAN SECTION),PACKAGE A & B, INCLUDING RO |
| 18L00128 | ₱533,151,235.00 | "533151235" | ₱550,050,000.00 | "550050000.00" | ₱528,195,586.55 | 528195586.55 | ✓ | TAGUM CITY FLYOVER ALONG AGUSAN-DAVAO ROAD, PACKAGE 1, DAVAO DEL NORTE |
| 18L00157 | ₱528,909,103.10 | "528909103.1" | ₱546,074,200.00 | "546074200.00" | ₱544,899,981.59 | 544899981.59 | ✓ | ALTERNATE RD FROM REGION XI TO REGION X (JCT. DAVAO CITY DIVERSION RD- |
| 22I00102 | ₱511,892,619.00 | "511892619" | ₱517,306,344.87 | "517306344.87" | ₱511,892,618.99 | 511892618.99 | ✓ | CLUSTER 2: PROJECT 1. CONST. OF CAUSEWAY, SECT. 3.1, STA. 0+140-STA. 0 |
| 18K00250 | ₱507,538,173.90 | "507538173.9" | ₱537,022,500.00 | "537022500.00" | ₱507,538,173.93 | 507538173.93 | ✓ | CLUSTER 50 CONSTRUCTION OF BY-PASS AND DIVERSION ROADS IN BUKIDNON |
| 24I00352 | ₱494,887,057.60 | "494887057.6" | ₱494,999,412.43 | "494999412.43" | ₱494,887,057.56 | 494887057.56 | ✓ | BASIC INFRASTRUCTURE PROGRAM (BIP) - MULTI-PURPOSE BUILDINGS/FACILITIE |
| 23I00183 | ₱477,682,680.80 | "477682680.8" | ₱482,499,345.43 | "482499345.43" | ₱477,682,680.84 | 477682680.84 | ✓ | CONSTRUCTION OF SAMAR ISLAND MEDICAL CENTER (PHASE 1), BARANGAY GADGAR |
| 20L00158 | ₱476,368,777.90 | "476368777.9" | ₱492,053,500.00 | "492053500.00" | ₱492,053,401.66 | 492053401.66 | ✓ | CONSTRUCTION OF ASPHALT ROAD - DAVAO CITY COASTAL BYPASS ROAD (BAGO AP |
| 22L00192 | ₱475,170,777.90 | "475170777.9" | ₱482,500,000.00 | "482500000.00" | ₱475,170,777.88 | 475170777.88 | ✓ | DAVAO CITY COASTAL BYPASS ROAD (BAGO APLAYA - TIMES BEACH - ROXAS AVEN |
| 18K00246 | ₱471,641,048.40 | "471641048.4" | ₱501,800,000.00 | "501800000.00" | ₱471,641,048.43 | 471641048.43 | ✓ | CLUSTER 46 CONST. OF BYPASS AND DIVERSION ROADS/ CONST. OF MISSING LIN |
| 18L00153 | ₱467,702,781.20 | "467702781.2" | ₱482,500,000.00 | "482500000.00" | ₱462,863,042.81 | 462863042.81 | ✓ | TAGUM CITY FLYOVER ALONG AGUSAN-DAVAO ROAD, PACKAGE 2, DAVAO DEL NORTE |
| 20L00157 | ₱467,617,777.90 | "467617777.9" | ₱482,500,000.00 | "482500000.00" | ₱482,374,847.33 | 482374847.33 | ✓ | CONSTRUCTION OF ASPHALT ROAD - DAVAO CITY COASTAL BYPASS ROAD (BAGO AP |
| 18M00050 | ₱467,471,295.80 | "467471295.8" | ₱482,500,000.00 | "482500000.00" | ₱482,329,168.30 | 482329168.3 | ✓ | CONSTRUCTION OF CONCRETE ROAD  COLUMBIO KORONADAL ROAD, SULTAN KUDARAT |
| 18L00179 | ₱466,371,777.90 | "466371777.9" | ₱482,500,000.00 | "482500000.00" | ₱468,171,957.33 | 468171957.33 | ✓ | CONSTRUCTION OF TAGUM CITY FLYOVER ALONG AGUSAN-DAVAO ROAD, PACKAGE 1, |
| 19L00110 | ₱464,208,777.90 | "464208777.9" | ₱482,500,000.00 | "482500000.00" | ₱482,493,880.89 | 482493880.89 | ✓ | CONSTRUCTION OF FLYOVER-TAGUM CITY FLYOVER ALONG AGUSAN-DAVAO ROAD, PA |
| 18K00207 | ₱459,123,912.80 | "459123912.8" | ₱482,500,000.00 | "482500000.00" | ₱459,123,912.77 | 459123912.77 | ✓ | CLUSTER 10 CONST. OF MISSING LINKS/ NEW ROADS, BUKIDNON |
| 18K00221 | ₱458,193,741.10 | "458193741.1" | ₱482,500,000.00 | "482500000.00" | ₱458,193,741.06 | 458193741.06 | ✓ | CLUSTER 17 CONSTRUCTION OF MISSING LINKS/NEW ROADS, BUKIDNON |
| 18K00224 | ₱457,913,657.20 | "457913657.2" | ₱482,500,000.00 | "482500000.00" | ₱457,913,657.22 | 457913657.22 | ✓ | CLUSTER 20 CONSTRUCTION OF MISSING LINKS/ NEW ROADS, BUKIDNON |
| 18K00255 | ₱456,161,702.10 | "456161702.1" | ₱487,325,000.00 | "487325000.00" | ₱456,161,702.13 | 456161702.13 | ✓ | CLUSTER 55 CONSTRUCTION OF MISSING LINKS/ NEW ROADS IN BUKIDNON |
| 18L00158 | ₱453,883,951.98 | "453,883,951.98" | ₱468,507,500.00 | "468507500.00" | ₱463,533,167.23 | 463533167.23 | ✓ | ALTERNATE ROAD FROM REGION XI TO REGION X (JCT. DAVAO CITY DIV. ROAD-C |
| 18L00161 | ₱447,358,443.60 | "447,358,443.60" | ₱461,771,800.00 | "461771800.00" | ₱445,644,127.24 | 445644127.24 | ✓ | BUKIDNON-COMPOSTELA VALLEY RD (BRGY. NAMNAM,SAN FERNANDO,BUKIDNON-LAAK |

### 20 random rows (seed 20261101)

| Contract ID | contract_amount (DB) | awardAmount (source) | approved_budget (DB) | abc (source) | budget (DB) | budget (source) | match | Title |
|---|--:|--:|--:|--:|--:|--:|:-:|---|
| 22NA0028 | ₱95,963,584.63 | "95963584.63" | ₱96,500,000.00 | "96500000.00" | ₱96,499,999.47 | 96499999.47 | ✓ | IMPROVEMENT OF CABADBARAN RIVER (DINABUKAN-MABINI SECTION), CABADBARAN |
| 24LB0057 | ₱4,797,202.77 | "4797202.77" | ₱4,900,000.00 | "4900000.00" | ₱4,900,000.00 | 4900000 | ✓ | CONSTRUCTION (COMPLETION) OF OFFICE BUILDING, DOLE REGION XI, DAVAO CI |
| 23K00101 | ₱66,022,344.63 | "66022344.63" | ₱67,375,000.00 | "67375000.00" | ₱66,022,344.63 | 66022344.63 | ✓ | CONSTRUCTION OF FLOOD CONTROL PROJECT (ROA CRUSHER) ALONG UPPER BALULA |
| 20KL0022 | ₱37,526,938.48 | "37526938.48" | ₱39,477,340.00 | "39477340.00" | ₱39,477,340.00 | 39477340 | ✓ | NETWORK DEVELOPMENT - ROAD WIDENING - PRIMARY ROADS, BUTUAN CITY-CAGAY |
| 21HJ0115 | ₱2,042,967.96 | "2042967.96" | ₱2,049,000.00 | "2049000.00" | ₱2,049,000.00 | 2049000 | ✓ | CONSTRUCTION/COMPLETION OF 1 UNIT 1 STOREY 2 CLASSROOM SCHOOL BUILDING |
| 18IG0050 | ₱36,926,124.38 | "36926124.38" | ₱39,200,000.00 | "39200000.00" | ₱39,199,094.78 | 39199094.78 | ✓ | CONSTRUCTION/REHABILITATION OF CADAC-AN FLOOD STRUCTURES (DIKING SYSTE |
| 23K00286 | ₱142,997,777.90 | "142997777.9" | ₱144,750,000.00 | "144750000.00" | ₱142,997,777.88 | 142997777.88 | ✓ | CONSTRUCTION OF BY-PASS AND DIVERSION ROADS, JCT. BUDA, QUEZON-JCT. VA |
| 25JE0042 | ₱48,199,645.65 | "48199645.65" | ₱48,250,000.00 | "48250000.00" | ₱48,199,645.65 | 48199645.65 | ✓ | CONSTRUCTION/ REHABILITATION OF FLOOD MITIGATION FACILITIES WITHIN MAJ |
| 20HD0044 | ₱5,052,798.66 | "5052798.66" | ₱5,324,340.00 | "5324340.00" | ₱5,324,340.00 | 5324340 | ✓ | REHABILITATION/RECONSTRUCTION/UPGRADING OF DAMAGED PAVED ROADS ALONG B |
| 22L00119 | ₱73,367,786.15 | "73367786.15" | ₱75,248,770.00 | "75248770.00" | ₱73,367,786.15 | 73367786.15 | ✓ | ROAD WIDENING - BYPASS ROAD, JCT. PADADA (ALONG DIGOS-MAKAR ROAD) - KI |
| 24MH0030 | ₱4,941,664.10 | "4941664.1" | ₱4,950,000.00 | "4950000.00" | ₱4,941,664.10 | 4941664.1 | ✓ | CONSTRUCTION OF FLOOD CONTROL STRUCTURE, BARANGAY POBLACION, KALAMANSI |
| 24KF0024 | ₱11,976,633.24 | "11976633.24" | ₱12,233,289.01 | "12233289.01" | ₱11,976,633.24 | 11976633.24 | ✓ | FLOOD MANAGEMENT PROGRAM-CONSTRUCTION/MAINTENANCE OF FLOOD MITIGATION  |
| 22IH0026 | ₱42,256,576.30 | "42256576.3" | ₱42,261,925.59 | "42261925.59" | ₱42,254,877.86 | 42254877.86 | ✓ | CONSTRUCTION (EXTENSION) OF CATARMAN FLOOD CONTROL STRUCTURES (CATARMA |
| 16KJ0098 | ₱2,458,210.76 | "2,458,210.76" | ₱2,487,500.00 | "2487500.00" | ₱2,458,210.76 | 2458210.76 | ✓ | HEALTH FACILITIES ENHANCEMENT PROGRAM (HFEP)-BARANGAY HEALTH STATION ( |
| 21HA0006 | ₱4,700,000.00 | "4700000" | ₱4,900,000.00 | "4900000.00" | ₱4,700,000.00 | 4700000 | ✓ | CONSTRUCTION/IMPROVEMENT OF ACCESS ROADS LEADING TO TRADES, INDUSTRIES |
| 21JD0009 | ₱17,375,209.61 | "17375209.61" | ₱17,640,000.00 | "17640000.00" | ₱17,638,256.77 | 17638256.77 | ✓ | CONSTRUCTION OF BY-PASS AND DIVERSION ROADS BRGY. BANONONG, DAPITAN CI |
| 24GE0074 | ₱19,691,267.29 | "19691267.29" | ₱19,800,000.00 | "19800000.00" | ₱19,691,267.29 | 19691267.29 | ✓ | CONSTRUCTION OF MULTI-PURPOSE BUILDING-RECONSTRUCTION OF MULTI-PURPOSE |
| 21NB0056 | ₱4,771,367.38 | "4771367.38" | ₱4,950,000.00 | "4950000.00" | ₱4,949,999.96 | 4949999.96 | ✓ | CONSTRUCTION OF ISOLATION/MULTI-PURPOSE BUILDING,BRGY. DEL MONTE, TALA |
| 17LA0218 | ₱27,350,847.56 | "27350847.56" | ₱27,767,357.93 | "27767357.93" | ₱27,767,464.56 | 27767464.56 | ✓ | CONSTRUCTION OF ONE (1) UNIT, THREE (3) STOREY, TWELVE (12) CLASSROOM  |
| 24IA0026 | ₱4,843,719.60 | "4843719.6" | ₱4,945,094.05 | "4945094.05" | ₱4,843,719.60 | 4843719.6 | ✓ | CONSTRUCTION OF DRAINAGE, BARANGAY PALANAY, CAIBIRAN, BILIRAN |

### Rows whose three amounts disagree by 2× or more (87)

| Contract ID | contract_amount (DB) | awardAmount (source) | approved_budget (DB) | abc (source) | budget (DB) | budget (source) | match | Title |
|---|--:|--:|--:|--:|--:|--:|:-:|---|
| 21Z00007 | ₱9,109,964,205.23 | "9,109,964,205.23" | ₱7,661,870,651.55 | "7661870651.55" | ₱9,109,964,205.23 | 9109964205.23 | ✓ | DAVAO CITY BYPASS CONSTRUCTION PROJECT (DCBCP) PACKAGE I-2, STA. 0+000 |
| 24Z00009 | ₱1,378,888,884.00 | "1378888884" | ₱1,180,059,307.67 | "1180059307.67" | ₱1,378,888,883.81 | 1378888883.81 | ✓ | SUB-PROJECT 8, PARANG EAST DIVERSION ROAD, STA. 0+000 - STA. 7+074.29 |
| 18Z00023 | ₱1,318,905,595.73 | "1,318,905,595.73" | ₱1,145,039,762.15 | "1145039762.15" | ₱1,422,910,094.22 | 1422910094.22 | ✓ | PR-06, ALICIA - MALANGAS ROAD, ZAMBOANGA SIBUGAY (K1769+648.00 - K1793 |
| 17Z00002 | ₱997,500,000.74 | "997,500,000.74" | ₱847,166,675.98 | "847166675.98" | ₱997,500,000.74 | 997500000.74 | ✓ | CONSTRUCTION OF SAMAR PACIFIC COASTAL ROAD(SPCR) PROJECT, PROVINCE OF  |
| 21Z00001 | ₱893,726,836.55 | "893,726,836.55" | ₱700,711,359.58 | "700711359.58" | ₱893,726,836.55 | 893726836.55 | ✓ | BRIDGE NO. 1, NALIL - SIKKIAT BRIDGE, TAWI-TAWI, BARMM (K0+031.00 - K0 |
| 21Z00020 | ₱200,600,000.00 | "200,600,000.00" | ₱181,157,165.94 | "181157165.94" | ₱200,600,000.00 | 200600000 | ✓ | CONTRACT PACKAGE 5, SLOPE PROTECTION (MARAWI-BITO ROAD) UPPER AND LOWE |
| 19I00117 | ₱124,935,148.10 | "124935148.1" | ₱131,583,703.46 | "131583703.46" | ₱64,564,139.18 | 64564139.18 | ✓ | BRIDGE - REPLACEMENT OF PERMANENT WEAK BRIDGES, CATMON BR. (B00031BR)  |
| 20L00137 | ₱122,060,915.40 | "122060915.4" | ₱125,450,000.00 | "125450000.00" | ₱7,550,666.92 | 7550666.92 | ✓ | CONSTRUCTION OF CONCRETE BRIDGE - MATINA APLAYA BRIDGE, DAVAO CITY |
| 16I00028 | ₱114,704,450.10 | "114704450.1" | ₱115,650,000.00 | "115650000.00" | ₱3,418,717.26 | 3418717.26 | ✓ | CONST./REPAIR/REHAB./IMPRVT. OF VARIOUS INFRA INCLUDING LOCAL PROJECTS |
| 20L00141 | ₱112,673,334.20 | "112673334.2" | ₱115,800,000.00 | "115800000.00" | ₱5,830,675.87 | 5830675.87 | ✓ | CONSTRUCTION OF CONCRETE BRIDGE - MATINA APLAYA BRIDGE 2, DAVAO CITY |
| 18II0063 | ₱90,698,721.83 | "90698721.83" | ₱94,479,947.21 | "94479947.21" | ₱14,509,769.56 | 14509769.56 | ✓ | CONSTRUCTION OF MISSING LINKS/NEW ROADS, ARTECHE - BRGY. CATUMSAN - JI |
| 15N00117 | ₱83,316,580.53 | "83316580.5300000" | ₱96,500,000.00 | "96500000.00" | ₱40,271,902.09 | 40271902.09 | ✓ | CONCRETING OF (EXISTING GRAVEL ROAD), CAMP EDWARD - FERLDA - POYAWON - |
| 22GA0011 | ₱75,011,613.61 | "75011613.61" | ₱76,500,000.00 | "76500000.00" | ₱33,784,810.22 | 33784810.22 | ✓ | BALETE BYPASS ROAD, AKLAN, BALETE, AKLAN |
| 18G00015 | ₱67,249,999.98 | "67249999.98" | ₱71,245,938.49 | "71245938.49" | ₱24,665,498.31 | 24665498.31 | ✓ | CONSTRUCTION OF BYPASS ROAD - KALIBO CIRCUMFERENTIAL ROAD INCL. ROW, A |
| 17J00013 | ₱66,390,856.48 | "66,390,856.48" | ₱68,798,866.72 | "68798866.72" | ₱12,157,206.64 | 12157206.64 | ✓ | IMPROVEMENT/WIDENING OF NATIONAL ROADS OF ZAMBOANGA CITY - LABUAN - LI |
| 23GK0186 | ₱56,146,651.20 | "56146651.2" | ₱57,899,999.95 | "57899999.95" | ₱93,391.73 | 93391.73 | ✓ | CONSTRUCTION OF BRIDGE, BRGY. HAWAIIAN, SILAY CITY, NEGROS OCCIDENTAL |
| 18H00023 | ₱55,551,380.04 | "55551380.04" | ₱58,480,052.91 | "58480052.91" | ₱20,805,705.82 | 20805705.82 | ✓ | ORGANIZATIONAL OUTCOME 1: ENSURE SAFE AND RELIABLE NATIONAL ROAD SYSTE |
| 19I00083 | ₱55,092,415.60 | "55092415.6" | ₱115,089,926.50 | "115089926.50" | ₱55,092,393.40 | 55092393.4 | ✓ | NETWORK DEVELOPMENT - CONSTRUCTION OF BY-PASS AND DIVERSION ROADS, TAC |
| 16G00107 | ₱53,199,999.88 | "53,199,999.88" | ₱56,031,379.94 | "56031379.94" | ₱10,156,410.19 | 10156410.19 | ✓ | WIDENING OF ANILAO BRIDGE (B00182PN) ALONG ILOILO EAST COAST - CAPIZ R |
| 23KB0064 | ₱52,448,172.52 | "52448172.52" | ₱53,268,000.00 | "53268000.00" | ₱17,829,783.52 | 17829783.52 | ✓ | WIDENING OF PERMANENT BRIDGES, MANUTO BRIDGE (B01380MN) ALONG BUKIDNON |
| 18H00021 | ₱49,637,775.45 | "49637775.45" | ₱52,554,865.00 | "52554865.00" | ₱11,169,003.92 | 11169003.92 | ✓ | ORGANIZATIONAL OUTCOME 1:ENSURE SAFE AND RELIABLE NATIONAL ROAD SYSTEM |
| 20IA0023 | ₱47,027,590.00 | "47027590" | ₱48,482,054.87 | "48482054.87" | ₱14,371,631.50 | 14371631.5 | ✓ | ASSET PRESERVATION-REHABILITATION/RECONSTRUCTION/UPGRADING OF DAMAGED  |
| 19IA0068 | ₱46,977,200.00 | "46977200" | ₱48,342,623.17 | "48342623.17" | ₱16,442,020.00 | 16442020 | ✓ | CONSTRUCTION OF NEW PERMANENT BRIDGE MACALPE BRIDGE ALONG NAVAL CAIBIR |
| 15GA0175 | ₱46,500,000.00 | "46500000.0000000" | ₱49,000,000.00 | "49000000.00" | ₱1,727,958.34 | 1727958.34 | ✓ | CONST. OF RIVER CONTROL(REVETMENT WALL) ALONG AKLAN RIVER (BRGY. PALAL |
| 19IA0007 | ₱45,604,500.00 | "45604500" | ₱47,039,245.46 | "47039245.46" | ₱13,681,350.00 | 13681350 | ✓ | REHABILITATION OF DAMAGED PAVED ROADS - TERTIARY ROADS, MARIPIPI CIRCU |
| 20KA0060 | ₱43,501,064.78 | "43501064.78" | ₱96,500,000.00 | "96500000.00" | ₱47,850,855.00 | 47850855 | ✓ | CONSTRUCTION OF FLOOD MITIGATION STRUCTURE - CONSTRUCTION OF FLOOD MIT |
| 17JA0087 | ₱42,648,212.12 | "42,648,212.12" | ₱43,521,268.26 | "43521268.26" | ₱8,529,355.70 | 8529355.7 | ✓ | CLUSTER - 1.) REPLACEMENT OF TOGTOBO BRIDGE (PSCG) (B00560MN) ALONG PA |
| 20GB0140 | ₱39,382,490.38 | "39382490.38" | ₱39,800,000.00 | "39800000.00" | ₱12,990,990.00 | 12990990 | ✓ | CONCRETING OF BRGY. MAYBUNGA FMR BRGY. MAYBUNGA, LAUA-AN, ANTIQUE |
| 16G00020 | ₱39,355,361.58 | "39,355,361.58" | ₱45,925,294.51 | "45925294.51" | ₱2,423,313.20 | 2423313.2 | ✓ | REPLACEMENT OF PERMANENT WEAK BRIDGES, BALETE BRIDGE (B00283PN) ALONG  |
| 21NH0065 | ₱38,923,735.16 | "38923735.16" | ₱39,600,000.00 | "39600000.00" | ₱7,788,220.57 | 7788220.57 | ✓ | CONSTRUCTION OF MULTI-PURPOSE BUILDING, MUNICIPALITY OF CANTILAN, SURI |
| 16IH0033 | ₱38,505,915.89 | "38,505,915.89" | ₱44,043,355.95 | "44043355.95" | ₱191,160.76 | 191160.76 | ✓ | ROAD UPGRADING (UNPAVED TO PAVED) BASED ON GRAVEL ROAD STRATEGIES, BUG |
| 18GO0100 | ₱36,850,000.00 | "36,850,000.00" | ₱38,804,580.00 | "38804580.00" | ₱9,650,137.61 | 9650137.61 | ✓ | REHABILITATION/RECONSTRUCTION/UPGRADING (STO. NINO-BANAGO ROAD (NORTH) |
| 15II0173 | ₱36,631,287.70 | "36631287.7000000" | ₱38,595,221.14 | "38595221.14" | ₱5,065,724.30 | 5065724.3 | ✓ | CONSTRUCTION OF BUGAY-GUIGUINTA-BUGTUSAN-MABINI-TAYLOR-VICTORY-EL EMPO |
| 19GB0020 | ₱36,308,974.42 | "36308974.42" | ₱49,000,000.00 | "49000000.00" | ₱917,657.66 | 917657.66 | ✓ | CONSTRUCTION OF REVETMENT - CONSTRUCTION OF REVETMENT ALONG SIBALOM RI |
| 24HE0010 | ₱29,359,800.00 | "29359800" | ₱29,409,800.00 | "29409800.00" | ₱8,010,318.06 | 8010318.06 | ✓ | ORGANIZATIONAL OUTCOME 1: ENSURE SAFE AND RELIABLE NATIONAL ROAD SYSTE |
| 22HC0051 | ₱28,371,000.00 | "28371000" | ₱29,400,000.00 | "29400000.00" | ₱11,863,409.39 | 11863409.39 | ✓ | SUSTAINABLE INFRASTRUCTURE PROJECTS ALLEVIATING GAPS (SIPAG) - FLOOD M |
| 22KF0083 | ₱28,266,320.48 | "28266320.48" | ₱29,966,145.00 | "29966145.00" | ₱1,662,964.37 | 1662964.37 | ✓ | ROAD WIDENING-MISAMIS ORIENTAL-MA. CRISTINA BDRY. RD- K1525+427-K1525+ |
| 20HF0106 | ₱27,790,621.10 | "27790621.1" | ₱28,950,000.00 | "28950000.00" | ₱12,187,112.93 | 12187112.93 | ✓ | IMPROVEMENT OF ACCESS ROAD LEADING TO MT. MANUNGGAL, BRGY. SUNOG, BALA |
| 17IH0035 | ₱27,209,987.67 | "27,209,987.67" | ₱31,713,785.34 | "31713785.34" | ₱3,206,792.06 | 3206792.06 | ✓ | CONSTRUCTION OF 2 UNITS 2 STOREY 12 CLASSROOM SCHOOL BUILDING, SAN ISI |
| 20G00091 | ₱24,496,773.99 | "24496773.99" | ₱24,750,000.00 | "24750000.00" | ₱2,511,302.20 | 2511302.2 | ✓ | CONSTRUCTION OF CONCRETE ROAD - MUELLE LONEY ROAD EXTENSION, ILOILO CI |
| 18HA0027 | ₱23,699,994.40 | "23699994.4" | ₱27,893,690.00 | "27893690.00" | ₱6,753,371.68 | 6753371.68 | ✓ | OFF-CARRIAGEWAY IMPROVEMENT-PANGLAO ISLAND CIRCUMFERENTIAL ROAD-(S0006 |
| 18JF0086 | ₱23,401,137.48 | "23401137.48" | ₱24,125,000.00 | "24125000.00" | ₱8,443,517.70 | 8443517.7 | ✓ | NRJ LEADING TO BUSAY FALLS, DOÑA JOSEFA, IPIL ZAMBOANGA SIBUGAY |
| 17IH0130 | ₱23,146,877.43 | "23146877.43" | ₱53,063,589.21 | "53063589.21" | ₱23,344,595.28 | 23344595.28 | ✓ | CLUSTER SB-2017-17: CONSTRUCTION OF BUILDING:FOUR (4) PROJECTS LOCATED |
| 18IJ0069 | ₱22,868,664.77 | "22868664.77" | ₱23,988,807.00 | "23988807.00" | ₱11,297,171.21 | 11297171.21 | ✓ | WIDENING OF PERMANENT BRIDGES, NAGA BR. (B00349SM) ALONG DAANG MAHARLI |
| 21IL0051 | ₱22,728,084.46 | "22728084.46" | ₱23,074,100.00 | "23074100.00" | ₱9,276,898.52 | 9276898.52 | ✓ | CONSTRUCTION/IMPROVEMENT OF ACCESS ROADS LEADING TO TRADES AND INDUSTR |
| 15KI0062 | ₱17,789,268.24 | "17789268.2400000" | ₱19,600,000.00 | "19600000.00" | ₱9,035,379.47 | 9035379.47 | ✓ | IMPROVEMENT OF ACCESS ROAD FROM NATIONAL HIGHWAY LEADING TO SAN VICENT |
| 16IH0130 | ₱17,720,311.81 | "17,720,311.81" | ₱19,600,582.63 | "19600582.63" | ₱6,822,247.20 | 6822247.2 | ✓ | CONCRETING OF JUNCTION POBLACION HIGHWAY - MANRAYA FMR, SAN ANTONIO, N |
| 20JI0067 | ₱17,399,999.88 | "17399999.88" | ₱17,500,000.00 | "17500000.00" | ₱2,605,856.17 | 2605856.17 | ✓ | CONSTRUCTION OF ONE (1) UNIT TWO (2) STOREY SIX (6) CLASSROOM SCHOOL B |
| 21MC0001 | ₱17,224,807.90 | "17224807.9" | ₱18,131,960.00 | "18131960.00" | ₱180,819.05 | 180819.05 | ✓ | PREVENTIVE MAINTENANCE OF ROAD: ASPHALT OVERLAY - ALONG MAKILALA-ALLAH |
| 18HA0021 | ₱17,057,883.11 | "17057883.11" | ₱19,314,900.00 | "19314900.00" | ₱1,243,296.51 | 1243296.51 | ✓ | OFF-CARRIAGEWAY IMPROVEMENT-TAGBILARAN CITY-CORELLA-SIKATUNA-LOBOC ROA |
| 18JA0049 | ₱16,150,424.74 | "16150424.74" | ₱16,779,310.07 | "16779310.07" | ₱6,640,301.26 | 6640301.26 | ✓ | CONVERGENCE AND SPECIAL SUPPORT PROGRAM - CONSTRUCTION/IMPROVEMENT OF  |
| 20JA0008 | ₱15,366,400.00 | "15366400" | ₱15,680,000.00 | "15680000.00" | ₱1,683,195.35 | 1683195.35 | ✓ | WIDENING OF PERMANENT BRIDGES - SAN JOSE GUSU BR. (PARALLEL BR.) ALONG |
| 21GA0005 | ₱14,898,952.50 | "14898952.5" | ₱22,409,120.00 | "22409120.00" | ₱8,210,120.63 | 8210120.63 | ✓ | CONSTRUCTION OF DRAINAGE ALONG AKLAN EAST ROAD K0276+720-K0277+282, K0 |
| 18GH0188 | ₱14,444,942.13 | "14444942.13" | ₱14,550,000.00 | "14550000.00" | ₱3,467,987.52 | 3467987.52 | ✓ | CONSTRUCTION OF BRGY. BITO-ON PORT, CALAGNA-AN ISLAND, CARLES, ILOILO |
| 20HN0090 | ₱14,105,132.65 | "14105132.65" | ₱14,850,000.00 | "14850000.00" | ₱2,101,479.27 | 2101479.27 | ✓ | LP: LOCAL INFRASTRUCTURE PROGRAM - LOCAL ROADS AND BRIDGES-LOCAL ROADS |
| 16NG0078 | ₱13,892,198.80 | "13,892,198.80" | ₱13,896,600.00 | "13896600.00" | ₱234,243.78 | 234243.78 | ✓ | CONSTRUCTION OF (2 UNITS) 2 STY 4 CLR SCHOOL BUILDING, PILAR NHS (SCH. |
| 24HE0009 | ₱13,675,025.95 | "13675025.95" | ₱13,681,780.00 | "13681780.00" | ₱4,040,361.84 | 4040361.84 | ✓ | ORGANIZATIONAL OUTCOME 1: ENSURE SAFE AND RELIABLE NATIONAL ROAD SYSTE |
| 21GG0151 | ₱12,338,665.92 | "12338665.92" | ₱14,700,000.00 | "14700000.00" | ₱2,973,140.32 | 2973140.32 | ✓ | CONSTRUCTION OF TYPHOON SHELTER FOR FIXED WING AIRCRAFT, TACTICAL OPER |
| 24GO0086 | ₱12,251,250.00 | "12251250" | ₱29,400,000.00 | "29400000.00" | ₱12,375,000.00 | 12375000 | ✓ | CONSTRUCTION OF MULTI-PURPOSE BUILDING, BARANGAY MANSILINGAN, BACOLOD  |
| 21GG0152 | ₱12,026,666.12 | "12026666.12" | ₱14,700,000.00 | "14700000.00" | ₱2,336,486.52 | 2336486.52 | ✓ | CONSTRUCTION OF TYPHOON SHELTER HANGAR FOR ROTARY AIRCRAFT, TACTICAL O |
| 17GJ0084 | ₱11,505,575.71 | "11,505,575.71" | ₱12,111,420.57 | "12111420.57" | ₱284,338.32 | 284338.32 | ✓ | OFF-CARRIAGEWAY IMPROVEMENT: CONSTRUCTION OF BIKE LANES - ILOILO - ANT |
| 18GP0048 | ₱11,098,430.91 | "11,098,430.91" | ₱11,463,479.32 | "11463479.32" | ₱4,375,929.93 | 4375929.93 | ✓ | WIDENING OF BRIDGE - GUINTAS BR. (B00268PN) ALONG SIGMA - MAMBUSAO - J |
| 18GB0134 | ₱10,599,924.47 | "10599924.47" | ₱14,700,000.00 | "14700000.00" | ₱4,090,128.26 | 4090128.26 | ✓ | CONSTRUCTION OF REVETMENT WALL ALONG SIBALOM RIVER, DISTRICT I, SIBALO |
| 22ID0057 | ₱9,528,503.73 | "9528503.73" | ₱19,598,623.96 | "19598623.96" | ₱10,474,578.48 | 10474578.48 | ✓ | INSTALLATION OF ROAD STUD(SOLAR) ALONG PALO-CARIGARA-ORMOC ROAD,K0941+ |
| 18GG0195 | ₱9,407,204.58 | "9,407,204.58" | ₱9,716,256.59 | "9716256.59" | ₱1,763,134.18 | 1763134.18 | ✓ | CONSTRUCTION OF ONE (1) UNIT TWO (2) STOREY FOUR (4) CLASSROOMS, BADLA |
| 18GG0211 | ₱9,194,935.48 | "9,194,935.48" | ₱9,528,430.55 | "9528430.55" | ₱3,178,060.54 | 3178060.54 | ✓ | CONSTRUCTION OF ONE (1) UNIT TWO (2) STOREY - TWO (2) REGULAR WORKSHOP |
| 21JG0102 | ₱9,190,994.65 | "9190994.65" | ₱12,437,500.00 | "12437500.00" | ₱1,378,649.20 | 1378649.2 | ✓ | CONCRETING OF BRGY. LIGUAC TO BRGY. COLOJO FMR, BRGY. LIGUAC AND BRGY. |
| 23GO0048 | ₱7,731,744.35 | "7731744.35" | ₱15,778,000.00 | "15778000.00" | ₱8,504,918.79 | 8504918.79 | ✓ | ROAD SAFETY: PAVEMENT MARKINGS - INSTALLATION OF SOLAR PAVEMENT STUDS  |
| 19GD0100 | ₱7,658,000.00 | "7658000" | ₱17,960,000.00 | "17960000.00" | ₱7,959,735.36 | 7959735.36 | ✓ | CONCRETING OF SUGARCANE FARM-TO-MILL ROAD, SITIO ROSARIO, BRGY. LANTAN |
| 17RF0046 | ₱7,569,316.50 | "7,569,316.50" | ₱7,645,731.53 | "7645731.53" | ₱564,206.06 | 564206.06 | ✓ | CONSTRUCTION OF 1 UNIT 2 STOREY 4 CL SCHOOL BUILDING AT PINOCAWAN ES,  |
| 25JF0005 | ₱7,198,118.91 | "7198118.91" | ₱14,700,000.00 | "14700000.00" | ₱7,198,118.91 | 7198118.91 | ✓ | CONSTRUCTION OF SLOPE PROTECTION ALONG MAIN CANAL, AZUSANO CIS, TITAY, |
| 20GA0225 | ₱7,160,396.15 | "7160396.15" | ₱9,950,000.00 | "9950000.00" | ₱2,864,313.15 | 2864313.15 | ✓ | CONCRETING OF BARANGAY VIVO FMR  BARANGAY VIVO, TANGALAN, AKLAN |
| 17RF0126 | ₱6,341,079.90 | "6,341,079.90" | ₱6,405,300.00 | "6405300.00" | ₱1,362,018.81 | 1362018.81 | ✓ | CONSTRUCTION OF 1- UNIT TWO STOREY FOUR CLASSROOM SCHOOL BUILDING AT S |
| 19GK0046 | ₱5,585,836.84 | "5585836.84" | ₱5,879,828.26 | "5879828.26" | ₱1,695,345.23 | 1695345.23 | ✓ | WIDENING OF BRIDGE - VASCOÑA BR. (B00183NR) ALONG BACOLOD NORTH RD |
| 22KA0100 | ₱4,856,673.14 | "4856673.14" | ₱4,950,000.00 | "4950000.00" | ₱26,250.00 | 26250 | ✓ | CONSTRUCTION OF MULTI-PURPOSE BUILDING (BAHAY TULUGAN),BRGY. KIBALABAG |
| 21GD0073 | ₱4,801,100.62 | "4801100.62" | ₱4,900,000.00 | "4900000.00" | ₱1,603,153.61 | 1603153.61 | ✓ | CONSTRUCTION OF MULTI-PURPOSE BUILDING - CONSTRUCTION OF MULTI-PURPOSE |
| 24KB0066 | ₱4,204,441.03 | "4204441.03" | ₱4,233,600.00 | "4233600.00" | ₱630,666.15 | 630666.15 | ✓ | REHABILITATION/RECONSTRUCTION/UPGRADING OF DAMAGED PAVED ROADS ALONG B |
| 18NA0099 | ₱3,778,325.35 | "3778325.35" | ₱4,158,105.00 | "4158105.00" | ₱1,187,222.33 | 1187222.33 | ✓ | CLUSTER - CONST. OF BRGY. HEALTH STATION (BHS) BRGY. TOLOSA, CABADBARA |
| 18NA0100 | ₱3,564,954.25 | "3564954.25" | ₱4,158,105.00 | "4158105.00" | ₱1,116,123.52 | 1116123.52 | ✓ | (CLUS.) 1. CONSTRUCTION OF BARANGAY HEALTH STATION (BHS), BRGY. 3, NAS |
| 17RF0038 | ₱3,370,961.12 | "3370961.12" | ₱3,405,061.06 | "3405061.06" | ₱168,625.12 | 168625.12 | ✓ | CONSTRUCTION OF 1 UNIT 1 STOREY 3 CL SCHOOL BUILDING AT GUBA HS, VALLE |
| 17IH0056 | ₱3,098,479.51 | "3,098,479.51" | ₱3,980,063.60 | "3980063.60" | ₱1,878,779.12 | 1878779.12 | ✓ | REHABILITATION OF DISTRICT HOSPITAL, CAPUL DISTRICT HOSPITAL, CAPUL, N |
| 17GB0183 | ₱2,797,000.00 | "2797000" | ₱2,799,677.19 | "2799677.19" | ₱1,157,333.47 | 1157333.47 | ✓ | CONSTRUCTION OF 1 STOREY TWO(2) CLASSROOM SCHOOL BUILDING AT CAMANSI E |
| 20IL0143 | ₱1,930,500.00 | "1930500" | ₱4,950,000.00 | "4950000.00" | ₱1,980,000.00 | 1980000 | ✓ | CLUSTER 20 - LOCAL-BUILDINGS AND OTHER STRUCTURES-MULTIPURPOSE/FACILIT |
| 22NI0024 | ₱1,914,751.36 | "1914751.36" | ₱3,960,000.00 | "3960000.00" | ₱1,979,674.20 | 1979674.2 | ✓ | PACKAGE 4- CONSTRUCTION (COMPLETION) OF MULTI-PURPOSE BUILDING, BARANG |
| 21HB0076 | ₱1,648,100.00 | "1648100" | ₱3,430,000.00 | "3430000.00" | ₱1,648,100.00 | 1648100 | ✓ | OO1: ENSURE SAFE AND RELIABLE NATIONAL ROAD SYSTEM, BRIDGE PROGRAM - R |
| 17GB0056 | ₱982,988.17 | "982,988.17" | ₱1,980,000.00 | "1980000.00" | ₱982,988.17 | 982988.17 | ✓ | COMPLETION OF MULTI-PURPOSE BUILDING, SIDO, SIBALOM, ANTIQUE |
| 19HH0102 | ₱953,100.00 | "953100" | ₱1,980,000.00 | "1980000.00" | ₱953,100.00 | 953100 | ✓ | LOCAL PROGRAM: LOCAL INFRASTRUCTURE PROGRAM BUILDINGS AND OTHER STRUCT |

## Appendix B — DILG SubayBAYAN row-by-row samples

Cells are shown exactly as stored in the Excel file (backticks); "blank" is an empty cell.

### Top 50 by total_cost

⚑ = flagged "Amount not verified"; ↺ = reported total replaced.

| ID | File, row | total_cost (DB) | Total cell (AQ) | Subsidy DB / cell (Q) | Counterpart DB / cell (R) | Contract cell (EE) | Title |
|---|---|--:|--:|--:|--:|--:|---|
| LIME-26-11-23-17-000-11 | RLIP_LIME20DF_Batch16 r596 | ₱8,789,534,586.00 ⚑ | `8,789,534,586.00` | — / blank | — / blank | blank | Improvement of Samal Island Integrated Public Market and Tra |
| RLIP-25-10-13-01-000-2 | RLIP_LIME20DF_Batch02 r764 | ₱7,160,000,000.00 ⚑ | `7,160,000,000.00` | — / blank | — / blank | blank | Construction of Water System at Libon-libon Lingating, Baung |
| LIME-26-01-29-08-000-2 | RLIP_LIME20DF_Batch14 r806 | ₱2,500,000,000.00 ⚑ | `2,500,000,000.00` | — / blank | — / blank | blank | Construction of Tourism Scenic Stand Points & Signages |
| RLIP-25-10-43-08-000-1 | RLIP_LIME20DF_Batch03 r1291 | ₱1,475,655,520.00 ⚑ | `1,475,655,520.00` | — / blank | — / blank | blank | ROAD CONCRETING |
| LIME-25-16-02-00-000-1 | RLIP_LIME20DF_Batch13 r1950 | ₱1,034,398,238.86 ⚑ | `1,034,398,238.86` | — / blank | — / blank | blank | UPGRADING/ IMPROVEMENT OF KITCHARAO-ANIBONGAN PROVINCIAL ROA |
| RLIP-25-10-43-08-000-4 | RLIP_LIME20DF_Batch03 r1339 | ₱1,030,413,516.98 ⚑ | `1,030,413,516.98` | — / blank | — / blank | blank | REPAIR OF CLASSROOM AT ALAGATAN ES |
| LIME-25-06-19-03-000-3 | RLIP_LIME20DF_Batch05 r1017 | ₱752,892,040.00 ⚑ | `752,892,040.00` | — / blank | — / blank | blank | CONSTRUCTION OF SLOPE PROTECTION |
| RLIP-25-10-43-08-000-5 | RLIP_LIME20DF_Batch03 r1344 | ₱632,438,938.32 ⚑ | `632,438,938.32` | — / blank | — / blank | blank | ADDTIONAL CONSTRUCTION OF CLASSROOM @ KISANDI |
| RLIP-25-10-13-20-000-17 | RLIP_LIME20DF_Batch02 r820 | ₱629,375,000.00 ⚑ | `629,375,000.00` | — / blank | — / blank | blank | Land Development for Apartment Type Cemetery Phase 2, San Is |
| RLIP-25-10-43-08-000-3 | RLIP_LIME20DF_Batch03 r1313 | ₱623,094,948.33 ⚑ | `623,094,948.33` | — / blank | — / blank | blank | WATER WORKS |
| FALGU-25-13-06-00-000-1 | LGSF_LocallyFunded_Batch02 r187 | ₱500,000,000.00 ⚑ | blank | ₱500,000,000.00 / `500,000,000.00` | — / blank | blank | Multi-purpose building: Construction of Pamantasan ng Lungso |
| FALGU-26-04-10-00-000-2 | LGSF_LocallyFunded_Batch03 r900 | ₱500,000,000.00 ⚑ | blank | ₱500,000,000.00 / `500,000,000.00` | — / blank | blank | Construction of Multipurpose buildings in Barangay Talisay,  |
| FALGU-26-13-13-00-000-1 | LGSF_LocallyFunded_Batch01 r1783 | ₱462,999,900.00 | `462,999,900.00` | ₱462,999,900.00 / `462,999,900.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-25-05-17-24-000-4 | LGSF_LocallyFunded_Batch01 r1753 | ₱450,000,000.00 ⚑ | blank | ₱450,000,000.00 / `450,000,000.00` | — / blank | blank | Multi-purpose building: Comprehensive Retrofitting and Rehab |
| LIME-25-06-19-14-000-5 | RLIP_LIME20DF_Batch06 r1460 | ₱436,410,607.85 ⚑ | `436,410,607.85` | — / blank | — / blank | blank | CONSTRUCTION OF A THREE (3) STOREY ROXAS CITY HALL BUILDING |
| LIME-26-12-63-19-000-1 | RLIP_LIME20DF_Batch11 r1780 | ₱392,930,847.90 ⚑ | `392,930,847.90` | — / blank | — / blank | blank | CONSTRUCTION OF 2-STOREY MULTIPURPOSE BUILDING BRGY. LAMCADE |
| FALGU-26-01-55-00-000-1 | LGSF_LocallyFunded_Batch02 r140 | ₱384,000,000.00 | blank | ₱384,000,000.00 / `384,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-03-14-00-000-2 | LGSF_LocallyFunded_Batch03 r1295 | ₱378,000,000.00 | `378,000,000.00` | ₱378,000,000.00 / `378,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-04-58-00-000-1 | LGSF_LocallyFunded_Batch02 r76 | ₱376,000,000.00 | `376,000,000.00` | ₱376,000,000.00 / `376,000,000.00` | — / blank | `277380000.0` | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-04-10-00-000-1 | LGSF_LocallyFunded_Batch02 r31 | ₱367,474,086.00 | `367,474,086.00` | ₱368,000,000.00 / `368,000,000.00` | — / blank | `367474086.0` | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-07-22-00-000-1 | LGSF_LocallyFunded_Batch02 r793 | ₱360,000,000.00 | blank | ₱360,000,000.00 / `360,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-25-08-60-00-000-2 | LGSF_LocallyFunded_Batch01 r618 | ₱326,986,093.97 ⚑ | `326,986,093.97` | ₱30,000,000.00 / `30,000,000.00` | ₱0.00 / `0.0` | `29956093.97` | Construction of multi-purpose building, Barangay San Policar |
| FALGU-25-13-16-00-000-9 | LGSF_LocallyFunded_Batch04 r903 | ₱300,000,000.00 ⚑ | blank | ₱300,000,000.00 / `300,000,000.00` | — / blank | blank | Improvement of Local Road in City of Valenzuela, National Ca |
| FALGU-26-06-30-00-000-1 | LGSF_LocallyFunded_Batch02 r174 | ₱299,000,000.00 | blank | ₱299,000,000.00 / `299,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-03-54-00-000-1 | LGSF_LocallyFunded_Batch02 r1829 | ₱286,000,000.00 | blank | ₱286,000,000.00 / `286,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-13-06-00-000-1 | LGSF_LocallyFunded_Batch01 r1776 | ₱286,000,000.00 | blank | ₱286,000,000.00 / `286,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-04-56-00-000-1 | LGSF_LocallyFunded_Batch02 r73 | ₱280,000,000.00 | `280,000,000.00` | ₱280,000,000.00 / `280,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-05-17-00-000-1 | LGSF_LocallyFunded_Batch03 r333 | ₱261,000,000.00 | blank | ₱261,000,000.00 / `261,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-13-01-00-000-1 | LGSF_LocallyFunded_Batch01 r1787 | ₱255,266,304.00 | `255,266,304.00` | ₱257,000,000.00 / `257,000,000.00` | — / blank | `255266304.0` | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-03-49-00-000-1 | LGSF_LocallyFunded_Batch03 r1296 | ₱245,000,000.00 | `245,000,000.00` | ₱245,000,000.00 / `245,000,000.00` | ₱0.00 / `0.0` | `242994066.0` | Assistance to Indigent Individuals or Families - Food assist |
| LIME-25-16-04-00-000-5 | RLIP_LIME20DF_Batch11 r1197 | ₱236,043,137.27 ⚑ | `236,043,137.27` | — / blank | — / blank | blank | Improvement of Various Rural Roads in Butuan City Phase IV w |
| FALGU-26-01-55-00-000-3 | LGSF_LocallyFunded_Batch04 r88 | ₱234,000,000.00 | blank | ₱234,000,000.00 / `234,000,000.00` | — / blank | blank | Construction of Hospital Building in Barangay Linmansangan,  |
| FALGU-26-04-21-00-000-1 | LGSF_LocallyFunded_Batch02 r755 | ₱224,335,990.80 | `224,335,990.80` | ₱252,000,000.00 / `252,000,000.00` | — / blank | `224335990.8` | Assistance to Indigent Individuals or Families - Food assist |
| LIME-25-09-01-01-000-12 | RLIP_LIME20DF_Batch09 r760 | ₱203,019,307.22 ⚑ | `203,019,307.22` | — / blank | — / blank | blank | Concreting of Road at Kud Pasangen, Barangay Binuangan |
| FALGU-25-02-57-00-000-1 | LGSF_LocallyFunded_Batch01 r1126 | ₱200,000,000.00 ⚑ | blank | ₱200,000,000.00 / `200,000,000.00` | — / blank | blank | Construction of Multi-Purpose Building in Sta. Maria, Maddel |
| FALGU-25-06-79-00-000-1 | LGSF_LocallyFunded_Batch01 r1104 | ₱200,000,000.00 ⚑ | blank | ₱200,000,000.00 / `200,000,000.00` | — / blank | blank | Construction of Phase 2 of Multi-Purpose Building |
| FALGU-26-03-49-00-000-2 | LGSF_LocallyFunded_Batch04 r441 | ₱200,000,000.00 ⚑ | blank | ₱200,000,000.00 / `200,000,000.00` | — / blank | blank | Construction of Local Road in Barangay Santa Ines, Cabiao to |
| FALGU-26-04-10-28-000-2 | LGSF_LocallyFunded_Batch03 r1571 | ₱200,000,000.00 ⚑ | blank | ₱200,000,000.00 / `200,000,000.00` | — / blank | blank | Construction of multipurpose building in Barangay San Antoni |
| FALGU-26-13-15-00-000-1 | LGSF_LocallyFunded_Batch01 r1799 | ₱197,000,000.00 | blank | ₱197,000,000.00 / `197,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-07-12-00-000-1 | LGSF_LocallyFunded_Batch02 r792 | ₱195,999,600.00 | `195,999,600.00` | ₱196,000,000.00 / `196,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| RLIP-25-10-43-08-000-2 | RLIP_LIME20DF_Batch03 r1305 | ₱192,281,009.80 | `192,281,009.80` | — / blank | — / blank | blank | ADDITIONAL CONSTRUCTION OF MP FACILITY (COVERED COURT) |
| FALGU-26-02-31-00-000-1 | LGSF_LocallyFunded_Batch02 r713 | ₱192,000,000.00 | `192,000,000.00` | ₱192,000,000.00 / `192,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-13-14-00-000-3 | LGSF_LocallyFunded_Batch02 r1491 | ₱180,000,000.00 | blank | ₱180,000,000.00 / `180,000,000.00` | — / blank | blank | Purchase of medical or hospital equipment |
| FALGU-26-13-13-00-000-3 | LGSF_LocallyFunded_Batch03 r1026 | ₱179,802,917.49 | `179,802,917.49` | ₱179,882,242.41 / `179,882,242.41` | — / blank | blank | ENGINEERING-26-FLOOD-00037 REHABILITATION OF ROAD, SIDEWALK  |
| FALGU-26-10-13-00-000-1 | LGSF_LocallyFunded_Batch02 r930 | ₱178,000,000.00 | `178,000,000.00` | ₱178,000,000.00 / `178,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-03-69-00-000-1 | LGSF_LocallyFunded_Batch01 r2005 | ₱175,000,000.00 | blank | ₱175,000,000.00 / `175,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-09-66-00-000-1 | LGSF_LocallyFunded_Batch02 r1235 | ₱172,000,000.00 | blank | ₱172,000,000.00 / `172,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-08-37-00-000-1 | LGSF_LocallyFunded_Batch02 r1036 | ₱171,000,000.00 | `171,000,000.00` | ₱171,000,000.00 / `171,000,000.00` | ₱0.00 / `0.0` | blank | Assistance to Indigent Individuals or Families - Food assist |
| FALGU-26-18-45-00-000-1 | LGSF_LocallyFunded_Batch03 r990 | ₱171,000,000.00 | blank | ₱171,000,000.00 / `171,000,000.00` | — / blank | blank | Assistance to Indigent Individuals or Families - Food assist |
| LIME-25-16-04-00-000-7 | RLIP_LIME20DF_Batch11 r1200 | ₱170,249,862.67 ⚑ | `170,249,862.67` | — / blank | — / blank | blank | Construction of Butuan City Urban Drainage (Phase 8) with Ex |

### 30 random rows (seed 20261101)

| ID | File, row | total_cost (DB) | Total cell (AQ) | Subsidy DB / cell (Q) | Counterpart DB / cell (R) | Contract cell (EE) | Title |
|---|---|--:|--:|--:|--:|--:|---|
| LIME-26-12-63-11-000-6 | RLIP_LIME20DF_Batch12 r567 | — | blank | — / blank | — / blank | blank | Construction and Installation of Solar LED Lights from Purok |
| RLIP-25-14-11-04-000-9 | RLIP_LIME20DF_Batch03 r465 | — | blank | — / blank | — / blank | blank | Improvement of Labey Multi-purpose Building, Ambuklao |
| LIME-26-14-81-05-000-39 | RLIP_LIME20DF_Batch17 r1582 | — | blank | — / blank | — / blank | blank | Purchase and Installation of Solar Powered Street Lights in  |
| LIME-25-14-27-11-000-1 | RLIP_LIME20DF_Batch08 r1293 | ₱749,139.18 | `749,139.18` | — / blank | — / blank | `749139.18` | Improvement of Liwon to Hayukung FMR |
| LIME-25-17-53-10-000-7 | RLIP_LIME20DF_Batch09 r119 | ₱300,000.00 | `300,000.00` | — / blank | — / blank | blank | Construction of Multi Purpose Building Bgy. Caponayan Phase  |
| LIME-25-03-14-10-000-30 | RLIP_LIME20DF_Batch06 r55 | ₱6,217,035.00 | `6,217,035.00` | — / blank | — / blank | `6206035.0` | Construction of Road (Sto. Cristo) |
| LIME-26-16-03-02-000-9 | RLIP_LIME20DF_Batch17 r840 | — | blank | — / blank | — / blank | blank | Concreting of Libertad Access Road at Relocation Site 1st St |
| SBDP-25-11-23-03-000-12 | LGSF_LocallyFunded_Batch02 r690 | ₱2,499,190.86 | `2,499,190.86` | ₱2,500,000.00 / `2,500,000.00` | ₱0.00 / `0.0` | `2499191.38` | PROVISION OF RENEWABLE ENERGY-BASED ELECTRIFICATION |
| LIME-25-12-47-18-000-1 | RLIP_LIME20DF_Batch03 r739 | ₱6,000,000.00 | `6,000,000.00` | — / blank | — / blank | `5994972.62` | CONSTRUCTION OF COVERED COURT WITH STAGE AND BLEACHERS FOR A |
| LIME-26-11-23-17-000-11 | RLIP_LIME20DF_Batch16 r596 | ₱8,789,534,586.00 ⚑ | `8,789,534,586.00` | — / blank | — / blank | blank | Improvement of Samal Island Integrated Public Market and Tra |
| rlip-b04-r1270 | RLIP_LIME20DF_Batch04 r1270 | — | blank | — / blank | — / blank | blank | Rehabilitation Improvement of Day Care Center at Brgy. Luisi |
| RLIP-25-12-65-10-000-1 | RLIP_LIME20DF_Batch02 r1138 | ₱2,000,000.00 | `2,000,000.00` | — / blank | — / blank | blank | PROVISION OF SOLAR STREETLIGHTS |
| LIME-26-08-48-18-000-3 | RLIP_LIME20DF_Batch12 r1266 | — | blank | — / blank | — / blank | blank | Repair/ Rehabilitation of Municipal Road at Gregorio B. Tan  |
| FALGU-26-02-15-05-000-2 | LGSF_LocallyFunded_Batch03 r1750 | ₱4,993,908.06 | `4,993,908.06` | ₱5,000,000.00 / `5,000,000.00` | — / blank | blank | Upgrading of Local Road in Barangay Sanja, Aparri |
| LIME-25-17-52-00-000-166 | RLIP_LIME20DF_Batch09 r1405 | — | blank | — / blank | — / blank | blank | Construction of Senior Citizens Building at San Vicente |
| LIME-26-02-31-14-000-20 | RLIP_LIME20DF_Batch16 r1795 | ₱1,600,000.00 | `1,600,000.00` | — / blank | — / blank | blank | Concrete Pavement at Medical Arts |
| RLIP-25-05-17-09-000-7 | RLIP_LIME20DF_Batch04 r554 | ₱2,497,921.08 | `2,497,921.08` | — / blank | — / blank | blank | Construction of One (1) Classroom School Building in Camalig |
| LIME-26-04-56-47-000-11 | RLIP_LIME20DF_Batch13 r806 | — | blank | — / blank | — / blank | blank | CONSTRUCTION OF ACCESS ROAD LEADING TO SANITARY LANDFILL |
| GEF-26-01-33-08-000-3A | LGSF_LocallyFunded_Batch03 r791 | ₱5,179,475.00 | `5,179,475.00` | ₱5,179,475.00 / `5,179,475.00` | ₱0.00 / `0.0` | blank | SUPPLY AND DELIVERY OF RICE FOR DISTRIBUTION TO IDENTIFIED B |
| RLIP-25-10-13-03-000-13 | RLIP_LIME20DF_Batch03 r305 | ₱4,000,000.00 | `4,000,000.00` | — / blank | — / blank | blank | Capital Expenditure on Local Economic Development for the Re |
| RLIP-25-17-52-02-000-12 | RLIP_LIME20DF_Batch01 r2003 | — | blank | — / blank | — / blank | blank | Concreting of Apnagan, Villapag-asa Road |
| LIME-25-01-29-04-000-2 | RLIP_LIME20DF_Batch07 r1371 | — | blank | — / blank | — / blank | blank | Rehab./Improvement of FMR Balugang Phase II |
| RLIP-25-10-43-17-000-9 | RLIP_LIME20DF_Batch03 r746 | ₱3,997,510.37 | `3,997,510.37` | — / blank | — / blank | blank | Construction of Dalangpanan Hall |
| FALGU-25-04-10-21-000-2 | LGSF_LocallyFunded_Batch01 r631 | ₱1,000,000.00 | `1,000,000.00` | ₱1,000,000.00 / `1,000,000.00` | — / blank | blank | Purchase of Vehicle – Van (for conversion into a rescue vehi |
| LIME-26-08-78-03-000-4 | RLIP_LIME20DF_Batch14 r1505 | ₱2,998,240.46 | `2,998,240.46` | — / blank | — / blank | blank | Installation of Solar Street Lights |
| LIME-26-07-12-38-000-5 | RLIP_LIME20DF_Batch15 r1091 | — | blank | — / blank | — / blank | blank | CONCRETING OF ACCESS ROAD GOING TO ECO-WASTE CENTER (PHASE 2 |
| RLIP-25-03-49-28-000-3 | RLIP_LIME20DF_Batch04 r1824 | ₱1,365,000.00 | `1,365,000.00` | — / blank | — / blank | `1342259.06` | Embankment (Purok 1) |
| LIME-25-07-22-11-000-2 | RLIP_LIME20DF_Batch10 r540 | ₱34,708,163.60 | `34,708,163.60` | — / blank | — / blank | `34708163.59` | Road Opening and Concreting of Cogon 20ha Lot Road Network ( |
| RLIP-25-10-13-11-000-5 | RLIP_LIME20DF_Batch02 r754 | ₱2,000,000.00 | `2,000,000.00` | — / blank | — / blank | blank | Development of Tourism Center/Pasalubong Center and Tourism  |
| FALGU-25-03-49-23-000-1 | LGSF_LocallyFunded_Batch01 r391 | ₱4,994,627.61 | `4,994,627.61` | ₱5,000,000.00 / `5,000,000.00` | — / blank | `4994627.61` | CONSTRUCTION OF MULTI-PURPOSE BUILDING IN MUNICIPAL GOVERNME |

### The 10 replaced totals

| ID | Reported total (cell AQ) | Shown (total_cost) | Basis | Contract (EE) | Subsidy + counterpart | Reported ÷ basis | Title / place |
|---|--:|--:|---|--:|--:|--:|---|
| SBDP-2025-10-43-08-076-01 | ₱101,072,637,659.00 | ₱1,994,838.96 | contract_amount | `1994838.96` | ₱2,000,000.00 | 50667× | CONCRETING OF FARM-TO-MARKET ROAD — CITY OF GINGOOG, MISAMIS ORIENTAL |
| SBDP-2025-10-43-08-014-01 | ₱1,994,699,780.00 | ₱2,000,000.00 | subsidy_plus_counterpart | blank | ₱2,000,000.00 | 997× | CONCRETING OF FARM-TO-MARKET ROAD — CITY OF GINGOOG, MISAMIS ORIENTAL |
| SBDP-2025-10-43-08-022-01 | ₱1,994,624,980.00 | ₱1,994,624.98 | contract_amount | `1994624.98` | ₱2,000,000.00 | 1000× | CONCRETING OF FARM-TO-MARKET ROAD — CITY OF GINGOOG, MISAMIS ORIENTAL |
| SBDP-2025-10-43-08-072-01 | ₱1,985,576,340.00 | ₱1,985,576.34 | contract_amount | `1985576.34` | ₱2,000,000.00 | 1000× | CONCRETING OF FARM-TO-MARKET ROAD — CITY OF GINGOOG, MISAMIS ORIENTAL |
| LIME-25-16-85-05-000-1 | ₱1,623,929,220.20 | ₱2,618,396.03 | contract_amount | `2618396.03` | ₱0.00 | 620× | SITE DEVELOPMENT OF LORETO INSTITUTIONAL COMPLEX – PHAS — LORETO, DINAGAT ISLANDS |
| FALGU-25-17-52-12-000-4 | ₱1,250,000,000.00 | ₱1,250,000.00 | contract_amount | `1250000.0` | ₱1,250,000.00 | 1000× | Purchase of vehicle - Van (for conversion into a rescue — ROXAS, ORIENTAL MINDORO |
| LIME-25-11-23-17-000-11 | ₱722,368,062.32 | ₱2,867,254.34 | contract_amount | `2867254.34` | ₱0.00 | 252× | Repair and Maintenance of Babak Gymnasium — ISLAND GARDEN CITY OF SAMAL, DAVAO DEL NORTE |
| SBDP-26-02-15-23-000-14 | ₱249,726,475.74 | ₱2,497,264.74 | contract_amount | `2497264.74` | ₱2,500,000.00 | 100× | REHABILITATION/IMPROVEMENT OF SCHOOL BUILDING — SANTA ANA, CAGAYAN |
| SBDP-26-05-17-08-000-1 | ₱208,441,540.07 | ₱9,998,529.24 | contract_amount | `9998529.24` | ₱10,000,000.00 | 21× | CONCRETING OF FARM-TO-MARKET ROAD — CALABANGA, CAMARINES SUR |
| GEF-26-14-44-09-000-16 | ₱147,781,335.38 | ₱3,900,169.00 | subsidy_plus_counterpart | blank | ₱3,900,169.00 | 38× | IMPROVEMENT/CONCRETING/RIPRAPPING OF TURNING POINT TO L — SAGADA, MOUNTAIN PROVINCE |

### The 25 "Amount not verified" rows

| ID | Shown total (= reported, cell AQ) | Subcategory | Subcat. median | × median | Subsidy + counterpart | Contract (EE) | Title / place |
|---|--:|---|--:|--:|--:|--:|---|
| LIME-26-11-23-17-000-11 | ₱8,789,534,586.00 (`8,789,534,586.00`) | Markets and multipurpose buildings | ₱1,993,263.32 | 4410× | ₱0.00 | blank | Improvement of Samal Island Integrated Public Market an — ISLAND GARDEN CITY OF SAMAL, DAVAO DEL NORTE |
| RLIP-25-10-13-01-000-2 | ₱7,160,000,000.00 (`7,160,000,000.00`) | Water supply systems | ₱2,196,260.84 | 3260× | ₱0.00 | blank | Construction of Water System at Libon-libon Lingating,  — BAUNGON, BUKIDNON |
| LIME-26-01-29-08-000-2 | ₱2,500,000,000.00 (`2,500,000,000.00`) | Livelihood initiatives | ₱1,480,951.10 | 1688× | ₱0.00 | blank | Construction of Tourism Scenic Stand Points & Signages — CERVANTES, ILOCOS SUR |
| RLIP-25-10-43-08-000-1 | ₱1,475,655,520.00 (`1,475,655,520.00`) | Roads and bridges | ₱1,994,157.05 | 740× | ₱0.00 | blank | ROAD CONCRETING — CITY OF GINGOOG, MISAMIS ORIENTAL |
| LIME-25-16-02-00-000-1 | ₱1,034,398,238.86 (`1,034,398,238.86`) | Roads and bridges | ₱1,994,157.05 | 519× | ₱0.00 | blank | UPGRADING/ IMPROVEMENT OF KITCHARAO-ANIBONGAN PROVINCIA — AGUSAN DEL NORTE |
| RLIP-25-10-43-08-000-4 | ₱1,030,413,516.98 (`1,030,413,516.98`) | Public buildings | ₱2,000,000.00 | 515× | ₱0.00 | blank | REPAIR OF CLASSROOM AT ALAGATAN ES — CITY OF GINGOOG, MISAMIS ORIENTAL |
| LIME-25-06-19-03-000-3 | ₱752,892,040.00 (`752,892,040.00`) | Disaster mitigation and preparedness | ₱1,250,000.00 | 602× | ₱0.00 | blank | CONSTRUCTION OF SLOPE PROTECTION — DUMALAG, CAPIZ |
| RLIP-25-10-43-08-000-5 | ₱632,438,938.32 (`632,438,938.32`) | Public buildings | ₱2,000,000.00 | 316× | ₱0.00 | blank | ADDTIONAL CONSTRUCTION OF CLASSROOM @ KISANDI — CITY OF GINGOOG, MISAMIS ORIENTAL |
| RLIP-25-10-13-20-000-17 | ₱629,375,000.00 (`629,375,000.00`) | Community facilities | ₱2,000,000.00 | 315× | ₱0.00 | blank | Land Development for Apartment Type Cemetery Phase 2, S — TALAKAG, BUKIDNON |
| RLIP-25-10-43-08-000-3 | ₱623,094,948.33 (`623,094,948.33`) | Water supply systems | ₱2,196,260.84 | 284× | ₱0.00 | blank | WATER WORKS — CITY OF GINGOOG, MISAMIS ORIENTAL |
| FALGU-25-13-06-00-000-1 | ₱500,000,000.00 (blank) | Markets and multipurpose buildings | ₱1,993,263.32 | 251× | ₱500,000,000.00 | blank | Multi-purpose building: Construction of Pamantasan ng L — CITY OF MANILA, CITY OF MANILA |
| FALGU-26-04-10-00-000-2 | ₱500,000,000.00 (blank) | Markets and multipurpose buildings | ₱1,993,263.32 | 251× | ₱500,000,000.00 | blank | Construction of Multipurpose buildings in Barangay Tali — BATANGAS |
| FALGU-25-05-17-24-000-4 | ₱450,000,000.00 (blank) | Evacuation centers | ₱1,930,000.00 | 233× | ₱450,000,000.00 | blank | Multi-purpose building: Comprehensive Retrofitting and  — CITY OF NAGA, CAMARINES SUR |
| LIME-25-06-19-14-000-5 | ₱436,410,607.85 (`436,410,607.85`) | Public buildings | ₱2,000,000.00 | 218× | ₱0.00 | blank | CONSTRUCTION OF A THREE (3) STOREY ROXAS CITY HALL BUIL — CITY OF ROXAS, CAPIZ |
| LIME-26-12-63-19-000-1 | ₱392,930,847.90 (`392,930,847.90`) | Markets and multipurpose buildings | ₱1,993,263.32 | 197× | ₱0.00 | blank | CONSTRUCTION OF 2-STOREY MULTIPURPOSE BUILDING BRGY. LA — LAKE SEBU, SOUTH COTABATO |
| FALGU-25-08-60-00-000-2 | ₱326,986,093.97 (`326,986,093.97`) | Markets and multipurpose buildings | ₱1,993,263.32 | 164× | ₱30,000,000.00 | `29956093.97` | Construction of multi-purpose building, Barangay San Po — CITY OF CALBAYOG, SAMAR (WESTERN SAMAR) |
| FALGU-25-13-16-00-000-9 | ₱300,000,000.00 (blank) | Roads and bridges | ₱1,994,157.05 | 150× | ₱300,000,000.00 | blank | Improvement of Local Road in City of Valenzuela, Nation — CITY OF VALENZUELA, CITY OF VALENZUELA |
| LIME-25-16-04-00-000-5 | ₱236,043,137.27 (`236,043,137.27`) | Roads and bridges | ₱1,994,157.05 | 118× | ₱0.00 | blank | Improvement of Various Rural Roads in Butuan City Phase — CITY OF BUTUAN, CITY OF BUTUAN (CAPITAL) |
| LIME-25-09-01-01-000-12 | ₱203,019,307.22 (`203,019,307.22`) | Roads and bridges | ₱1,994,157.05 | 102× | ₱0.00 | blank | Concreting of Road at Kud Pasangen, Barangay Binuangan — CITY OF ISABELA, CITY OF ISABELA (Not a Province) |
| FALGU-25-02-57-00-000-1 | ₱200,000,000.00 (blank) | Markets and multipurpose buildings | ₱1,993,263.32 | 100× | ₱200,000,000.00 | blank | Construction of Multi-Purpose Building in Sta. Maria, M — QUIRINO |
| FALGU-25-06-79-00-000-1 | ₱200,000,000.00 (blank) | Markets and multipurpose buildings | ₱1,993,263.32 | 100× | ₱200,000,000.00 | blank | Construction of Phase 2 of Multi-Purpose Building — GUIMARAS |
| FALGU-26-03-49-00-000-2 | ₱200,000,000.00 (blank) | Roads and bridges | ₱1,994,157.05 | 100× | ₱200,000,000.00 | blank | Construction of Local Road in Barangay Santa Ines, Cabi — NUEVA ECIJA |
| FALGU-26-04-10-28-000-2 | ₱200,000,000.00 (blank) | Markets and multipurpose buildings | ₱1,993,263.32 | 100× | ₱200,000,000.00 | blank | Construction of multipurpose building in Barangay San A — SANTO TOMAS, BATANGAS |
| LIME-25-16-04-00-000-7 | ₱170,249,862.67 (`170,249,862.67`) | Other public infrastructure | ₱1,212,748.77 | 140× | ₱0.00 | blank | Construction of Butuan City Urban Drainage (Phase 8) wi — CITY OF BUTUAN, CITY OF BUTUAN (CAPITAL) |
| FALGU-26-08-37-38-000-4 | ₱164,000,000.00 (blank) | Waste and sanitation | ₱1,500,000.00 | 109× | ₱164,000,000.00 | blank | Construction of Water supply and sanitation project in  — ORMOC CITY, LEYTE |
