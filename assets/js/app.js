import md from './markdown.js';
import idb from './storage.js';
import { KEYBINDINGS } from './keybindings.js';

/* ================================================================
 * 2. 配置
 * ================================================================ */
const CONFIG = {
  owner:  'lcd-xvii',
  repo:   'oi-docs',
  branch: 'main',
  contentRoot: '',
  treeCacheTTL: 10 * 60 * 1000,
  docCacheTTL:  24 * 60 * 60 * 1000,
};

const CATEGORY_META = {
  '题解':     { icon: 'file-text', order: 1 },
  '总结':     { icon: 'list', order: 2 },
  '算法理论': { icon: 'book', order: 3 },
  '杂项':     { icon: 'folder', order: 999 },
};

/* ================================================================
 * 4. 基础设施
 * ================================================================ */
const $ = s => document.querySelector(s);
const ROOT = CONFIG.contentRoot ? CONFIG.contentRoot.replace(/^\/+|\/+$/g, '') + '/' : '';
const SITE_BASE = new URL('../../', import.meta.url).href;
const API_BASE = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}`;
const CACHE_KEY = `oi-docs-tree:${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${ROOT}`;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encodePath = p => p.split('/').map(encodeURIComponent).join('/');
const resolvePath = (dir, rel) => { const out=[]; (dir+rel).split('/').forEach(p=>{if(!p||p==='.')return;if(p==='..')out.pop();else out.push(p);}); return out.join('/'); };
const ICON_PATHS = {
  'file-text': '<path d="M5 3.5h9l5 5v12H5z"/><path d="M14 3.5v5h5M8 13h8M8 16.5h8"/>',
  list: '<path d="M9 6h10M9 12h10M9 18h10"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  book: '<path d="M4 4.5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z"/><path d="M4 16.5a3 3 0 0 1 3-3h11M8 8h6"/>',
  folder: '<path d="M3.5 6.5h6l2 2h9v10h-17z"/><path d="M3.5 8.5h17"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/>',
  link: '<path d="M10 13.5 14 9.5M8.5 15H7a4 4 0 0 1 0-8h4M15.5 9H17a4 4 0 0 1 0 8h-4"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="1.5"/><path d="M16 8V5a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 4 5v11a1.5 1.5 0 0 0 1.5 1.5H8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  summary: '<path d="M2 2l4 4l4-4M2 6l4 4l4-4"/>',
};
function iconSvg(name, className = 'nav-icon') {
  const viewBox = name === 'summary' ? '0 0 12 12' : '0 0 24 24';
  return `<svg class="${className}" width="18" height="18" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.folder}</svg>`;
}

/* ================================================================
 * 6. 数据获取
 * ================================================================ */
async function fetchTree(force = false) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.time < CONFIG.treeCacheTTL) return cached.data;
    } catch {}
  }
  const headers = { 'Accept': 'application/vnd.github+json' };
  const tryBranch = async branch => fetch(`${API_BASE}/git/trees/${branch}?recursive=1`, { headers });
  let res = await tryBranch(CONFIG.branch);
  if (res.status === 404 && CONFIG.branch === 'main') res = await tryBranch('master');
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) throw new Error('GitHub API 速率限制（匿名 60 次/小时），请稍后重试。');
    throw new Error(`拉取文件列表失败：HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.truncated) console.warn('[OI Docs] 文件树被截断，部分文档可能未显示');
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, time: Date.now() }));
  return data;
}

async function fetchMarkdown(path) {
  const cached = await idb.get('docs', path);
  if (cached && Date.now() - cached.time < CONFIG.docCacheTTL) return cached.text;
  const res = await fetch(SITE_BASE + encodePath(ROOT + path), { cache: 'no-cache' });
  if (!res.ok) {
    if (cached) return cached.text;
    throw new Error(`HTTP ${res.status} — ${path}`);
  }
  const text = await res.text();
  idb.set('docs', path, { text, time: Date.now() });
  return text;
}

