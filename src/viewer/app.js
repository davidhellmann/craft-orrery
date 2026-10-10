// Routing between the views their scripts registered (#<view>/<kind>:<uid>), header and theme. The first view is the
// one to start with.
const App = (() => {
  const main = document.getElementById('main');
  const nav = document.getElementById('views');
  let active = null;
  const mounted = new Set();

  VIEWS.forEach(v => {
    const sec = document.createElement('section');
    sec.className = 'view';
    sec.id = `view-${v.id}`;
    main.appendChild(sec);
    v.el = sec;
  });
  nav.innerHTML = VIEWS.map(v => `<a href="#${v.id}" data-view="${v.id}">${v.label}</a>`).join('');

  const parse = (hash = location.hash) => {
    const [view, ...rest] = hash.replace(/^#/, '').split('/');
    return { view: VIEWS.find(v => v.id === view) ? view : VIEWS[0].id, key: rest.join('/') || null };
  };
  // The element matching `selector` that an event happened in, if any.
  const targetIn = (ev, selector) => (ev.target instanceof Element ? ev.target.closest(selector) : null);

  // In-page links (#view/key) go through the viewer's own history.
  document.addEventListener('click', ev => {
    const a = targetIn(ev, 'a[href^="#"]');
    if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault();
    const { view, key } = parse(a.getAttribute('href'));
    go(view, key, { fromHash: true });
  });

  function activate(viewId, key, opts) {
    const v = VIEWS.find(x => x.id === viewId);
    if (!mounted.has(v.id)) { v.mount(v.el); mounted.add(v.id); }
    if (active !== v) {
      VIEWS.forEach(x => x.el.classList.toggle('on', x === v));
      nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.view === v.id));
      active = v;
    }
    v.show(key, opts);
  }

  // History: each navigation is a browser history entry that knows its position, so back never leaves
  // the viewer and the header buttons agree with the browser's. The page embedding the viewer listens
  // for "orrery:navigate", as pushState fires no hashchange.
  const back = /** @type {HTMLButtonElement} */ (document.getElementById('back'));
  const forward = /** @type {HTMLButtonElement} */ (document.getElementById('forward'));
  let pos = history.state && Number.isInteger(history.state.orrery) ? history.state.orrery : 0, last = pos;
  history.replaceState({ orrery: pos }, '');
  function navigated() {
    back.disabled = pos === 0;
    forward.disabled = pos >= last;
    window.dispatchEvent(new Event('orrery:navigate'));
  }
  function go(viewId, key, opts = {}) {
    const hash = `#${viewId}${key ? '/' + key : ''}`;
    if (location.hash !== hash) {
      last = ++pos;
      history.pushState({ orrery: pos }, '', hash);
    }
    activate(viewId, key, opts);
    navigated();
  }
  window.addEventListener('popstate', ev => {
    if (ev.state && Number.isInteger(ev.state.orrery)) {
      pos = ev.state.orrery;
      last = Math.max(last, pos);
    } else {
      last = ++pos;
      history.replaceState({ orrery: pos }, '');
    }
    const { view, key } = parse();
    activate(view, key, { fromHash: true });
    navigated();
  });
  back.addEventListener('click', () => pos > 0 && history.back());
  forward.addEventListener('click', () => pos < last && history.forward());
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (closePickers()) return;
    if (active && active.escape && !targetIn(ev, 'input, select, textarea')) active.escape();
  });

  // access pickers: switch user groups and GraphQL schemas on as a layer, remembered per browser
  const accessEl = document.getElementById('access');
  const PICKER = { usergroup: { label: KIND.usergroup.plural, all: 'All user groups' }, schema: { label: 'GraphQL', all: 'All GraphQL schemas' } };
  try {
    const saved = JSON.parse(localStorage.getItem('orrery-access') || '{}');
    ACCESS.forEach(kind => (saved[kind] || []).forEach(uid => nodeOf(keyOf(kind, uid)) && shownAccess[kind].add(uid)));
  } catch (e) {}
  accessEl.innerHTML = ACCESS.filter(kind => ofKind(kind).length).map(kind => `
    <div class="picker" data-kind="${kind}">
      <button class="pick" type="button" aria-haspopup="true" aria-expanded="false">${glyph(kind)}<span class="pick-label">${PICKER[kind].label}</span><span class="pick-count"></span></button>
      <div class="pop floating" hidden>
        <div class="opt all"><label><input type="checkbox" data-all>${PICKER[kind].all}</label></div>
        ${ofKind(kind).map(a => `<div class="opt"><label><input type="checkbox" value="${a.uid}">${esc(a.name)}</label><button class="opt-go" type="button" data-go="${keyOf(kind, a.uid)}" title="Show what ${esc(a.name)} can reach">→</button></div>`).join('')}
      </div>
    </div>`).join('');

  function syncPicker(p) {
    const on = shownAccess[p.dataset.kind], total = ofKind(p.dataset.kind).length;
    p.querySelectorAll('input[value]').forEach(i => { i.checked = on.has(i.value); });
    const all = p.querySelector('[data-all]');
    all.checked = on.size === total;
    all.indeterminate = on.size > 0 && on.size < total;
    p.querySelector('.pick-count').textContent = on.size === total ? 'All' : on.size || '';
    p.classList.toggle('on', on.size > 0);
  }
  function accessChanged() {
    try { localStorage.setItem('orrery-access', JSON.stringify(Object.fromEntries(ACCESS.map(k => [k, [...shownAccess[k]]])))); } catch (e) {}
    accessEl.querySelectorAll('.picker').forEach(syncPicker);
    VIEWS.forEach(v => mounted.has(v.id) && v.refresh && v.refresh());
  }
  function closePickers() {
    const open = /** @type {NodeListOf<HTMLElement>} */ (accessEl.querySelectorAll('.pop:not([hidden])'));
    open.forEach(pop => { pop.hidden = true; pop.previousElementSibling.setAttribute('aria-expanded', 'false'); });
    return open.length > 0;
  }
  /** @type {NodeListOf<HTMLElement>} */ (accessEl.querySelectorAll('.picker')).forEach(p => {
    const kind = p.dataset.kind, pop = /** @type {HTMLElement} */ (p.querySelector('.pop')), btn = p.querySelector('.pick');
    btn.addEventListener('click', () => {
      const opening = pop.hidden;
      closePickers();
      pop.hidden = !opening;
      btn.setAttribute('aria-expanded', String(opening));
    });
    /** @type {NodeListOf<HTMLInputElement>} */ (p.querySelectorAll('input[value]')).forEach(i => i.addEventListener('change', () => {
      if (i.checked) shownAccess[kind].add(i.value); else shownAccess[kind].delete(i.value);
      accessChanged();
    }));
    p.querySelector('[data-all]').addEventListener('change', ev => {
      const all = /** @type {HTMLInputElement} */ (ev.target).checked;
      ofKind(kind).forEach(a => (all ? shownAccess[kind].add(a.uid) : shownAccess[kind].delete(a.uid)));
      accessChanged();
    });
    bindGo(pop, key => { closePickers(); go(active ? active.id : VIEWS[0].id, key); });
    syncPicker(p);
  });
  document.addEventListener('pointerdown', ev => { if (!targetIn(ev, '.picker')) closePickers(); });

  // header
  const STATS = ['group', 'site', 'section', 'page', 'block', 'matrix', 'field'];
  document.getElementById('stats').innerHTML = STATS.map(k => `<span class="stat">${glyph(k)}<b>${ofKind(k).length}</b>${KIND[k].plural}</span>`).join('');
  if (model.dateModified) document.getElementById('meta').textContent = `Config updated ${new Date(model.dateModified * 1000).toLocaleString()}`;

  // theme: light or dark, starts from the system's and is remembered per browser once switched
  const themeBtn = document.getElementById('theme');
  const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></g></svg>';
  const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" fill="currentColor"/></svg>';
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeBtn.innerHTML = theme === 'dark' ? SUN : MOON;
    themeBtn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
  themeBtn.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('orrery-theme', theme); } catch (e) {}
    setTheme(theme);
  });
  setTheme(document.documentElement.dataset.theme);

  // info: what each view is and how to read it, floating over the view; off until asked for, then remembered
  const infoBtn = document.getElementById('info');
  function setInfo(open) {
    document.documentElement.classList.toggle('show-info', open);
    infoBtn.setAttribute('aria-pressed', String(open));
    infoBtn.title = open ? 'Hide info' : 'Show info';
    infoBtn.setAttribute('aria-label', infoBtn.title);
  }
  function toggleInfo(open) {
    try { localStorage.setItem('orrery-info', open ? 'shown' : 'hidden'); } catch (e) {}
    setInfo(open);
  }
  infoBtn.addEventListener('click', () => toggleInfo(!document.documentElement.classList.contains('show-info')));
  document.addEventListener('click', ev => { if (targetIn(ev, '[data-info-close]')) toggleInfo(false); });
  let infoOpen = false;
  try { infoOpen = localStorage.getItem('orrery-info') === 'shown'; } catch (e) {}
  setInfo(infoOpen);

  return { go, start() { const { view, key } = parse(); activate(view, key, { fromHash: true }); navigated(); } };
})();

App.start();
