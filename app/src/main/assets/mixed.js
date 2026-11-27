/* Resistor Lab: circuitos mistos (associações de série e paralelo). Estende o motor de engine.js. */
(function (root) {
  'use strict';
  var L = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.Lab;
  var fmt = L.fmt, eng = L.eng;
  var MAX_RESISTORS = 50, MAX_DEPTH = 6, TOL = 0.01;
  var TYPE = { series: 'série', parallel: 'paralelo' };
  var sum = function (l) { return l.reduce(function (a, b) { return a + b; }, 0); };
  var close = function (a, b, scale) { return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), scale || 0) * 1e-9; };
  var approx = function (x) { return Math.abs(Number(x.toPrecision(6)) - x) > Math.abs(x) * 1e-12 ? '≈ ' + fmt(x) : '= ' + fmt(x); };
  function letters(n) { var s = ''; n++; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }
  function finite(v) { if (!isFinite(v)) throw new Error('O resultado ficou grande demais. Revise os valores.'); return v; }

  /* ---------- validação e montagem ---------- */
  function build(tree) {
    var leaves = [], groups = [];
    if (!tree || (tree.type !== 'series' && tree.type !== 'parallel')) throw new Error('O circuito precisa começar com um grupo em série ou em paralelo.');
    var seen = [];
    function walk(src, depth, parent, path) {
      if (!src || typeof src !== 'object') throw new Error('Há uma ligação incompleta no circuito.');
      if (seen.indexOf(src) >= 0) throw new Error('Ligação inválida: o mesmo item aparece duas vezes no circuito.');
      seen.push(src);
      if (src.type === 'R') {
        var name = 'R' + (leaves.length + 1), unit = src.unit || 'Ω';
        if (!L.MULT[unit]) throw new Error(name + ': unidade desconhecida.');
        var R = src.value * L.MULT[unit];
        if (typeof src.value !== 'number' || !isFinite(R)) throw new Error(name + ': informe um número válido.');
        if (R === 0) throw new Error(name + ' não pode ser zero. Isso causaria uma divisão por zero ou um curto-circuito.');
        if (R < 0) throw new Error(name + ' não pode ser negativo. Digite um valor maior que zero.');
        if (R < 1e-6 || R > 1e12) throw new Error(name + ' está fora da faixa aceita pelo aplicativo (de 0,000001 a 1 trilhão de ohms).');
        var leaf = { type: 'R', name: name, R: R, value: src.value, unit: unit, parent: parent };
        leaves.push(leaf);
        if (leaves.length > MAX_RESISTORS) throw new Error('O limite é de ' + MAX_RESISTORS + ' resistores por circuito.');
        return leaf;
      }
      if (src.type !== 'series' && src.type !== 'parallel') throw new Error('Há um tipo de ligação desconhecido no circuito.');
      var where = depth === 0 ? 'O circuito principal' : 'O grupo ' + path + ' (' + TYPE[src.type] + ')';
      if (depth >= MAX_DEPTH) throw new Error('O limite é de ' + MAX_DEPTH + ' níveis de grupos, um dentro do outro.');
      if (!src.items || src.items.length < 2) throw new Error(where + ' precisa de pelo menos 2 itens. Adicione outro resistor ou remova o grupo.');
      var g = { type: src.type, parent: parent, order: groups.length };
      groups.push(g);
      g.items = src.items.map(function (child, i) { return walk(child, depth + 1, g, (path ? path + '.' : '') + (i + 1)); });
      g.height = 1 + Math.max.apply(null, g.items.map(function (x) { return x.height || 0; }));
      return g;
    }
    var top = walk(tree, 0, null, '');
    /* Ordem de redução: os grupos mais internos primeiro; o principal por último. */
    var order = groups.slice().sort(function (a, b) { return a.height - b.height || a.order - b.order; });
    order.forEach(function (g, k) { g.k = k; g.name = g === top ? 'Req' : 'R' + letters(k); });
    return { top: top, leaves: leaves, order: order };
  }

  /* Texto da ligação, ex.: R1 + (R2 ∥ R3) */
  function expression(node, nested) {
    if (node.type === 'R') return node.name;
    var t = node.items.map(function (x) { return expression(x, true); }).join(node.type === 'series' ? ' + ' : ' ∥ ');
    return nested ? '(' + t + ')' : t;
  }
  var operands = function (g) { return g.items.map(function (x) { return x.name; }); };
  var describeGroup = function (g) { return operands(g).join(g.type === 'series' ? ' + ' : ' ∥ '); };
  var equivalent = function (type, list) { return type === 'series' ? sum(list) : 1 / sum(list.map(function (r) { return 1 / r; })); };

  function mixed(input) {
    var b = build(input.tree), known = input.known || 'none';
    if (known !== 'none') {
      var what = known === 'V' ? 'A tensão da fonte' : 'A corrente total';
      if (typeof input.source !== 'number' || !isFinite(input.source)) throw new Error(what + ': informe um número válido.');
      if (input.source <= 0) throw new Error(what + ' precisa ser maior que zero.');
      if (input.source < 1e-6 || input.source > 1e12) throw new Error(what + ' está fora da faixa aceita pelo aplicativo.');
    }
    b.order.forEach(function (g) {
      g.S = g.type === 'parallel' ? sum(g.items.map(function (x) { return 1 / x.R; })) : null;
      g.R = finite(g.type === 'series' ? sum(g.items.map(function (x) { return x.R; })) : 1 / g.S);
    });
    var c = { kind: 'mixed', input: input, known: known, top: b.top, order: b.order, leaves: b.leaves, ohms: b.leaves.map(function (x) { return x.R; }), Req: b.top.R, V: null, I: null, P: null, expression: expression(b.top) };
    c.pure = b.order.every(function (g) { return g.type === b.top.type; });
    if (known !== 'none') {
      c.V = finite(known === 'V' ? input.source : input.source * c.Req);
      c.I = finite(known === 'I' ? input.source : input.source / c.Req);
      (function spread(node, V, I) {
        node.V = finite(V); node.I = finite(I); node.P = finite(V * I);
        if (node.items) node.items.forEach(function (x) {
          if (node.type === 'series') spread(x, I * x.R, I); else spread(x, V, V / x.R);
        });
      })(b.top, c.V, c.I);
      c.P = finite(c.V * c.I);
    }
    c.items = b.leaves.map(function (x) { return { name: x.name, R: x.R, V: known === 'none' ? null : x.V, I: known === 'none' ? null : x.I, P: known === 'none' ? null : x.P }; });
    c.checks = verify(c);
    return c;
  }

  /* ---------- conferência por Kirchhoff, usando apenas os valores dos resistores ---------- */
  function netlist(top) {
    var edges = [], nodes = 2; /* nó 0 = polo + ; nó 1 = polo − */
    (function wire(x, a, b) {
      if (x.type === 'R') { edges.push({ leaf: x, a: a, b: b }); return; }
      if (x.type === 'parallel') { x.items.forEach(function (y) { wire(y, a, b); }); return; }
      var from = a;
      x.items.forEach(function (y, i) { var to = i === x.items.length - 1 ? b : nodes++; wire(y, from, to); from = to; });
    })(top, 0, 1);
    return { edges: edges, nodes: nodes };
  }
  /* Menor e maior soma de tensões entre todos os caminhos do polo + ao polo −. */
  function paths(x) {
    if (x.type === 'R') return [x.V, x.V];
    var p = x.items.map(paths);
    if (x.type === 'series') return [sum(p.map(function (q) { return q[0]; })), sum(p.map(function (q) { return q[1]; }))];
    return [Math.min.apply(null, p.map(function (q) { return q[0]; })), Math.max.apply(null, p.map(function (q) { return q[1]; }))];
  }
  function verify(c) {
    var list = [], add = function (name, text, ok) { list.push({ name: name, text: text, ok: ok }); };
    var ok = c.order.every(function (g) {
      var r = g.items.map(function (x) { return x.R; });
      return g.type === 'series' ? g.R >= Math.max.apply(null, r) * (1 - 1e-9) : g.R <= Math.min.apply(null, r) * (1 + 1e-9);
    });
    add('Reduções', 'Cada grupo em série ficou maior que seus itens e cada grupo em paralelo ficou menor que o menor deles.', ok);
    if (c.V === null) return list;
    add('Lei de Ohm', 'V = I × Req → ' + eng(c.I, 'A') + ' × ' + eng(c.Req, 'Ω') + ' = ' + eng(c.V, 'V') + '.', close(c.I * c.Req, c.V));
    var net = netlist(c.top), kcl = true;
    for (var n = 0; n < net.nodes; n++) {
      var into = n === 0 ? c.I : 0, out = n === 1 ? c.I : 0;
      net.edges.forEach(function (e) { if (e.b === n) into += e.leaf.I; if (e.a === n) out += e.leaf.I; });
      if (!close(into, out)) kcl = false;
    }
    add('Lei das correntes (Kirchhoff)', 'Nos ' + net.nodes + ' nós do circuito, contando os dois polos da fonte, a corrente que entra é igual à que sai.', kcl);
    var p = paths(c.top);
    add('Lei das tensões (Kirchhoff)', 'Em qualquer caminho de um polo ao outro, a soma das tensões nos resistores é ' + eng(p[0], 'V') + (close(p[0], p[1]) ? '' : ' a ' + eng(p[1], 'V')) + ', e a fonte tem ' + eng(c.V, 'V') + '.', close(p[0], c.V) && close(p[1], c.V));
    var sp = sum(c.items.map(function (x) { return x.P; }));
    add('Potência', 'A soma das potências individuais (' + eng(sp, 'W') + ') é igual a V × I (' + eng(c.P, 'W') + ').', close(sp, c.P));
    return list;
  }

  /* ---------- aula passo a passo ---------- */
  function step(topic, title, o) {
    return { topic: topic, title: title, why: o.why || '', simple: o.simple || '', formula: o.formula || '', symbols: o.symbols || [], subs: o.subs || [], divisions: o.divisions || [], result: o.result || '', view: o.view || null };
  }
  var SYM = {
    group: 'RA, RB, RC… = resistência equivalente de um grupo: um único resistor imaginário que substitui o grupo inteiro. Unidade: ohm (Ω).',
    Req: 'Req = resistência equivalente do circuito inteiro, em ohms (Ω).',
    Rn: 'R1, R2, R3… = os resistores do circuito. O número é só o nome.',
    plus: '+ entre resistores indica ligação em série.',
    par: '∥ significa "em paralelo com".',
    one: 'O 1 em 1/R indica o inverso da resistência.',
    V: 'V = tensão elétrica, em volts (V).', I: 'I = corrente elétrica, em ampères (A).', P: 'P = potência, em watts (W).'
  };

  function lesson(c) {
    var s = [], n = c.order.length;
    var plan = c.order.map(function (g, k) { return (k + 1) + 'º: ' + g.name + ' = ' + describeGroup(g) + ' (' + TYPE[g.type] + ')'; });
    var orderText = 'Comece pelos grupos mais internos, aqueles em que todos os itens já têm um valor conhecido. A ordem neste circuito é:\n' + plan.join('\n');
    var data = c.leaves.map(function (x) { return x.unit === 'Ω' ? x.name + ' = ' + fmt(x.R) + ' Ω' : x.name + ' = ' + fmt(x.value) + ' ' + x.unit + ' × ' + fmt(L.MULT[x.unit]) + ' = ' + fmt(x.R) + ' Ω'; });
    if (c.known !== 'none') data.push((c.known === 'V' ? 'Tensão da fonte: V = ' : 'Corrente total: I = ') + fmt(c.input.source) + (c.known === 'V' ? ' V' : ' A'));
    data.push('Ligação: ' + c.expression);
    var first = step('data', 'Ler o circuito e decidir a ordem', {
      why: orderText, simple: 'Um circuito misto é resolvido aos poucos: troque um grupo de cada vez por um único resistor, até sobrar só um.',
      symbols: [SYM.Rn, SYM.plus, SYM.par, SYM.group], subs: data, view: { stage: 0 }
    });
    first.order = orderText;
    s.push(first);

    c.order.forEach(function (g, k) {
      var names = operands(g), vals = g.items.map(function (x) { return x.R; }), isTop = g === c.top;
      var inner = g.items.filter(function (x) { return x.items; }).map(function (x) { return x.name; });
      var whyNow = inner.length ? 'Agora dá para calcular, porque ' + inner.join(' e ') + (inner.length > 1 ? ' já foram calculados.' : ' já foi calculado.') : 'Dá para calcular agora porque este grupo só tem resistores com valores conhecidos.';
      var o = { view: { reduce: k }, symbols: [isTop ? SYM.Req : SYM.group, SYM.Rn], result: g.name + ' = ' + eng(g.R, 'Ω') };
      if (g.type === 'series') {
        o.why = whyNow + ' ' + names.join(', ') + ' estão em série: a mesma corrente passa por todos, então as resistências se somam.';
        o.simple = 'Eles estão em fila. Some os valores e troque todos por um só, chamado ' + g.name + '.';
        o.formula = g.name + ' = ' + names.join(' + ');
        o.subs = [g.name + ' = ' + vals.map(function (v) { return fmt(v); }).join(' + '), g.name + ' ' + approx(g.R) + ' Ω'];
        o.symbols.push(SYM.plus);
      } else {
        o.why = whyNow + ' ' + names.join(', ') + ' estão em paralelo: ligados entre os mesmos dois pontos. Somamos os inversos e depois invertemos a soma.';
        o.simple = 'Eles estão lado a lado. Faça 1 dividido por cada valor, some, e depois faça 1 dividido pela soma.';
        o.formula = '1/' + g.name + ' = ' + names.map(function (x) { return '1/' + x; }).join(' + ');
        o.subs = g.items.map(function (x) { return '1/' + x.name + ' = 1 ÷ ' + fmt(x.R) + ' ' + approx(1 / x.R); })
          .concat(['Soma: 1/' + g.name + ' = ' + vals.map(function (v) { return fmt(1 / v); }).join(' + ') + ' ' + approx(g.S), 'Inverter: ' + g.name + ' = 1 ÷ ' + fmt(g.S) + ' ' + approx(g.R) + ' Ω']);
        if (vals.length === 2) o.subs.push('Atalho para 2 itens: ' + g.name + ' = (' + names[0] + ' × ' + names[1] + ') ÷ (' + names[0] + ' + ' + names[1] + ') = ' + fmt(vals[0] * vals[1]) + ' ÷ ' + fmt(vals[0] + vals[1]) + ' ' + approx(g.R) + ' Ω');
        o.divisions = vals.map(function (v) { return [1, v]; }).concat([[1, g.S]]);
        o.symbols.push(SYM.one, SYM.par);
      }
      s.push(step(isTop ? 'req' : 'red' + k, (k + 1) + 'ª redução: ' + g.name + ' (' + TYPE[g.type] + ')', o));
    });

    var checkSubs = function () { return c.checks.map(function (x) { return (x.ok ? '✓ ' : '✗ ') + x.name + ': ' + x.text; }); };
    if (c.known === 'none') {
      s.push(step('check', 'Conferir o resultado', { why: 'Para calcular tensões, correntes e potências, informe a tensão da fonte ou a corrente total.', simple: 'Conferir evita erros.', subs: checkSubs() }));
      return s;
    }
    var byV = c.known === 'V';
    s.push(step(byV ? 'current' : 'voltage', byV ? 'Calcular a corrente total' : 'Calcular a tensão total', {
      why: 'Agora o circuito inteiro é um único resistor, Req. Aplicamos a Lei de Ohm nele.',
      simple: byV ? 'Divida a tensão da fonte pela resistência total.' : 'Multiplique a corrente total pela resistência total.',
      formula: byV ? 'I = V ÷ Req' : 'V = I × Req', symbols: [SYM.V, SYM.I, SYM.Req],
      subs: byV ? ['I = ' + fmt(c.V) + ' ÷ ' + fmt(c.Req), 'I ' + approx(c.I) + ' A'] : ['V = ' + fmt(c.I) + ' × ' + fmt(c.Req), 'V ' + approx(c.V) + ' V'],
      divisions: byV ? [[c.V, c.Req]] : [], result: byV ? 'I = ' + eng(c.I, 'A') : 'V = ' + eng(c.V, 'V'), view: { stage: n }
    }));

    c.order.slice().reverse().forEach(function (g) {
      var ser = g.type === 'series', label = g === c.top ? 'o circuito principal' : g.name;
      var o = { view: { expand: g.k }, symbols: [SYM.V, SYM.I, SYM.group] };
      if (ser) {
        o.why = 'Voltamos no diagrama. ' + (g === c.top ? 'O circuito principal' : g.name) + ' é um grupo em série: todos os itens recebem a MESMA corrente, ' + eng(g.I, 'A') + '. A tensão de cada um é V = I × R.';
        o.simple = 'Em fila, a corrente não muda. Multiplique essa corrente por cada resistência.';
        o.formula = 'V = I × R';
        o.subs = ['Corrente do grupo: ' + eng(g.I, 'A')].concat(g.items.map(function (x) { return x.name + ': I = ' + fmt(x.I) + ' A; V = ' + fmt(x.I) + ' × ' + fmt(x.R) + ' ' + approx(x.V) + ' V'; }));
      } else {
        o.why = 'Voltamos no diagrama. ' + (g === c.top ? 'O circuito principal' : g.name) + ' é um grupo em paralelo: todos os ramos recebem a MESMA tensão, ' + eng(g.V, 'V') + '. A corrente de cada ramo é I = V ÷ R.';
        o.simple = 'Lado a lado, a tensão não muda. Divida essa tensão por cada resistência.';
        o.formula = 'I = V ÷ R';
        o.subs = ['Tensão do grupo: ' + eng(g.V, 'V')].concat(g.items.map(function (x) { return x.name + ': V = ' + fmt(x.V) + ' V; I = ' + fmt(x.V) + ' ÷ ' + fmt(x.R) + ' ' + approx(x.I) + ' A'; }));
        o.divisions = g.items.map(function (x) { return [x.V, x.R]; });
      }
      s.push(step('back' + g.k, 'Voltar: tensões e correntes em ' + label, o));
    });

    s.push(step('pi', 'Calcular a potência de cada resistor', {
      why: 'Com a tensão e a corrente de cada resistor, a potência é o produto das duas.', simple: 'Multiplique a tensão pela corrente de cada resistor.',
      formula: 'P = V × I', symbols: [SYM.P, SYM.V, SYM.I],
      subs: c.items.map(function (x) { return 'P de ' + x.name + ' = ' + fmt(x.V) + ' × ' + fmt(x.I) + ' ' + approx(x.P) + ' W'; })
    }));
    s.push(step('pt', 'Calcular a potência total', {
      why: 'É a potência entregue pela fonte.', simple: 'Multiplique a tensão total pela corrente total.', formula: 'P = V × I', symbols: [SYM.P, SYM.V, SYM.I],
      subs: ['P = ' + fmt(c.V) + ' × ' + fmt(c.I), 'P ' + approx(c.P) + ' W'], result: 'P = ' + eng(c.P, 'W')
    }));
    s.push(step('check', 'Conferir pelas leis de Kirchhoff', { why: 'Conferimos as correntes em cada nó e as tensões em todos os caminhos.', simple: 'É a prova real do circuito.', subs: checkSubs() }));
    return s;
  }

  /* ---------- correção das respostas ---------- */
  function fields(c) {
    var f = [], add = function (key, label, unit, value, topic, extra) {
      var o = { key: key, label: label, unit: unit, value: value, topic: topic };
      Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; }); f.push(o);
    };
    c.order.forEach(function (g) {
      if (g === c.top) add('Req', 'Resistência total', 'Ω', g.R, 'req', { group: g });
      else add('G' + g.k, g.name + ' (' + describeGroup(g) + ')', 'Ω', g.R, 'red' + g.k, { group: g });
    });
    if (c.known === 'none') return f;
    if (c.known === 'V') add('I', 'Corrente total', 'A', c.I, 'current'); else add('V', 'Tensão total', 'V', c.V, 'voltage');
    c.leaves.forEach(function (x, i) {
      add('V' + i, 'Tensão em ' + x.name, 'V', x.V, 'back' + x.parent.k, { leaf: x, q: 'V', i: i });
      add('I' + i, 'Corrente em ' + x.name, 'A', x.I, 'back' + x.parent.k, { leaf: x, q: 'I', i: i });
    });
    c.leaves.forEach(function (x, i) { add('P' + i, 'Potência em ' + x.name, 'W', x.P, 'pi', { leaf: x, q: 'P', i: i }); });
    add('P', 'Potência total', 'W', c.P, 'pt');
    return f;
  }
  var match = function (u, v) { return v === 0 ? u === 0 : Math.abs(u - v) <= Math.abs(v) * TOL; };
  var keyOf = function (c, g) { return g === c.top ? 'Req' : 'G' + g.k; };

  function chained(c, f, a) {
    var num = function (k) { return typeof a[k] === 'number' && isFinite(a[k]) ? a[k] : null; };
    if (f.group) {
      var used = false, list = f.group.items.map(function (x) {
        if (x.items && num(keyOf(c, x)) !== null) { used = true; return num(keyOf(c, x)); }
        return x.R;
      });
      return used ? equivalent(f.group.type, list) : null;
    }
    if (f.key === 'I') return num('Req') ? c.V / num('Req') : null;
    if (f.key === 'V') return num('Req') !== null ? c.I * num('Req') : null;
    if (f.q === 'V') return num('I' + f.i) !== null ? num('I' + f.i) * f.leaf.R : null;
    if (f.q === 'I') return num('V' + f.i) !== null ? num('V' + f.i) / f.leaf.R : null;
    if (f.q === 'P') return num('V' + f.i) !== null && num('I' + f.i) !== null ? num('V' + f.i) * num('I' + f.i) : null;
    return null;
  }

  function hypotheses(c, f) {
    var h = [], add = function (v, m) { if (isFinite(v)) h.push([v, m]); };
    if (f.group) {
      var g = f.group, r = g.items.map(function (x) { return x.R; }), ser = g.type === 'series';
      add(equivalent(ser ? 'parallel' : 'series', r), 'Neste grupo você usou a fórmula de ' + (ser ? 'PARALELO' : 'SÉRIE') + ', mas ' + describeGroup(g) + ' está em ' + TYPE[g.type].toUpperCase() + '.');
      if (!ser) add(g.S, 'Faltou inverter: você achou 1/' + g.name + '. Agora calcule 1 ÷ essa soma.');
      add(sum(r) / r.length, 'Você calculou a média. A resistência equivalente não é uma média.');
      r.forEach(function (_, i) { add(equivalent(g.type, r.filter(function (_, j) { return j !== i; })), 'Parece que ' + g.items[i].name + ' ficou fora da conta.'); });
      if (g === c.top) {
        add(sum(c.ohms), 'Você somou todos os resistores como se o circuito inteiro estivesse em série. Reduza um grupo de cada vez.');
        add(equivalent('parallel', c.ohms), 'Você tratou o circuito inteiro como paralelo. Reduza um grupo de cada vez.');
      }
    } else if (f.key === 'I') {
      add(c.V * c.Req, 'Você multiplicou. A corrente total é I = V ÷ Req.'); add(c.Req / c.V, 'A divisão está invertida. O correto é V ÷ Req.');
    } else if (f.key === 'V') {
      add(c.I / c.Req, 'Você dividiu. A tensão total é V = I × Req.');
    } else if (f.q === 'V') {
      var x = f.leaf;
      add(c.V, 'Você usou a tensão da fonte. ' + x.name + ' recebe só a tensão do trecho onde está. Volte pelos diagramas.');
      add(c.I * x.R, 'Você usou a corrente total. Nem toda a corrente total passa por ' + x.name + '. Use a corrente dele.');
      add(x.I / x.R, 'Você dividiu I por R. A tensão é I × R.');
    } else if (f.q === 'I') {
      var y = f.leaf;
      add(c.I, 'Você usou a corrente total. Antes de chegar em ' + y.name + ', a corrente se divide em um grupo em paralelo.');
      add(c.V / y.R, 'Você usou a tensão da fonte. Use a tensão que está sobre ' + y.name + '.');
      add(y.V * y.R, 'Você multiplicou. A corrente é V ÷ R.');
    } else if (f.q === 'P') {
      var z = f.leaf;
      add(c.P, 'Esse é o valor da potência TOTAL. Aqui se pede só a de ' + z.name + '.');
      add(c.V * z.I, 'Você usou a tensão da fonte. Use a tensão sobre ' + z.name + '.');
      add(z.V * c.I, 'Você usou a corrente total. Use a corrente de ' + z.name + '.');
      add(z.V / z.I, 'Você dividiu. A potência é V × I.');
    } else if (f.key === 'P') {
      add(c.V / c.I, 'Você dividiu V por I. A potência é V × I.');
    }
    return h;
  }

  function diagnose(c, key, user, answers) {
    var f = fields(c).filter(function (x) { return x.key === key; })[0];
    var out = { key: key, label: f.label, unit: f.unit, user: user, expected: f.value, topic: f.topic, ok: match(user, f.value), carried: false, message: '' };
    var say = function (m) { out.message = m; return out; };
    if (out.ok) return say('Correto!');
    var ch = answers ? chained(c, f, answers) : null;
    if (ch !== null && isFinite(ch) && !match(ch, f.value) && match(user, ch)) { out.carried = true; return say('A conta desta etapa está certa, mas usou um valor errado de uma etapa anterior. Corrija o primeiro erro e refaça.'); }
    var scales = [1e3, 1e-3, 1e6, 1e-6];
    for (var i = 0; i < scales.length; i++) if (match(user, f.value * scales[i])) return say('Os algarismos estão certos, mas há um erro de unidade ou de vírgula. Confira os prefixos (k, M, m) e a unidade escolhida.');
    var h = hypotheses(c, f);
    for (var j = 0; j < h.length; j++) if (match(user, h[j][0])) return say(h[j][1]);
    if (match(Math.abs(user), Math.abs(f.value))) return say('O número está certo, mas o sinal não. Aqui o valor é positivo.');
    if (Math.abs(user - f.value) <= Math.abs(f.value) * 0.05) return say('Está perto. Provavelmente você arredondou cedo demais. Mantenha pelo menos 4 algarismos significativos.');
    return say('Não reconheci o tipo de erro. Refaça esta etapa conferindo a fórmula, os valores substituídos e a aritmética.');
  }

  /* ---------- exemplos ---------- */
  var r = function (v, u) { return { type: 'R', value: v, unit: u || 'Ω' }; };
  var S = function () { return { type: 'series', items: [].slice.call(arguments) }; };
  var P = function () { return { type: 'parallel', items: [].slice.call(arguments) }; };
  var EXAMPLES = [
    { level: 1, title: 'Um resistor e um par em paralelo', input: { tree: S(r(100), P(r(200), r(200))), known: 'V', source: 12 } },
    { level: 2, title: 'Dois ramos, um deles com série', input: { tree: P(S(r(100), r(200)), r(600)), known: 'V', source: 12 } },
    { level: 3, title: 'Grupos dentro de grupos, com kΩ', input: { tree: S(r(1, 'kΩ'), P(S(r(2.2, 'kΩ'), r(1.8, 'kΩ')), r(4, 'kΩ')), P(r(600), r(300))), known: 'V', source: 16 } }
  ];

  /* ---------- desafios mistos ---------- */
  function challenge(level, rng) {
    rng = rng || Math.random;
    var pick = function (l) { return l[Math.floor(rng() * l.length)]; };
    var pair = function () { var p = pick([[200, 200], [60, 30], [120, 40], [300, 150], [600, 300], [100, 100]]); return P(r(p[0]), r(p[1])); };
    var tree, keys;
    if (level === 1) { tree = S(r(pick([10, 50, 100, 150])), pair()); keys = ['G0', 'Req', 'I']; }
    else if (level === 2) {
      var branch = pick([[100, 200, 600], [200, 400, 300], [100, 500, 300], [50, 150, 200]]);
      tree = S(r(pick([20, 40, 100])), P(S(r(branch[0]), r(branch[1])), r(branch[2]))); keys = ['G0', 'G1', 'Req', 'I', 'V0', 'I3'];
    } else {
      var m = pick([1, 2, 10]);
      tree = S(r(100 * m), P(S(r(60 * m), P(r(80 * m), r(80 * m))), r(100 * m)), P(r(100 * m), r(100 * m))); keys = ['Req', 'I', 'V0', 'I1', 'I2', 'V4', 'P'];
    }
    return { level: level, type: 'mixed', input: { tree: tree, known: 'V', source: pick([6, 12, 24]) }, keys: keys };
  }

  L.mixedChallenge = challenge;
  L.mixed = mixed;
  L.mixedLesson = lesson;
  L.mixedFields = fields;
  L.mixedDiagnose = diagnose;
  L.mixedExpression = expression;
  L.MIXED_EXAMPLES = EXAMPLES;
  L.MIXED_LIMITS = { resistors: MAX_RESISTORS, depth: MAX_DEPTH };
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(this);
