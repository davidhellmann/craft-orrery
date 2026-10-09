// Graph view: every site group, site, section, entry type and field as one pannable map.
// Columns run from where content lives (left) to what it's made of (right).
const GraphView = (() => {
  const COLS = ['group', 'site', 'section', 'page', 'matrix', 'block', 'field'];
  const COL_W = 230, COL_GAP = 110, NODE_H = 30, NODE_GAP = 6, TOP = 70;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- graph: containment edges drive the lineage, relation edges are followed one hop only
  const nodes = {}, edges = [];
  const add = (kind, obj) => { const key = keyOf(kind, obj.uid); nodes[key] = { key, kind, obj, x: 0, y: 0, down: [], up: [], refs: [], refBy: [] }; };
  M.siteGroups.forEach(g => add('group', g));
  M.sites.forEach(s => add('site', s));
  M.sections.forEach(s => add('section', s));
  M.entryTypes.forEach(e => add(e.kind, e));
  M.fields.forEach(f => add(f.isBuilder ? 'matrix' : 'field', f));
  const seen = new Set();
  const link = (a, b, type = 'contain') => {
    if (!nodes[a] || !nodes[b] || a === b || seen.has(a + '>' + b)) return;
    seen.add(a + '>' + b);
    edges.push({ a, b, type });
    if (type === 'contain') { nodes[a].down.push(b); nodes[b].up.push(a); } else { nodes[a].refs.push(b); nodes[b].refBy.push(a); }
  };
  M.sites.forEach(s => link(keyOf('group', s.group), keyOf('site', s.uid)));
  M.sections.forEach(s => {
    s.sites.forEach(ss => link(keyOf('site', ss.site), keyOf('section', s.uid)));
    s.entryTypes.forEach(u => by.et[u] && link(keyOf('section', s.uid), etKey(by.et[u])));
  });
  M.entryTypes.forEach(e => customElements(e.tabs).forEach(({ f }) => link(etKey(e), fieldKey(f))));
  M.fields.forEach(f => {
    (f.blocks || []).forEach(b => by.et[b.entryType] && link(fieldKey(f), etKey(by.et[b.entryType])));
    if (f.type === 'ContentBlock') customElements(f.tabs).forEach(({ f: inner }) => link(fieldKey(f), fieldKey(inner)));
    f.targets.forEach(s => link(fieldKey(f), keyOf('section', s.uid), 'ref'));
  });

  function walk(start, dir, out) {
    const stack = [start];
    while (stack.length) nodes[stack.pop()][dir].forEach(k => { if (!out.has(k)) { out.add(k); stack.push(k); } });
  }
  function lineage(key) {
    const out = new Set([key]);
    walk(key, 'down', out);
    walk(key, 'up', out);
    [...out].forEach(k => nodes[k].refs.forEach(r => out.add(r)));
    nodes[key].refBy.forEach(r => out.add(r));
    return out;
  }
  function subtree(key) {
    const out = new Set([key]);
    walk(key, 'down', out);
    [...out].forEach(k => nodes[k].refs.forEach(r => out.add(r)));
    return out;
  }

  // ---- layout: columns, each ordered by the average position of its already placed parents
  function layout(visible) {
    const pos = {}, counts = {};
    let index = 0;
    COLS.forEach((kind, ci) => {
      const list = Object.values(nodes).filter(n => n.kind === kind && (!visible || visible.has(n.key)));
      const score = n => { const ps = n.up.filter(p => pos[p]); return ps.length ? ps.reduce((a, p) => a + pos[p].i, 0) / ps.length : Infinity; };
      list.sort((a, b) => score(a) - score(b) || byName(a.obj, b.obj));
      list.forEach((n, i) => { pos[n.key] = { i: index++, x: ci * (COL_W + COL_GAP), y: TOP + i * (NODE_H + NODE_GAP) }; });
      counts[kind] = list.length;
    });
    return { pos, counts };
  }

  let el, svg, vp, gCols, gEdges, gNodes, side, wrap;
  let view = { x: 30, y: 64, k: 0.6 }, visibleSet = null, lit = null, selected = null, isolate = false, groupFilter = '', fitted = false;
  const isShown = n => !visibleSet || visibleSet.has(n.key);
  const isMovable = n => isShown(n) && (!lit || lit.has(n.key));

  function glyphNode(kind) {
    const y = NODE_H / 2;
    if (kind === 'field') return svgEl('circle', { class: 'glyph dot', cx: 14, cy: y, r: 3 });
    const round = kind === 'site' || kind === 'page' || kind === 'block';
    const cls = `glyph${kind === 'group' || kind === 'site' ? ' filled' : ''}${kind === 'matrix' || kind === 'block' ? ' dashed' : ''}`;
    return round ? svgEl('circle', { class: cls, cx: 14, cy: y, r: 5 }) : svgEl('rect', { class: cls, x: 9, y: y - 5, width: 10, height: 10, rx: 1.5 });
  }
  function drawNodes() {
    Object.values(nodes).forEach(n => {
      const g = svgEl('g', { class: 'node' });
      g.appendChild(svgEl('rect', { class: 'body', width: COL_W, height: NODE_H, rx: 6 }));
      g.appendChild(glyphNode(n.kind));
      const subText = n.kind === 'field' || n.kind === 'matrix' ? fieldTypeLabel(n.obj)
        : n.obj.conventionOk === false ? `no ${n.obj.prefix}` : n.kind === 'section' ? n.obj.type : '';
      // Shorten the name so it stops before the label on the right.
      const room = Math.floor((COL_W - 46 - subText.length * 6.3) / 7);
      const t = svgEl('text', { x: 28, y: 19 });
      t.textContent = n.obj.name.length > room ? n.obj.name.slice(0, room - 1) + '…' : n.obj.name;
      g.appendChild(t);
      const tip = svgEl('title');
      tip.textContent = n.obj.name;
      g.appendChild(tip);
      if (subText) { const s = svgEl('text', { class: 'sub', x: COL_W - 8, y: 19, 'text-anchor': 'end' }); s.textContent = subText; g.appendChild(s); }
      n.marks = svgEl('g');
      g.appendChild(n.marks);
      n.g = g;
      g.__node = n;
      gNodes.appendChild(g);
    });
    edges.forEach(e => { e.path = svgEl('path', { class: 'edge' + (e.type === 'ref' ? ' ref' : '') }); gEdges.appendChild(e.path); });
  }
  // Access marks sit on the node's top edge, right-aligned: a dot for user groups, a diamond for schemas.
  function drawMarks() {
    Object.values(nodes).forEach(n => {
      const kinds = ACCESS.filter(kind => activeAccess(kind).some(a => rightsOn(a, kind, n.key)));
      n.marks.replaceChildren(...kinds.map((kind, i) => {
        const x = COL_W - 10 - (kinds.length - 1 - i) * 13;
        return kind === 'usergroup'
          ? svgEl('circle', { class: 'mark-usergroup', cx: x, cy: 0, r: 4.5 })
          : svgEl('rect', { class: 'mark-schema', x: x - 3.6, y: -3.6, width: 7.2, height: 7.2, rx: 1, transform: `rotate(45 ${x} 0)` });
      }));
    });
  }
  function edgePath(a, b) {
    const ax = a.x + COL_W, ay = a.y + NODE_H / 2, bx = b.x, byy = b.y + NODE_H / 2;
    const dx = bx > ax ? Math.max(40, (bx - ax) / 2) : 60 + Math.abs(ax - bx) * 0.08;
    return `M${ax},${ay} C${ax + dx},${ay} ${bx - dx},${byy} ${bx},${byy}`;
  }
  function render() {
    Object.values(nodes).forEach(n => {
      n.g.setAttribute('transform', `translate(${n.x},${n.y})`);
      n.g.style.display = visibleSet && !visibleSet.has(n.key) ? 'none' : '';
    });
    edges.forEach(e => {
      const hidden = visibleSet && (!visibleSet.has(e.a) || !visibleSet.has(e.b));
      e.path.style.display = hidden ? 'none' : '';
      if (!hidden) e.path.setAttribute('d', edgePath(nodes[e.a], nodes[e.b]));
    });
  }
  function drawCols(counts) {
    gCols.innerHTML = '';
    COLS.forEach((k, ci) => {
      const x = ci * (COL_W + COL_GAP);
      const t = svgEl('text', { class: 'col-label', x, y: 30 }); t.textContent = KIND[k].plural; gCols.appendChild(t);
      const c = svgEl('text', { class: 'col-count', x, y: 48 }); c.textContent = `${counts[k] || 0}${KIND[k].hint ? ` · ${KIND[k].hint.toLowerCase()}` : ''}`; gCols.appendChild(c);
    });
  }
  function applyLayout(visible, animate = true) {
    const { pos, counts } = layout(visible);
    drawCols(counts);
    visibleSet = visible;
    const from = {};
    Object.values(nodes).forEach(n => { from[n.key] = { x: n.x, y: n.y }; });
    if (!animate || reducedMotion()) { Object.values(nodes).forEach(n => { if (pos[n.key]) Object.assign(n, { x: pos[n.key].x, y: pos[n.key].y }); }); render(); return; }
    const t0 = performance.now(), D = 420;
    const step = now => {
      const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
      Object.values(nodes).forEach(n => {
        if (!pos[n.key]) return;
        n.x = from[n.key].x + (pos[n.key].x - from[n.key].x) * e;
        n.y = from[n.key].y + (pos[n.key].y - from[n.key].y) * e;
      });
      render();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- view transform
  const setView = () => vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  function zoomAt(k, mx, my) {
    k = Math.min(2.4, Math.max(0.1, k));
    view.x = mx - (mx - view.x) * (k / view.k);
    view.y = my - (my - view.y) * (k / view.k);
    view.k = k;
    setView();
  }
  // Eases the scale towards k while the point under (mx, my) stays put.
  function zoomTo(k, mx, my) {
    const from = view.k, to = Math.min(2.4, Math.max(0.1, k));
    if (reducedMotion()) { zoomAt(to, mx, my); return; }
    const t0 = performance.now(), D = 240;
    const step = now => {
      const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
      zoomAt(from * Math.pow(to / from, e), mx, my);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function centerOn(key) {
    const n = nodes[key];
    if (!n) return;
    const r = svg.getBoundingClientRect();
    view.x = r.width / 2 - (n.x + COL_W / 2) * view.k;
    view.y = r.height / 2 - (n.y + NODE_H / 2) * view.k;
    setView();
  }
  function fit() {
    const r = svg.getBoundingClientRect();
    const vis = Object.values(nodes).filter(n => !visibleSet || visibleSet.has(n.key));
    if (!vis.length || !r.width) return;
    const minX = Math.min(...vis.map(n => n.x)), maxX = Math.max(...vis.map(n => n.x + COL_W)), maxY = Math.max(...vis.map(n => n.y + NODE_H));
    const byWidth = (r.width - 60) / (maxX - minX), all = Math.min(byWidth, (r.height - 90) / maxY);
    // fit the width; the columns are long, vertical is for scrolling
    const k = Math.min(1.1, Math.max(all, Math.min(0.6, byWidth)));
    view = { k, x: 30 - minX * k, y: Math.max(64, (r.height - maxY * k) / 2) };
    setView();
  }

  // ---- dragging: a dragged node keeps a margin around it and pushes overlapping nodes aside, along the
  // shorter way out. Pushed nodes fall back to where they were once the dragged node moves on.
  const PAD_X = 20, PAD_Y = NODE_GAP;
  function push(b, a) {
    const ox = COL_W + PAD_X - Math.abs(b.x - a.x), oy = NODE_H + PAD_Y - Math.abs(b.y - a.y);
    if (ox <= 0 || oy <= 0) return false;
    if (oy <= ox) b.y += b.y >= a.y ? oy : -oy; else b.x += b.x >= a.x ? ox : -ox;
    return true;
  }
  function makeRoom(dragged, home) {
    const shown = Object.values(nodes).filter(n => n !== dragged && isShown(n));
    shown.forEach(n => Object.assign(n, home.get(n)));
    const queue = [dragged];
    for (let i = 0; i < queue.length && i < shown.length * 4; i++) {
      const a = queue[i];
      if (a !== dragged && push(a, dragged)) queue.push(a);
      shown.forEach(b => { if (b !== a && push(b, a)) queue.push(b); });
    }
  }

  // ---- selection: a node lights up its lineage, a user group or schema everything it reaches
  function reach(key) {
    const n = nodeOf(key);
    return new Set(Object.keys(nodes).filter(k => rightsOn(n.obj, n.kind, k)));
  }
  function highlight() {
    const base = selected ? (nodes[selected] ? lineage(selected) : reach(selected)) : groupFilter ? subtree(keyOf('group', groupFilter)) : null;
    svg.classList.toggle('dim', !!base);
    Object.values(nodes).forEach(n => {
      n.g.classList.toggle('hl', !!base && base.has(n.key));
      n.g.classList.toggle('sel', n.key === selected);
    });
    edges.forEach(e => e.path.classList.toggle('hl', !!base && base.has(e.a) && base.has(e.b)));
    lit = base;
    return base;
  }
  function select(key, { center = false } = {}) {
    selected = nodeOf(key) ? key : null;
    const base = highlight();
    if (isolate) applyLayout(base);
    panel();
    if (center && selected) setTimeout(() => centerOn(selected), isolate ? 450 : 0);
    else if (selected) requestAnimationFrame(() => reveal(selected));
  }
  // Pans just enough that a node isn't cut off at the edges, like when the details panel opens over it.
  function reveal(key) {
    const n = nodes[key];
    if (!n) return;
    const r = svg.getBoundingClientRect(), pad = 24;
    const left = view.x + n.x * view.k, right = left + COL_W * view.k;
    const dx = right > r.width - pad ? r.width - pad - right : left < pad ? pad - left : 0;
    if (dx) { view.x += dx; setView(); }
  }
  function panel() {
    side.classList.toggle('closed', !selected);
    const inner = side.querySelector('.scroll');
    inner.innerHTML = selected ? `<div class="inner">${closeButton('Close details', 'data-close')}${detailHTML(nodeOf(selected))}${crossLinks(selected, 'graph')}</div>` : '';
    const close = inner.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => App.go('graph', null));
    bindGo(inner, k => App.go('graph', k));
    inner.scrollTop = 0;
  }
  const info = () => infoCard(`
    <h2>Reading the map</h2>
    <div class="legend">${legendHTML()}<span><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" stroke-dasharray="4 3"/></svg>Relation</span></div>
    <p>Left to right is where content lives: site groups have sites, sites have sections, sections hold pages.</p>
    <p>Pages are made of fields. Builders (matrix fields) hold blocks, and blocks are made of fields again. Dashed lines are relations, a field that pulls entries from another section.</p>
    <p>Click anything to light up what it’s connected to. <b>Isolate</b> lays out only that part.</p>
    <p>Double-click to zoom in, with Shift to zoom out. Scroll or drag the background to move around, drag a node to move it and the others make room.</p>
    <h3>Worth a look</h3>
    <div class="list">
      ${checksHandles ? `<div class="row"><span class="grow">Handles without prefix (${[PREFIX.page, PREFIX.block].filter(Boolean).map(esc).join(' / ')})</span><b>${unprefixedEntryTypes.length}</b></div>` : ''}
      <div class="row"><span class="grow">Fields not used anywhere</span><b>${unusedFields.length}</b></div>
    </div>
    ${unusedFields.length ? `<h3>Unused fields</h3><div class="list">${unusedFields.map(f => row(fieldKey(f), typeTag(f))).join('')}</div>` : ''}`);

  function mount(root) {
    el = root;
    el.innerHTML = `
      <div class="map dots">
        <div class="tools">
          <div class="floating toolbar">
            <input type="search" placeholder="Search name or handle  ⏎" aria-label="Search the map">
            <select aria-label="Site group"><option value="">All site groups</option>${M.siteGroups.map(g => `<option value="${g.uid}">${esc(g.name)}</option>`).join('')}</select>
            <button class="btn" data-isolate title="Lay out only the highlighted part">Isolate</button>
            <button class="btn" data-reset>Reset</button>
          </div>
        </div>
        ${info()}
        <div class="zoom"><button class="btn floating" data-zoom="in" aria-label="Zoom in">+</button><button class="btn floating" data-zoom="out" aria-label="Zoom out">−</button><button class="btn floating" data-fit aria-label="Fit to screen" style="font-size:11px">Fit</button></div>
        <svg class="graph-svg"><g class="vp"><g class="cols"></g><g class="edges"></g><g class="nodes"></g></g></svg>
      </div>
      <aside class="panel"><div class="scroll" style="flex:1"></div></aside>`;
    wrap = el.querySelector('.map');
    svg = el.querySelector('.graph-svg');
    vp = el.querySelector('.vp');
    gCols = el.querySelector('.cols');
    gEdges = el.querySelector('.edges');
    gNodes = el.querySelector('.nodes');
    side = el.querySelector('.panel');
    bindGo(wrap.querySelector('.info'), k => App.go('graph', k));
    drawNodes();
    drawMarks();
    applyLayout(null, false);
    setView();

    // trackpad scroll pans, pinch / ⌘-scroll zooms
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      if (ev.ctrlKey || ev.metaKey) zoomAt(view.k * Math.exp(-ev.deltaY * 0.01), ev.clientX - r.left, ev.clientY - r.top);
      else { view.x -= ev.deltaX; view.y -= ev.deltaY; setView(); }
    }, { passive: false });
    // double-click zooms in on that spot, shift + double-click zooms out, like a map
    svg.addEventListener('dblclick', ev => {
      const r = svg.getBoundingClientRect();
      zoomTo(view.k * (ev.shiftKey ? 0.5 : 2), ev.clientX - r.left, ev.clientY - r.top);
    });
    let drag = null;
    svg.addEventListener('pointerdown', ev => {
      const g = ev.target.closest('.node');
      const hit = g && g.__node;
      // dimmed nodes belong to the background: a click still selects them, a drag pans the map
      const node = hit && isMovable(hit) ? hit : null;
      const home = node && new Map(Object.values(nodes).map(n => [n, { x: n.x, y: n.y }]));
      drag = { sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, hit, node, home, nx: node && node.x, ny: node && node.y, moved: false };
      svg.setPointerCapture(ev.pointerId);
      wrap.classList.add('panning');
    });
    svg.addEventListener('pointermove', ev => {
      if (!drag) return;
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.node) { drag.node.x = drag.nx + dx / view.k; drag.node.y = drag.ny + dy / view.k; makeRoom(drag.node, drag.home); render(); } else { view.x = drag.vx + dx; view.y = drag.vy + dy; setView(); }
    });
    const end = () => {
      if (drag && !drag.moved) App.go('graph', drag.hit ? drag.hit.key : null);
      drag = null;
      wrap.classList.remove('panning');
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', () => { drag = null; wrap.classList.remove('panning'); });

    const search = el.querySelector('input[type=search]');
    const matches = q => Object.values(nodes).filter(n => n.obj.name.toLowerCase().includes(q) || (n.obj.handle || '').toLowerCase().includes(q));
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const hits = new Set(q ? matches(q) : []);
      Object.values(nodes).forEach(n => n.g.classList.toggle('match', hits.has(n)));
    });
    search.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      const q = search.value.trim().toLowerCase();
      if (!q) return;
      const hit = Object.values(nodes).find(n => n.obj.name.toLowerCase() === q || (n.obj.handle || '').toLowerCase() === q) || matches(q)[0];
      if (hit) App.go('graph', hit.key, { center: true });
    });
    const group = el.querySelector('select');
    group.addEventListener('change', () => { groupFilter = group.value; App.go('graph', null); });
    const iso = el.querySelector('[data-isolate]');
    iso.addEventListener('click', () => {
      isolate = !isolate;
      iso.classList.toggle('on', isolate);
      applyLayout(isolate ? highlight() : null);
      setTimeout(selected ? () => centerOn(selected) : fit, 450);
    });
    el.querySelector('[data-reset]').addEventListener('click', () => {
      isolate = false; iso.classList.remove('on');
      groupFilter = ''; group.value = '';
      search.value = ''; search.dispatchEvent(new Event('input'));
      applyLayout(null);
      App.go('graph', null);
      setTimeout(fit, 450);
    });
    el.querySelector('[data-fit]').addEventListener('click', fit);
    el.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
      const r = svg.getBoundingClientRect();
      zoomTo(view.k * (b.dataset.zoom === 'in' ? 1.25 : 0.8), r.width / 2, r.height / 2);
    }));
    panel();
  }

  return {
    id: 'graph',
    label: 'Graph',
    mount,
    show(key, opts = {}) {
      if (!fitted) { fitted = true; requestAnimationFrame(() => { fit(); if (key) centerOn(key); }); }
      if (key !== selected) select(key, { center: opts.center || (!!key && opts.fromHash) });
    },
    escape() { if (selected) App.go('graph', null); },
    refresh() { drawMarks(); panel(); },
  };
})();