async function loadManifest(force = false) {
  if (!force) {
    const cached = await idb.get('meta', 'manifest');
    if (cached && Date.now() - cached.time < CONFIG.treeCacheTTL) return cached.data;
  }
  const res = await fetch(SITE_BASE + 'manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('manifest.json 不存在');
  const data = await res.json();
  idb.set('meta', 'manifest', { data, time: Date.now() });
  return data;
}

async function loadSearchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const cached = await idb.get('meta', 'search-index');
  if (cached && Date.now() - cached.time < CONFIG.treeCacheTTL) {
    SEARCH_INDEX = cached.data;
    return SEARCH_INDEX;
  }
  const res = await fetch(SITE_BASE + 'search-index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('search-index.json 不存在');
  SEARCH_INDEX = await res.json();
  idb.set('meta', 'search-index', { data: SEARCH_INDEX, time: Date.now() });
  return SEARCH_INDEX;
}

/* ================================================================
 * 7. 构建分类
 * ================================================================ */
let CATEGORIES = [];
let MANIFEST = null;
let SEARCH_INDEX = null;
let ITEM_MAP = new Map();
let activeTag = null;
let currentPath = null;
let treeLoaded = false;

function buildDocs(tree) {
  const blobs = (tree.tree || [])
    .filter(t => t.type === 'blob' && /\.md$/i.test(t.path))
    .filter(t => !t.path.split('/').some(seg => seg.startsWith('.')))
    .filter(t => !/^_/.test(t.path.split('/').pop()))
    .filter(t => !ROOT || t.path.startsWith(ROOT))
    .map(t => ROOT ? t.path.slice(ROOT.length) : t.path);

  const groups = new Map();
  for (const path of blobs) {
    const parts = path.split('/');
    const catName = parts.length === 1 ? '杂项' : parts[0];
    const title = parts[parts.length - 1].replace(/\.md$/i, '');
    if (!groups.has(catName)) groups.set(catName, []);
    groups.get(catName).push({ path, title, tags: [], date: '', summary: '' });
  }
  return finalizeCategories(groups);
}

function buildFromManifest(manifest) {
  const groups = new Map();
  for (const d of manifest.docs || []) {
    if (ROOT && !d.path.startsWith(ROOT)) continue;
    const path = ROOT ? d.path.slice(ROOT.length) : d.path;
    const parts = path.split('/');
    const catName = parts.length === 1 ? '杂项' : parts[0];
    if (!groups.has(catName)) groups.set(catName, []);
    groups.get(catName).push({
      path,
      title: d.title || parts[parts.length - 1].replace(/\.md$/i, ''),
      tags: Array.isArray(d.tags) ? d.tags : [],
      date: d.date || '',
      summary: d.summary || '',
    });
  }
  return finalizeCategories(groups);
}

function finalizeCategories(groups) {
  const arr = [...groups.entries()].map(([name, items]) => {
    const meta = CATEGORY_META[name] || {};
    items.sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      a.title.localeCompare(b.title, 'zh-CN'));
    return { name, icon: meta.icon || '📁', order: meta.order ?? 500, items, collapsed: false };
  });
  arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'));
  return arr;
}

function rebuildItemMap() {
  ITEM_MAP = new Map();
  for (const c of CATEGORIES) for (const it of c.items) ITEM_MAP.set(it.path, { ...it, cat: c.name });
}

/* ================================================================
 * 8. 侧边栏 + 标签云
 * ================================================================ */
function renderSidebar() {
  let html = '';
  CATEGORIES.forEach((cat, ci) => {
    let items = cat.items;
    if (activeTag) items = items.filter(it => (it.tags || []).includes(activeTag));
    if (activeTag && items.length === 0) return;
    const filtering = activeTag;
    const collapsed = (cat.collapsed && !filtering) ? ' collapsed' : '';
    html += `<section class="nav-group${collapsed}" data-cat="${ci}">
      <button class="nav-group-title" type="button" aria-expanded="${!collapsed}">
        <span class="caret" aria-hidden="true"></span>${iconSvg(cat.icon)}<span class="nav-group-name">${escapeHtml(cat.name)}</span><span class="count">${items.length}</span>
      </button>
      <ul class="nav-items">`;
    if (items.length === 0) html += `<li class="nav-empty">空</li>`;
    else items.forEach(it => {
      const active = it.path === currentPath ? ' active' : '';
      html += `<li><a href="#${escapeHtml(encodeURIComponent(it.path))}" class="${active.trim()}" data-path="${escapeHtml(it.path)}" title="${escapeHtml(it.path)}"${active ? ' aria-current="page"' : ''}>${escapeHtml(it.title)}</a></li>`;
    });
    html += `</ul></section>`;
  });
  if (!html) html = `<div class="nav-empty">${treeLoaded ? (activeTag ? '该标签下没有文档' : '没有找到 .md 文档') : '正在读取仓库…'}</div>`;
  $('#nav').innerHTML = html;
  const documentCount = CATEGORIES.reduce((total, category) => total + category.items.length, 0);
  $('#docCount').textContent = documentCount ? `${documentCount} 篇` : '';
}

