// Reading documents on the phone, for Smart add: PDFs, Word, Excel, PowerPoint, CSV and plain text.
// Only the words are pulled out here. A PDF is also kept whole, so the family's AI can read scanned pages too.
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
const MAX_TEXT = 12000;          // words kept from one document
const MAX_PDF = 6 * 1024 * 1024; // PDFs up to this size are also sent whole to the AI
const MAX_PAGES = 15;

const ext = (name) => ((/\.([a-z0-9]{1,6})$/i.exec(name || '') || [])[1] || '').toLowerCase();
export function docKind(f) {
  const e = ext(f.name), t = f.type || '';
  if (/^image\//.test(t) && !/svg/.test(t)) return 'image';
  if (t === 'application/pdf' || e === 'pdf') return 'pdf';
  if (e === 'docx' || /wordprocessingml/.test(t)) return 'docx';
  if (e === 'xlsx' || /spreadsheetml/.test(t)) return 'xlsx';
  if (e === 'pptx' || /presentationml/.test(t)) return 'pptx';
  if (['csv', 'tsv', 'txt', 'md', 'json', 'vcf', 'rtf'].includes(e) || /^text\//.test(t)) return 'text';
  if (['doc', 'xls', 'ppt', 'pages', 'numbers', 'key'].includes(e)) return 'old';
  return 'other';
}
// Why a file couldn't be read, in plain words.
export function cantRead(f) {
  const k = docKind(f), e = ext(f.name).toUpperCase() || 'this kind of file';
  if (k === 'old') return `${f.name}: old ${e} files can’t be read — save it as PDF or the newer format (.docx / .xlsx) and add it again. It’s kept on the vendor.`;
  return `${f.name}: ${e} files can’t be read, only kept on the vendor.`;
}

const ent = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const tidy = (s) => s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, MAX_TEXT);

/* ---------- Zip (Word, Excel and PowerPoint files are zips of XML) ---------- */
export async function unzip(buf, want) {
  const dv = new DataView(buf), dec = new TextDecoder();
  let e = buf.byteLength - 22; const stop = Math.max(0, e - 65557);
  while (e >= stop && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < stop) throw new Error('not a zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nl)); p += 46 + nl + xl + cl;
    if (!want(name)) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const raw = new Uint8Array(buf, start, size);
    let bytes;
    if (method === 0) bytes = raw;
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else continue;
    out.set(name, dec.decode(bytes));
  }
  return out;
}
const byNumber = (a, b) => (+(a.match(/(\d+)\.xml$/) || [0, 0])[1]) - (+(b.match(/(\d+)\.xml$/) || [0, 0])[1]);

function wordText(xml) {
  return ent(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n').replace(/<[^>]+>/g, ''));
}
async function readDocx(buf) {
  const z = await unzip(buf, n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
  return tidy([...z.keys()].sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : 0)).map(k => wordText(z.get(k))).join('\n'));
}
async function readXlsx(buf) {
  const z = await unzip(buf, n => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = [...(z.get('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => ent([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const sheets = [...z.keys()].filter(k => k.includes('worksheets')).sort(byNumber);
  const lines = [];
  for (const k of sheets) {
    for (const row of z.get(k).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
        const attrs = c[1] || '', body = c[2] || '';
        if (/t="s"/.test(attrs)) return shared[+(body.match(/<v>(\d+)<\/v>/) || [0, -1])[1]] || '';
        if (/t="inlineStr"/.test(attrs)) return ent([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''));
        return ent((body.match(/<v>([\s\S]*?)<\/v>/) || [0, ''])[1]);
      }).filter(x => x !== '');
      if (cells.length) lines.push(cells.join(' | '));
    }
    lines.push('');
  }
  return tidy(lines.join('\n'));
}
async function readPptx(buf) {
  const z = await unzip(buf, n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  return tidy([...z.keys()].sort(byNumber).map(k => ent(z.get(k).replace(/<\/a:p>/g, '\n').replace(/<a:br\/>/g, '\n').replace(/<[^>]+>/g, ''))).join('\n\n'));
}
async function readPdf(buf) {
  const pdfjs = await import(PDFJS + 'pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const parts = [];
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let line = '', lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { parts.push(line); line = ''; }
      line += (line && !/\s$/.test(line) ? ' ' : '') + (it.str || ''); lastY = y;
      if (it.hasEOL) { parts.push(line); line = ''; lastY = null; }
    }
    parts.push(line, '');
  }
  return { text: tidy(parts.join('\n')), pages: doc.numPages };
}
function toB64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }

// → { name, kind, text, pages?, b64?, mime?, error? }
export async function readDoc(f) {
  const kind = docKind(f), out = { name: f.name, kind, text: '' };
  try {
    if (kind === 'text') out.text = tidy((await f.text()).replace(/\r\n?/g, '\n').replace(/,(?=\S)/g, ', '));
    else if (kind === 'docx') out.text = await readDocx(await f.arrayBuffer());
    else if (kind === 'xlsx') out.text = await readXlsx(await f.arrayBuffer());
    else if (kind === 'pptx') out.text = await readPptx(await f.arrayBuffer());
    else if (kind === 'pdf') {
      const buf = await f.arrayBuffer();
      if (f.size <= MAX_PDF) { out.b64 = toB64(buf); out.mime = 'application/pdf'; }
      try { Object.assign(out, await readPdf(buf)); } catch (e) { /* scanned or unreadable here — the AI may still read it */ }
    } else out.error = cantRead(f);
  } catch (e) { out.error = `${f.name}: couldn’t open it (${e.message || 'unknown problem'}). It’s kept on the vendor.`; }
  return out;
}
// A useful name from a file name: "Quote - Sharma Caterers.pdf" → "Sharma Caterers". Generic names give ''.
export function nameFromFile(name) {
  let s = String(name || '').replace(/\.[a-z0-9]{1,6}$/i, '').replace(/[_]+/g, ' ').replace(/\s*[-–—]\s*/g, ' - ').trim();
  s = s.replace(/\b(quote|quotation|estimate|invoice|brochure|menu|price ?list|rate ?card|package|packages|catalog(ue)?|proposal|final|v\d+|copy|\(\d+\))\b/gi, ' ').replace(/^[\s-]+|[\s-]+$/g, '').replace(/\s*-\s*-\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim();
  if (!s || /^(img|image|scan|scanned|doc|document|file|whatsapp|cam|dsc|pdf|untitled|new)\b/i.test(s) || /^\W*\d[\d\s-]*$/.test(s) || s.length < 3) return '';
  return s.slice(0, 60);
}
