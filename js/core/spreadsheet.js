/*
 * Reading uploaded spreadsheets in the browser, carried over from the original prototype.
 * parseCSV(text) and parseXlsx(file) both return an array of rows, each an array of cell strings.
 * The XLSX reader handles the first worksheet only and needs a browser with DecompressionStream.
 */
function parseCSV(text) {
  const out = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && c === ',') {
      row.push(cell); cell = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) out.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('Unclosed CSV quotation.');
  row.push(cell);
  if (row.some(Boolean)) out.push(row);
  return out;
}

async function parseXlsx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const u16 = i => view.getUint16(i, true), u32 = i => view.getUint32(i, true);
  const decoder = new TextDecoder();

  // Find the ZIP central directory
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw Error('Invalid XLSX file.');
  const parts = {};
  let p = u32(end + 16);
  for (let i = 0, n = u16(end + 10); i < n; i++) {
    if (u32(p) !== 0x02014b50) throw Error('Invalid XLSX file.');
    const method = u16(p + 10), size = u32(p + 20), nameLen = u16(p + 28), extraLen = u16(p + 30), commentLen = u16(p + 32), offset = u32(p + 42);
    const name = decoder.decode(bytes.slice(p + 46, p + 46 + nameLen));
    const start = offset + 30 + u16(offset + 26) + u16(offset + 28);
    parts[name] = { method, bytes: bytes.slice(start, start + size) };
    p += 46 + nameLen + extraLen + commentLen;
  }

  async function xml(name) {
    const item = parts[name];
    if (!item) return null;
    let data = item.bytes;
    if (item.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw Error('This browser cannot read XLSX. Save the file as CSV and try again.');
      data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    } else if (item.method !== 0) throw Error('Unsupported XLSX compression.');
    return new DOMParser().parseFromString(decoder.decode(data), 'application/xml');
  }

  const workbook = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels');
  const firstSheet = workbook?.getElementsByTagName('sheet')[0];
  const relId = firstSheet?.getAttribute('r:id');
  const target = [...(rels?.getElementsByTagName('Relationship') || [])].find(r => r.getAttribute('Id') === relId)?.getAttribute('Target');
  const path = target ? (target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '')) : 'xl/worksheets/sheet1.xml';
  const sheet = await xml(path);
  if (!sheet) throw Error('No worksheet found.');
  const shared = await xml('xl/sharedStrings.xml');
  const strings = [...(shared?.getElementsByTagName('si') || [])].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));

  return [...sheet.getElementsByTagName('row')].map(row => {
    const values = [];
    for (const c of row.getElementsByTagName('c')) {
      const letters = (c.getAttribute('r') || 'A').match(/^[A-Z]+/)[0];
      const col = [...letters].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const type = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent || '';
      values[col] = type === 's' ? strings[Number(v)] || '' : type === 'inlineStr' ? [...c.getElementsByTagName('t')].map(t => t.textContent).join('') : v;
    }
    return values;
  }).filter(r => r.some(Boolean));
}
