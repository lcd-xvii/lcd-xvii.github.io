(function () {
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ============================================================
   * 滚动淡入
   * ============================================================ */
  var reveals = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reveals.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
    }
  }

  /* ============================================================
   * 最近更新 + 贡献墙
   * ------------------------------------------------------------
   * 每个来源只描述三件事：去哪儿取清单、怎么把清单变成条目、怎么生成链接。
   * 想加一个入口卡片（例如 GitHub 提交、某个仓库的 releases），
   * 在 SOURCES 里加一项即可，墙和「最近」会自动把它算进去。
   * ============================================================ */
  var SOURCES = [
    {
      label: 'OI 文档',
      url: 'oi-docs/manifest.json',
      link: function (path) { return 'oi-docs/#' + encodeURIComponent(path); },
      parse: function (data) {
        var docs = (data && data.docs) || [];
        var fallback = data && data.generatedAt ? String(data.generatedAt).slice(0, 10) : '';
        return docs.map(function (doc) {
          return {
            title: doc.title || doc.path,
            date: doc.updated || doc.date || fallback,
            href: this.link(doc.path),
            tag: doc.category || ''
          };
        }, this);
      }
    }
  ];

  var wallEl = document.getElementById('wall');
  var wallCountEl = document.getElementById('wallCount');
  var recentEl = document.getElementById('recent');

  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function ymd(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function loadSource(source) {
    return fetch(source.url, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error(source.url + ' ' + res.status);
        return res.json();
      })
      .then(function (data) {
        return source.parse(data).map(function (item) {
          item.source = source.label;
          return item;
        });
      })
      .catch(function () { return []; });
  }

  function renderWall(items) {
    if (!wallEl) return;

    var counts = {};
    var dated = 0;
    items.forEach(function (item) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return;
      counts[item.date] = (counts[item.date] || 0) + 1;
      dated += 1;
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - 52 * 7);

    var html = '';
    for (var i = 0; i < 371; i += 1) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      var key = ymd(day);
      var count = counts[key] || 0;
      var level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
      var future = day > today;
      html += '<i data-level="' + (future ? 0 : level) + '"' +
        (future ? ' data-future="true" style="visibility:hidden"' : '') +
        ' title="' + key + (count ? ' · ' + count + ' 篇更新' : '') + '"></i>';
    }
    wallEl.innerHTML = html;

    if (wallCountEl) {
      wallCountEl.textContent = dated
        ? '过去一年 · ' + dated + ' 篇更新'
        : '过去一年';
    }
  }

  function renderRecent(items) {
    if (!recentEl) return;

    var sorted = items
      .filter(function (item) { return item.title; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, 6);

    if (!sorted.length) {
      recentEl.innerHTML = '<li><p class="recent-empty">暂时没有可显示的更新。</p></li>';
      return;
    }

    recentEl.innerHTML = sorted.map(function (item) {
      return '<li><a href="' + esc(item.href) + '">' +
        '<span class="src">' + esc(item.source) + '</span>' +
        '<span class="t">' + esc(item.title) + '</span>' +
        '<span class="d">' + esc(item.date || '—') + '</span>' +
        '</a></li>';
    }).join('');
  }

  Promise.all(SOURCES.map(loadSource)).then(function (results) {
    var items = [].concat.apply([], results);
    renderWall(items);
    renderRecent(items);
  });
})();
