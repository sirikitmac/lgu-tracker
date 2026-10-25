/**
 * RFC 4180 CSV parser: quoted fields, doubled quotes, commas and newlines
 * inside quotes, CRLF or LF. Returns objects keyed by the header row.
 * Throws on an unterminated quote or a row whose width differs from the header.
 */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV ends inside a quoted field.');
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const [header, ...body] = records;
  if (!header) return { header: [], rows: [] };
  const rows = body.map((values, index) => {
    if (values.length !== header.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} fields; the header has ${header.length}.`);
    }
    return Object.fromEntries(header.map((name, c) => [name, values[c]]));
  });
  return { header, rows };
}
