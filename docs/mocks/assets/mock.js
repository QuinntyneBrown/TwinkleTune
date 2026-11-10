/* mock.js — tiny runtime for HTML mocks. No framework, no build step.
   From the writing-html-mocks skill, with two TwinkleTune changes marked below.
   - theme:  ?theme=light|dark, localStorage, the mock bar toggle, or the `t` key
   - chrome: ?chrome=0 hides the mock bar and notes (used for screenshots)
   - motion: ?motion=0, or a browser driven by automation, finishes every
             animation at once so a screenshot shows the settled screen
   - flow:   [data-mock-href] makes a product <button> lead to the mock of the
             screen, dialog or toast it opens, so the set clicks through
   Everything degrades gracefully when JavaScript is off. */
(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  function readStored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  // TwinkleTune: light is the shipped product, so it is the default whatever
  // the operating system prefers. Dark is opt-in.
  function currentTheme() { return root.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    if (persist) store('mock-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      button.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }

  var requested = params.get('theme');
  if (requested === 'light' || requested === 'dark') applyTheme(requested, false);
  else applyTheme(readStored('mock-theme') === 'dark' ? 'dark' : 'light', false);

  if (params.get('chrome') === '0') root.dataset.chrome = 'off';
  if (params.get('motion') === '0' || navigator.webdriver) root.dataset.motion = 'off';

  // Carry the current theme and chrome across mocks so a review stays consistent.
  function carry(href) {
    try {
      var url = new URL(href, location.href);
      url.searchParams.set('theme', currentTheme());
      if (root.dataset.chrome === 'off') url.searchParams.set('chrome', '0');
      if (params.get('motion') === '0') url.searchParams.set('motion', '0');
      return url.toString();
    } catch (e) { return href; /* relative file URLs in some viewers */ }
  }

  // On a phone the state list scrolls sideways: keep the current state in view.
  var current = document.querySelector('.mock-bar [aria-current="page"]');
  if (current && current.scrollIntoView) current.scrollIntoView({ inline: 'center', block: 'nearest' });

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-theme-toggle]')) { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true); return; }
    if (event.target.closest('[data-chrome-toggle]')) { root.dataset.chrome = root.dataset.chrome === 'off' ? 'on' : 'off'; return; }
    // TwinkleTune: product buttons lead to the mock they open.
    var flow = event.target.closest('[data-mock-href]');
    if (flow) { location.href = carry(flow.getAttribute('data-mock-href')); return; }
    var link = event.target.closest('a[href]');
    if (link && !/^(#|mailto:|tel:)/.test(link.getAttribute('href'))) link.href = carry(link.href);
  });

  document.addEventListener('keydown', function (event) {
    if (event.target.matches('input, textarea, select, [contenteditable]')) return;
    if (event.key === 't' && !event.metaKey && !event.ctrlKey && !event.altKey) applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  });
})();
