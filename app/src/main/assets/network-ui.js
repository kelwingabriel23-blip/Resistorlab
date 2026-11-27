/* Resistor Lab: telas e diagramas do circuito livre e do conversor triângulo/estrela. */
window.NetworkUI = function (ui) {
  'use strict';
  var L = window.Lab, h = ui.h, btn = ui.btn, card = ui.card, add = ui.add, field = ui.field, select = ui.select, numInput = ui.numInput;
  var wire = ui.wire, txt = ui.txt;
  var caption = function (t) { return h('p', { className: 'muted' }, t); };

  /* ---------- desenho do circuito por nós ---------- */
  function crossings(order, pairs) {
    var at = {}; order.forEach(function (n, i) { at[n] = i; });
    var seg = pairs.map(function (p) { return [Math.min(at[p[0]], at[p[1]]), Math.max(at[p[0]], at[p[1]])]; }), total = 0;
    for (var i = 0; i < seg.length; i++) for (var j = 0; j < seg.length; j++) {
      var a = seg[i], b = seg[j]; if (a[0] < b[0] && b[0] < a[1] && a[1] < b[1]) total++;
    }
    return total;
  }
  function arrange(nodes, comps, first, opposite) {
    var pairs = [], seen = {};
    comps.forEach(function (c) { var k = [c.a, c.b].sort().join(''); if (!seen[k] && !((c.a === first && c.b === opposite) || (c.b === first && c.a === opposite))) { seen[k] = 1; pairs.push([c.a, c.b]); } });
    var rest = nodes.filter(function (n) { return n !== first; }), best = null, score = Infinity;
    function rate(r) {
      var o = [first].concat(r), s = crossings(o, pairs) * 10;
      if (opposite) s += Math.abs(o.indexOf(opposite) - o.length / 2);
      if (s < score) { score = s; best = o; }
    }
    if (rest.length <= 7) (function permute(left, done) { if (!left.length) rate(done); else left.forEach(function (x, i) { permute(left.slice(0, i).concat(left.slice(i + 1)), done.concat(x)); }); })(rest, []);
    else {
      rate(rest);
      for (var pass = 0; pass < 6; pass++) for (var i = 0; i < rest.length; i++) for (var j = i + 1; j < rest.length; j++) {
        var trial = best.slice(1), t = trial[i]; trial[i] = trial[j]; trial[j] = t; rate(trial);
      }
    }
    return best;
  }
  function graph(comps, opts) {
    opts = opts || {};
    var nodes = []; comps.forEach(function (c) { [c.a, c.b].forEach(function (n) { if (nodes.indexOf(n) < 0) nodes.push(n); }); }); nodes.sort();
    var big = nodes.length > 8 || comps.length > 14;
    var W = big ? 460 : 320, H = big ? 440 : 300, cx = W / 2, cy = H / 2 - 18, rx = W / 2 - 42, ry = H / 2 - 52, bottom = H - 16;
    var src = comps.filter(function (c) { return c.type === 'V'; })[0] || comps.filter(function (c) { return c.type === 'I'; })[0];
    var first = opts.terminals ? opts.terminals[0] : src ? src.a : nodes[0], opposite = opts.terminals ? opts.terminals[1] : src ? src.b : null;
    if (nodes.indexOf(first) < 0) first = nodes[0];
    var pos = opts.positions;
    if (!pos) {
      var order = nodes.length ? arrange(nodes, comps, first, opposite) : []; pos = {};
      order.forEach(function (n, i) { var a = Math.PI + 2 * Math.PI * i / order.length; pos[n] = nodes.length === 2 ? [i ? cx + rx : cx - rx, cy] : [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
    }
    var groups = {}; comps.forEach(function (c) { var k = [c.a, c.b].sort().join(''); (groups[k] = groups[k] || []).push(c); });
    var wires = '', symbols = '', labels = '', used = [], outerUsed = false;
    comps.forEach(function (c) {
      var p = pos[c.a], q = pos[c.b]; if (!p || !q) return;
      var list = groups[[c.a, c.b].sort().join('')], points;
      var outer = !outerUsed && c === src && !opts.positions && Math.abs(p[1] - cy) < 2 && Math.abs(q[1] - cy) < 2 && Math.abs(p[0] - q[0]) > rx * 1.5;
      if (outer) { outerUsed = true; var out = function (z) { return z[0] < cx ? z[0] - 24 : z[0] + 24; }; points = [p, [out(p), p[1]], [out(p), bottom], [out(q), bottom], [out(q), q[1]], q]; }
      else {
        var index = list.indexOf(c) - (list.filter(function (x) { return !(outerUsed && x === src); }).length - 1) / 2;
        if (list.length > 1 && index !== 0) {
          var ends = [c.a, c.b].sort(), u = pos[ends[0]], v = pos[ends[1]], len = Math.hypot(v[0] - u[0], v[1] - u[1]) || 1;
          points = [p, [(p[0] + q[0]) / 2 - (v[1] - u[1]) / len * 44 * index, (p[1] + q[1]) / 2 + (v[0] - u[0]) / len * 44 * index], q];
        } else points = [p, q];
      }
      wires += wire('M' + points.map(function (z) { return z[0].toFixed(1) + ' ' + z[1].toFixed(1); }).join('L'));
      var lengths = points.slice(1).map(function (z, i) { return Math.hypot(z[0] - points[i][0], z[1] - points[i][1]); }), total = lengths.reduce(function (a, b) { return a + b; }, 0);
      function along(t) {
        var d = t * total, i = 0; while (i < lengths.length - 1 && d > lengths[i]) { d -= lengths[i]; i++; }
        var a = points[i], b = points[i + 1], f = lengths[i] ? d / lengths[i] : 0;
        return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
      }
      var tries = [0.5, 0.34, 0.66, 0.27, 0.73, 0.42, 0.58], spot = null, bestGap = -1;
      tries.some(function (t) { var m = along(t), gap = Math.min.apply(null, used.map(function (z) { return Math.hypot(z.x - m.x, z.y - m.y); }).concat([999])); if (gap > bestGap) { bestGap = gap; spot = m; } return gap >= 46; });
      used.push(spot);
      var mark = opts.mark && opts.mark.indexOf(c.name) >= 0, color = mark ? '#ffffff' : '#25e3ff';
      var turn = 'translate(' + spot.x.toFixed(1) + ' ' + spot.y.toFixed(1) + ') rotate(' + spot.angle.toFixed(1) + ')';
      if (c.type === 'R') symbols += '<g transform="' + turn + '"><rect x="-19" y="-3" width="38" height="6" fill="#0c1931"/>' + wire('M-19 0h3l3 -7l5 14l5 -14l5 14l5 -14l5 14l3 -7h4', color) + '</g>';
      else if (c.type === 'V') { /* + e − sempre em pé, o + do lado do primeiro nó */
        var ux = Math.cos(spot.angle * Math.PI / 180) * 5.5, uy = Math.sin(spot.angle * Math.PI / 180) * 5.5, px = spot.x - ux, py = spot.y - uy, mx = spot.x + ux, my = spot.y + uy;
        symbols += '<circle cx="' + spot.x.toFixed(1) + '" cy="' + spot.y.toFixed(1) + '" r="12" fill="#0c1931" stroke="#e6f1ff" stroke-width="2"/><path d="M' + (px - 3).toFixed(1) + ' ' + py.toFixed(1) + 'h6M' + px.toFixed(1) + ' ' + (py - 3).toFixed(1) + 'v6M' + (mx - 3).toFixed(1) + ' ' + my.toFixed(1) + 'h6" stroke="#e6f1ff" stroke-width="1.5" fill="none"/>';
      } else symbols += '<g transform="' + turn + '"><circle r="12" fill="#0c1931" stroke="#e6f1ff" stroke-width="2"/><path d="M7 0H-6M-2 -4l-5 4l5 4" stroke="#e6f1ff" stroke-width="1.8" fill="none"/></g>';
      var label = (c.name || '') + ' ' + (c.label !== undefined ? c.label : L.eng(c.value, c.type === 'R' ? 'Ω' : c.type === 'V' ? 'V' : 'A', 3));
      var w = label.length * 6.1 + 6, lx = Math.max(w / 2 + 1, Math.min(W - w / 2 - 1, spot.x)), ly = spot.y + (outer ? -20 : 19);
      labels += '<rect x="' + (lx - w / 2).toFixed(1) + '" y="' + (ly - 10).toFixed(1) + '" width="' + w.toFixed(1) + '" height="13" rx="3" fill="#0c1931" opacity="0.92"/>' + txt(lx.toFixed(1), ly.toFixed(1), label, mark ? '#ffffff' : '#b8d4f5').replace('font-size="11"', 'font-size="10"');
    });
    var dots = nodes.map(function (n) {
      if (!pos[n]) return '';
      var p = pos[n], terminal = opts.terminals && opts.terminals.indexOf(n) >= 0, dx = p[0] - cx, dy = p[1] - cy, len = Math.hypot(dx, dy);
      var ox = len < 5 ? 14 : dx / len * 16, oy = len < 5 ? -10 : dy / len * 16;
      if (Math.abs(dy) < 2 && len >= 5) { oy = -13; ox = dx > 0 ? 10 : -10; }
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (terminal ? 6 : 3.5) + '" fill="' + (terminal ? '#ffffff' : '#25e3ff') + '"/>' + txt(p[0] + ox, p[1] + oy + 4, n, '#ffffff').replace('font-size="11"', 'font-size="13" font-weight="bold"') +
        (opts.ground === n ? wire('M' + (p[0] - 7) + ' ' + (p[1] + 9) + 'h14M' + (p[0] - 4) + ' ' + (p[1] + 13) + 'h8', '#8fa8cc') : '');
    }).join('');
    return h('div', { className: 'diagram scroll', tabIndex: 0, html: '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Diagrama do circuito por nós" style="max-width:100%;height:auto;min-width:' + Math.round(W * 0.82) + 'px">' + wires + symbols + labels + dots + '</svg>' });
  }
  function wiring(comps) {
    return comps.map(function (c) { return c.name + ': ' + (c.type === 'R' ? 'entre ' + c.a + ' e ' + c.b : c.type === 'V' ? '+ em ' + c.a + ', − em ' + c.b : 'entrega em ' + c.a + ', retira de ' + c.b); }).join(' · ');
  }
  function named(components) {
    var n = { R: 0, V: 0, I: 0 };
    return components.map(function (c) { return { type: c.type, a: c.a, b: c.b, name: (c.type === 'I' ? 'F' : c.type) + (++n[c.type]), value: c.value, unit: c.unit }; });
  }
  function stepView(c, s) {
    if (c.kind !== 'network' || !s.graph) return null;
    var opts = { terminals: c.mode === 'req' ? c.terminals : null, ground: c.ground };
    return h('div', { className: 'stack' }, graph(s.graph, opts));
  }

  /* ---------- conversor triângulo / estrela ---------- */
  function deltaDiagrams(c) {
    function triangle(names, values) { return graph([['A', 'B'], ['B', 'C'], ['C', 'A']].map(function (p, i) { return { type: 'R', a: p[0], b: p[1], name: names[i], value: values[i] }; }), { positions: { A: [50, 205], B: [160, 40], C: [270, 205] } }); }
    function star(names, values) { return graph(['A', 'B', 'C'].map(function (n, i) { return { type: 'R', a: n, b: '•', name: names[i], value: values[i] }; }), { positions: { A: [50, 205], B: [160, 30], C: [270, 205], '•': [160, 135] } }); }
    var toStar = c.direction === 'toStar';
    return [caption(toStar ? 'Antes: triângulo (Δ)' : 'Antes: estrela (Y)'), (toStar ? triangle : star)(c.from, c.given), caption(toStar ? 'Depois: estrela (Y)' : 'Depois: triângulo (Δ)'), (toStar ? star : triangle)(c.names, c.values)];
  }
  function paintDelta(output, c) {
    add(output, card(h('h2', {}, 'Resultado'), h('div', { className: 'stats' }, c.names.map(function (n, i) { return h('div', { className: 'stat' }, h('span', {}, n), h('b', {}, L.eng(c.values[i], 'Ω'))); }))), ui.actions(c),
      card(h('h2', {}, 'Diagramas'), deltaDiagrams(c)), card(h('h2', {}, 'Conferência'), c.checks.map(function (k) { return caption((k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text); })));
  }
  function deltaScreen(input, autoCalc) {
    var form = { direction: input ? input.direction : 'toStar', values: input ? input.values.map(ui.raw) : ['', '', ''], units: input && input.units ? input.units.slice() : ['Ω', 'Ω', 'Ω'] };
    var result = autoCalc ? L.delta(input) : null;
    ui.go('Triângulo ↔ Estrela', function (main) {
      var err = ui.errorBox(), output = h('div', { style: 'display:contents' });
      var stale = function () { result = null; output.textContent = ''; err.hidden = true; };
      var names = form.direction === 'toStar' ? ['Rab (entre A e B)', 'Rbc (entre B e C)', 'Rca (entre C e A)'] : ['Ra (de A ao centro)', 'Rb (de B ao centro)', 'Rc (de C ao centro)'];
      var parse = function () { return { direction: form.direction, values: form.values.map(function (v, i) { return ui.read(v, 'O campo ' + names[i]); }), units: form.units.slice() }; };
      add(main, card(field('Conversão', select([['toStar', 'Triângulo (Δ) → Estrela (Y)'], ['toDelta', 'Estrela (Y) → Triângulo (Δ)']], form.direction, function (v) { form.direction = v; form.values = ['', '', '']; result = null; ui.render(false); })),
        names.map(function (n, i) { var inp = numInput(form.values[i], function (v) { form.values[i] = v; stale(); }); inp.id = 'd' + i; return field(n, inp, select([['Ω', 'Ω'], ['kΩ', 'kΩ'], ['MΩ', 'MΩ']], form.units[i], function (v) { form.units[i] = v; stale(); }, 'Unidade do valor ' + (i + 1))); })),
        err, h('div', { className: 'row' }, btn('Calcular', function () { try { var c = L.delta(parse()); stale(); result = c; paintDelta(output, c); } catch (e) { stale(); ui.showError(err, e); } }, 'primary'),
          btn('Limpar valores', function () { form.values = ['', '', '']; result = null; ui.render(false); })),
        btn('✎ Resolvi sozinho: conferir minhas respostas', function () { try { var c = L.delta(parse()); stale(); ui.checkScreen(c); } catch (e) { ui.showError(err, e); } }), output);
      if (result) paintDelta(output, result);
    });
  }

  /* ---------- circuito livre ---------- */
  var comp = function (type, a, b) { return { type: type, a: a, b: b, value: '', unit: Object.keys(L.NETWORK_UNITS[type])[0] }; };
  function toForm(input) {
    var src = input || L.NETWORK_PRESETS[0].input;
    return { mode: src.mode || 'solve', ground: src.ground || '', terminals: (src.terminals || ['A', 'D']).slice(),
      components: src.components.map(function (c) { return { type: c.type, a: c.a, b: c.b, value: input ? ui.raw(c.value) : '', unit: c.unit }; }) };
  }
  function parse(form) {
    var names = named(form.components);
    var input = { mode: form.mode, components: form.components.map(function (c, i) { return { type: c.type, a: c.a, b: c.b, unit: c.unit, value: ui.read(c.value, 'O campo ' + names[i].name) }; }) };
    if (form.mode === 'req') input.terminals = form.terminals.slice(); else if (form.ground) input.ground = form.ground;
    return input;
  }
  var nodeOptions = function () { return L.NETWORK_NODES.map(function (n) { return [n, n]; }); };

  function paint(output, c) {
    var warn = c.warnings.map(function (w) { return h('p', { className: 'muted' }, '⚠ ' + w); });
    if (c.mode === 'req') {
      var titles = { dangling: 'Retirar ponta solta', parallel: 'Paralelo', series: 'Série', star: 'Estrela → triângulo' };
      add(output, card(h('h2', {}, 'Resistência entre ' + c.terminals[0] + ' e ' + c.terminals[1]), h('div', { className: 'big' }, L.eng(c.Req, 'Ω')), warn), ui.actions(c),
        card(h('h2', {}, 'Circuito original'), graph(c.comps, { terminals: c.terminals })),
        card(h('h2', {}, 'Simplificação passo a passo'), c.reduction.ok ? null : caption('Este circuito não se reduz só com série, paralelo e estrela → triângulo. O valor acima foi obtido pelo método nodal, explicado em "Aprender como foi feito".'),
          c.reduction.steps.map(function (x, i) {
            return h('div', { className: 'stack' }, h('div', { className: 'stephead' }, h('span', { className: 'num' }, String(i + 1)), h('h3', {}, titles[x.type])), h('p', {}, x.text), x.subs.length ? h('div', { className: 'mono' }, x.subs.join('\n')) : null, graph(x.after, { terminals: c.terminals, mark: x.created }));
          })),
        card(h('h2', {}, 'Conferência'), c.checks.map(function (k) { return caption((k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text); })));
      return;
    }
    add(output, card(h('h2', {}, 'Tensões dos nós'), caption('Medidas em relação ao nó ' + c.ground + ' (0 V).'), h('div', { className: 'stats' }, c.nodes.map(function (n) { return h('div', { className: 'stat' }, h('span', {}, 'Nó ' + n), h('b', {}, L.eng(c.voltages[n], 'V'))); })), warn),
      card(h('h2', {}, 'Componentes'), h('div', { className: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Tensão', 'Corrente', 'Potência'].map(function (t) { return h('th', {}, t); }))),
        h('tbody', {}, c.items.map(function (x) { return h('tr', {}, [x.name, L.eng(x.V, 'V'), L.eng(x.I, 'A'), L.eng(x.P, 'W')].map(function (t) { return h('td', {}, t); })); })))),
        caption('Resistores: tensão e corrente positivas vão do primeiro nó para o segundo (veja a ligação). Sinal negativo indica o sentido contrário. Fontes: corrente positiva é a que a fonte fornece; potência positiva significa que ela entrega energia.'), caption(wiring(c.comps)),
        h('p', {}, 'Potência total nos resistores: ' + L.eng(c.P, 'W'))),
      ui.actions(c), card(h('h2', {}, 'Diagrama'), graph(c.comps, { ground: c.ground })),
      card(h('h2', {}, 'Conferência'), c.checks.map(function (k) { return caption((k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text); })));
  }

  function screen(input, autoCalc) {
    var form = toForm(input), result = autoCalc ? L.network(input) : null;
    ui.go('Circuito Livre', function (main) {
      var err = ui.errorBox(), output = h('div', { style: 'display:contents' }), preview = h('div', { className: 'stack' });
      var drawPreview = function () {
        var list = named(form.components).map(function (c, i) { var f = form.components[i]; c.label = f.value.trim() ? f.value.trim().slice(0, 7) + ' ' + f.unit : '?'; return c; });
        preview.textContent = ''; add(preview, graph(list.filter(function (c) { return c.a !== c.b; }), { terminals: form.mode === 'req' ? form.terminals : null }));
      };
      var stale = function () { result = null; output.textContent = ''; err.hidden = true; drawPreview(); };
      var redraw = function () { result = null; ui.render(false); };
      var names = named(form.components);
      var preset = select([['', 'Escolha um modelo…']].concat(L.NETWORK_PRESETS.map(function (p) { return [p.id, p.title]; })), '', function (id) {
        var p = L.NETWORK_PRESETS.filter(function (x) { return x.id === id; })[0]; if (p) { form = toForm(p.input); form.components.forEach(function (c, i) { c.value = ui.raw(p.input.components[i].value); }); redraw(); }
      });
      var rows = form.components.map(function (c, i) {
        var name = names[i].name;
        var type = select([['R', 'Resistor'], ['V', 'Fonte de tensão'], ['I', 'Fonte de corrente']], c.type, function (v) { c.type = v; c.unit = Object.keys(L.NETWORK_UNITS[v])[0]; c.value = ''; redraw(); }, 'Tipo de ' + name);
        var a = select(nodeOptions(), c.a, function (v) { c.a = v; stale(); }, 'Nó 1 de ' + name), b = select(nodeOptions(), c.b, function (v) { c.b = v; stale(); }, 'Nó 2 de ' + name);
        var value = numInput(c.value, function (v) { c.value = v; stale(); }); value.id = 'n' + i;
        var labels = c.type === 'R' ? ['Entre o nó', 'e o nó'] : c.type === 'V' ? ['Polo + no nó', 'Polo − no nó'] : ['Entrega no nó', 'Retira do nó'];
        return h('div', { className: 'group component' }, h('div', { className: 'field' }, h('div', { className: 'grow' }, h('b', {}, name), type),
          h('button', { type: 'button', className: 'x', 'aria-label': 'Remover ' + name, on: { click: function () { form.components.splice(i, 1); redraw(); } } }, '×')),
          h('div', { className: 'pair' }, field(labels[0], a), field(labels[1], b)),
          field('Valor', value, select(Object.keys(L.NETWORK_UNITS[c.type]).map(function (u) { return [u, u]; }), c.unit, function (v) { c.unit = v; stale(); }, 'Unidade de ' + name)));
      });
      var add1 = function (type) { form.components.push(comp(type, 'A', 'B')); redraw(); };
      var full = form.components.length >= L.NETWORK_LIMIT;
      var mode = select([['solve', 'Resolver circuito com fontes'], ['req', 'Resistência entre dois pontos']], form.mode, function (v) {
        form.mode = v; if (v === 'req') form.components = form.components.filter(function (c) { return c.type === 'R'; }); redraw();
      });
      var setup = form.mode === 'req'
        ? h('div', { className: 'pair' }, field('Medir do nó', select(nodeOptions(), form.terminals[0], function (v) { form.terminals[0] = v; stale(); })), field('até o nó', select(nodeOptions(), form.terminals[1], function (v) { form.terminals[1] = v; stale(); })))
        : field('Nó de referência (0 V)', select([['', 'Automático (polo − da fonte)']].concat(nodeOptions()), form.ground, function (v) { form.ground = v; stale(); }));
      add(main,
        card(caption('Para ponte, triângulo, estrela e várias fontes. Dê uma letra a cada ponto de ligação (nó). Pontos unidos por um fio têm a MESMA letra.'), field('O que calcular?', mode), field('Carregar modelo pronto', preset), setup),
        card(h('h2', {}, 'Componentes'), rows, full ? null : h('div', { className: 'row' }, btn('+ Resistor', function () { add1('R'); }, 'small'), form.mode === 'solve' ? [btn('+ Fonte de tensão', function () { add1('V'); }, 'small'), btn('+ Fonte de corrente', function () { add1('I'); }, 'small')] : null)),
        card(h('h2', {}, 'Circuito montado'), preview), err,
        h('div', { className: 'row' }, btn('Calcular', function () {
          try { var c = L.network(parse(form)); stale(); result = c; paint(output, c); output.firstChild.scrollIntoView({ behavior: 'smooth' }); } catch (e) { stale(); ui.showError(err, e); }
        }, 'primary'), btn('Limpar valores', function () { form.components.forEach(function (c) { c.value = ''; }); redraw(); ui.toast('Valores limpos'); })),
        btn('✎ Resolvi sozinho: conferir minhas respostas', function () { try { var c = L.network(parse(form)); stale(); ui.checkScreen(c); } catch (e) { ui.showError(err, e); } }),
        output);
      drawPreview();
      if (result) paint(output, result);
    });
  }

  function problemCard(input) {
    var list = named(input.components);
    var show = list.map(function (c) { return { type: c.type, a: c.a, b: c.b, name: c.name, label: L.fmt(c.value) + ' ' + c.unit }; });
    return card(h('h3', {}, input.mode === 'req' ? 'Ache a resistência entre ' + input.terminals[0] + ' e ' + input.terminals[1] : 'Resolva o circuito (referência: 0 V no polo − de V1)'),
      graph(show, { terminals: input.mode === 'req' ? input.terminals : null, ground: input.mode === 'req' ? null : (input.ground || (list.filter(function (c) { return c.type === 'V'; })[0] || list.filter(function (c) { return c.type === 'I'; })[0]).b) }),
      h('p', {}, list.map(function (c) { return c.name + ' = ' + L.fmt(c.value) + ' ' + c.unit; }).join(' · ')), caption(wiring(list)));
  }

  return { screen: screen, deltaScreen: deltaScreen, stepView: stepView, problemCard: problemCard, deltaDiagrams: deltaDiagrams };
};