function renderTags() {
  const el = $('#tagCloud');
  if (!MANIFEST) { el.innerHTML = ''; return; }
  const counts = new Map();
  for (const cat of CATEGORIES) for (const it of cat.items) for (const t of (it.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
  if (!counts.size) { el.innerHTML = ''; return; }
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'));
  el.innerHTML = `<div class="tag-title">标签</div><div class="tag-list">${tags.map(([t, n]) =>
    `<button class="tag${t === activeTag ? ' active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}<span>${n}</span></button>`).join('')}</div>` +
    (activeTag ? `<button class="tag-clear" id="tagClear">清除筛选</button>` : '');
}

$('#tagCloud').addEventListener('click', e => {
  if (e.target.closest('#tagClear')) { activeTag = null; renderTags(); renderSidebar(); return; }
  const btn = e.target.closest('.tag');
  if (!btn) return;
  const t = btn.dataset.tag;
  activeTag = activeTag === t ? null : t;
  renderTags();
  renderSidebar();
});

$('#nav').addEventListener('click', e => {
  const t = e.target.closest('.nav-group-title');
  if (!t) return;
  const group = t.parentElement;
  group.classList.toggle('collapsed');
  const collapsed = group.classList.contains('collapsed');
  t.setAttribute('aria-expanded', String(!collapsed));
  CATEGORIES[+group.dataset.cat].collapsed = collapsed;
});

/* ================================================================
 * 9. 路由
 * ================================================================ */
function parseHash() {
  let h = location.hash.slice(1);
  if (!h) return { path: null, anchor: null };
  try { h = decodeURIComponent(h); } catch {}
  const i = h.indexOf('#');
  return i === -1 ? { path: h, anchor: null } : { path: h.slice(0, i), anchor: h.slice(i + 1) };
}

function scrollToAnchor(anchor) {
  const el = document.getElementById(anchor) || document.querySelector(`.md [id="${CSS.escape(anchor)}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ================================================================
 * 10. 欢迎页 / 文档
 * ================================================================ */
function renderWelcome() {
  currentPath = null;
  renderSidebar();
  document.title = 'OI 文档';
  const cards = CATEGORIES.map((c, i) =>
    `<button class="card" type="button" data-cat="${i}">${iconSvg(c.icon, 'card-icon')}<span class="card-copy"><span class="card-title">${escapeHtml(c.name)}</span><span class="card-description">${c.items.length} 篇文档</span></span><span class="card-arrow" aria-hidden="true">›</span></button>`
  ).join('');
  $('#content').innerHTML = `<div class="article welcome-page"><div class="hero"><p class="eyebrow">OI DOCS</p><h1>算法竞赛文档</h1><p>题解、周总结与算法理论整理</p></div><div class="welcome-section"><h2>文档分类</h2><div class="card-grid">${cards || '<div class="nav-empty">还没有文档</div>'}</div></div></div>`;
}

$('#content').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const cat = CATEGORIES[+card.dataset.cat];
  if (cat?.items[0]) location.hash = encodeURIComponent(cat.items[0].path);
});

function showError(html) {
  $('#content').innerHTML = `<div class="article"><div class="error">${html}</div></div>`;
}

function fixLinks(root, mdPath) {
  const dir = mdPath.includes('/') ? mdPath.slice(0, mdPath.lastIndexOf('/') + 1) : '';
  root.querySelectorAll('a[href]').forEach(a => {
    let href = a.getAttribute('href');
    if (!href) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; return; }
    if (href.startsWith('#')) return;
    const [rawPath, anchor] = href.split('#');
    if (/\.md$/i.test(rawPath)) {
      const target = resolvePath(dir, rawPath);
      const isInternal = ITEM_MAP.has(target);
      if (isInternal) a.setAttribute('href', '#' + encodeURIComponent(target) + (anchor ? '#' + anchor : ''));
      else { a.setAttribute('href', `https://github.com/${CONFIG.owner}/${CONFIG.repo}/blob/${CONFIG.branch}/` + encodePath(ROOT + target) + (anchor ? '#' + anchor : '')); a.target = '_blank'; }
    } else {
      a.setAttribute('href', SITE_BASE + encodePath(ROOT + resolvePath(dir, rawPath)) + (anchor ? '#' + anchor : ''));
      a.target = '_blank';
    }
  });
  root.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return;
    const rel = src.startsWith('/') ? src.slice(1) : resolvePath(dir, src);
    img.setAttribute('src', SITE_BASE + encodePath(ROOT + rel));
  });
}

function addHeadingIds(root, path) {
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    if (!h.id) h.id = h.textContent.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5\s-]/g, '').replace(/\s+/g, '-');
    if (h.querySelector('.heading-anchor')) return;
    const link = document.createElement('a');
    link.className = 'heading-anchor';
    link.href = `#${encodeURIComponent(path)}#${encodeURIComponent(h.id)}`;
    link.setAttribute('aria-label', `链接到标题：${h.textContent.trim()}`);
    link.innerHTML = iconSvg('link', 'heading-link-icon');
    h.prepend(link);
  });
}

/* ---------- 代码块复制 ---------- */
function attachCopyButtons(mdRoot) {
  mdRoot.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const code = pre.querySelector('code');
    if (!code) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '复制代码');
    btn.innerHTML = `${iconSvg('copy', 'copy-icon')}<span>复制</span>`;
    pre.appendChild(btn);
  });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
  return ok;
}

$('#content').addEventListener('click', async e => {
  const pathButton = e.target.closest('.copy-path-btn');
  if (pathButton) {
    const ok = await copyText(pathButton.dataset.path);
    if (!ok) return;
    pathButton.innerHTML = `${iconSvg('check', 'copy-icon')}<span>已复制</span>`;
    pathButton.classList.add('copied');
    setTimeout(() => {
      pathButton.innerHTML = `${iconSvg('copy', 'copy-icon')}<span>复制路径</span>`;
      pathButton.classList.remove('copied');
    }, 1500);
    return;
  }
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  const code = btn.closest('pre')?.querySelector('code');
  if (!code) return;
  const text = code.innerText;
  const ok = await copyText(text);
  if (!ok) return;
  btn.innerHTML = `${iconSvg('check', 'copy-icon')}<span>已复制</span>`;
  btn.classList.add('copied');
  setTimeout(() => {
    btn.innerHTML = `${iconSvg('copy', 'copy-icon')}<span>复制</span>`;
    btn.classList.remove('copied');
  }, 1500);
});

/* ---------- TOC ---------- */
let tocScrollHandler = null;
let tocRaf = 0;

