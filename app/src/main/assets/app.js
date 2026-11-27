/* Resistor Lab: telas e navegação. */
(function () {
  'use strict';
  var L = window.Lab, $ = function (s) { return document.querySelector(s); };

  /* ---------- armazenamento local ---------- */
  var memory = {};
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('rl.' + k); return v === null ? (k in memory ? memory[k] : d) : JSON.parse(v); } catch (e) { return k in memory ? memory[k] : d; } },
    set: function (k, v) { memory[k] = v; try { localStorage.setItem('rl.' + k, JSON.stringify(v)); } catch (e) { toast('Não foi possível gravar no aparelho.'); } }
  };
  var beginner = function () { return store.get('beginner', true); };

  /* ---------- ajudantes de tela ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'on') Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
      else if (k === 'html') el.innerHTML = v; /* só para SVG gerado pelo próprio app */
      else if (k in el && k !== 'list') el[k] = v; else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'object' ? c : document.createTextNode(c));
  }
  function btn(text, fn, cls) { return h('button', { type: 'button', className: 'btn ' + (cls || ''), on: { click: fn } }, text); }
  function card() { return h('section', { className: 'card' }, [].slice.call(arguments)); }
  var toastTimer;
  function toast(t) { var el = $('#toast'); el.textContent = t; el.className = 'show'; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = ''; }, 1800); }
  var uid = 0;
  function field(labelText, input, extra) {
    input.id = input.id || 'f' + (++uid);
    return h('div', { className: 'field' }, h('div', { className: 'grow' }, h('label', { htmlFor: input.id }, labelText), input), extra);
  }
  function select(options, value, onchange, aria) {
    var s = h('select', { 'aria-label': aria, on: { change: function () { onchange(s.value); } } }, options.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    s.value = value; return s;
  }
  function numInput(value, onInput) {
    var i = h('input', { type: 'text', inputMode: 'decimal', autocomplete: 'off', value: value || '', placeholder: 'Ex.: 4,7', on: { input: function () { onInput(i.value); } } });
    return i;
  }
  function read(text, name) {
    var r = L.parseNumber(text);
    if (!r.ok) throw new Error(name + ' ' + r.error);
    return r.value;
  }
  function errorBox() { return h('div', { className: 'error', role: 'alert', hidden: true }); }
  function showError(box, e) { box.textContent = e.message; box.hidden = false; box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  var raw = function (x) { return L.fmt(x, 12).replace(/\./g, ''); };

  /* ---------- navegação ---------- */
  var stack = [];
  function render(animate) {
    var s = stack[stack.length - 1], main = $('#screen');
    main.textContent = ''; main.className = animate ? 'enter' : '';
    $('#title').textContent = s.title; $('#back').hidden = stack.length === 1;
    s.draw(main);
  }
  function go(title, draw) { if (stack.length) stack[stack.length - 1].y = window.scrollY; stack.push({ title: title, draw: draw }); render(true); window.scrollTo(0, 0); }
  function back() { if (stack.length < 2) return false; stack.pop(); render(true); window.scrollTo(0, stack[stack.length - 1].y || 0); return true; }
  window.appBack = back; /* usado pelo botão Voltar do Android */
  $('#back').addEventListener('click', back);
  function add(main) { append(main, [].slice.call(arguments, 1)); }

  /* ---------- circuitos mistos (mixed-ui.js) ---------- */
  var Mixed = window.MixedUI({ h: h, btn: btn, card: card, add: add, field: field, select: select, numInput: numInput, read: read, errorBox: errorBox, showError: showError, raw: raw, toast: toast,
    go: go, render: render, wire: wire, txt: txt, source: source, actions: actions, lessonScreen: lessonScreen, checkScreen: checkScreen });

  var Net = window.NetworkUI({ h: h, btn: btn, card: card, add: add, field: field, select: select, numInput: numInput, read: read, errorBox: errorBox, showError: showError, raw: raw, toast: toast,
    go: go, render: render, wire: wire, txt: txt, actions: actions, checkScreen: checkScreen });
  var Teacher = window.AIUI({ h: h, btn: btn, card: card, add: add, field: field, select: select, errorBox: errorBox, showError: showError, toast: toast, store: store, go: go, render: render });

  /* ---------- diagramas ---------- */
  function zig(x, y) { return 'M' + x + ' ' + y + 'h6l4 -9l8 18l8 -18l8 18l8 -18l4 9h6'; } /* largura 52 */
  function txt(x, y, t, color) { return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="11" font-family="monospace" fill="' + (color || '#e6f1ff') + '">' + t + '</text>'; }
  function wire(d, color) { return '<path d="' + d + '" fill="none" stroke="' + (color || '#25e3ff') + '" stroke-width="2" stroke-linejoin="round"/>'; }
  function source(x, y) { return wire('M' + (x - 11) + ' ' + (y - 4) + 'h22M' + (x - 6) + ' ' + (y + 4) + 'h12', '#e6f1ff') + txt(x + 21, y - 4, '+') + txt(x + 21, y + 13, '−'); }
  function diagram(type, labels) {
    var n = labels.length, body = '', W, H;
    if (type === 'series') {
      var per = 3, rows = Math.ceil(n / per), cw = 82, left = 44, rh = 62;
      W = left + per * cw + 24; H = rows * rh + 44;
      var endX = left + per * cw, d = 'M20 30H' + left;
      for (var r = 0; r < rows; r++) {
        var y = 30 + r * rh, rev = r % 2 === 1;
        for (var c = 0; c < per; c++) {
          var i = r * per + (rev ? per - 1 - c : c), x = left + c * cw;
          if (i < n) { body += wire('M' + x + ' ' + y + 'h15' + zig(x + 15, y).replace(/^M[^h]+/, '') + 'h15') + txt(x + 41, y - 15, 'R' + (i + 1)) + txt(x + 41, y + 22, labels[i], '#8fa8cc'); }
          else body += wire('M' + x + ' ' + y + 'h' + cw);
        }
        if (r < rows - 1) body += wire('M' + (rev ? left : endX) + ' ' + y + 'v' + rh);
      }
      var lastY = 30 + (rows - 1) * rh, endsRight = (rows - 1) % 2 === 0, bottom = H - 8;
      var low = endsRight ? bottom : lastY, mid = (30 + low) / 2;
      body += wire(d) + wire(endsRight ? 'M' + endX + ' ' + lastY + 'h14V' + bottom + 'H20V' + (mid + 4) : 'M' + left + ' ' + lastY + 'H20V' + (mid + 4)) + wire('M20 30V' + (mid - 4)) + source(20, mid);
    } else {
      var gap = 74, first = 92; W = first + (n - 1) * gap + 44; H = 150;
      var lastX = first + (n - 1) * gap;
      body += wire('M24 68V20H' + lastX) + wire('M24 76V132H' + lastX) + source(24, 72);
      labels.forEach(function (lab, i) {
        var x = first + i * gap;
        body += wire('M' + x + ' 20v26l-9 4l18 8l-18 8l18 8l-18 8l18 8l-9 4v38') + txt(x + 25, 64, 'R' + (i + 1)) + txt(x, 147, lab, '#8fa8cc') + '<circle cx="' + x + '" cy="20" r="3" fill="#25e3ff"/><circle cx="' + x + '" cy="132" r="3" fill="#25e3ff"/>';
      });
    }
    var desc = 'Diagrama de ' + n + ' resistores em ' + (type === 'series' ? 'série' : 'paralelo');
    return h('div', { className: 'diagram scroll', html: '<svg width="' + W + '" height="' + (H + 6) + '" viewBox="0 0 ' + W + ' ' + (H + 6) + '" role="img" aria-label="' + desc + '" style="' + (type === 'series' ? 'max-width:100%;height:auto' : '') + '">' + body + '</svg>' });
  }

  /* ---------- histórico e salvos ---------- */
  function describe(c) {
    if (c.kind === 'network') return c.mode === 'req' ? { name: 'Livre · entre ' + c.terminals.join(' e '), summary: 'Req = ' + L.eng(c.Req, 'Ω') } : { name: 'Livre · ' + c.items.length + ' componentes', summary: 'Potência nos resistores = ' + L.eng(c.P, 'W') };
    if (c.kind === 'delta') return { name: c.direction === 'toStar' ? 'Triângulo → Estrela' : 'Estrela → Triângulo', summary: c.names.map(function (n, i) { return n + ' = ' + L.eng(c.values[i], 'Ω'); }).join(' · ') };
    if (c.kind === 'mixed') return { name: 'Misto · ' + c.items.length + ' resistores', summary: 'Req = ' + L.eng(c.Req, 'Ω') + (c.I !== null ? ' · I = ' + L.eng(c.I, 'A') : '') };
    if (c.kind === 'series' || c.kind === 'parallel') return { name: (c.kind === 'series' ? 'Série' : 'Paralelo') + ' · ' + c.ohms.length + ' resistor(es)', summary: 'Req = ' + L.eng(c.Req, 'Ω') + (c.I !== null ? ' · I = ' + L.eng(c.I, 'A') : '') };
    var t = c.kind === 'ohm' ? c.target : 'P';
    return { name: c.kind === 'ohm' ? 'Lei de Ohm' : 'Potência', summary: t + ' = ' + L.eng(c.values[t], L.QTY[t].unit) };
  }
  function record(c) {
    var d = describe(c), entry = { kind: c.kind, input: c.input, name: d.name, summary: d.summary, at: Date.now() };
    var key = function (e) { return e.kind + JSON.stringify(e.input); };
    var list = store.get('history', []).filter(function (e) { return key(e) !== key(entry); });
    list.unshift(entry); store.set('history', list.slice(0, 50));
    return entry;
  }
  function recompute(e) {
    if (e.kind === 'network') return L.network(e.input);
    if (e.kind === 'delta') return L.delta(e.input);
    if (e.kind === 'mixed') return L.mixed(e.input);
    if (e.kind === 'ohm') return L.ohm(e.input.target, e.input.values);
    if (e.kind === 'power') return L.power(e.input.mode, e.input.a, e.input.b);
    return L.circuit(e.kind, e.input);
  }
  function actions(c) {
    var entry = record(c);
    var name = h('input', { type: 'text', maxLength: 60, value: entry.name });
    var saveArea = h('div', { className: 'card', hidden: true }, field('Nome do cálculo', name), btn('Confirmar e salvar', function () {
      var s = store.get('saved', []);
      s.unshift({ kind: entry.kind, input: entry.input, name: name.value.trim() || entry.name, summary: entry.summary, at: Date.now() });
      store.set('saved', s); saveArea.hidden = true; toast('Cálculo salvo');
    }, 'primary'));
    return [btn('🎓 Aprender como foi feito', function () { lessonScreen(c); }, 'learn'), btn('Salvar cálculo', function () { saveArea.hidden = !saveArea.hidden; }), saveArea];
  }

  /* ---------- início ---------- */
  function mini(type) {
    var r = function (x, y) { return zig(x, y).replace(/^M[^h]+/, 'M' + x + ' ' + y); };
    var p = type === 'network' ? wire('M4 30L59 4L114 30L59 56ZM59 4V19l-5 3l10 5l-10 5l10 5l-5 3V56') : type === 'mixed' ? wire(r(2, 30) + 'M54 30h8M62 14v32M114 14v32M114 30h4' + r(62, 14) + r(62, 46)) : type === 'series' ? wire('M2 30h8' + zig(10, 30).replace(/^M[^h]+/, '') + 'h4' + zig(66, 30).replace(/^M[^h]+/, '').replace(/h6$/, 'h2')) : wire('M2 30h14V14h8' + zig(24, 14).replace(/^M[^h]+/, '') + 'h8v32h-8M16 30v16h8' + zig(24, 46).replace(/^M[^h]+/, '') + 'M84 30h14');
    return h('div', { html: '<svg viewBox="0 0 118 60" aria-hidden="true">' + p + '</svg>', style: 'width:96px;flex:none' });
  }
  function hero(type, title, sub) {
    return h('button', { type: 'button', className: 'hero', on: { click: function () { if (type === 'mixed') Mixed.screen(); else if (type === 'network') Net.screen(); else circuitScreen(type); } } }, mini(type), h('div', {}, h('b', {}, title), h('span', {}, sub)));
  }
  function tile(icon, title, sub, fn) { return h('button', { type: 'button', className: 'tile', on: { click: fn } }, h('i', {}, icon), h('b', {}, title), h('span', {}, sub)); }
  function home(main) {
    add(main, h('p', { className: 'muted' }, 'Calcule circuitos resistivos e aprenda cada passo.'),
      hero('series', 'Circuito em Série', 'Um único caminho para a corrente'),
      hero('parallel', 'Circuito em Paralelo', 'A corrente se divide em ramos'),
      hero('mixed', 'Circuito Misto', 'Série e paralelo no mesmo circuito'),
      hero('network', 'Circuito Livre', 'Ponte, triângulo, estrela e várias fontes'),
      h('div', { className: 'grid' },
        tile('🎓', 'Professor de Cálculos', 'Exemplos, desafios e correção', professorScreen),
        tile('?', 'Aprender', 'Fórmulas e eletrônica básica', learnScreen),
        tile('V=RI', 'Lei de Ohm', 'Tensão, corrente, resistência', ohmScreen),
        tile('W', 'Potência', 'Calcule watts', powerScreen),
        tile('kΩ', 'Conversor', 'Ω, kΩ e MΩ', converterScreen),
        tile('Δ↔Y', 'Triângulo e Estrela', 'Conversão com passos', function () { Net.deltaScreen(); }),
        tile('IA', 'Professor com IA', 'Opcional, usa internet', function () { Teacher.screen(); }),
        tile('↺', 'Histórico', 'Recentes e salvos', function () { historyScreen('history'); })));
  }

  /* ---------- calculadoras de série e paralelo ---------- */
  function blank() { return { value: '', unit: 'Ω' }; }
  function formFrom(input) {
    if (!input) return { rows: [blank(), blank()], known: 'V', source: '' };
    return { rows: input.resistors.map(function (r) { return { value: raw(r.value), unit: r.unit }; }), known: input.known, source: input.known === 'none' ? '' : raw(input.source) };
  }
  function parseForm(form) {
    var input = {
      resistors: form.rows.map(function (r, i) { return { value: read(r.value, 'O campo R' + (i + 1)), unit: r.unit }; }),
      known: form.known
    };
    if (form.known !== 'none') input.source = read(form.source, form.known === 'V' ? 'O campo da tensão' : 'O campo da corrente');
    return input;
  }
  function circuitScreen(type, input, autoCalc) {
    var form = formFrom(input), result = null, focusLast = false;
    var title = type === 'series' ? 'Circuito em Série' : 'Circuito em Paralelo';
    if (autoCalc) result = L.circuit(type, input);
    go(title, function draw(main) {
      var err = errorBox(), output = h('div', { style: 'display:contents' });
      var stale = function () { result = null; output.textContent = ''; err.hidden = true; };
      var redraw = function () { result = null; render(false); };
      var rows = form.rows.map(function (r, i) {
        var unit = select([['Ω', 'Ω'], ['kΩ', 'kΩ'], ['MΩ', 'MΩ']], r.unit, function (v) { r.unit = v; stale(); }, 'Unidade de R' + (i + 1));
        var rm = h('button', { type: 'button', className: 'x', 'aria-label': 'Remover R' + (i + 1), disabled: form.rows.length === 1, on: { click: function () { form.rows.splice(i, 1); redraw(); } } }, '×');
        var inp = numInput(r.value, function (v) { r.value = v; stale(); }); inp.id = 'r' + i;
        var f = field('R' + (i + 1), inp, [unit, rm]); return f;
      });
      var known = select([['V', 'Tensão da fonte (V)'], ['I', 'Corrente total (A)'], ['none', 'Só a resistência total']], form.known, function (v) { form.known = v; form.source = ''; redraw(); });
      add(main,
        card(h('h2', {}, 'Resistores'), rows, btn('+ Adicionar resistor', function () { form.rows.push(blank()); focusLast = true; redraw(); })),
        card(field('O que você conhece?', known), form.known === 'none' ? null : field(form.known === 'V' ? 'Tensão em volts (V)' : 'Corrente em ampères (A). Ex.: 20 mA = 0,02', numInput(form.source, function (v) { form.source = v; stale(); }))),
        err,
        h('div', { className: 'row' },
          btn('Calcular', function () {
            try { result = L.circuit(type, parseForm(form)); err.hidden = true; output.textContent = ''; paint(output, result); output.firstChild.scrollIntoView({ behavior: 'smooth' }); } catch (e) { stale(); showError(err, e); }
          }, 'primary'),
          btn('Limpar valores', function () { form = formFrom(null); redraw(); toast('Valores limpos'); })),
        btn('✎ Resolvi sozinho: conferir minhas respostas', function () {
          try { var c = L.circuit(type, parseForm(form)); stale(); checkScreen(c); } catch (e) { showError(err, e); }
        }),
        output);
      if (result) paint(output, result);
      if (focusLast) { focusLast = false; setTimeout(function () { var el = $('#r' + (form.rows.length - 1)); if (el) el.focus(); }, 0); }
    });
  }
  function paint(output, c) {
    var labels = c.ohms.map(function (r) { return L.eng(r, 'Ω', 3); });
    var stats = c.I === null ? null : h('div', { className: 'stats' }, [['Tensão total', L.eng(c.V, 'V')], ['Corrente total', L.eng(c.I, 'A')], ['Potência total', L.eng(c.P, 'W')], ['Resistores', String(c.ohms.length)]].map(function (s) { return h('div', { className: 'stat' }, h('span', {}, s[0]), h('b', {}, s[1])); }));
    var table = c.I === null ? h('p', { className: 'muted' }, 'Informe a tensão ou a corrente para ver os valores de cada resistor.') :
      h('div', { className: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Tensão', 'Corrente', 'Potência'].map(function (t) { return h('th', {}, t); }))),
        h('tbody', {}, c.items.map(function (x, i) { return h('tr', {}, [h('td', {}, 'R' + (i + 1)), h('td', {}, L.eng(x.V, 'V')), h('td', {}, L.eng(x.I, 'A')), h('td', {}, L.eng(x.P, 'W'))]); }))));
    add(output,
      card(h('h2', {}, 'Resistência ' + (c.kind === 'series' ? 'total' : 'equivalente')), h('div', { className: 'big' }, L.eng(c.Req, 'Ω')), stats, table),
      actions(c),
      card(h('h2', {}, 'Diagrama'), diagram(c.kind, labels)),
      card(h('h2', {}, 'Conferência'), c.checks.map(function (k) { return h('p', { className: 'muted' }, (k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text); })));
  }

  /* ---------- Professor: aula passo a passo ---------- */
  function divisionBlock(d) {
    var r = L.longDivision(d[0], d[1]);
    return h('details', {}, h('summary', {}, 'Como dividir ' + r.title), h('div', { className: 'mono' }, r.lines.join('\n')));
  }
  function lessonScreen(c) {
    var steps = L.lesson(c), log = [], aiHistory = [], pending = false, current = 0;
    go('Aprender como foi feito', function (main) {
      var chatBox = h('div', { style: 'display:flex;flex-direction:column;gap:8px', 'aria-live': 'polite' });
      var stepSel = select(steps.map(function (s, i) { return [String(i), 'Passo ' + (i + 1) + ': ' + s.title]; }), String(current), function (v) { current = +v; }, 'Passo da dúvida');
      var question = h('input', { type: 'text', maxLength: 200, placeholder: 'Ex.: por que usar essa fórmula?' });
      function bubble(m) { m.el = h('div', { className: 'chat ' + m[0] }, m[1]); chatBox.appendChild(m.el); }
      function send(q) {
        if (!q.trim()) return;
        if (Teacher.active()) return sendToAI(q);
        var a = [['me', 'Passo ' + (current + 1) + ': ' + q], ['prof', L.ask(q, steps, current)]];
        a.forEach(function (m) { log.push(m); bubble(m); });
        question.value = ''; chatBox.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      function sendToAI(q) {
        if (pending) { toast('Aguarde a resposta anterior'); return; }
        pending = true;
        var index = current, mine = ['me', 'Passo ' + (index + 1) + ': ' + q], reply = ['prof', '🤖 Pensando…'];
        [mine, reply].forEach(function (m) { log.push(m); bubble(m); });
        question.value = ''; reply.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        Teacher.ask({ steps: steps, index: index, question: q, history: aiHistory, beginner: beginner() }, function (r) {
          pending = false;
          if (r.ok) aiHistory.push({ q: q, a: r.text });
          reply[1] = r.ok ? '🤖 Resposta da IA (pode errar; confira com os passos):\n' + r.text : '⚠ ' + r.error + '\n\nResposta do professor offline:\n' + L.ask(q, steps, index);
          reply.el.textContent = reply[1];
        });
      }
      var toggle = h('input', { type: 'checkbox', id: 'beg', checked: beginner(), on: { change: function () { store.set('beginner', toggle.checked); render(false); } } });
      var chat = card(h('h2', {}, 'Pergunte ao professor'), h('p', { className: 'muted' }, Teacher.active() ? '🤖 IA ligada: cada pergunta usa a internet, envia este cálculo à Anthropic e gera custo na sua conta.' : 'Funciona sem internet. Responde dúvidas sobre as etapas deste cálculo e conceitos básicos.'), btn(Teacher.active() ? 'Ajustes da IA' : 'Quer fazer perguntas livres? Professor com IA', function () { Teacher.screen(); }, 'small'), field('Sobre qual passo?', stepSel),
        h('div', { className: 'chips' }, ['Não entendi', 'Por que essa fórmula?', 'O que significa cada letra?', 'De onde vieram os números?', 'Como fazer a divisão?'].concat(c.kind === 'mixed' || c.kind === 'network' ? ['Qual calcular primeiro?'] : []).map(function (q) { return btn(q, function () { send(q); }, 'small'); })),
        chatBox, h('form', { className: 'field', on: { submit: function (e) { e.preventDefault(); send(question.value); } } }, h('div', { className: 'grow' }, question), h('button', { type: 'submit', className: 'btn primary' }, 'Enviar')));
      add(main, h('div', { className: 'switch card', style: 'flex-direction:row' }, toggle, h('label', { htmlFor: 'beg' }, 'Modo iniciante (linguagem simples)')));
      if (c.kind === 'series' || c.kind === 'parallel') add(main, card(diagram(c.kind, c.ohms.map(function (r) { return L.eng(r, 'Ω', 3); }))));
      if (c.kind === 'delta') add(main, card(Net.deltaDiagrams(c)));
      steps.forEach(function (s, i) {
        add(main, card(h('div', { className: 'stephead' }, h('span', { className: 'num' }, String(i + 1)), h('h3', {}, s.title)),
          beginner() && s.simple ? h('p', {}, '💡 ' + s.simple) : null,
          s.why ? h('p', { style: 'white-space:pre-line' }, s.why) : null,
          c.kind === 'mixed' && s.view ? Mixed.stepView(c, s.view) : null,
          Net.stepView(c, s),
          s.formula ? h('div', { className: 'formula' }, s.formula) : null,
          s.symbols.length ? h('details', { open: beginner() }, h('summary', {}, 'O que significa cada símbolo'), h('ul', {}, s.symbols.map(function (x) { return h('li', {}, x); }))) : null,
          s.subs.length ? h('div', { className: 'mono' }, s.subs.join('\n')) : null,
          s.divisions.map(divisionBlock),
          s.result ? h('div', { className: 'verdict ok' }, h('b', {}, s.result)) : null,
          btn('Tenho uma dúvida neste passo', function () { current = i; stepSel.value = String(i); chat.scrollIntoView({ behavior: 'smooth' }); question.focus({ preventScroll: true }); }, 'small')));
      });
      add(main, chat); log.forEach(bubble);
    });
  }

  /* ---------- correção ---------- */
  var ANSWER_UNITS = { 'Ω': [['1', 'Ω'], ['1000', 'kΩ'], ['1000000', 'MΩ']], V: [['1', 'V'], ['0.001', 'mV'], ['1000', 'kV']], A: [['1', 'A'], ['0.001', 'mA'], ['0.000001', 'µA']], W: [['1', 'W'], ['0.001', 'mW'], ['1000', 'kW']] };
  function answerForm(c, keys, onDone) {
    var fields = L.fields(c).filter(function (f) { return !keys || keys.indexOf(f.key) >= 0; });
    var state = fields.map(function () { return { text: '', mult: '1' }; });
    var err = errorBox(), out = h('div', { style: 'display:contents' });
    var nodes = fields.map(function (f, i) {
      var box = numInput('', function (v) { state[i].text = v; });
      if (f.signed) { box.inputMode = 'text'; box.placeholder = 'Pode ser negativo'; }
      return field(f.label, box, select(ANSWER_UNITS[f.unit], '1', function (v) { state[i].mult = v; }, 'Unidade: ' + f.label));
    });
    var check = btn('Corrigir', function () {
      out.textContent = ''; err.hidden = true;
      try {
        var answers = {}, done = [];
        fields.forEach(function (f, i) { if (state[i].text.trim()) { answers[f.key] = read(state[i].text, 'O campo "' + f.label + '"') * Number(state[i].mult); done.push(f); } });
        if (!done.length) throw new Error('Preencha pelo menos uma resposta.');
        var results = done.map(function (f) { return L.diagnose(c, f.key, answers[f.key], answers); });
        var wrong = results.filter(function (r) { return !r.ok; });
        add(out, h('div', { className: 'verdict ' + (wrong.length ? 'bad' : 'ok') }, h('b', {}, wrong.length ? 'O primeiro erro está em: ' + wrong[0].label : (done.length === fields.length ? 'Tudo certo!' : 'As respostas preenchidas estão certas.'))));
        results.forEach(function (r) {
          var shown = L.eng(r.user, r.unit);
          var lessonStep = L.lesson(c).filter(function (s) { return s.topic === r.topic; })[0];
          add(out, h('div', { className: 'verdict ' + (r.ok ? 'ok' : 'bad') }, h('p', {}, h('b', {}, (r.ok ? '✓ ' : '✗ ') + r.label + ': ' + shown)), r.ok ? null : h('p', {}, r.message),
            !r.ok && lessonStep ? h('details', {}, h('summary', {}, 'Como corrigir'), lessonStep.formula ? h('div', { className: 'formula' }, lessonStep.formula) : null, h('p', {}, lessonStep.why), h('div', { className: 'mono' }, lessonStep.subs.join('\n')), lessonStep.divisions.map(divisionBlock)) : null));
        });
        if (onDone) onDone(!wrong.length && done.length === fields.length);
        out.firstChild.scrollIntoView({ behavior: 'smooth' });
      } catch (e) { showError(err, e); }
    }, 'primary');
    return [card(h('h2', {}, 'Suas respostas'), h('p', { className: 'muted' }, 'Escolha a unidade ao lado. Aceito até 1% de diferença por arredondamento.' + (c.kind === 'network' && c.mode === 'solve' ? ' Use o sinal de menos quando o sentido for contrário ao pedido.' : '')), nodes), err, check, out];
  }
  function problemCard(type, input) {
    if (type === 'network') return Net.problemCard(input);
    if (type === 'delta') return card(h('h3', {}, input.direction === 'toStar' ? 'Triângulo → Estrela' : 'Estrela → Triângulo'), Net.deltaDiagrams(L.delta(input))[1]);
    if (type === 'mixed') return Mixed.problemCard(input);
    return card(h('h3', {}, 'Circuito em ' + (type === 'series' ? 'série' : 'paralelo')),
      diagram(type, input.resistors.map(function (r) { return L.fmt(r.value) + ' ' + r.unit; })),
      h('p', {}, input.resistors.map(function (r, i) { return 'R' + (i + 1) + ' = ' + L.fmt(r.value) + ' ' + r.unit; }).join(' · ')),
      input.known === 'none' ? null : h('p', {}, input.known === 'V' ? 'Tensão da fonte: ' + L.fmt(input.source) + ' V' : 'Corrente total: ' + L.fmt(input.source) + ' A'));
  }
  function checkScreen(c) {
    var nodes = [problemCard(c.kind, c.input)].concat(answerForm(c), [btn('🎓 Aprender como foi feito', function () { lessonScreen(c); }, 'learn')]);
    go('Conferir meu cálculo', function (main) { nodes.forEach(function (n) { add(main, n); }); });
  }

  /* ---------- Professor: exemplos e desafios ---------- */
  function professorScreen() {
    go('Professor de Cálculos', function (main) {
      var toggle = h('input', { type: 'checkbox', id: 'beg', checked: beginner(), on: { change: function () { store.set('beginner', toggle.checked); toast(toggle.checked ? 'Modo iniciante ligado' : 'Modo iniciante desligado'); } } });
      var score = store.get('score', { right: 0 });
      add(main, card(h('p', {}, 'Seu professor particular de eletrônica. Escolha um exemplo guiado, resolva um desafio ou use uma calculadora e toque em "Aprender como foi feito".'), h('div', { className: 'switch' }, toggle, h('label', { htmlFor: 'beg' }, 'Modo iniciante'))),
        card(h('h2', {}, 'Modo desafio'), h('p', { className: 'muted' }, 'Desafios resolvidos: ' + score.right), [[null, 'Série e paralelo'], ['mixed', 'Misto'], ['network', 'Ponte e várias fontes']].map(function (kind) {
          return h('div', { className: 'stack', 'data-kind': kind[0] || 'basic' }, h('h3', {}, kind[1]), h('div', { className: 'row' }, [[1, 'Fácil'], [2, 'Médio'], [3, 'Difícil']].map(function (l) { return btn(l[1], function () { challengeScreen(l[0], kind[0]); }); })));
        })),
        card(h('h2', {}, 'Conferir meu cálculo'), h('p', { className: 'muted' }, 'Digite os dados do seu exercício e toque em "Resolvi sozinho".'), h('div', { className: 'row' }, btn('Série', function () { circuitScreen('series'); }), btn('Paralelo', function () { circuitScreen('parallel'); }), btn('Misto', function () { Mixed.screen(); }))));
      add(main, Mixed.examplesCard());
      ['series', 'parallel'].forEach(function (t) {
        add(main, card(h('h2', {}, 'Exemplos em ' + (t === 'series' ? 'série' : 'paralelo')), L.EXAMPLES.filter(function (e) { return e.type === t; }).map(function (e) {
          return card(h('h3', {}, 'Nível ' + e.level + ': ' + e.title), h('p', { className: 'muted' }, e.tip + ' ' + e.input.resistors.map(function (r) { return L.fmt(r.value) + ' ' + r.unit; }).join(', ') + ' em ' + e.input.source + ' V.'),
            h('div', { className: 'row' }, btn('Ver aula', function () { lessonScreen(L.circuit(e.type, e.input)); }, 'small learn'), btn('Abrir na calculadora', function () { circuitScreen(e.type, e.input, true); }, 'small')));
        })));
      });
    });
  }
  function challengeScreen(level, kind) {
    var q, c, nodes, counted;
    function make() {
      if (kind === 'mixed') { q = L.mixedChallenge(level); c = L.mixed(q.input); }
      else if (kind === 'network') { q = L.networkChallenge(level); c = L.network(q.input); }
      else { q = L.challenge(level); c = L.circuit(q.type, q.input); }
      counted = false;
      nodes = [problemCard(kind || q.type, q.input)].concat(answerForm(c, q.keys, function (all) {
        if (all && !counted) { counted = true; var s = store.get('score', { right: 0 }); s.right++; store.set('score', s); toast('Desafio resolvido!'); }
      }), [h('div', { className: 'row' }, btn('Ver resolução', function () { counted = true; lessonScreen(c); }, 'learn'), btn('Novo desafio', function () { make(); render(true); window.scrollTo(0, 0); }))]);
    }
    make();
    go('Desafio ' + ['', 'fácil', 'médio', 'difícil'][level] + (kind === 'mixed' ? ' · misto' : kind === 'network' ? ' · livre' : ''), function (main) { nodes.forEach(function (n) { add(main, n); }); });
  }

  /* ---------- Lei de Ohm e potência ---------- */
  function pairForm(main, state, picker, keys, compute) {
    var err = errorBox(), out = h('div', { style: 'display:contents' });
    var clearOut = function () { out.textContent = ''; err.hidden = true; state.result = null; };
    var inputs = keys.map(function (k) {
      var q = L.QTY[k];
      var unit = k === 'R' ? select([['Ω', 'Ω'], ['kΩ', 'kΩ'], ['MΩ', 'MΩ']], state.unit, function (v) { state.unit = v; clearOut(); }, 'Unidade da resistência') : null;
      return field(q.name + ' (' + k + ')' + (k === 'R' ? '' : ' em ' + q.unit), numInput(state.text[k], function (v) { state.text[k] = v; clearOut(); }), unit);
    });
    function paintPair(c) {
      var t = c.kind === 'ohm' ? c.target : 'P';
      add(out, card(h('h2', {}, L.QTY[t].name), h('div', { className: 'big' }, L.eng(c.values[t], L.QTY[t].unit)),
        h('div', { className: 'stats' }, ['V', 'I', 'R', 'P'].map(function (k) { return h('div', { className: 'stat' }, h('span', {}, L.QTY[k].name), h('b', {}, L.eng(c.values[k], L.QTY[k].unit))); }))), actions(c));
    }
    add(main, card(picker, inputs), err, h('div', { className: 'row' }, btn('Calcular', function () {
      try {
        var v = keys.map(function (k) { return read(state.text[k], 'O campo "' + L.QTY[k].name + '"') * (k === 'R' ? L.MULT[state.unit] : 1); });
        clearOut(); state.result = compute(v); paintPair(state.result); out.firstChild.scrollIntoView({ behavior: 'smooth' });
      } catch (e) { clearOut(); showError(err, e); }
    }, 'primary'), btn('Limpar valores', function () { state.text = {}; state.result = null; render(false); toast('Valores limpos'); })), out);
    if (state.result) paintPair(state.result);
  }
  function ohmScreen(c) {
    var state = { target: 'I', text: {}, unit: 'Ω', result: null };
    if (c && c.values) { state.target = c.target; state.result = c; c.given.forEach(function (k) { state.text[k] = raw(c.values[k]); }); }
    go('Lei de Ohm', function (main) {
      var picker = field('O que você quer descobrir?', select([['V', 'Tensão (V)'], ['I', 'Corrente (I)'], ['R', 'Resistência (R)']], state.target, function (v) { state.target = v; state.text = {}; state.result = null; render(false); }));
      var keys = ['V', 'I', 'R'].filter(function (k) { return k !== state.target; });
      pairForm(main, state, picker, keys, function (v) { var o = {}; keys.forEach(function (k, i) { o[k] = v[i]; }); return L.ohm(state.target, o); });
    });
  }
  function powerScreen(c) {
    var state = { mode: 'VI', text: {}, unit: 'Ω', result: null };
    if (c && c.values) { state.mode = c.mode; state.result = c; c.given.forEach(function (k) { state.text[k] = raw(c.values[k]); }); }
    go('Potência elétrica', function (main) {
      var picker = field('O que você conhece?', select([['VI', 'Tensão e corrente'], ['VR', 'Tensão e resistência'], ['IR', 'Corrente e resistência']], state.mode, function (v) { state.mode = v; state.text = {}; state.result = null; render(false); }));
      pairForm(main, state, picker, state.mode.split(''), function (v) { return L.power(state.mode, v[0], v[1]); });
    });
  }

  /* ---------- conversor ---------- */
  function converterScreen() {
    var state = { text: '', unit: 'kΩ' };
    go('Conversor de unidades', function (main) {
      var out = h('div', { className: 'card', 'aria-live': 'polite' });
      function update() {
        out.textContent = '';
        if (!state.text.trim()) { add(out, h('p', { className: 'muted' }, 'Digite um valor para ver as conversões.')); return; }
        var r = L.parseNumber(state.text);
        if (!r.ok || r.value < 0) { add(out, h('p', { className: 'error' }, r.ok ? 'Resistência não pode ser negativa.' : 'O valor ' + r.error)); return; }
        ['Ω', 'kΩ', 'MΩ'].forEach(function (u) { add(out, h('div', { className: 'stat' }, h('span', {}, u), h('b', {}, L.fmt(L.convert(r.value, state.unit, u), 10) + ' ' + u))); });
      }
      var input = numInput(state.text, function (v) { state.text = v; update(); });
      add(main, card(field('Valor', input, select([['Ω', 'Ω'], ['kΩ', 'kΩ'], ['MΩ', 'MΩ']], state.unit, function (v) { state.unit = v; update(); }, 'Unidade de origem'))), out,
        card(h('div', { className: 'formula' }, '1 kΩ = 1.000 Ω\n1 MΩ = 1.000 kΩ = 1.000.000 Ω')), btn('Limpar valores', function () { state.text = ''; input.value = ''; update(); }));
      update();
    });
  }

  /* ---------- histórico ---------- */
  function open(e) {
    try {
      var c = recompute(e);
      if (e.kind === 'network') Net.screen(e.input, true); else if (e.kind === 'delta') Net.deltaScreen(e.input, true); else if (e.kind === 'mixed') Mixed.screen(e.input, true); else if (e.kind === 'ohm') ohmScreen(c); else if (e.kind === 'power') powerScreen(c); else circuitScreen(e.kind, e.input, true);
    } catch (x) { toast('Não foi possível abrir este cálculo.'); }
  }
  function historyScreen(tab) {
    var confirming = false;
    go('Histórico', function (main) {
      var list = store.get(tab, []);
      add(main, h('div', { className: 'tabs' }, [['history', 'Recentes'], ['saved', 'Salvos']].map(function (t) { return btn(t[1], function () { tab = t[0]; confirming = false; render(false); }, tab === t[0] ? 'on' : ''); })));
      if (!list.length) add(main, card(h('p', { className: 'muted' }, tab === 'history' ? 'Seus cálculos aparecem aqui automaticamente.' : 'Toque em "Salvar cálculo" em um resultado para guardá-lo aqui.')));
      list.forEach(function (e, i) {
        add(main, card(h('h3', {}, e.name), h('p', {}, e.summary), h('p', { className: 'muted' }, new Date(e.at).toLocaleString('pt-BR')),
          h('div', { className: 'row' }, btn('Abrir', function () { open(e); }, 'small'), btn('🎓 Aprender como foi feito', function () { try { lessonScreen(recompute(e)); } catch (x) { toast('Não foi possível abrir este cálculo.'); } }, 'small learn'), btn('Excluir', function () { list.splice(i, 1); store.set(tab, list); render(false); }, 'small'))));
      });
      if (list.length) add(main, btn(confirming ? 'Toque de novo para apagar tudo' : (tab === 'history' ? 'Limpar histórico' : 'Apagar todos os salvos'), function () { if (confirming) store.set(tab, []); confirming = !confirming; render(false); }));
    });
  }

  /* ---------- área Aprender ---------- */
  var TOPICS = [
    ['Tensão, corrente e resistência', 'Pense em água num cano. A tensão (V, em volts) é a pressão que empurra. A corrente (I, em ampères) é a quantidade que passa. A resistência (R, em ohms) é o aperto no cano. É só uma comparação, mas ajuda a começar.', ''],
    ['Lei de Ohm', 'Liga as três grandezas em um resistor. Quanto maior a tensão, maior a corrente. Quanto maior a resistência, menor a corrente.', 'V = R × I\nI = V ÷ R\nR = V ÷ I'],
    ['Potência elétrica', 'É a energia usada por segundo, em watts (W). No resistor ela vira calor. Escolha um resistor com potência nominal maior que a calculada, de preferência o dobro.', 'P = V × I\nP = R × I²\nP = V² ÷ R'],
    ['Circuito em série', 'Um único caminho. A corrente é igual em todos e as tensões se somam. Se um resistor abrir, a corrente para em todo o circuito.', 'Req = R1 + R2 + … + Rn\nVn = I × Rn\nV = V1 + V2 + … + Vn'],
    ['Circuito em paralelo', 'Vários caminhos entre os mesmos dois pontos. A tensão é igual em todos e as correntes se somam. A resistência equivalente fica menor que o menor resistor.', '1/Req = 1/R1 + 1/R2 + … + 1/Rn\nDois resistores: Req = (R1 × R2) ÷ (R1 + R2)\nIn = V ÷ Rn\nI = I1 + I2 + … + In'],
    ['Circuito misto', 'Tem trechos em série e trechos em paralelo. Resolva trocando um grupo de cada vez por um resistor equivalente, começando pelos mais internos. Depois volte pelos diagramas: em série os itens têm a mesma corrente; em paralelo, a mesma tensão. Circuitos em ponte não podem ser reduzidos só com essas duas regras: use o Circuito Livre.', 'Exemplo: R1 + (R2 ∥ R3)\n1º: RA = R2 ∥ R3\n2º: Req = R1 + RA'],
    ['Ponte, triângulo e estrela', 'Na ponte de Wheatstone há um resistor ligando os meios de dois ramos. Ela não está em série nem em paralelo. Pode-se trocar um triângulo (Δ) por uma estrela (Y), ou o contrário, ou usar o método nodal. A ponte está equilibrada quando os dois pontos do meio têm a mesma tensão: então não passa corrente no resistor central.', 'Δ→Y: Ra = Rab × Rca ÷ (Rab + Rbc + Rca)\nY→Δ: Rab = (RaRb + RbRc + RcRa) ÷ Rc\nPonte equilibrada (braços R1-R3 e R2-R4): R1 × R4 = R2 × R3'],
    ['Várias fontes e método nodal', 'Dê um nome a cada nó, escolha um como 0 V e escreva a lei das correntes em cada um. Cada fonte de tensão acrescenta uma equação. Na superposição, calcula-se o efeito de uma fonte por vez e somam-se correntes ou tensões. Potências não se somam dessa forma.', 'Em cada nó: Σ correntes que saem = 0\nEm resistor: I = (Va − Vb) ÷ R'],
    ['Leis de Kirchhoff', 'Lei das correntes: o que chega a um nó é igual ao que sai. Lei das tensões: percorrendo uma malha fechada, a soma das elevações é igual à soma das quedas de tensão.', 'ΣI entra = ΣI sai\nΣV na malha = 0'],
    ['Prefixos e unidades', 'Converta tudo para Ω, V e A antes de calcular. M (mega) e m (mili) são diferentes.', 'M = × 1.000.000\nk = × 1.000\nm = ÷ 1.000\nµ = ÷ 1.000.000'],
    ['Divisão com decimais', 'Multiplique dividendo e divisor por 10, 100, 1000… até o divisor e o dividendo ficarem inteiros. Divida normalmente. Quando sobrar resto, coloque a vírgula no resultado e acrescente zeros ao resto.', '7,5 ÷ 2,5 = 75 ÷ 25 = 3'],
    ['Cuidados', 'Este app usa o modelo ideal: fonte de corrente contínua, fios sem resistência e resistores sem tolerância. Resistores reais variam (por exemplo ±5%). Não faça experiências na rede elétrica da casa. Para praticar, use pilhas ou fontes de baixa tensão.', '']
  ];
  function learnScreen() {
    go('Aprender', function (main) {
      TOPICS.forEach(function (t, i) { add(main, h('details', { className: 'card', open: i === 0 }, h('summary', {}, t[0]), h('p', {}, t[1]), t[2] ? h('div', { className: 'formula', style: 'white-space:pre-line' }, t[2]) : null)); });
      add(main, btn('Praticar com o Professor', professorScreen, 'primary'));
    });
  }

  go('Resistor Lab', home);
})();
