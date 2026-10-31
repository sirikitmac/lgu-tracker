/**
 * Minimal read-only XLSX reader for the SubayBAYAN exports.
 *
 * The exports are plain workbooks: one sheet, cells are either shared strings
 * (t="s") or numbers. This reads the first worksheet into a sparse grid of
 * strings and numbers without a spreadsheet dependency (the common ones pull
 * in large, audit-flagged dependency trees for features we never use).
 *
 * Supported: shared strings (including rich-text runs), inline strings,
 * t="str" formula results, booleans, numbers. Not supported (never used by
 * the exports): dates stored as styled numbers are returned as plain numbers;
 * the caller decides how to read them.
 */
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';

export type CellValue = string | number | null;

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITY[e];
  });
}

/** "A" → 0, "Z" → 25, "AA" → 26, "EM" → 142 */
export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    // Plain <t> or rich text <r><t>..</t></r> runs; phonetic <rPh> runs are not text.
    const body = si[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '');
    let text = '';
    for (const t of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) text += t[1] ?? '';
    out.push(decodeXml(text));
  }
  return out;
}

export interface Sheet {
  /** rows[rowNumber - 1][columnIndex]; missing cells are undefined. */
  rows: CellValue[][];
  /** Merged ranges as written in the file, e.g. "A8:B9". */
  merges: string[];
}

/** Reads the first worksheet of an .xlsx file. */
export function readFirstSheet(file: string): Sheet {
  const zip = unzipSync(new Uint8Array(readFileSync(file)), {
    filter: (f) => f.name === 'xl/sharedStrings.xml' || f.name === 'xl/workbook.xml' || f.name === 'xl/_rels/workbook.xml.rels' || f.name.startsWith('xl/worksheets/sheet'),
  });
  const text = (name: string) => (zip[name] ? strFromU8(zip[name]) : undefined);
  const shared = readSharedStrings(text('xl/sharedStrings.xml'));

  // Resolve the first <sheet> in workbook order to its part.
  const workbook = text('xl/workbook.xml') ?? '';
  const rels = text('xl/_rels/workbook.xml.rels') ?? '';
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const target = rid ? new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1] : undefined;
  const part = target ? `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}` : 'xl/worksheets/sheet1.xml';
  const xml = text(part);
  if (!xml) throw new Error(`${file}: worksheet ${part} not found.`);

  const rows: CellValue[][] = [];
  for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(/\br="(\d+)"/.exec(row[1])?.[1]);
    if (!r || !row[2]) continue;
    const cells: CellValue[] = [];
    for (const c of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!ref || !c[2]) continue;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2])?.[1];
      let value: CellValue = null;
      if (type === 's') value = v === undefined ? null : shared[Number(v)] ?? null;
      else if (type === 'inlineStr') value = decodeXml([...c[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
      else if (type === 'str' || type === 'e') value = v === undefined ? null : decodeXml(v);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = Number(v);
      cells[columnIndex(ref)] = value;
    }
    rows[r - 1] = cells;
  }
  const merges = [...xml.matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"/g)].map((m) => m[1]);
  return { rows, merges };
}