function setupTOC(mdRoot, path) {
  const toc = document.getElementById('toc');
  if (!toc) return;
  if (tocScrollHandler) {
    window.removeEventListener('scroll', tocScrollHandler);
    tocScrollHandler = null;
  }
  if (tocRaf) {
    cancelAnimationFrame(tocRaf);
    tocRaf = 0;
  }
  const heads = [...mdRoot.querySelectorAll('h1[id],h2[id],h3[id],h4[id]')];
  if (heads.length < 2) {
    toc.remove();
    return;
  }

  const list = heads.map(h => {
    const lvl = +h.tagName[1];
    return `<li class="toc-l${lvl}"><a href="#${encodeURIComponent(path)}#${encodeURIComponent(h.id)}" data-id="${escapeHtml(h.id)}">${escapeHtml(h.textContent.trim())}</a></li>`;
  }).join('');

  toc.innerHTML = `<button class="toc-head" id="tocHead" type="button" aria-expanded="false"><span>目录</span><span aria-hidden="true">▾</span></button><ul class="toc-list">${list}</ul>`;
  toc.querySelector('.toc-head').addEventListener('click', event => {
    const collapsed = toc.classList.toggle('collapsed');
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
  });
  const update = () => {
    let activeId = heads[0].id;
    for (const h of heads) {
      if (h.getBoundingClientRect().top < 100) activeId = h.id; else break;
    }
    toc.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.id === activeId));
  };
  tocScrollHandler = () => {
    if (tocRaf) return;
    tocRaf = requestAnimationFrame(() => { tocRaf = 0; update(); });
  };
  window.addEventListener('scroll', tocScrollHandler, { passive: true });
  update();
}

