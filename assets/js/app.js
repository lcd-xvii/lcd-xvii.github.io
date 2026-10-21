import md from './markdown.js';
import idb from './storage.js';

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
};
function iconSvg(name, className = 'nav-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.folder}</svg>`;
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
function renderSidebar(keyword = '') {
  const q = keyword.trim().toLowerCase();
  let html = '';
  CATEGORIES.forEach((cat, ci) => {
    let items = cat.items;
    if (activeTag) items = items.filter(it => (it.tags || []).includes(activeTag));
    if (q) items = items.filter(it => it.title.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q));
    if ((q || activeTag) && items.length === 0) return;
    const filtering = q || activeTag;
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
  if (e.target.closest('#tagClear')) { activeTag = null; renderTags(); renderSidebar($('#search').value); return; }
  const btn = e.target.closest('.tag');
  if (!btn) return;
  const t = btn.dataset.tag;
  activeTag = activeTag === t ? null : t;
  renderTags();
  renderSidebar($('#search').value);
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
  renderSidebar($('#search').value);
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
  const heads = [...mdRoot.querySelectorAll('h1[id],h2[id],h3[id],h4[id]')];
  if (heads.length < 2) { toc.remove(); return; }

  const list = heads.map(h => {
    const lvl = +h.tagName[1];
    return `<li class="toc-l${lvl}"><a href="#${encodeURIComponent(path)}#${encodeURIComponent(h.id)}" data-id="${escapeHtml(h.id)}">${escapeHtml(h.textContent.trim())}</a></li>`;
  }).join('');

  toc.innerHTML = `<div class="toc-head" id="tocHead"><span>目录</span><span>▾</span></div><ul class="toc-list">${list}</ul>`;
  toc.querySelector('.toc-head').addEventListener('click', () => toc.classList.toggle('collapsed'));

  if (tocScrollHandler) window.removeEventListener('scroll', tocScrollHandler);
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
        <h1 class="article-title">${escapeHtml(item.title)}</h1>
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

function highlight(snippet, q) {
  const s = escapeHtml(snippet);
  const qe = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!qe) return s;
  return s.replace(new RegExp(qe, 'gi'), m => '<mark>' + m + '</mark>');
}

function searchDocs(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const titleHits = [];
  const seen = new Set();
  for (const [path, item] of ITEM_MAP) {
    if (item.title.toLowerCase().includes(q)) {
      titleHits.push({ path, title: item.title, cat: item.cat, anchor: null, snippet: '' });
      seen.add(path);
    }
  }
  const contentHits = [];
  if (SEARCH_INDEX) {
    for (const doc of SEARCH_INDEX) {
      const item = ITEM_MAP.get(doc.path);
      if (!item || seen.has(doc.path)) continue;
      for (const sec of (doc.sections || [])) {
        const i = sec.text.toLowerCase().indexOf(q);
        if (i === -1) continue;
        const start = Math.max(0, i - 30);
        const end = Math.min(sec.text.length, i + q.length + 50);
        const snippet = (start > 0 ? '…' : '') + sec.text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < sec.text.length ? '…' : '');
        contentHits.push({ path: doc.path, title: item.title, cat: item.cat, anchor: sec.id || null, snippet });
        break;
      }
      if (contentHits.length >= 30) break;
    }
  }
  return [...titleHits, ...contentHits].slice(0, 40);
}

function positionSearchPanel() {
  const input = $('#search');
  const panel = $('#searchResults');
  const r = input.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 260), window.innerWidth - 24);
  const left = Math.min(Math.max(r.left, 12), window.innerWidth - width - 12);
  panel.style.left = `${left}px`;
  panel.style.top = `${r.bottom + 6}px`;
  panel.style.width = `${width}px`;
}

function renderSearchResults(q) {
  const box = $('#searchResults');
  if (!searchResults.length) {
    box.innerHTML = `<div class="search-empty">没有结果</div>`;
  } else {
    box.innerHTML = searchResults.map((r, i) => `
      <a class="search-result${i === searchSel ? ' sel' : ''}" data-i="${i}"
         href="#${encodeURIComponent(r.path)}${r.anchor ? '#' + encodeURIComponent(r.anchor) : ''}">
        <div class="sr-title">${highlight(r.title, q)}<span class="sr-cat">${escapeHtml(r.cat)}</span></div>
        ${r.snippet ? `<div class="sr-snippet">${highlight(r.snippet, q)}</div>` : ''}
      </a>`).join('');
  }
  positionSearchPanel();
  box.classList.add('show');
}

