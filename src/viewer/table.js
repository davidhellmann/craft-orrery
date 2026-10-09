// Table view: which field sits where. Flip to entry types to read it the other way round.
const TableView = (() => {
  let el, body, side, countEl;
  const state = { mode: 'fields', q: '', type: '', kind: '', group: '', unused: false, unprefixed: false, sort: 'name', dir: 1, selected: null };

  const fieldTypes = [...new Set(M.fields.map(fieldTypeLabel))].sort();
  const fieldTypeOf = f => fieldTypeLabel(f);
  const matchQ = o => !state.q || o.name.toLowerCase().includes(state.q) || (o.handle || '').toLowerCase().includes(state.q);
  const usedChip = u => chip(useKey(u), u.el.label && u.el.label !== u.owner.name && u.el.label !== (by.field[u.el.field] || {}).name ? ` <em>“${esc(u.el.label)}”</em>` : '');
  const fieldChip = ({ el: e, f }) => chip(fieldKey(f), e.label && e.label !== f.name ? ` <em>“${esc(e.label)}”</em>` : '');
  const groupsOf = e => new Set([...sitesOfEt(e)].map(s => by.site[s] && by.site[s].group).filter(Boolean));

  const COLUMNS = {
    fields: [
      { id: 'name', label: 'Field', sort: f => f.name, w: '20%' },
      { id: 'handle', label: 'Handle', sort: f => f.handle, w: '17%' },
      { id: 'type', label: 'Type', sort: f => fieldTypeOf(f), w: '120px' },
      { id: 'uses', label: 'Uses', sort: f => f.usedIn.length, num: true, w: '64px' },
      { id: 'where', label: 'Used in' },
    ],
    entryTypes: [
      { id: 'name', label: 'Entry type', sort: e => e.name, w: '18%' },
      { id: 'handle', label: 'Handle', sort: e => e.handle, w: '16%' },
      { id: 'kind', label: 'Kind', sort: e => e.kind, w: '76px' },
      { id: 'lives', label: 'Lives in', w: '22%' },
      { id: 'uses', label: '#', sort: e => customElements(e.tabs).length, num: true, w: '52px' },
      { id: 'where', label: 'Fields' },
    ],
  };

  function rows() {
    if (state.mode === 'fields') {
      return M.fields.filter(f => matchQ(f) && (!state.type || fieldTypeOf(f) === state.type) && (!state.unused || !f.usedIn.length));
    }
    return M.entryTypes.filter(e => matchQ(e) && (!state.kind || e.kind === state.kind) && (!state.unprefixed || !e.conventionOk) && (!state.group || groupsOf(e).has(state.group)));
  }
  function cells(o) {
    if (state.mode === 'fields') {
      const key = fieldKey(o);
      return [key, `<td class="name">${glyph(o.kind)} ${esc(o.name)}${accessMarks(key)}</td><td><code class="faint">${esc(o.handle)}</code></td><td>${typeTag(o)}</td><td class="num ${o.usedIn.length ? '' : 'zero'}">${o.usedIn.length}</td><td><div class="chips">${o.usedIn.map(usedChip).join('') || '<span class="faint">not used</span>'}</div></td>`];
    }
    const key = etKey(o), els = customElements(o.tabs);
    const lives = o.kind === 'page'
      ? o.sections.map(s => chip(keyOf('section', s.uid))).join('')
      : o.builders.map(b => chip(fieldKey(b.field), b.context && b.context !== o.name ? ` <em>as “${esc(b.context)}”</em>` : '')).join('');
    return [key, `<td class="name">${glyph(o.kind)} ${esc(o.name)}${accessMarks(key)}</td><td><code class="faint">${esc(o.handle)}</code> ${prefixTag(o)}</td><td><span class="tag">${KIND[o.kind].label}</span></td><td><div class="chips">${lives || '<span class="faint">—</span>'}</div></td><td class="num">${els.length}</td><td><div class="chips">${els.map(fieldChip).join('')}</div></td>`];
  }

  function draw() {
    const cols = COLUMNS[state.mode];
    const sortCol = cols.find(c => c.id === state.sort && c.sort) || cols[0];
    const list = rows().sort((a, b) => {
      const x = sortCol.sort(a), y = sortCol.sort(b);
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * state.dir || byName(a, b);
    });
    countEl.textContent = `${list.length} ${state.mode === 'fields' ? 'fields' : 'entry types'}`;
    const head = cols.map(c => `<th class="${c.sort ? 'sort' : ''}" data-sort="${c.sort ? c.id : ''}" ${c.num ? 'style="text-align:right"' : ''}>${c.label}<span class="arrow">${c.id === sortCol.id ? (state.dir > 0 ? ' ↑' : ' ↓') : ''}</span></th>`).join('');
    body.innerHTML = `<table class="t"><colgroup>${cols.map(c => `<col style="width:${c.w || 'auto'}">`).join('')}</colgroup><thead><tr>${head}</tr></thead><tbody>${list.map(o => { const [key, html] = cells(o); return `<tr data-row="${key}" class="${key === state.selected ? 'on' : ''}">${html}</tr>`; }).join('')}</tbody></table>`;
    body.querySelectorAll('th[data-sort]').forEach(th => th.dataset.sort && th.addEventListener('click', () => {
      state.dir = state.sort === th.dataset.sort ? -state.dir : th.dataset.sort === 'uses' ? -1 : 1;
      state.sort = th.dataset.sort;
      draw();
    }));
    body.querySelectorAll('tr[data-row]').forEach(tr => tr.addEventListener('click', () => App.go('table', tr.dataset.row)));
    bindGo(body, k => App.go('table', k));
  }
  function filters() {
    const f = el.querySelector('[data-filters]');
    f.innerHTML = state.mode === 'fields'
      ? `<select data-f="type" aria-label="Field type"><option value="">All types</option>${fieldTypes.map(t => `<option ${t === state.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
         <label class="check"><input type="checkbox" data-f="unused" ${state.unused ? 'checked' : ''}> only unused</label>`
      : `<select data-f="kind" aria-label="Kind"><option value="">Pages and blocks</option>${Object.keys(KIND).filter(isEntryType).map(k => `<option value="${k}" ${state.kind === k ? 'selected' : ''}>${KIND[k].plural}</option>`).join('')}</select>
         <select data-f="group" aria-label="Site group"><option value="">All site groups</option>${M.siteGroups.map(g => `<option value="${g.uid}" ${g.uid === state.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
         ${checksHandles ? `<label class="check"><input type="checkbox" data-f="unprefixed" ${state.unprefixed ? 'checked' : ''}> only without prefix</label>` : ''}`;
    f.querySelectorAll('[data-f]').forEach(x => x.addEventListener('change', () => { state[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.value; draw(); }));
  }
  function setMode(mode) {
    state.mode = mode;
    state.sort = 'name';
    state.dir = 1;
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    filters();
    draw();
  }
  function panel() {
    side.classList.toggle('closed', !state.selected);
    const inner = side.querySelector('.scroll');
    const n = nodeOf(state.selected);
    inner.innerHTML = n ? `<div class="inner">${closeButton('Close details', 'data-close')}${detailHTML(n)}${crossLinks(n.key, 'table')}</div>` : '';
    bindGo(inner, k => App.go('table', k));
    const close = inner.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => App.go('table', null));
  }

  function mount(root) {
    el = root;
    el.innerHTML = `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <div class="toolbar">
            <div class="seg" role="tablist"><button data-mode="fields" class="on">Fields</button><button data-mode="entryTypes">Entry types</button></div>
            <input type="search" placeholder="Search name or handle" aria-label="Search">
            <div class="toolbar" data-filters></div>
            <span class="tbl-count"></span>
          </div>
        </div>
        <div class="tbl-body">
          <div class="scroll" data-body></div>
          ${infoCard(`<h2>Fields and where they sit</h2><p>Every field with each layout it’s placed in. A label in quotes is what that layout calls the field.</p><p>Switch to <b>Entry types</b> to read it from the other side: each page or block with its fields.</p><p>Click a row or a chip for details.</p>`)}
        </div>
      </div>
      <aside class="panel"><div class="scroll" style="flex:1"></div></aside>`;
    body = el.querySelector('[data-body]');
    side = el.querySelector('.panel');
    countEl = el.querySelector('.tbl-count');
    el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    const search = el.querySelector('input[type=search]');
    search.addEventListener('input', () => { state.q = search.value.trim().toLowerCase(); draw(); });
    filters();
    draw();
    panel();
  }

  return {
    id: 'table',
    label: 'Table',
    mount,
    show(key, opts = {}) {
      const n = nodeOf(key);
      // a deep link to an entry type opens the entry type table, a field the field table
      if (n && opts.fromHash) {
        const mode = isEntryType(n.kind) ? 'entryTypes' : isField(n.kind) ? 'fields' : state.mode;
        if (mode !== state.mode) setMode(mode);
      }
      state.selected = n ? key : null;
      body.querySelectorAll('tr[data-row]').forEach(tr => tr.classList.toggle('on', tr.dataset.row === state.selected));
      const on = body.querySelector('tr.on');
      if (on && opts.fromHash) on.scrollIntoView({ block: 'center' });
      panel();
    },
    escape() { if (state.selected) App.go('table', null); },
    refresh() { draw(); panel(); },
  };
})();