async function openDoc(path, anchor) {
  clearTimeout(searchTimer);
  searchRequest++;
  closeSidebar();
  hideSearchResults();
  const item = ITEM_MAP.get(path);
  if (!item) { showError(`未找到文档：<code>${escapeHtml(path)}</code>`); return; }

  document.querySelectorAll('.nav-items a').forEach(a => {
    const active = a.dataset.path === path;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('#content').innerHTML = `<div class="article"><div class="loading">正在加载 ${escapeHtml(item.title)}…</div></div>`;
  window.scrollTo(0, 0);

  try {
    const text = await fetchMarkdown(path);
    const html = md.render(text);
    const tagsHtml = (item.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
    const category = CATEGORIES.find(candidate => candidate.name === item.cat);
    const categoryHref = category?.items[0] ? `#${encodeURIComponent(category.items[0].path)}` : '#';
    $('#content').innerHTML = `<div class="article">
      <nav class="breadcrumbs" aria-label="面包屑导航">
        <a href="#">首页</a><span aria-hidden="true">/</span><a href="${categoryHref}">${escapeHtml(item.cat)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(item.title)}</span>
      </nav>
      <header class="article-heading">
        <div class="article-title-row">
          <h1 class="article-title">${escapeHtml(item.title)}</h1>
        </div>
        <div class="article-meta">
          <span class="badge">${escapeHtml(item.cat)}</span>
          <span class="article-path">${escapeHtml(path)}</span>
          <button class="copy-path-btn" type="button" data-path="${escapeHtml(path)}" aria-label="复制文档路径">${iconSvg('copy', 'copy-icon')}<span>复制路径</span></button>
          ${tagsHtml}
        </div>
      </header>
      <div class="toc collapsed" id="toc"></div>
      <div class="md">${html}</div>
    </div>`;

    const mdRoot = $('#content .md');
    fixLinks(mdRoot, path);
    addHeadingIds(mdRoot, path);
    attachCopyButtons(mdRoot);
    setupTOC(mdRoot, path);
    currentPath = path;
    document.title = `${item.title} · OI 文档`;
    if (anchor) setTimeout(() => scrollToAnchor(anchor), 50);
  } catch (err) {
    showError(`<strong>无法加载文档</strong><br>路径：<code>${escapeHtml(path)}</code><br>原因：${escapeHtml(err.message || String(err))}<br><small>请确认文件存在、配置正确，并通过 http(s) 访问页面。</small>`);
  }
}

async function onHashChange() {
  const { path, anchor } = parseHash();
  if (path && path === currentPath) {
    if (anchor) scrollToAnchor(anchor);
    return;
  }
  if (path) await openDoc(path, anchor);
  else renderWelcome();
}

/* ================================================================
 * 11. 全文搜索
 * ================================================================ */
let searchResults = [];
let searchSel = -1;
let searchTimer = null;
let searchRequest = 0;
let searchIndexError = '';
let searchIndexPromise = null;

function searchTerms(query) {
  return [...query.matchAll(/"([^"]+)"|(\S+)/g)]
    .map(match => (match[1] || match[2]).trim().toLocaleLowerCase())
    .filter(Boolean);
}

function highlight(text, query) {
  const terms = searchTerms(query).sort((a, b) => b.length - a.length);
  const escapedText = escapeHtml(text);
  if (!terms.length) return escapedText;
  const expression = new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu');
  return escapedText.replace(expression, match => `<mark>${match}</mark>`);
}

function searchDocs(query, scope = 'all') {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const results = [];
  const sectionsByPath = new Map((SEARCH_INDEX || []).map(doc => [doc.path, doc.sections || []]));

  for (const [path, item] of ITEM_MAP) {
    const fields = [
      { value: item.title, score: 45, kind: 'title' },
      { value: item.cat, score: 18, kind: 'category' },
      { value: path, score: 8, kind: 'path' },
      { value: (item.tags || []).join(' '), score: 22, kind: 'tag' },
    ].filter(field => scope !== 'title' || field.kind === 'title');
    const sections = sectionsByPath.get(path) || [];
    const contentOnly = scope === 'content';
    const titleOnly = scope === 'title';
    let score = 0;
    let matched = true;
    let bestSection = null;
    let bestSectionScore = -1;

    for (const term of terms) {
      const fieldHit = !contentOnly && fields.reduce((best, field) => {
        const value = field.value.toLocaleLowerCase();
        if (!value.includes(term)) return best;
        const fieldScore = field.score +
          (field.kind === 'title' && value === term ? 35 : 0) +
          (field.kind === 'title' && value.startsWith(term) ? 15 : 0);
        return Math.max(best, fieldScore);
      }, 0);
      let contentHit = false;

      if (!titleOnly) {
        for (const section of sections) {
          const text = String(section.text || '');
          const index = text.toLocaleLowerCase().indexOf(term);
          if (index < 0) continue;
          contentHit = true;
          const sectionScore = terms.reduce((total, candidate) =>
            total + (text.toLocaleLowerCase().includes(candidate) ? 10 : 0), 0) + (section.id ? 2 : 0);
          if (sectionScore > bestSectionScore) {
            bestSection = { ...section, text };
            bestSectionScore = sectionScore;
          }
        }
      }

      if (contentOnly ? !contentHit : (titleOnly ? !fieldHit : (!fieldHit && !contentHit))) {
        matched = false;
        break;
      }
      score += Math.max(fieldHit, contentHit ? bestSectionScore : 0);
    }
    if (!matched) continue;

    let snippet = '';
    if (bestSection) {
      const lower = bestSection.text.toLocaleLowerCase();
      const firstMatch = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] || 0;
      const start = Math.max(0, firstMatch - 48);
      const end = Math.min(bestSection.text.length, firstMatch + 120);
      snippet = (start > 0 ? '…' : '') +
        bestSection.text.slice(start, end).replace(/\s+/g, ' ').trim() +
        (end < bestSection.text.length ? '…' : '');
    }
    results.push({
      path,
      title: item.title,
      cat: item.cat,
      anchor: bestSection?.id || null,
      snippet,
      score,
    });
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-CN')).slice(0, 60);
}

function renderDialogSearchResults(query, scope) {
  const box = $('#searchDialogResults');
  const status = $('#searchStatus');
  const terms = searchTerms(query);
  if (!terms.length) {
    status.textContent = '输入关键词开始搜索';
    box.innerHTML = '<div class="search-dialog-empty">支持多个关键词和加引号的短语</div>';
    return;
  }
  if (!searchResults.length) {
    status.textContent = searchIndexError && scope !== 'title'
      ? '正文索引加载失败；请重试或改为仅搜索标题'
      : '没有匹配的文档';
    box.innerHTML = `<div class="search-dialog-empty">${searchIndexError && scope !== 'title'
      ? '无法载入正文搜索索引。可继续搜索标题，或重新载入索引。<br><button class="retry-search-index" type="button">重新载入全文索引</button>'
      : '没有找到匹配项，请尝试更短或不同的关键词。'}</div>`;
    return;
  }
  status.textContent = `${searchResults.length} 条结果${searchResults.length === 60 ? '（显示前 60 条）' : ''}`;
  box.innerHTML = searchResults.map((result, index) => `
    <a class="dialog-search-result" id="dialog-result-${index}" role="option" aria-selected="${index === searchSel}"
       href="#${encodeURIComponent(result.path)}${result.anchor ? '#' + encodeURIComponent(result.anchor) : ''}" data-i="${index}">
      ${iconSvg(result.snippet ? 'file-text' : 'folder', 'dialog-search-result-icon')}
      <span class="dialog-result-copy">
        <span class="dialog-result-title">${highlight(result.title, query)}<span class="dialog-result-meta">${escapeHtml(result.cat)} · ${escapeHtml(result.path)}</span></span>
        ${result.snippet ? `<span class="dialog-result-snippet">${highlight(result.snippet, query)}</span>` : ''}
      </span>
    </a>`).join('');
  updateSearchSel();
}

async function runSearch(query, scope) {
  const request = ++searchRequest;
  const terms = searchTerms(query);
  searchSel = -1;
  if (!terms.length) {
    searchResults = [];
    renderDialogSearchResults(query, scope);
    return;
  }
  if (scope !== 'title' && !SEARCH_INDEX) {
    $('#searchStatus').textContent = '正在载入正文索引…';
    if (!searchIndexPromise) {
      searchIndexPromise = loadSearchIndex().then(() => {
        searchIndexError = '';
      }).catch(error => {
        searchIndexError = error.message || String(error);
        console.error('[OI 文档] 正文搜索索引加载失败', error);
      });
    }
    await searchIndexPromise;
  }
  if (request !== searchRequest) return;
  searchResults = searchDocs(query, scope);
  renderDialogSearchResults(query, scope);
}

function hideSearchResults() {
  searchResults = [];
  searchSel = -1;
}

function updateSearchSel() {
  $('#searchDialogResults').querySelectorAll('.dialog-search-result').forEach((el, i) => {
    el.setAttribute('aria-selected', String(i === searchSel));
    if (i === searchSel) el.scrollIntoView({ block: 'nearest' });
  });
}

function goResult(r) {
  clearTimeout(searchTimer);
  searchRequest++;
  hideSearchResults();
  if (searchDialog.open) searchDialog.close();
  location.hash = encodeURIComponent(r.path) + (r.anchor ? '#' + r.anchor : '');
}

const searchDialog = $('#searchDialog');
const globalSearch = $('#globalSearch');
$('#searchBtn').addEventListener('click', () => showSearch('all'));
$('#searchClose').addEventListener('click', () => searchDialog.close());
searchDialog.addEventListener('click', event => {
  if (event.target === searchDialog) searchDialog.close();
  if (event.target.closest('.dialog-search-result')) searchDialog.close();
  if (event.target.closest('.retry-search-index')) {
    SEARCH_INDEX = null;
    searchIndexPromise = null;
    searchIndexError = '';
    runSearch(globalSearch.value, $('#searchScope').value);
  }
});
globalSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchRequest++;
  const query = globalSearch.value;
  searchResults = [];
  searchSel = -1;
  $('#searchStatus').textContent = query.trim() ? '正在搜索…' : '输入关键词开始搜索';
  $('#searchDialogResults').innerHTML = query.trim()
    ? '<div class="search-dialog-empty">正在搜索…</div>'
    : '<div class="search-dialog-empty">支持多个关键词和加引号的短语</div>';
  searchTimer = setTimeout(() => runSearch(query, $('#searchScope').value), 100);
});
$('#searchScope').addEventListener('change', () => {
  clearTimeout(searchTimer);
  searchRequest++;
  searchResults = [];
  searchSel = -1;
  $('#searchStatus').textContent = globalSearch.value.trim() ? '正在搜索…' : '输入关键词开始搜索';
  runSearch(globalSearch.value, $('#searchScope').value);
});
globalSearch.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!searchResults.length) return;
    event.preventDefault();
    searchSel = event.key === 'ArrowDown'
      ? Math.min(searchSel + 1, searchResults.length - 1)
      : Math.max(searchSel <= 0 ? 0 : searchSel - 1, 0);
    updateSearchSel();
  } else if (event.key === 'Enter' && searchResults.length) {
    event.preventDefault();
    goResult(searchResults[searchSel >= 0 ? searchSel : 0]);
    searchDialog.close();
  }
});

