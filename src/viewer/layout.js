// Layout view: every field layout, either as the editor's form or as a page wireframe.
registerView((() => {
  let el, treeEl, canvas, context, crumbsEl;
  const state = { tab: 'pages', q: '', current: null, formTab: 0, mode: 'form' };
  const matchQ = o => matchesSearch(o, state.q);
  const nearestWidth = w => [25, 50, 75, 100].reduce((p, c) => (Math.abs(c - w) < Math.abs(p - w) ? c : p), 100);

  // ---- tree
  // `name` (HTML) stands in for the node's own name.
  function item(key, name = '', extra = '') {
    const n = nodeOf(key);
    return `<div class="titem ${state.current === key ? 'on' : ''}" data-go="${key}">${glyph(n.kind, n.obj)}<span class="n">${name || esc(n.obj.name)}</span>${accessMarks(key)}${extra}</div>`;
  }
  function pagesTree() {
    let h = '';
    model.siteGroups.forEach(g => {
      const secs = model.sections.filter(s => s.groups.includes(g.uid) && (matchQ(s) || s.entryTypes.some(u => byUid.et[u] && matchQ(byUid.et[u]))));
      if (!secs.length) return;
      h += `<details class="tgroup" ${state.q || g === model.siteGroups[0] ? 'open' : ''}><summary>${glyph('group')}<span>${esc(g.name)}</span><span class="c">${secs.length}</span></summary><div class="kids">`;
      [['structure', 'Structures'], ['single', 'Singles'], ['channel', 'Channels']].forEach(([type, label]) => {
        const list = secs.filter(s => s.type === type).sort(byName);
        if (!list.length) return;
        h += `<div class="sub-label">${label}</div>`;
        list.forEach(s => {
          const ets = s.entryTypes.map(u => byUid.et[u]).filter(Boolean);
          if (ets.length === 1) h += item(etKey(ets[0]), esc(s.name), s.hasUrls ? '<span class="c">URL</span>' : '');
          else h += `<details class="tgroup" ${state.q ? 'open' : ''}><summary style="font-weight:500">${glyph('section')}<span>${esc(s.name)}</span>${accessMarks(keyOf('section', s.uid))}<span class="c">${ets.length}</span></summary><div class="kids">${ets.map(e => item(etKey(e), usedNameHTML(s.as[e.uid], e))).join('')}</div></details>`;
        });
      });
      h += `</div></details>`;
    });
    return h;
  }
  function blocksTree() {
    let h = '';
    const groups = new Map();
    model.fields.filter(f => f.blocks).sort(byName).forEach(f => {
      const list = (f.blocks || []).map(b => byUid.et[b.entryType]).filter(e => e && matchQ(e));
      if (list.length || (state.q && matchQ(f))) groups.set(f, list);
    });
    groups.forEach((list, f) => {
      h += `<details class="tgroup" ${state.q ? 'open' : ''}><summary>${glyph('matrix')}<span>${esc(f.name)}</span><span class="c">${list.length}</span></summary><div class="kids">${list.map(e => {
        const b = (f.blocks || []).find(x => x.entryType === e.uid);
        return item(etKey(e), b && usedNameHTML(b.as, e));
      }).join('')}</div></details>`;
    });
    return h;
  }
  // Unused entry types and the field layouts of global sets, volumes, category and tag groups, users and addresses.
  const otherTree = () => otherLayouts(matchQ).map(([kind, list]) => `<details class="tgroup" ${state.q ? 'open' : ''}><summary>${glyph(kind)}<span>${esc(KIND[kind].plural)}</span><span class="c">${list.length}</span></summary><div class="kids">${list.map(o => item(keyOf(kind, o.uid))).join('')}</div></details>`).join('');
  // Each tab of the tree, with the kinds it lists: a section opens on Pages, a Builder on Blocks.
  const TREES = {
    pages: { label: 'Pages', draw: pagesTree, kinds: ['page', 'section'] },
    blocks: { label: 'Blocks', draw: blocksTree, kinds: ['block', 'matrix'] },
    other: { label: 'Other', draw: otherTree, kinds: OTHER_LAYOUTS },
  };

  function drawTree() {
    const h = TREES[state.tab].draw();
    // A search that finds nothing in this tab points to the tabs where it does.
    const elsewhere = !h && state.q ? Object.keys(TREES).filter(tab => tab !== state.tab && TREES[tab].draw()) : [];
    const none = !state.q ? 'Nothing here yet.' : elsewhere.length ? 'Nothing matches here, only under' : 'Nothing matches.';
    treeEl.innerHTML = h || `<p class="muted" style="padding:10px">${none}${elsewhere.map(tab => ` <button class="btn" data-ttab="${tab}">${TREES[tab].label}</button>`).join('')}</p>`;
    treeEl.querySelectorAll('[data-ttab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.ttab)));
    bindGo(treeEl, k => App.go('layout', k));
    const on = treeEl.querySelector('.titem.on');
    if (on) {
      for (let d = on.closest('details'); d; d = d.parentElement.closest('details')) d.open = true;
      on.scrollIntoView({ block: 'nearest' });
    }
  }

  // ---- form mode: what an editor sees
  function control(f) {
    if (f.blocks) {
      return `<div class="ctl">${blockGroups(f).map(([g, blocks]) => `${g ? `<span class="grp">${esc(g)}</span>` : ''}${blocks.map(b => {
        const e = byUid.et[b.entryType];
        if (!e) return '';
        return `<span class="blockchip" data-go="${etKey(e)}"><b>${usedNameHTML(b.as, e)}</b></span>`;
      }).join('')}`).join('')}</div>`;
    }
    if (f.tabs) return `<div class="ctl">${layoutFields(f.tabs).map(({ f: inner }) => chip(fieldKey(inner))).join('')}</div>`;
    if (f.role === 'relation') return `<div class="ctl">→ ${f.allSources ? 'any section' : f.targets.map(s => chip(keyOf('section', s.uid))).join(' ')}${f.max ? ` <span>max ${f.max}</span>` : ''}</div>`;
    if (f.options) return `<div class="ctl">${f.options.map(o => `<span>${esc(o.label)}${o.default ? ' ●' : ''}</span>`).join('<span>·</span>')}</div>`;
    return `<div class="ctl">${esc(fieldTypeLabel(f))}</div>`;
  }
  // The form of whatever has a field layout: an entry type, a ContentBlock, a global set, …
  function formHTML(o) {
    const tabs = o.tabs;
    if (!tabs.length) return '<p class="muted">No field layout.</p>';
    const ti = Math.min(state.formTab, tabs.length - 1);
    let h = tabs.length > 1 ? `<div class="form-tabs">${tabs.map((tab, i) => `<button data-tab="${i}" class="${i === ti ? 'on' : ''}">${esc(tab.name)}${tab.conditional ? ` ${condTag(tab)}` : ''}</button>`).join('')}</div>` : '';
    h += '<div class="form">';
    tabs[ti].elements.forEach(e => {
      const w = `w${nearestWidth(e.width)}`;
      if (e.kind === 'HorizontalRule') { h += '<div class="fbox rule"></div>'; return; }
      if (e.kind === 'Heading') { h += `<div class="fbox heading">${esc(e.text)}</div>`; return; }
      if (e.kind === 'Tip') { h += `<div class="fbox tip">${esc(e.text)}</div>`; return; }
      if (e.kind === 'Title') { h += `<div class="fbox ${w}"><div class="lbl">${esc(elementName(e, o))}${reqTag(e)}${condTag(e)}</div><div class="h">title</div><div class="ctl">Text</div></div>`; return; }
      if (e.kind in NATIVE_FIELDS) { h += `<div class="fbox ${w}"><div class="lbl">${esc(elementName(e, o))}${reqTag(e)}${condTag(e)}</div><div class="ctl">Native field</div></div>`; return; }
      if (e.kind !== 'CustomField') { h += `<div class="fbox ${w}"><div class="lbl faint">${esc(elementName(e, o))}</div></div>`; return; }
      const f = byUid.field[e.field];
      if (!f) return;
      h += `<div class="fbox ${w} link" data-go="${fieldKey(f)}"><div class="lbl">${esc(e.label || f.name)}${renamedMark(e, f)}${reqTag(e)}${condTag(e)}</div><div class="h">${esc(e.handle || f.handle)}${e.handle || e.label ? ` · ${esc(f.name)}` : ''}</div>${control(f)}</div>`;
    });
    return h + '</div>';
  }

  // ---- page mode: the layout drawn as a wireframe
  function wfItem(e, f, depth) {
    const label = e.label || (f ? f.name : e.kind === 'Title' ? 'Title' : '');
    const cap = `<div class="cap"><b>${esc(label)}</b>${reqTag(e)}${condTag(e)}</div>`;
    const span = `style="grid-column: span ${Math.round(nearestWidth(e.width) / 25)}"`;
    if (e.kind === 'HorizontalRule') return '<div style="grid-column:1/-1;border-top:1px dashed var(--line-strong)"></div>';
    if (e.kind === 'Heading') return `<div style="grid-column:1/-1;font-weight:700;margin-top:4px">${esc(e.text)}</div>`;
    if (e.kind === 'Title') return `<div class="wfi" ${span}>${cap}<div class="wf-title"></div></div>`;
    if (!f) return '';
    const name = `${f.name} ${e.handle || ''}`.toLowerCase();
    if (f.blocks) return `<div class="wfi" style="grid-column:1/-1">${cap}${lane(f, depth + 1)}</div>`;
    if (f.tabs) return `<div class="wfi" style="grid-column:1/-1">${cap}<div class="wf" style="border-left:2px dashed var(--line-strong);padding-left:12px">${(f.tabs || []).flatMap(tab => tab.elements).map(x => wfItem(x, byUid.field[x.field], depth + 1)).join('')}</div></div>`;
    let body;
    if (f.type === 'Assets' || /image|logo|svg/.test(name)) body = `<div class="wf-img">${esc(fieldTypeLabel(f))}</div>`;
    else if (f.role === 'relation') body = `<div class="wf-ref" data-go="${f.targets[0] ? keyOf('section', f.targets[0].uid) : ''}">→ ${f.allSources ? 'any section' : f.targets.map(s => esc(s.name)).join(', ') || 'entries'} · ${f.max === 1 ? 'one' : 'many'}</div>`;
    else if (f.options) body = `<div class="wf-pills">${f.options.map(o => `<span class="${o.default ? 'def' : ''}">${esc(o.label)}</span>`).join('')}</div>`;
    else if (f.type === 'HyperField' || f.type === 'Link') body = `<div class="wf-btns"><span></span>${f.max !== 1 ? '<span></span>' : ''}</div>`;
    else if (f.type === 'Lightswitch') body = '<div class="wf-switch"></div>';
    else if (/description|multi|rich|body|text/.test(name) && f.type !== 'PlainText' || /ckeditor/i.test(f.typeClass || '')) body = '<div class="wf-text"><i></i><i></i><i></i></div>';
    else if (f.type === 'Table') body = '<div class="wf-text"><i style="width:100%"></i><i style="width:100%"></i><i></i></div>';
    else body = `<div class="wf-line" style="width:${/heading|title/.test(name) ? 80 : 55}%"></div>`;
    return `<div class="wfi" ${span}>${cap}${body}</div>`;
  }
  function lane(f, depth) {
    if (depth > 3) return '<div class="muted">…</div>';
    let h = '<div class="lane">';
    blockGroups(f).forEach(([g, blocks]) => {
      if (g) h += `<div class="lg">${esc(g)}</div>`;
      blocks.forEach(b => {
        const e = byUid.et[b.entryType];
        if (!e) return;
        const pulls = [...pullsFrom(e)];
        const inner = e.tabs.flatMap(tab => tab.elements).map(x => wfItem(x, byUid.field[x.field], depth)).join('');
        h += `<div class="blk"><div class="bh"><span class="caret"></span>${glyph('block', e)}<div><div class="bn">${usedNameHTML(b.as, e)}</div><div class="bs">${count(layoutFields(e.tabs).length, 'field', 'fields')}</div></div><span class="sp"></span>${pulls.map(s => `<span class="chip link" data-go="${keyOf('section', s.uid)}">from ${esc(s.name)}</span>`).join('')}<span class="chip link" data-go="${etKey(e)}">open</span></div><div class="bb"><div class="wf" style="margin-top:12px">${inner}</div></div></div>`;
      });
    });
    return h + '</div>';
  }
  function pageHTML(e) {
    const urls = e.sections.flatMap(s => s.sites.filter(x => byUid.site[x.site]).map(x => (x.hasUrls
      ? `<span class="url">${esc(siteUrl(byUid.site[x.site], x.uriFormat))}</span>`
      : `<span class="url none">${esc(byUid.site[x.site].name)} · no URL</span>`)));
    const where = e.kind === 'block' ? e.builders.map(b => `<span class="url none">inside ${esc(b.field.name)}${isRenamed(b.as, e) ? ` ${esc(renamedAs(b.as, e))}` : ''}</span>`) : [];
    const zones = e.tabs.map(tab => {
      const hasBuilder = layoutFields([tab]).some(({ f }) => f.blocks);
      return `<div class="zone"><span class="zl">${esc(tab.name)}${hasBuilder ? ' · content builder' : ''}</span><div class="wf">${tab.elements.map(x => wfItem(x, byUid.field[x.field], 0)).join('')}</div></div>`;
    }).join('');
    return `<div class="browser"><div class="chrome"><div class="lights"><i></i><i></i><i></i></div><div class="urls">${[...urls, ...where].join('')}</div></div><div class="pagebody">${zones || '<p class="muted">No field layout.</p>'}</div></div>`;
  }

  // ---- canvas
  function crumbs(n) {
    const parts = [];
    if (n.kind === 'page') { const s = n.obj.sections[0]; if (s && s.groups[0]) parts.push(keyOf('group', s.groups[0])); if (s && s.entryTypes.length > 1) parts.push(keyOf('section', s.uid)); }
    if (n.kind === 'block' && n.obj.builders[0]) { const owner = ownersOfField(n.obj.builders[0].field)[0]; if (owner) parts.push(etKey(owner)); parts.push(fieldKey(n.obj.builders[0].field)); }
    if (n.kind === 'section' && n.obj.groups[0]) parts.push(keyOf('group', n.obj.groups[0]));
    parts.push(n.key);
    const trail = parts.map((k, i) => { const p = nodeOf(k); return i === parts.length - 1 ? `<span class="here">${esc(p.obj.name)}</span>` : `<a data-go="${k}">${esc(p.obj.name)}</a><span class="faint">/</span>`; }).join(' ');
    const isEt = isEntryType(n.kind);
    return `<button class="btn only-small" data-tree>Browse</button>${trail}${isEt ? `<span class="end seg"><button data-mode="form" class="${state.mode === 'form' ? 'on' : ''}">Form</button><button data-mode="page" class="${state.mode === 'page' ? 'on' : ''}">Page</button></span>` : ''}`;
  }
  function canvasHTML(n) {
    const o = n.obj;
    let h = `<div class="headline"><div class="big">${glyph(n.kind, o)}</div><div style="min-width:0">${kindLabel(n.kind, o)}<h2>${esc(o.name)}</h2><div class="mono faint">${esc(o.handle || '')}${o.gql ? ` · ${esc(o.gql)}` : ''}${o.conventionOk === false ? ` ${prefixTag(o)}` : ''}</div></div></div>`;
    if (isEntryType(n.kind)) return h + (state.mode === 'page' ? pageHTML(o) : formHTML(o));
    // Only entry types make up pages, so other field layouts always show as a form.
    if (isLayoutOwner(n.kind)) return h + formHTML(o);
    if (n.kind === 'section') {
      return h + `<h3>Entry types</h3>${sectionEntryTypes(o)}`;
    }
    if (isField(n.kind)) {
      if (o.tabs) h += formHTML(o);
      else if (o.blocks) h += `<div class="form"><div class="fbox w100"><div class="lbl">${esc(o.name)}</div><div class="h">${esc(o.handle)}</div>${control(o)}</div></div>`;
      else h += fieldDetail(o) || `<p class="muted">${esc(fieldTypeLabel(o))} field, no settings worth showing.</p>`;
      return h + `<h3>Placed in ${count(o.usedIn.length, 'layout', 'layouts')}</h3>${o.usedIn.length ? `<div class="list">${o.usedIn.map(u => row(useKey(u), `${note(renameNote(u.el, o))}${reqTag(u.el)}${condTag(u.el)}`)).join('')}</div>` : '<p class="muted">Not used anywhere.</p>'}`;
    }
    return h + detailHTML(n, { title: false });
  }
  function open(key) {
    let n = nodeOf(key);
    if (!n) {
      const start = model.sections.flatMap(s => s.entryTypes).map(u => byUid.et[u]).find(Boolean) || model.entryTypes[0];
      if (!start) {
        canvas.innerHTML = '<p class="muted">No entry types yet. Once a section or Matrix field has one, its layout shows up here.</p>';
        drawTree();
        return;
      }
      n = nodeOf(etKey(start));
    }
    if (n.kind === 'section' && n.obj.entryTypes.length === 1 && byUid.et[n.obj.entryTypes[0]]) n = nodeOf(etKey(byUid.et[n.obj.entryTypes[0]]));
    if (state.current !== n.key) state.formTab = 0;
    state.current = n.key;
    crumbsEl.innerHTML = crumbs(n);
    canvas.innerHTML = canvasHTML(n);
    canvas.scrollTop = 0;
    context.innerHTML = KIND[n.kind].layer ? crossLinks(n.key, 'layout') : `<h3 style="margin-top:0">Context</h3>${detailHTML(n, { title: false })}${crossLinks(n.key, 'layout')}`;
    canvas.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.formTab = +b.dataset.tab; open(n.key); }));
    canvas.querySelectorAll('.blk > .bh').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
    crumbsEl.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { state.mode = b.dataset.mode; open(n.key); }));
    const treeBtn = crumbsEl.querySelector('[data-tree]');
    if (treeBtn) treeBtn.addEventListener('click', () => el.querySelector('.tree').classList.toggle('closed'));
    [crumbsEl, canvas, context].forEach(r => bindGo(r, k => App.go('layout', k)));
    const tab = Object.keys(TREES).find(id => TREES[id].kinds.includes(n.kind)) || state.tab;
    if (tab !== state.tab) setTab(tab, false);
    drawTree();
    if (matchMedia('(max-width: 760px)').matches) el.querySelector('.tree').classList.add('closed');
  }
  function setTab(tab, redraw = true) {
    state.tab = tab;
    el.querySelectorAll('[data-ttab]').forEach(b => b.classList.toggle('on', b.dataset.ttab === tab));
    if (redraw) drawTree();
  }

  const info = () => '<h2>Field layouts</h2><p>Pick a page or block on the left to see its field layout. <b>Other</b> has the rest: global sets, volumes, category and tag groups, users, addresses, and entry types not used anywhere.</p><p><b>Form</b> shows the tabs and fields as an editor sees them, at their widths. <b>Page</b> draws an entry type as a wireframe, with the blocks of each builder to fold open.</p><p>The context on the right says where it lives and what it’s made of.</p>';

  function mount(root) {
    el = root;
    el.innerHTML = `
      <aside class="tree">
        <div class="head">
          <input type="search" placeholder="Search layouts" aria-label="Search layouts">
          <div class="seg">${Object.keys(TREES).map(tab => `<button data-ttab="${tab}" class="${tab === state.tab ? 'on' : ''}">${TREES[tab].label}</button>`).join('')}</div>
        </div>
        <div class="body scroll"></div>
      </aside>
      <div class="stage">
        <div class="crumbs"></div>
        <div class="stage-body">
          <div class="canvas-wrap">
            <div class="canvas scroll dots"></div>
            ${infoCard(info())}
          </div>
          <aside class="context scroll"></aside>
        </div>
      </div>`;
    treeEl = el.querySelector('.tree .body');
    canvas = el.querySelector('.canvas');
    context = el.querySelector('.context');
    crumbsEl = el.querySelector('.crumbs');
    el.querySelectorAll('[data-ttab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.ttab)));
    const search = el.querySelector('.tree input[type=search]');
    search.addEventListener('input', () => { state.q = search.value.trim().toLowerCase(); drawTree(); });
  }

  return {
    id: 'layout',
    label: 'Layout',
    crossLink: 'Open layout',
    // Whatever has a field layout, the fields in them, and sections, which open their entry types.
    kinds: Object.keys(KIND).filter(k => k === 'section' || isField(k) || isEntryType(k) || isLayoutOwner(k)),
    info,
    mount,
    show(key) { open(key); },
    refresh() {
      const top = canvas.scrollTop;
      if (state.current) open(state.current); else drawTree();
      canvas.scrollTop = top;
    },
  };
})());
