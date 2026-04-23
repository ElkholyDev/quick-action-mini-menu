(function () {
  'use strict';

  let menuHost = null;
  let shadowRoot = null;
  let menuEl = null;   // main compact menu
  let moreEl = null;   // separate full more-panel
  let savedText = '';
  let savedX = 0;
  let savedY = 0;
  let expandTimer = null;
  const EXPAND_DELAY = 250;

  // Build DOM
  function buildMenu() {
    menuHost = document.createElement('div');
    menuHost.setAttribute('data-qamm-host', '');
    Object.assign(menuHost.style, {
      all: 'initial',
      position: 'fixed',
      zIndex: '2147483647',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      display: 'block',
    });

    shadowRoot = menuHost.attachShadow({ mode: 'closed' });

    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('styles.css');

    // Main mini menu
    menuEl = document.createElement('div');
    menuEl.className = 'qamm';
    menuEl.setAttribute('role', 'menu');
    menuEl.innerHTML = `
      <button class="qamm__btn qamm__btn--copy" aria-label="Copy">
        <svg class="qamm__icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span class="qamm__label">Copy</span>
      </button>
      <div class="qamm__sep"></div>
      <button class="qamm__btn qamm__btn--search" aria-label="Search with Google">
        <svg class="qamm__icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="qamm__label">Search with Google</span>
      </button>
      <div class="qamm__sep"></div>
      <button class="qamm__btn qamm__btn--more" aria-label="More options">
        <svg class="qamm__icon" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>
        <span class="qamm__label">More options</span>
      </button>
    `;

    // Separate more panel
    moreEl = document.createElement('div');
    moreEl.className = 'qamm-more';
    moreEl.setAttribute('role', 'menu');
    moreEl.innerHTML = `
      <button class="qamm-more__btn qamm-more__btn--print" aria-label="Print">
        <svg class="qamm-more__icon" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span class="qamm-more__label">Print</span>
        <span class="qamm-more__shortcut">Ctrl+P</span>
      </button>
      <div class="qamm-more__sep"></div>
      <button class="qamm-more__btn qamm-more__btn--highlight" aria-label="Copy link to highlight">
        <svg class="qamm-more__icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span class="qamm-more__label">Copy link to highlight</span>
      </button>
      <button class="qamm-more__btn qamm-more__btn--perplexity" aria-label="Search Perplexity">
        <svg class="qamm-more__icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="qamm-more__label">Search Perplexity</span>
      </button>
      <button class="qamm-more__btn qamm-more__btn--translate" aria-label="Translate">
        <svg class="qamm-more__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span class="qamm-more__label">Translate</span>
      </button>
    `;

    shadowRoot.appendChild(styleLink);
    shadowRoot.appendChild(menuEl);
    shadowRoot.appendChild(moreEl);

    // Prevent mousedown from clearing selection
    menuEl.addEventListener('mousedown', e => e.preventDefault());
    moreEl.addEventListener('mousedown', e => e.preventDefault());

    menuEl.style.pointerEvents = 'auto';
    moreEl.style.pointerEvents = 'auto';

    // Expand on stillness
    menuEl.addEventListener('mouseenter', startExpandTimer);
    menuEl.addEventListener('mousemove', startExpandTimer);
    menuEl.addEventListener('mouseleave', onMenuLeave);

    shadowRoot.querySelector('.qamm__btn--copy').addEventListener('click', onCopy);
    shadowRoot.querySelector('.qamm__btn--search').addEventListener('click', onSearch);
    shadowRoot.querySelector('.qamm__btn--more').addEventListener('click', onOpenMore);
    shadowRoot.querySelector('.qamm-more__btn--print').addEventListener('click', onPrint);
    shadowRoot.querySelector('.qamm-more__btn--highlight').addEventListener('click', onCopyHighlightLink);
    shadowRoot.querySelector('.qamm-more__btn--perplexity').addEventListener('click', onPerplexity);
    shadowRoot.querySelector('.qamm-more__btn--translate').addEventListener('click', onTranslate);

    document.documentElement.appendChild(menuHost);
  }

  // Helpers: position element within viewport
  function placeEl(el, cursorX, cursorY) {
    el.style.visibility = 'hidden';
    el.style.display = 'flex';
    const w = el.offsetWidth || 240;
    const h = el.offsetHeight || 150;
    el.style.visibility = '';
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const M = 8;
    let left = cursorX + 6;
    let top = cursorY + 16;
    if (left + w > vpW - M) left = cursorX - w - 6;
    if (left < M) left = M;
    if (top + h > vpH - M) top = cursorY - h - 6;
    if (top < M) top = M;
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
  }

  // Expand helpers
  function startExpandTimer() {
    if (menuEl.classList.contains('qamm--expanded')) return;
    clearTimeout(expandTimer);
    expandTimer = setTimeout(() => menuEl.classList.add('qamm--expanded'), EXPAND_DELAY);
  }

  function onMenuLeave() {
    clearTimeout(expandTimer);
    menuEl.classList.remove('qamm--expanded');
  }

  // Main menu
  function showMenu(cursorX, cursorY) {
    if (!menuHost) buildMenu();
    savedX = cursorX;
    savedY = cursorY;
    // Hide more panel if open
    moreEl.style.display = 'none';
    moreEl.classList.remove('qamm-more--visible');
    placeEl(menuEl, cursorX, cursorY);
    requestAnimationFrame(() => menuEl.classList.add('qamm--visible'));
  }

  function hideMenu() {
    clearTimeout(expandTimer);
    menuEl.classList.remove('qamm--visible', 'qamm--expanded');
    // Wait for fade-out transition then hide
    setTimeout(() => { menuEl.style.display = 'none'; }, 130);
  }

  function hideMenuNow() {
    clearTimeout(expandTimer);
    menuEl.classList.remove('qamm--visible', 'qamm--expanded');
    menuEl.style.display = 'none';
  }

  // More panel
  function showMorePanel() {
    placeEl(moreEl, savedX, savedY);
    requestAnimationFrame(() => moreEl.classList.add('qamm-more--visible'));
  }

  function hideMoreNow() {
    moreEl.classList.remove('qamm-more--visible');
    moreEl.style.display = 'none';
  }

  // Actions
  function onCopy(e) {
    e.preventDefault(); e.stopPropagation();
    if (savedText) navigator.clipboard.writeText(savedText).catch(() => {});
    savedText = '';
    hideMenuNow();
  }

  function onSearch(e) {
    e.preventDefault(); e.stopPropagation();
    if (savedText) chrome.runtime.sendMessage({ type: 'QAMM_SEARCH', query: savedText });
    savedText = '';
    hideMenuNow();
  }

  function onOpenMore(e) {
    e.preventDefault(); e.stopPropagation();
    hideMenuNow();     // mini menu disappears
    showMorePanel();   // separate panel appears
  }

  function onPrint(e) {
    e.preventDefault(); e.stopPropagation();
    hideMoreNow();
    setTimeout(() => window.print(), 80);
  }

  function onCopyHighlightLink(e) {
    e.preventDefault(); e.stopPropagation();
    if (savedText) {
      const url = location.href.split('#')[0] + '#:~:text=' + encodeURIComponent(savedText);
      navigator.clipboard.writeText(url).catch(() => {});
    }
    savedText = '';
    hideMoreNow();
  }

  function onPerplexity(e) {
    e.preventDefault(); e.stopPropagation();
    if (savedText) chrome.runtime.sendMessage({ type: 'QAMM_URL', url: 'https://www.perplexity.ai/search?q=' + encodeURIComponent(savedText) });
    savedText = '';
    hideMoreNow();
  }

  function onTranslate(e) {
    e.preventDefault(); e.stopPropagation();
    if (savedText) chrome.runtime.sendMessage({ type: 'QAMM_URL', url: 'https://translate.google.com/?sl=auto&tl=en&text=' + encodeURIComponent(savedText) + '&op=translate' });
    savedText = '';
    hideMoreNow();
  }

  // Global listeners
  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (menuHost && menuHost.contains(e.target)) return;
    setTimeout(() => {
      const text = window.getSelection?.().toString().trim() ?? '';
      if (text.length > 0) {
        savedText = text;
        showMenu(e.clientX, e.clientY);
      } else {
        hideMenuNow();
        hideMoreNow();
        savedText = '';
      }
    }, 20);
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (menuHost && menuHost.contains(e.target)) return;
    hideMenuNow();
    hideMoreNow();
    savedText = '';
  });

  document.addEventListener('scroll', () => { hideMenuNow(); hideMoreNow(); }, { passive: true, capture: true });
  window.addEventListener('resize', () => { hideMenuNow(); hideMoreNow(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideMenuNow(); hideMoreNow(); savedText = ''; }
  });

})();