/* ================================================================
 * 13. 主题（三套 rustdoc 主题）/ 侧栏
 * ================================================================ */
const sidebar = $('#sidebar');
const backdrop = $('#backdrop');
const layout = document.querySelector('.layout');
const sidebarResizer = $('#sidebarResizer');
const settingsPanel = $('#settingsPanel');
const settingsButton = $('#settingsBtn');
const THEMES = ['light', 'dark', 'ayu'];

function updateSidebarToggle() {
  const visible = window.matchMedia('(min-width: 861px)').matches
    ? !layout.classList.contains('sidebar-collapsed')
    : sidebar.classList.contains('open');
  $('#menuBtn').setAttribute('aria-expanded', String(visible));
}

function closeSidebar() {
  sidebar.classList.remove('open');
  backdrop.classList.remove('show');
  updateSidebarToggle();
}

function setSidebarOpen(open) {
  sidebar.classList.toggle('open', open);
  backdrop.classList.toggle('show', open);
  updateSidebarToggle();
  if (open) focusSidebarStart();
  else $('#menuBtn').focus();
}

function focusSidebarStart() {
  sidebar.querySelector('button:not([disabled]), a[href], [tabindex="0"]')?.focus();
}

function toggleSidebar() {
  if (window.matchMedia('(min-width: 861px)').matches) {
    const open = layout.classList.contains('sidebar-collapsed');
    layout.classList.toggle('sidebar-collapsed', !open);
    updateSidebarToggle();
    if (open) focusSidebarStart();
    else $('#menuBtn').focus();
    return;
  }
  setSidebarOpen(!sidebar.classList.contains('open'));
}

$('#menuBtn').addEventListener('click', toggleSidebar);
backdrop.addEventListener('click', closeSidebar);

const helpDialog = $('#helpDialog');
$('#helpBtn').addEventListener('click', showHelp);
$('#helpClose').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', event => {
  if (event.target === helpDialog) helpDialog.close();
});

const SETTINGS_KEY = 'oi-docs-settings';
const PREFERENCES_VERSION = 2;
const VALID_FONT_SIZES = ['16', '18', '20', '22'];
const VALID_WIDTHS = ['720', '960', '1200', 'full'];
const preferences = (() => {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (error) {
    console.warn('[OI 文档] 设置读取失败，使用默认值', error);
  }
  if (!saved || typeof saved !== 'object') saved = {};
  const savedFontSize = String(saved.fontSize);
  return {
    theme: THEMES.includes(saved.theme) ? saved.theme :
      (THEMES.includes(localStorage.getItem('oi-docs-theme')) ? localStorage.getItem('oi-docs-theme') : 'light'),
    font: saved.font === 'serif' ? 'serif' : 'sans',
    fontSize: VALID_FONT_SIZES.includes(savedFontSize)
      ? (saved.version === PREFERENCES_VERSION || savedFontSize !== '16' ? savedFontSize : '18')
      : '18',
    contentWidth: VALID_WIDTHS.includes(String(saved.contentWidth)) ? String(saved.contentWidth) : '960',
    wrapCode: saved.wrapCode === true,
    sidebarWidth: Number.isFinite(saved.sidebarWidth) ? Math.min(420, Math.max(180, saved.sidebarWidth)) : 250,
  };
})();

