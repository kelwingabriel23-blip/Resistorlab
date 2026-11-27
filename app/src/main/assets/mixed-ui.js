/* Resistor Lab: tela e diagramas dos circuitos mistos. Usa os componentes visuais de app.js. */
window.MixedUI = function (ui) {
  'use strict';
  var L = window.Lab, h = ui.h, btn = ui.btn, card = ui.card, add = ui.add, field = ui.field, select = ui.select, numInput = ui.numInput;
  var wire = ui.wire, txt = ui.txt, source = ui.source;
  var TYPE = { series: 'série', parallel: 'paralelo' };

  /* ---------- desenho: cada nó vira um bloco {w, h, axis, draw(x, y)} ---------- */
  function resistorBlock(label, sub, kind) {
    return { w: 78, h: 54, axis: 25, draw: function (x, y) {
      var m = y + 25, body;
      if (kind) { /* resistor equivalente (grupo já reduzido) */
        body = wire('M' + x + ' ' + m + 'h15M' + (x + 63) + ' ' + m + 'h15') + '<rect x="' + (x + 15) + '" y="' + (m - 11) + '" width="48" height="22" rx="6" fill="' + (kind === 'new' ? '#2f7bff' : '#2f7bff33') + '" stroke="#25e3ff" stroke-width="2"/>' + txt(x + 39, m + 4, label, '#ffffff');
        return body + txt(x + 39, m + 25, sub, '#8fa8cc');
      }
      return wire('M' + x + ' ' + m + 'h13h6l4 -9l8 18l8 -18l8 18l8 -18l4 9h6h13') + txt(x + 39, m - 14, label) + txt(x + 39, m + 23, sub, '#8fa8cc');
    } };
  }
  function seriesBlock(list) {
    if (!list.length) return { w: 40, h: 20, axis: 10, draw: function (x, y) { return wire('M' + x + ' ' + (y + 10) + 'h40'); } };
    var axis = Math.max.apply(null, list.map(function (b) { return b.axis; }));
    var below = Math.max.apply(null, list.map(function (b) { return b.h - b.axis; }));
    return { w: list.reduce(function (a, b) { return a + b.w; }, 0), h: axis + below, axis: axis, draw: function (x, y) {
      var out = ''; list.forEach(function (b) { out += b.draw(x, y + axis - b.axis); x += b.w; }); return out;
    } };
  }
  function parallelBlock(list) {
    if (list.length < 2) return seriesBlock(list);
    var inner = Math.max.apply(null, list.map(function (b) { return b.w; })), w = inner + 28, at = [], height = 0;
    list.forEach(function (b) { at.push(height); height += b.h + 6; });
    var first = at[0] + list[0].axis, last = at[list.length - 1] + list[list.length - 1].axis, axis = (first + last) / 2;
    return { w: w, h: height - 6, axis: axis, draw: function (x, y) {
      var left = x + 10, right = x + w - 10;
      var out = wire('M' + left + ' ' + (y + first) + 'V' + (y + last) + 'M' + right + ' ' + (y + first) + 'V' + (y + last) + 'M' + x + ' ' + (y + axis) + 'H' + left + 'M' + right + ' ' + (y + axis) + 'H' + (x + w));
      list.forEach(function (b, i) {
        var bx = x + 14 + (inner - b.w) / 2, m = y + at[i] + b.axis;
        out += wire('M' + left + ' ' + m + 'H' + bx + 'M' + (bx + b.w) + ' ' + m + 'H' + right) + b.draw(bx, y + at[i]);
      });
      [left, right].forEach(function (cx) { out += '<circle cx="' + cx + '" cy="' + (y + axis) + '" r="3" fill="#25e3ff"/>'; });
      return out;
    } };
  }
  function highlight(b, label) {
    var w = Math.max(b.w + 8, label.length * 7 + 12);
    return { w: w, h: b.h + 24, axis: b.axis + 18, draw: function (x, y) {
      var dx = x + (w - b.w) / 2, m = y + b.axis + 18;
      return '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (w - 4) + '" height="' + (b.h + 20) + '" rx="10" fill="#25e3ff14" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="5 4"/>' +
        txt(x + w / 2, y + 14, label, '#ffffff') + wire('M' + x + ' ' + m + 'H' + dx + 'M' + (dx + b.w) + ' ' + m + 'H' + (x + w)) + b.draw(dx, y + 18);
    } };
  }
  function svg(block, label) {
    var x0 = 44, y0 = 8, axis = y0 + block.axis, bottom = Math.max(y0 + block.h + 12, axis + 48), W = x0 + block.w + 24, H = bottom + 10, mid = (axis + bottom) / 2;
    var body = wire('M20 ' + (mid - 4) + 'V' + axis + 'H' + x0) + block.draw(x0, y0) + wire('M' + (x0 + block.w) + ' ' + axis + 'h12V' + bottom + 'H20V' + (mid + 4)) + source(20, mid);
    return h('div', { className: 'diagram scroll', tabIndex: 0, html: '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '" style="max-width:100%;height:auto;min-width:' + Math.round(W * 0.76) + 'px">' + body + '</svg>' });
  }
  var wrap = function (type, list) { return type === 'series' ? seriesBlock(list) : parallelBlock(list); };

  /* Circuito calculado depois de `stage` reduções. `mark` destaca o grupo que será calculado. */
  function stageDiagram(c, stage, mark, fresh) {
    function block(node) {
      if (node.type === 'R') return resistorBlock(node.name, L.eng(node.R, 'Ω', 3));
      if (node.k < stage) return resistorBlock(node.name, L.eng(node.R, 'Ω', 3), node.k === fresh ? 'new' : 'old');
      var b = wrap(node.type, node.items.map(block));
      return node.k === mark ? highlight(b, node.name + ' (' + TYPE[node.type] + ')') : b;
    }
    return svg(block(c.top), 'Circuito misto' + (stage ? ' após ' + stage + ' redução(ões)' : ' original') + ': ' + c.expression);
  }
  function caption(t) { return h('p', { className: 'muted' }, t); }
  function stepView(c, v) {
    if (v.reduce !== undefined) {
      var g = c.order[v.reduce];
      return h('div', { className: 'stack' }, caption('Antes: o grupo destacado é calculado agora.'), stageDiagram(c, v.reduce, v.reduce),
        caption('Depois: o grupo virou o resistor ' + g.name + '.'), stageDiagram(c, v.reduce + 1, null, v.reduce));
    }
    if (v.expand !== undefined) return h('div', { className: 'stack' }, caption('Diagrama desta volta: veja o trecho destacado.'), stageDiagram(c, v.expand, v.expand));
    return h('div', { className: 'stack' }, caption(v.stage ? 'Circuito totalmente simplificado.' : 'Circuito original.'), stageDiagram(c, v.stage));
  }

  /* Desenho do circuito enquanto é montado ou em um exercício. */
  function inputDiagram(tree, show) {
    var n = 0;
    function block(node) {
      if (node.type === 'R') { n++; return resistorBlock('R' + n, show(node)); }
      return wrap(node.type, node.items.map(block));
    }
    return svg(block(tree), 'Diagrama do circuito misto montado');
  }
  function inputText(tree) {
    var n = 0;
    return (function walk(node, nested) {
      if (node.type === 'R') return 'R' + (++n);
      var t = node.items.map(function (x) { return walk(x, true); }).join(node.type === 'series' ? ' + ' : ' ∥ ');
      return nested ? '(' + t + ')' : t;
    })(tree);
  }
  function problemCard(input) {
    var list = [];
    (function walk(x) { if (x.type === 'R') list.push('R' + (list.length + 1) + ' = ' + L.fmt(x.value) + ' ' + x.unit); else x.items.forEach(walk); })(input.tree);
    return card(h('h3', {}, 'Circuito misto'), inputDiagram(input.tree, function (x) { return L.fmt(x.value) + ' ' + x.unit; }),
      h('p', {}, 'Ligação: ' + inputText(input.tree)), h('p', {}, list.join(' · ')),
      input.known === 'none' ? null : h('p', {}, input.known === 'V' ? 'Tensão da fonte: ' + L.fmt(input.source) + ' V' : 'Corrente total: ' + L.fmt(input.source) + ' A'));
  }

  /* ---------- estado do formulário ---------- */
  var res = function () { return { type: 'R', value: '', unit: 'Ω' }; };
  var group = function (type) { return { type: type, items: [res(), res()] }; };
  var blankForm = function () { return { tree: { type: 'series', items: [res(), group('parallel')] }, known: 'V', source: '' }; };
  function toForm(input) {
    if (!input) return blankForm();
    var copy = function (x) { return x.type === 'R' ? { type: 'R', value: ui.raw(x.value), unit: x.unit || 'Ω' } : { type: x.type, items: x.items.map(copy) }; };
    return { tree: copy(input.tree), known: input.known, source: input.known === 'none' ? '' : ui.raw(input.source) };
  }
  function parse(form) {
    var n = 0;
    var tree = (function walk(x) {
      if (x.type === 'R') { n++; return { type: 'R', value: ui.read(x.value, 'O campo R' + n), unit: x.unit }; }
      return { type: x.type, items: x.items.map(walk) };
    })(form.tree);
    var input = { tree: tree, known: form.known };
    if (form.known !== 'none') input.source = ui.read(form.source, form.known === 'V' ? 'O campo da tensão' : 'O campo da corrente');
    return input;
  }
  var count = function (x) { return x.type === 'R' ? 1 : x.items.reduce(function (a, y) { return a + count(y); }, 0); };

  /* ---------- resultado ---------- */
  function paint(output, c) {
    var stats = c.I === null ? null : h('div', { className: 'stats' }, [['Tensão total', L.eng(c.V, 'V')], ['Corrente total', L.eng(c.I, 'A')], ['Potência total', L.eng(c.P, 'W')], ['Resistores', String(c.items.length)]].map(function (s) { return h('div', { className: 'stat' }, h('span', {}, s[0]), h('b', {}, s[1])); }));
    var table = c.I === null ? caption('Informe a tensão ou a corrente para ver os valores de cada resistor.') :
      h('div', { className: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Tensão', 'Corrente', 'Potência'].map(function (t) { return h('th', {}, t); }))),
        h('tbody', {}, c.items.map(function (x) { return h('tr', {}, [x.name, L.eng(x.V, 'V'), L.eng(x.I, 'A'), L.eng(x.P, 'W')].map(function (t) { return h('td', {}, t); })); }))));
    add(output,
      card(h('h2', {}, 'Resistência equivalente'), h('div', { className: 'big' }, L.eng(c.Req, 'Ω')), stats, table,
        c.pure ? caption('Este circuito usa apenas ligações em ' + TYPE[c.top.type] + '. O resultado vale, e você também pode usar a calculadora de ' + TYPE[c.top.type] + '.') : null),
      ui.actions(c),
      card(h('h2', {}, 'Circuito original'), caption('Deslize para o lado se o desenho não couber na tela.'), stageDiagram(c, 0)),
      card(h('h2', {}, 'Simplificação passo a passo'), caption('Calcule na ordem abaixo, dos grupos mais internos para o circuito principal.'),
        c.order.map(function (g, k) {
          var names = g.items.map(function (x) { return x.name; }).join(g.type === 'series' ? ' + ' : ' ∥ ');
          return h('div', { className: 'stack' }, h('div', { className: 'stephead' }, h('span', { className: 'num' }, String(k + 1)), h('h3', {}, 'Calcular ' + g.name + ' (' + TYPE[g.type] + ')')),
            stageDiagram(c, k, k, k - 1), h('div', { className: 'formula' }, g.name + ' = ' + names + ' = ' + L.eng(g.R, 'Ω')));
        }),
        h('div', { className: 'stack' }, h('h3', {}, 'Circuito simplificado'), stageDiagram(c, c.order.length, null, c.order.length - 1))),
      card(h('h2', {}, 'Conferência'), c.checks.map(function (k) { return caption((k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text); })));
  }

  /* ---------- tela da calculadora ---------- */
  function screen(input, autoCalc) {
    var form = toForm(input), result = autoCalc ? L.mixed(input) : null;
    ui.go('Circuito Misto', function (main) {
      var err = ui.errorBox(), output = h('div', { style: 'display:contents' }), preview = h('div', { className: 'stack' });
      var drawPreview = function () {
        preview.textContent = '';
        add(preview, inputDiagram(form.tree, function (x) { return x.value.trim() ? x.value.trim().slice(0, 8) + ' ' + x.unit : '?'; }), h('p', { className: 'formula' }, inputText(form.tree)));
      };
      var stale = function () { result = null; output.textContent = ''; err.hidden = true; drawPreview(); };
      var redraw = function () { result = null; ui.render(false); };
      var total = count(form.tree), full = total >= L.MIXED_LIMITS.resistors, number = 0;

      function editor(g, depth, parent) {
        var kind = select([['series', 'Em série'], ['parallel', 'Em paralelo']], g.type, function (v) { g.type = v; redraw(); }, depth ? 'Tipo do subgrupo' : 'Tipo do circuito principal');
        var armed = false;
        var remove = parent ? btn('Remover grupo', function () {
          if (!armed) { armed = true; remove.textContent = 'Toque de novo para remover'; return; }
          parent.items.splice(parent.items.indexOf(g), 1); redraw();
        }, 'small') : null;
        var children = g.items.map(function (x) {
          if (x.type !== 'R') return editor(x, depth + 1, g);
          var n = ++number, unit = select([['Ω', 'Ω'], ['kΩ', 'kΩ'], ['MΩ', 'MΩ']], x.unit, function (v) { x.unit = v; stale(); }, 'Unidade de R' + n);
          var rm = h('button', { type: 'button', className: 'x', 'aria-label': 'Remover R' + n, on: { click: function () { g.items.splice(g.items.indexOf(x), 1); redraw(); } } }, '×');
          var inp = numInput(x.value, function (v) { x.value = v; stale(); }); inp.id = 'm' + n;
          return field('R' + n, inp, [unit, rm]);
        });
        var push = function (item) { g.items.push(item); redraw(); };
        var adders = h('div', { className: 'row' },
          full ? null : btn('+ Resistor', function () { push(res()); }, 'small add-r'),
          depth + 1 < L.MIXED_LIMITS.depth && total + 2 <= L.MIXED_LIMITS.resistors ? [btn('+ Grupo série', function () { push(group('series')); }, 'small add-s'), btn('+ Grupo paralelo', function () { push(group('parallel')); }, 'small add-p')] : null);
        return h('div', { className: depth ? 'group ' + g.type : 'stack', 'data-depth': depth },
          field(depth ? 'Subgrupo: seus itens ficam' : 'Circuito principal: os itens ficam', kind), children, adders, remove);
      }

      var known = select([['V', 'Tensão da fonte (V)'], ['I', 'Corrente total (A)'], ['none', 'Só a resistência total']], form.known, function (v) { form.known = v; form.source = ''; redraw(); });
      add(main,
        card(h('h2', {}, 'Monte o circuito'), caption('Cada grupo liga seus itens em série ou em paralelo. Um grupo pode conter outros grupos e vale como um único item no grupo de fora.'), editor(form.tree, 0, null)),
        card(h('h2', {}, 'Circuito montado'), preview),
        card(field('O que você conhece?', known), form.known === 'none' ? null : field(form.known === 'V' ? 'Tensão em volts (V)' : 'Corrente em ampères (A). Ex.: 20 mA = 0,02', numInput(form.source, function (v) { form.source = v; stale(); }))),
        err,
        h('div', { className: 'row' },
          btn('Calcular', function () {
            try { var c = L.mixed(parse(form)); stale(); result = c; paint(output, c); output.firstChild.scrollIntoView({ behavior: 'smooth' }); } catch (e) { stale(); ui.showError(err, e); }
          }, 'primary'),
          btn('Limpar valores', function () { form = blankForm(); redraw(); ui.toast('Valores limpos'); })),
        btn('✎ Resolvi sozinho: conferir minhas respostas', function () {
          try { var c = L.mixed(parse(form)); stale(); ui.checkScreen(c); } catch (e) { ui.showError(err, e); }
        }),
        output);
      drawPreview();
      if (result) paint(output, result);
    });
  }

  function examplesCard() {
    return card(h('h2', {}, 'Exemplos de circuitos mistos'), L.MIXED_EXAMPLES.map(function (e) {
      return card(h('h3', {}, 'Nível ' + e.level + ': ' + e.title),
        h('div', { className: 'row' }, btn('Ver aula', function () { ui.lessonScreen(L.mixed(e.input)); }, 'small learn'), btn('Abrir na calculadora', function () { screen(e.input, true); }, 'small')));
    }));
  }

  return { screen: screen, stepView: stepView, problemCard: problemCard, examplesCard: examplesCard };
};
