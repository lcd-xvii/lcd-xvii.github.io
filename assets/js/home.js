(function () {
  var root = document.documentElement;
  var themes = ['light', 'dark', 'ayu'];
  var button = document.getElementById('settingsBtn');
  var panel = document.getElementById('settingsPanel');
  var choices = Array.prototype.slice.call(document.querySelectorAll('[data-theme-choice]'));

  function currentTheme() {
    return themes.indexOf(root.dataset.theme) >= 0 ? root.dataset.theme : 'light';
  }

  function syncThemeButtons() {
    var theme = currentTheme();
    choices.forEach(function (choice) {
      choice.setAttribute('aria-pressed', choice.dataset.themeChoice === theme ? 'true' : 'false');
    });
  }

  function setPanelOpen(open) {
    if (!button || !panel) return;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  choices.forEach(function (choice) {
    choice.addEventListener('click', function () {
      var theme = choice.dataset.themeChoice;
      if (themes.indexOf(theme) === -1) theme = 'light';
      root.dataset.theme = theme;
      try { localStorage.setItem('oi-docs-theme', theme); } catch (e) {}
      syncThemeButtons();
    });
  });

  if (button && panel) {
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      setPanelOpen(panel.hidden);
    });

    document.addEventListener('click', function (event) {
      if (!panel.hidden && !event.target.closest('.settings-wrap')) setPanelOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        setPanelOpen(false);
        button.focus();
      }
    });
  }

  syncThemeButtons();

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