function savePreferences() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...preferences, version: PREFERENCES_VERSION }));
  localStorage.setItem('oi-docs-theme', preferences.theme);
}

function applyPreferences(persist = true) {
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.dataset.font = preferences.font;
  root.dataset.wrapCode = String(preferences.wrapCode);
  root.style.setProperty('--reading-size', `${preferences.fontSize}px`);
  root.style.setProperty('--article-max-width', preferences.contentWidth === 'full' ? 'none' : `${preferences.contentWidth}px`);
  root.style.setProperty('--sidebar-w', `${preferences.sidebarWidth}px`);
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preferences.theme));
  });
  $('#fontFamily').value = preferences.font;
  $('#fontSize').value = preferences.fontSize;
  $('#contentWidth').value = preferences.contentWidth;
  $('#wrapCode').checked = preferences.wrapCode;
  sidebarResizer.setAttribute('aria-valuenow', String(preferences.sidebarWidth));
  if (persist) savePreferences();
}

applyPreferences(false);
updateSidebarToggle();
document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => {
    preferences.theme = button.dataset.themeChoice;
    applyPreferences();
  });
});
$('#fontFamily').addEventListener('change', event => { preferences.font = event.target.value; applyPreferences(); });
$('#fontSize').addEventListener('change', event => { preferences.fontSize = event.target.value; applyPreferences(); });
$('#contentWidth').addEventListener('change', event => { preferences.contentWidth = event.target.value; applyPreferences(); });
$('#wrapCode').addEventListener('change', event => { preferences.wrapCode = event.target.checked; applyPreferences(); });
$('#resetSettings').addEventListener('click', () => {
  Object.assign(preferences, {
    theme: 'light',
    font: 'sans',
    fontSize: '18',
    contentWidth: '960',
    wrapCode: false,
    sidebarWidth: 250,
  });
  applyPreferences();
});

function toggleSettings(force) {
  const open = force ?? settingsPanel.hidden;
  settingsPanel.hidden = !open;
  settingsButton.setAttribute('aria-expanded', String(open));
  if (open) settingsPanel.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')?.focus();
  else if (settingsPanel.contains(document.activeElement)) settingsButton.focus();
}
settingsButton.addEventListener('click', () => toggleSettings());
document.addEventListener('click', event => {
  if (!event.target.closest('.settings-wrap')) toggleSettings(false);
});

function showSearch() {
  toggleSettings(false);
  if (helpDialog.open) helpDialog.close();
  if (!searchDialog.open) searchDialog.showModal();
  $('#searchScope').value = 'all';
  runSearch(globalSearch.value, 'all');
  requestAnimationFrame(() => globalSearch.focus());
}

function showFileSwitcher() {
  toggleSettings(false);
  if (helpDialog.open) helpDialog.close();
  if (!searchDialog.open) searchDialog.showModal();
  globalSearch.value = '';
  $('#searchScope').value = 'title';
  runSearch('', 'title');
  requestAnimationFrame(() => globalSearch.focus());
}

function showTOC() {
  const toc = $('#content .toc');
  if (!toc) return;
  toc.classList.remove('collapsed');
  const heading = toc.querySelector('.toc-head');
  heading?.setAttribute('aria-expanded', 'true');
  toc.querySelector('.toc-list a')?.focus();
}

function showHelp() {
  toggleSettings(false);
  if (searchDialog.open) searchDialog.close();
  if (!helpDialog.open) helpDialog.showModal();
  requestAnimationFrame(() => $('#helpClose').focus());
}

function toggleTheme() {
  const themeIndex = THEMES.indexOf(preferences.theme);
  preferences.theme = THEMES[(themeIndex + 1) % THEMES.length];
  applyPreferences();
}

function closePanels(target) {
  toggleSettings(false);
  hideSearchResults();
  if (window.matchMedia('(min-width: 861px)').matches) {
    layout.classList.add('sidebar-collapsed');
    updateSidebarToggle();
  } else {
    closeSidebar();
  }
  if (searchDialog.open) searchDialog.close();
  if (helpDialog.open) helpDialog.close();
  const toc = $('#content .toc');
  if (toc) {
    toc.classList.add('collapsed');
    toc.querySelector('.toc-head')?.setAttribute('aria-expanded', 'false');
  }
  if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) {
    target.blur();
  }
}

function adjustFontSize(direction) {
  const current = VALID_FONT_SIZES.indexOf(preferences.fontSize);
  const next = Math.max(0, Math.min(VALID_FONT_SIZES.length - 1, current + direction));
  if (next === current) return;
  preferences.fontSize = VALID_FONT_SIZES[next];
  applyPreferences();
}

function adjustContentWidth(direction) {
  const current = VALID_WIDTHS.indexOf(preferences.contentWidth);
  const next = Math.max(0, Math.min(VALID_WIDTHS.length - 1, current + direction));
  if (next === current) return;
  preferences.contentWidth = VALID_WIDTHS[next];
  applyPreferences();
}

