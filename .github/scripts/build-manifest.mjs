import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = join(process.cwd(), 'oi-docs');
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.github', 'vendor']);

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      await walk(p, out);
    } else if (e.isFile() && /\.md$/i.test(e.name)) {
      if (e.name.startsWith('_')) continue;
      out.push(p);
    }
  }
  return out;
}

function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      if (v === '') { meta[key] = []; continue; }
      if (/^\[.*\]$/.test(v)) {
        meta[key] = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else {
        meta[key] = v.replace(/^["']|["']$/g, '');
      }
    } else if (/^\s*-\s+/.test(line) && key) {
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(line.replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, ''));
    }
  }
  return { meta, body: text.slice(m[0].length) };
}

function stripInline(s) {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]{1,2}([^*_~]+)[*_~]{1,2}/g, '$1')
    .trim();
}

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5\s-]/g, '').replace(/\s+/g, '-');
}

function splitSections(body) {
  const sections = [];
  let cur = { id: '', text: '' };
  for (const line of body.split(/\r?\n/)) {
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) {
      if (cur.text.trim() || cur.id) sections.push(cur);
      const text = stripInline(hm[2]);
      cur = { id: slugify(text), text: text + '\n' };
    } else {
      cur.text += line + '\n';
    }
  }
  if (cur.text.trim() || cur.id) sections.push(cur);
  return sections;
}

const files = await walk(ROOT);
const docs = [];
const searchIndex = [];

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const raw = await readFile(file, 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  if (String(meta.draft).toLowerCase() === 'true') continue;

  const parts = rel.split('/');
  const category = parts.length === 1 ? '杂项' : parts[0];
  const baseTitle = parts[parts.length - 1].replace(/\.md$/i, '');
  const title = (typeof meta.title === 'string' && meta.title) || baseTitle;
  const tags = Array.isArray(meta.tags) ? meta.tags.map(String) : (meta.tags ? [String(meta.tags)] : []);
  const date = typeof meta.date === 'string' ? meta.date : (meta.date ? String(meta.date) : '');
  const summary = typeof meta.summary === 'string' ? meta.summary : '';

  docs.push({ path: rel, title, category, tags, date, summary });
  searchIndex.push({ path: rel, sections: splitSections(body) });
}

docs.sort((a, b) => a.path.localeCompare(b.path));

await writeFile(join(ROOT, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), docs }));
await writeFile(join(ROOT, 'search-index.json'), JSON.stringify(searchIndex));
console.log(`manifest: ${docs.length} docs, index: ${searchIndex.length} docs`);