function hideSearchResults() {
  $('#searchResults').classList.remove('show');
  searchResults = [];
  searchSel = -1;
}

function updateSearchSel() {
  $('#searchResults').querySelectorAll('.search-result').forEach((el, i) => {
    el.classList.toggle('sel', i === searchSel);
    if (i === searchSel) el.scrollIntoView({ block: 'nearest' });
  });
}

function goResult(r) {
  hideSearchResults();
  $('#search').blur();
  location.hash = encodeURIComponent(r.path) + (r.anchor ? '#' + r.anchor : '');
}

$('#search').addEventListener('input', e => {
  const q = e.target.value;
  renderSidebar(q);
  clearTimeout(searchTimer);
  searchSel = -1;
  if (!q.trim()) { hideSearchResults(); return; }
  searchTimer = setTimeout(async () => {
    if (MANIFEST) { try { await loadSearchIndex(); } catch {} }
    searchResults = searchDocs(q);
    renderSearchResults(q);
  }, 200);
});

$('#search').addEventListener('keydown', e => {
  if (e.key === 'Escape') { hideSearchResults(); e.target.blur(); return; }
  if (!searchResults.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); searchSel = Math.min(searchSel + 1, searchResults.length - 1); updateSearchSel(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); searchSel = Math.max(searchSel - 1, 0); updateSearchSel(); }
  else if (e.key === 'Enter') {
    if (searchSel >= 0) { e.preventDefault(); goResult(searchResults[searchSel]); }
    else if (searchResults[0]) { e.preventDefault(); goResult(searchResults[0]); }
  }
});

$('#searchResults').addEventListener('click', e => {
  const a = e.target.closest('.search-result');
  if (a) { hideSearchResults(); $('#search').blur(); }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) hideSearchResults();
});

window.addEventListener('resize', () => {
  if ($('#searchResults').classList.contains('show')) positionSearchPanel();
});
window.addEventListener('scroll', () => {
  if ($('#searchResults').classList.contains('show')) positionSearchPanel();
}, { passive: true });

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
}
function toggleSidebar() {
  if (window.matchMedia('(min-width: 861px)').matches) {
    layout.classList.toggle('sidebar-collapsed');
    updateSidebarToggle();
    return;
  }
  setSidebarOpen(!sidebar.classList.contains('open'));
}

$('#menuBtn').addEventListener('click', toggleSidebar);
backdrop.addEventListener('click', closeSidebar);

const SETTINGS_KEY = 'oi-docs-settings';
const VALID_FONT_SIZES = ['14', '16', '18', '20'];
const VALID_WIDTHS = ['720', '960', '1200', 'full'];
const preferences = (() => {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (error) {
    console.warn('[OI 文档] 设置读取失败，使用默认值', error);
  }
  if (!saved || typeof saved !== 'object') saved = {};
  return {
    theme: THEMES.includes(saved.theme) ? saved.theme :
      (THEMES.includes(localStorage.getItem('oi-docs-theme')) ? localStorage.getItem('oi-docs-theme') : 'light'),
    font: saved.font === 'serif' ? 'serif' : 'sans',
    fontSize: VALID_FONT_SIZES.includes(String(saved.fontSize)) ? String(saved.fontSize) : '16',
    contentWidth: VALID_WIDTHS.includes(String(saved.contentWidth)) ? String(saved.contentWidth) : '960',
    wrapCode: saved.wrapCode === true,
    sidebarWidth: Number.isFinite(saved.sidebarWidth) ? Math.min(420, Math.max(180, saved.sidebarWidth)) : 250,
  };
})();

function savePreferences() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
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
    fontSize: '16',
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
}
settingsButton.addEventListener('click', () => toggleSettings());
document.addEventListener('click', event => {
  if (!event.target.closest('.settings-wrap')) toggleSettings(false);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  toggleSettings(false);
  hideSearchResults();
  closeSidebar();
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
  MANIFEST = null;
  SEARCH_INDEX = null;
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
  renderSidebar($('#search').value);
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
