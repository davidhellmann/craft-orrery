// Diff view: pick what to compare, then two of them, and see where they differ.
registerView((() => {
  // What can be compared: the kinds that share an index, so Pages with Blocks and Builders with Fields.
  const kindsOf = type => Object.keys(KIND).filter(k => KIND[k].index === type.index);
  const listOf = type => kindsOf(type).flatMap(ofKind);
  const TYPES = [
    { id: 'site', label: t('Sites'), pick: t('pick a site'), compare: t('Compare two sites'), index: 'site' },
    { id: 'section', label: t('Sections'), pick: t('pick a section'), compare: t('Compare two sections'), index: 'section' },
    { id: 'entrytype', label: t('Entry types'), pick: t('pick an entry type'), compare: t('Compare two entry types'), index: 'et' },
    { id: 'field', label: t('Fields'), pick: t('pick a field'), compare: t('Compare two fields'), index: 'field' },
    { id: 'usergroup', label: t('User groups'), pick: t('pick a user group'), compare: t('Compare two user groups'), index: 'usergroup' },
    { id: 'schema', label: t('GraphQL schemas'), pick: t('pick a GraphQL schema'), compare: t('Compare two GraphQL schemas'), index: 'schema' },
  ].filter(type => listOf(type).length);
  const typeOf = key => { const n = nodeOf(key); return n ? TYPES.find(type => type.index === KIND[n.kind].index) : null; };

  // ---- what each kind of thing is made of: properties compared as values, groups compared item by item
  const yes = v => (v ? t('Yes') : t('No'));
  const RIGHTS = {
    ...RIGHT_LABELS,
    viewPeer: t('view others’'), savePeer: t('save others’'), deletePeer: t('delete others’'),
    viewPeerDrafts: t('view others’ drafts'), savePeerDrafts: t('save others’ drafts'), deletePeerDrafts: t('delete others’ drafts'),
  };
  const rightTags = rights => rights.map(r => RIGHTS[r] || r);
  // How a Matrix field shows its entries.
  const VIEW_MODES = { cards: t('cards'), blocks: t('blocks'), index: t('index') };
  function item(key, tags = [], id = key) {
    const n = nodeOf(key);
    return n ? { id, key, name: n.obj.name, tags: tags.filter(Boolean) } : null;
  }
  const fieldItems = tabs => tabs.flatMap(tab => tab.elements.filter(el => el.kind === 'CustomField' && byUid.field[el.field]).map(el => {
    const f = byUid.field[el.field];
    const handle = el.handle && el.handle !== f.handle ? el.handle : null;
    return item(fieldKey(f), [tab.name, el.label && quoted(el.label), handle && t('handle {handle}', { handle }), el.required && t('required'), el.conditional && t('conditional'), el.width !== 100 && `${el.width}%`], handle ? `${fieldKey(f)}#${handle}` : fieldKey(f));
  }));
  const accessGroups = key => ACCESS.filter(kind => ofKind(kind).length && accessApplies(kind, nodeOf(key).kind)).map(kind => ({
    title: KIND[kind].plural,
    items: ofKind(kind).map(a => { const r = rightsOn(a, kind, key); return r && item(keyOf(kind, a.uid), rightTags(r)); }),
  }));

  function describe(n) {
    const o = n.obj;
    if (n.kind === 'site') {
      return {
        props: [[t('Handle'), o.handle], [t('Site group'), (byUid.group[o.group] || {}).name], [t('Language'), o.language], [t('Base URL'), o.baseUrl], [t('Primary'), yes(o.primary)]],
        groups: [
          { title: t('Sections'), items: o.sections.map(s => { const ss = s.sites.find(x => x.site === o.uid); return item(keyOf('section', s.uid), [sectionType(s), ss && ss.hasUrls ? ss.uriFormat : t('no URLs')]); }) },
          ...accessGroups(n.key),
        ],
      };
    }
    if (n.kind === 'section') {
      return {
        props: [[t('Handle'), o.handle], [t('Type'), sectionType(o)]],
        groups: [
          { title: t('Sites'), items: o.sites.map(ss => item(keyOf('site', ss.site), [ss.hasUrls ? ss.uriFormat : t('no URLs')])) },
          { title: t('Entry types'), items: o.entryTypes.map(u => byUid.et[u] && item(etKey(byUid.et[u]), [perUseNote(byUid.et[u], o.contexts[u])])) },
          { title: t('Pulled in by'), items: o.referencedBy.map(f => item(fieldKey(f))) },
          { title: t('Preview targets'), items: o.previewTargets.map(p => ({ id: p, name: p, tags: [] })) },
          ...accessGroups(n.key),
        ],
      };
    }
    if (isEntryType(n.kind)) {
      return {
        props: [[t('Handle'), o.handle], [t('Kind'), KIND[o.kind].label], [t('Title field'), yes(o.hasTitleField)], [t('Tabs'), o.tabs.map(tab => tab.name).join(', ')], [t('GraphQL type'), o.gql]],
        groups: [
          { title: t('Lives in'), items: [
            ...o.sections.map(s => item(keyOf('section', s.uid), [perUseNote(o, s.contexts[o.uid])])),
            ...o.builders.map(b => item(fieldKey(b.field), [perUseNote(o, b.context), b.group])),
          ] },
          { title: t('Fields'), items: fieldItems(o.tabs) },
          ...accessGroups(n.key),
        ],
      };
    }
    if (isField(n.kind)) {
      const props = [[t('Handle'), o.handle], [t('Type'), fieldTypeLabel(o)], [t('Instructions'), o.instructions]];
      if (o.blocks) props.push([t('View mode'), VIEW_MODES[o.viewMode] || o.viewMode], [t('Min entries'), o.min], [t('Max entries'), o.max]);
      if (o.sources) props.push([t('Sources'), o.allSources ? t('All sections') : null], [t('Max relations'), o.max]);
      const groups = [];
      if (o.options) groups.push({ title: t('Options'), items: o.options.map(op => ({ id: op.value, name: op.label, tags: [op.value, op.default && t('default')].filter(Boolean) })) });
      if (o.blocks) groups.push({ title: t('Blocks'), items: o.blocks.map(b => byUid.et[b.entryType] && item(etKey(byUid.et[b.entryType]), [perUseNote(byUid.et[b.entryType], b.context), b.group])) });
      if (o.targets.length) groups.push({ title: t('Pulls from'), items: o.targets.map(s => item(keyOf('section', s.uid))) });
      if (o.tabs) groups.push({ title: t('Contains'), items: fieldItems(o.tabs) });
      groups.push({ title: t('Used in'), items: o.usedIn.map(u => item(useKey(u), [u.el.label && quoted(u.el.label), u.el.required && t('required'), u.el.conditional && t('conditional')])) });
      return { props, groups: [...groups, ...accessGroups(n.key)] };
    }
    const sites = { title: t('Sites'), items: model.sites.filter(s => o.sites.includes(s.uid)).map(s => item(keyOf('site', s.uid), rightTags([n.kind === 'schema' ? 'read' : 'edit']))) };
    const sections = { title: t('Sections'), items: model.sections.filter(s => o.sections[s.uid]).map(s => item(keyOf('section', s.uid), rightTags(o.sections[s.uid]))) };
    if (n.kind === 'usergroup') return { props: [[t('Handle'), o.handle], [t('Description'), o.description]], groups: [sites, sections] };
    return {
      props: [[t('Public'), yes(o.public)], [t('Also queries'), o.elements.map(e => ELEMENT_SCOPES[e] || e).join(', ')]],
      groups: [sites, sections, { title: t('Builders'), items: model.fields.filter(f => o.fields[f.uid]).map(f => item(fieldKey(f), rightTags(o.fields[f.uid]))) }],
    };
  }

  // ---- comparison: rows are 'same', 'changed', or only on one side ('a', 'b')
  const sameTags = (x, y) => x.length === y.length && x.every(tag => y.includes(tag));
  function compare(a, b) {
    const da = describe(a), db = describe(b);
    const value = (d, label) => { const p = d.props.find(x => x[0] === label); return p && p[1] != null && p[1] !== '' ? String(p[1]) : null; };
    const labels = [...new Set([...da.props, ...db.props].map(p => p[0]))];
    const props = labels.map(label => {
      const x = value(da, label), y = value(db, label);
      return { label, x, y, status: x === y ? 'same' : 'changed' };
    });
    const titles = [...new Set([...da.groups, ...db.groups].map(g => g.title))];
    const groups = titles.map(title => {
      const list = d => ((d.groups.find(g => g.title === title) || {}).items || []).filter(Boolean);
      const ia = new Map(list(da).map(i => [i.id, i])), ib = new Map(list(db).map(i => [i.id, i]));
      const rows = [...new Set([...ia.keys(), ...ib.keys()])].map(id => {
        const x = ia.get(id), y = ib.get(id);
        return { x, y, ref: x || y, status: !y ? 'a' : !x ? 'b' : sameTags(x.tags, y.tags) ? 'same' : 'changed' };
      });
      return { title, rows };
    });
    return { props, groups };
  }

  // ---- view
  let el, bar, body, countEl;
  const state = { type: TYPES.find(type => type.id === 'entrytype') || TYPES[0], a: null, b: null, onlyDiff: false };
  const STATUS = { a: t('only in A'), b: t('only in B'), changed: t('differs') };
  const CODE = [t('Handle'), t('GraphQL type'), t('Base URL'), t('Language')];

  const diffKey = () => (state.a && state.b ? `${state.a}/${state.b}` : state.a || state.type.id);
  function pick(changes) {
    Object.assign(state, changes);
    App.go('diff', diffKey());
  }

  function options(side) {
    const other = side === 'a' ? state.b : state.a;
    const opt = o => { const k = keyOf(o.kind, o.uid); return `<option value="${k}" ${k === state[side] ? 'selected' : ''} ${k === other ? 'disabled' : ''}>${esc(o.name)}</option>`; };
    const list = listOf(state.type).sort(byName);
    // a type that holds several kinds lists them apart, Pages and Blocks, Builders and Fields
    const kinds = kindsOf(state.type);
    const grouped = kinds.length > 1 ? kinds.map(k => [KIND[k].plural, list.filter(o => o.kind === k)]) : null;
    return `<option value="">${side.toUpperCase()}: ${esc(state.type.pick)}</option>${grouped
      ? grouped.filter(([, l]) => l.length).map(([label, l]) => `<optgroup label="${label}">${l.map(opt).join('')}</optgroup>`).join('')
      : list.map(opt).join('')}`;
  }

  function drawBar() {
    bar.innerHTML = `
      <div class="seg" role="tablist">${TYPES.map(type => `<button data-type="${type.id}" class="${type === state.type ? 'on' : ''}">${type.label}</button>`).join('')}</div>
      <div class="toolbar">
        <select data-side="a" aria-label="${t('First to compare')}">${options('a')}</select>
        <button class="btn" data-swap title="${t('Swap A and B')}" aria-label="${t('Swap A and B')}" ${state.a && state.b ? '' : 'disabled'}>⇄</button>
        <select data-side="b" aria-label="${t('Second to compare')}">${options('b')}</select>
        <label class="check"><input type="checkbox" data-only ${state.onlyDiff ? 'checked' : ''}> ${t('only differences')}</label>
        <span class="tbl-count"></span>
      </div>`;
    countEl = bar.querySelector('.tbl-count');
    bar.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
      const type = TYPES.find(x => x.id === b.dataset.type);
      if (type !== state.type) pick({ type, a: null, b: null });
    }));
    bar.querySelectorAll('select[data-side]').forEach(s => s.addEventListener('change', () => pick({ [s.dataset.side]: s.value || null })));
    bar.querySelector('[data-swap]').addEventListener('click', () => pick({ a: state.b, b: state.a }));
    bar.querySelector('[data-only]').addEventListener('change', ev => { state.onlyDiff = ev.target.checked; drawBody(); });
  }

  const tagsHTML = (i, other) => (i.tags.length
    ? i.tags.map(tag => `<span class="tag ${other && !other.tags.includes(tag) ? 'solid' : ''}">${esc(tag)}</span>`).join(' ')
    : '<span class="muted">✓</span>');
  const missing = '<span class="faint">—</span>';
  const statusCell = s => `<td class="st">${STATUS[s] ? `<span class="tag outline">${STATUS[s]}</span>` : ''}</td>`;

  function drawBody() {
    if (!state.a || !state.b) {
      countEl.textContent = '';
      body.innerHTML = `<div class="diff-empty"><h2>${esc(state.type.compare)}</h2><p class="muted">${t('Pick one on each side to see what they share and where they differ. Anything with a <b>Compare</b> button in its details can start a comparison too.')}</p></div>`;
      return;
    }
    const a = nodeOf(state.a), b = nodeOf(state.b);
    const { props, groups } = compare(a, b);
    const differs = [...props, ...groups.flatMap(g => g.rows)].filter(r => r.status !== 'same').length;
    countEl.textContent = differs ? tn(differs, '{n} difference', '{n} differences') : t('No differences');
    const show = r => !state.onlyDiff || r.status !== 'same';

    let h = `<table class="t diff"><colgroup><col style="width:24%"><col><col><col style="width:104px"></colgroup>
      <thead><tr><th></th><th><span class="ab">A</span>${chip(state.a)}</th><th><span class="ab">B</span>${chip(state.b)}</th><th></th></tr></thead><tbody>`;
    const shownProps = props.filter(show);
    if (shownProps.length) {
      h += `<tr class="grp"><td colspan="4">${t('Properties')}</td></tr>`;
      const val = (p, v) => (v == null ? missing : CODE.includes(p.label) ? `<code>${esc(v)}</code>` : esc(v));
      h += shownProps.map(p => `<tr class="${p.status}"><td class="lbl">${esc(p.label)}</td><td>${val(p, p.x)}</td><td>${val(p, p.y)}</td>${statusCell(p.status)}</tr>`).join('');
    }
    groups.forEach(g => {
      const rows = g.rows.filter(show);
      if (!rows.length) return;
      const changed = g.rows.filter(r => r.status !== 'same').length;
      h += `<tr class="grp"><td colspan="4">${esc(g.title)} <span class="faint">${g.rows.length}${changed ? ` · ${tn(changed, '{n} differs', '{n} differ')}` : ''}</span></td></tr>`;
      h += rows.map(r => `<tr class="${r.status}"><td class="lbl">${r.ref.key ? chip(r.ref.key) : esc(r.ref.name)}</td><td>${r.x ? tagsHTML(r.x, r.y) : missing}</td><td>${r.y ? tagsHTML(r.y, r.x) : missing}</td>${statusCell(r.status)}</tr>`).join('');
    });
    h += '</tbody></table>';
    if (state.onlyDiff && !differs) h = `<div class="diff-empty"><p class="muted">${t('These two are the same in everything Orrery reads.')}</p></div>`;
    body.innerHTML = h;
    bindGo(body, k => App.go('graph', k));
  }

  const info = () => `<h2>${t('Reading a comparison')}</h2><p>${t('Each row is something A or B has. <b>Only in A</b> and <b>only in B</b> mark what the other one is missing; <b>differs</b> means both have it, set up differently, and the tags in black are the ones the other side lacks.')}</p><p>${t('Turn on <b>only differences</b> to hide everything they share. Names lead to the graph, and back brings you here again.')}</p>`;

  function mount(root) {
    el = root;
    el.innerHTML = `<div class="tbl-wrap"><div class="tbl-head" data-bar></div><div class="tbl-body"><div class="scroll" data-body></div>${infoCard(info())}</div></div>`;
    bar = el.querySelector('[data-bar]');
    body = el.querySelector('[data-body]');
  }

  return {
    id: 'diff',
    label: t('Diff'),
    crossLink: t('Compare'),
    // Whatever one of its types holds.
    kinds: Object.keys(KIND).filter(k => TYPES.some(type => type.index === KIND[k].index)),
    info,
    mount,
    // keys: "<type>", "<kind>:<uid>" for A, or "<kind>:<uid>/<kind>:<uid>" for A and B
    show(key) {
      if (key) {
        const [ka, kb] = key.split('/');
        const type = typeOf(ka) || TYPES.find(x => x.id === ka);
        if (type) Object.assign(state, { type, a: nodeOf(ka) ? ka : null, b: kb && typeOf(kb) === type && kb !== ka ? kb : null });
      }
      drawBar();
      drawBody();
    },
    refresh() { drawBody(); },
  };
})());
