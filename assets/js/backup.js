(function () {
  var link = document.getElementById('backupLink');
  if (!link) return;

  var host = location.hostname;
  var isMain = host === 'lcd-xvii.com' || host === 'www.lcd-xvii.com';
  var targetHost = isMain ? 'lcd-xvii.github.io' : 'lcd-xvii.com';
  var fullLabel = isMain ? 'GitHub Pages 备用入口' : 'Cloudflare 主站';
  var shortLabel = isMain ? '备用' : '主站';
  var label = document.getElementById('backupLabel');

  function update() {
    link.href = 'https://' + targetHost + location.pathname + location.search + location.hash;
    link.title = fullLabel;
    link.setAttribute('aria-label', fullLabel);
    if (label) label.textContent = link.dataset.long === 'true' ? fullLabel : shortLabel;
  }

  update();
  window.addEventListener('hashchange', update);
})();