const SHORTCUT_ACTIONS = {
  sidebar: toggleSidebar,
  settings: () => toggleSettings(),
  help: showHelp,
  toc: showTOC,
  sync: () => $('#refreshBtn').click(),
  search: showSearch,
  theme: toggleTheme,
  fontIncrease: () => adjustFontSize(1),
  fontDecrease: () => adjustFontSize(-1),
  widthIncrease: () => adjustContentWidth(1),
  widthDecrease: () => adjustContentWidth(-1),
  confirm: () => {
    if (searchDialog.open && searchResults.length) {
      goResult(searchResults[searchSel >= 0 ? searchSel : 0]);
    }
  },
  switchFile: showFileSwitcher,
  scrollTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  scrollBottom: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }),
  close: () => closePanels(document.activeElement),
};

function renderShortcutList() {
  const formatKeys = keys => keys.map(key => `<kbd>${escapeHtml(key)}</kbd>`).join(' + ');
  $('#shortcutList').innerHTML = KEYBINDINGS.map(binding =>
    `<tr><th>${formatKeys(binding.keys)}</th><td>${escapeHtml(binding.label)}</td></tr>`
  ).join('');
}

renderShortcutList();

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'));
}

function matchesShortcut(binding, event) {
  return event.key === binding.key &&
    event.altKey === Boolean(binding.alt) &&
    event.ctrlKey === Boolean(binding.ctrl) &&
    event.metaKey === Boolean(binding.meta) &&
    event.shiftKey === Boolean(binding.shift);
}

document.addEventListener('keydown', event => {
  const typing = isTypingTarget(event.target);
  const closeBinding = KEYBINDINGS.find(binding => binding.command === 'close');
  if (closeBinding && matchesShortcut(closeBinding, event)) {
    event.preventDefault();
    SHORTCUT_ACTIONS.close();
    return;
  }

  const binding = KEYBINDINGS.find(candidate =>
    candidate.key && matchesShortcut(candidate, event) &&
    (!candidate.when || (candidate.when === 'search' && searchDialog.open && event.target === globalSearch)) &&
    (!typing || candidate.alt || candidate.command === 'confirm'));
  if (binding) {
    event.preventDefault();
    SHORTCUT_ACTIONS[binding.command]();
    return;
  }
});

let resizeStartX = 0;
let resizeStartWidth = preferences.sidebarWidth;
sidebarResizer.addEventListener('pointerdown', event => {
  if (!window.matchMedia('(min-width: 861px)').matches) return;
  resizeStartX = event.clientX;
  resizeStartWidth = preferences.sidebarWidth;
  sidebarResizer.setPointerCapture(event.pointerId);
  document.body.classList.add('resizing-sidebar');
});
sidebarResizer.addEventListener('pointermove', event => {
  if (!sidebarResizer.hasPointerCapture(event.pointerId)) return;
  preferences.sidebarWidth = Math.min(420, Math.max(180, resizeStartWidth + event.clientX - resizeStartX));
  applyPreferences(false);
});
sidebarResizer.addEventListener('pointerup', event => {
  if (!sidebarResizer.hasPointerCapture(event.pointerId)) return;
  sidebarResizer.releasePointerCapture(event.pointerId);
  document.body.classList.remove('resizing-sidebar');
  savePreferences();
});
sidebarResizer.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  preferences.sidebarWidth = Math.min(420, Math.max(180, preferences.sidebarWidth + (event.key === 'ArrowRight' ? 16 : -16)));
  applyPreferences();
});
window.addEventListener('resize', () => {
  if (window.matchMedia('(min-width: 861px)').matches) {
    closeSidebar();
  } else {
    layout.classList.remove('sidebar-collapsed');
    updateSidebarToggle();
  }
});

/* ================================================================
 * 14. 加载 / 同步
 * ================================================================ */
async function loadContent() {
  searchRequest++;
  MANIFEST = null;
  SEARCH_INDEX = null;
  searchIndexPromise = null;
  searchIndexError = '';
  searchIndexPromise = null;
  searchIndexError = '';
  try {
    MANIFEST = await loadManifest();
    CATEGORIES = buildFromManifest(MANIFEST);
  } catch {
    const tree = await fetchTree();
    CATEGORIES = buildDocs(tree);
  }
  treeLoaded = true;
  rebuildItemMap();
  renderTags();
  renderSidebar();
  await onHashChange();
}

$('#refreshBtn').addEventListener('click', async () => {
  $('#refreshBtn').disabled = true;
  try {
    await idb.clear('docs');
    await idb.clear('meta');
    localStorage.removeItem(CACHE_KEY);
    currentPath = null;
    activeTag = null;
    await loadContent();
  } catch (err) {
    showError(`<strong>同步失败</strong><br>${escapeHtml(err.message)}`);
  } finally {
    $('#refreshBtn').disabled = false;
  }
});

/* ================================================================
 * 15. 启动
 * ================================================================ */
async function init() {
  if (!CONFIG.owner || !CONFIG.repo || CONFIG.owner === 'YOUR_GITHUB_USERNAME' || CONFIG.repo === 'YOUR_REPO_NAME') {
    showError(`<strong>尚未配置仓库信息</strong><br>请编辑 <code>CONFIG</code>：<br><code>owner: '你的 GitHub 用户名'</code><br><code>repo:  '你的仓库名'</code>`);
    return;
  }
  renderSidebar();
  $('#content').innerHTML = `<div class="article"><div class="loading">正在读取文档索引…</div></div>`;
  try {
    await loadContent();
  } catch (err) {
    showError(`<strong>初始化失败</strong><br>${escapeHtml(err.message)}`);
  }
}
window.addEventListener('hashchange', onHashChange);
init();
