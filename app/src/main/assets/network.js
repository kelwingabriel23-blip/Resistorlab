/* Resistor Lab: circuito livre (ponte, triângulo, estrela, várias fontes) por análise nodal exata. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var L = node ? require('./mixed.js') : root.Lab;
  var fmt = L.fmt, eng = L.eng;
  var NODES = 'ABCDEFGHIJKLMNOP'.split('');
  var UNITS = {
    R: { 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 },
    V: { 'V': 1, 'mV': 1e-3, 'kV': 1e3 },
    I: { 'A': 1, 'mA': 1e-3, 'µA': 1e-6 }
  };
  var MAX = 40;

  /* ---------- frações exatas com BigInt ---------- */
  var big = BigInt, ZERO, ONE;
  function gcd(a, b) { if (a < big(0)) a = -a; while (b) { var t = a % b; a = b; b = t; } return a; }
  function F(n, d) {
    if (d < big(0)) { n = -n; d = -d; }
    var g = gcd(n, d) || big(1);
    return { n: n / g, d: d / g };
  }
  ZERO = F(big(0), big(1)); ONE = F(big(1), big(1));
  var add = function (a, b) { return F(a.n * b.d + b.n * a.d, a.d * b.d); };
  var neg = function (a) { return { n: -a.n, d: a.d }; };
  var sub = function (a, b) { return add(a, neg(b)); };
  var mul = function (a, b) { return F(a.n * b.n, a.d * b.d); };
  var div = function (a, b) { if (b.n === big(0)) throw new Error('Divisão por zero no sistema de equações.'); return F(a.n * b.d, a.d * b.n); };
  var isZero = function (a) { return a.n === big(0); };
  function num(a) {
    var n = a.n, d = a.d, s = Math.max(n.toString().length, d.toString().length) - 280;
    if (s > 0) { var k = big(10) ** big(s); n /= k; d /= k; }
    return Number(n) / Number(d);
  }
  function exact(x) { /* número digitado -> fração exata */
    var m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(x));
    var digits = big(m[2] + (m[3] || '')), places = (m[3] || '').length - Number(m[4] || 0);
    if (m[1]) digits = -digits;
    return places >= 0 ? F(digits, big(10) ** big(places)) : F(digits * big(10) ** big(-places), big(1));
  }
  var unitFraction = { 1: '1', 1000: '1000', 1000000: '1000000', 0.001: '0.001', 0.000001: '0.000001' };

  /* ---------- leitura e validação ---------- */
  function read(input, mode) {
    var list = (input && input.components) || [], count = { R: 0, V: 0, I: 0 };
    if (!list.length) throw new Error('Adicione os componentes do circuito.');
    if (list.length > MAX) throw new Error('O limite é de ' + MAX + ' componentes.');
    return list.map(function (c) {
      if (!UNITS[c.type]) throw new Error('Há um componente de tipo desconhecido.');
      var name = (c.type === 'I' ? 'F' : c.type) + (++count[c.type]); /* F = fonte de corrente */
      if (NODES.indexOf(c.a) < 0 || NODES.indexOf(c.b) < 0) throw new Error(name + ': escolha os dois nós de ligação.');
      if (c.a === c.b) throw new Error(name + ' está com os dois terminais no mesmo nó (' + c.a + '). Ligue em dois nós diferentes.');
      var unit = c.unit || Object.keys(UNITS[c.type])[0], m = UNITS[c.type][unit];
      if (!m) throw new Error(name + ': unidade desconhecida.');
      if (typeof c.value !== 'number' || !isFinite(c.value)) throw new Error(name + ': informe um número válido.');
      if (c.value === 0) throw new Error(name + ' não pode ser zero.' + (c.type === 'R' ? ' Isso causaria uma divisão por zero. Para um fio, use o mesmo nome de nó nas duas pontas.' : ''));
      if (c.value < 0) throw new Error(name + ' não pode ser negativo.' + (c.type === 'R' ? '' : ' Para inverter a fonte, troque os nós.'));
      var v = c.value * m;
      if (v < 1e-6 || v > 1e12) throw new Error(name + ' está fora da faixa aceita pelo aplicativo.');
      return { type: c.type, name: name, a: c.a, b: c.b, value: v, shown: c.value, unit: unit, q: mul(exact(c.value), exact(unitFraction[m])) };
    });
  }
  function finder() {
    var up = {};
    var find = function (x) { while (up[x] !== undefined && up[x] !== x) x = up[x]; return x; };
    return { find: find, join: function (a, b) { var x = find(a), y = find(b); if (x === y) return false; up[x] = y; return true; } };
  }
  function nodesOf(comps) { var s = []; comps.forEach(function (c) { [c.a, c.b].forEach(function (n) { if (s.indexOf(n) < 0) s.push(n); }); }); return s.sort(); }
  function connected(comps, nodes, types) {
    var u = finder(); comps.forEach(function (c) { if (types.indexOf(c.type) >= 0) u.join(c.a, c.b); });
    return nodes.filter(function (n) { return u.find(n) !== u.find(nodes[0]); });
  }
  function warnings(comps, nodes, skip) {
    return nodes.filter(function (n) { return skip.indexOf(n) < 0 && comps.filter(function (c) { return c.a === n || c.b === n; }).length === 1; })
      .map(function (n) { return 'O nó ' + n + ' tem apenas uma ligação: não passa corrente por essa ponta. Verifique se é isso mesmo.'; });
  }

  /* ---------- sistema de equações ---------- */
  function equations(comps, nodes, ground) {
    var unknownNodes = nodes.filter(function (n) { return n !== ground; });
    var sources = comps.filter(function (c) { return c.type === 'V'; });
    var vars = unknownNodes.map(function (n) { return 'V' + n; }).concat(sources.map(function (s) { return 'J' + s.name.slice(1); }));
    var rows = [], info = [], zeros = function () { return vars.map(function () { return ZERO; }); };
    var col = function (n) { return unknownNodes.indexOf(n); };
    unknownNodes.forEach(function (n) {
      var r = zeros(), rhs = ZERO, terms = [];
      comps.forEach(function (c) {
        if (c.a !== n && c.b !== n) return;
        var other = c.a === n ? c.b : c.a, i = col(n), j = col(other);
        if (c.type === 'R') {
          var g = div(ONE, c.q); r[i] = add(r[i], g); if (j >= 0) r[j] = sub(r[j], g);
          terms.push('(V' + n + ' − ' + (other === ground ? '0' : 'V' + other) + ')/' + fmt(c.value));
        } else if (c.type === 'V') {
          var k = unknownNodes.length + sources.indexOf(c), s = c.a === n ? neg(ONE) : ONE; r[k] = add(r[k], s);
          terms.push((c.a === n ? '− ' : '+ ') + vars[k]);
        } else {
          rhs = c.a === n ? add(rhs, c.q) : sub(rhs, c.q);
          terms.push((c.a === n ? '− ' : '+ ') + fmt(c.value));
        }
      });
      rows.push(r.concat([rhs]));
      info.push('Nó ' + n + ': ' + terms.join(' + ').replace(/\+ − /g, '− ').replace(/\+ \+ /g, '+ ') + ' = 0');
    });
    sources.forEach(function (c) {
      var r = zeros(); if (col(c.a) >= 0) r[col(c.a)] = ONE; if (col(c.b) >= 0) r[col(c.b)] = neg(ONE);
      rows.push(r.concat([c.q]));
      info.push('Fonte ' + c.name + ': ' + (c.a === ground ? '0' : 'V' + c.a) + ' − ' + (c.b === ground ? '0' : 'V' + c.b) + ' = ' + fmt(c.value));
    });
    return { vars: vars, rows: rows, info: info, unknownNodes: unknownNodes, sources: sources };
  }
  function showRow(row, vars) {
    var t = '';
    vars.forEach(function (v, i) {
      if (isZero(row[i])) return;
      var x = num(row[i]), a = Math.abs(x), coef = Math.abs(a - 1) < 1e-12 ? '' : fmt(a, 5) + '·';
      t += (t ? (x < 0 ? ' − ' : ' + ') : (x < 0 ? '−' : '')) + coef + v;
    });
    return (t || '0') + ' = ' + fmt(num(row[vars.length]), 6);
  }
  function gauss(sys, log) {
    var m = sys.rows.map(function (r) { return r.slice(); }), n = sys.vars.length;
    if (m.length !== n) throw new Error('Não foi possível montar o sistema deste circuito.');
    for (var c = 0; c < n; c++) {
      var p = -1;
      for (var i = c; i < n; i++) if (!isZero(m[i][c])) { p = i; break; }
      if (p < 0) throw new Error('O circuito não tem uma solução única. Revise as ligações das fontes.');
      var t = m[c]; m[c] = m[p]; m[p] = t;
      var changed = [];
      for (var j = c + 1; j < n; j++) {
        if (isZero(m[j][c])) continue;
        var f = div(m[j][c], m[c][c]);
        m[j] = m[j].map(function (v, k) { return sub(v, mul(f, m[c][k])); });
        changed.push('  Equação ' + (j + 1) + ' − (' + fmt(num(f), 5) + ') × equação ' + (c + 1) + ' → ' + showRow(m[j], sys.vars));
      }
      if (log && changed.length) log.push('Eliminar ' + sys.vars[c] + ' usando a equação ' + (c + 1) + ' [' + showRow(m[c], sys.vars) + ']:', changed.join('\n'));
    }
    var x = new Array(n);
    for (var r = n - 1; r >= 0; r--) {
      var acc = m[r][n];
      for (var q = r + 1; q < n; q++) acc = sub(acc, mul(m[r][q], x[q]));
      x[r] = div(acc, m[r][r]);
      if (log) log.push('Substituição de volta: ' + showRow(m[r], sys.vars) + ' → ' + sys.vars[r] + ' = ' + fmt(num(x[r])));
    }
    return x;
  }
  function potentials(comps, nodes, ground, log) {
    var sys = equations(comps, nodes, ground), x = gauss(sys, log), v = {}, j = {};
    v[ground] = ZERO;
    sys.unknownNodes.forEach(function (n, i) { v[n] = x[i]; });
    sys.sources.forEach(function (s, i) { j[s.name] = x[sys.unknownNodes.length + i]; });
    return { v: v, j: j, sys: sys };
  }
  /* corrente de cada componente: resistor de a para b; fonte: corrente fornecida (sai pelo terminal a) */
  function element(c, sol) {
    var u = sub(sol.v[c.a], sol.v[c.b]);
    var i = c.type === 'R' ? div(u, c.q) : c.type === 'V' ? sol.j[c.name] : c.q;
    return { u: u, i: i, p: mul(u, i) };
  }

  /* Malhas independentes: árvore geradora + um componente que fecha cada malha. */
  function loops(comps, nodes) {
    var u = finder(), tree = [], chords = [];
    comps.forEach(function (c) { (u.join(c.a, c.b) ? tree : chords).push(c); });
    return chords.map(function (ch) {
      var path = (function search(at, seen) {
        if (at === ch.a) return [];
        for (var i = 0; i < tree.length; i++) {
          var e = tree[i], next = e.a === at ? e.b : e.b === at ? e.a : null;
          if (next === null || seen.indexOf(next) >= 0) continue;
          var rest = search(next, seen.concat(next));
          if (rest) return [{ c: e, from: at }].concat(rest);
        }
        return null;
      })(ch.b, [ch.b]);
      return [{ c: ch, from: ch.a }].concat(path);
    });
  }

  /* ---------- circuito com fontes ---------- */
  function network(input) {
    if (input && input.mode === 'req') return requivalent(input);
    var comps = read(input), nodes = nodesOf(comps);
    var srcs = comps.filter(function (c) { return c.type !== 'R'; });
    if (!srcs.length) throw new Error('Adicione pelo menos uma fonte. Sem fontes, use o modo "Resistência entre dois pontos".');
    var apart = connected(comps, nodes, ['R', 'V', 'I']);
    if (apart.length) throw new Error('O circuito está dividido em partes sem ligação. O(s) nó(s) ' + apart.join(', ') + ' não chega(m) ao nó ' + nodes[0] + '.');
    var vu = finder();
    comps.forEach(function (c) { if (c.type === 'V' && !vu.join(c.a, c.b)) throw new Error(c.name + ' fecha uma malha formada só por fontes de tensão ideais (por exemplo, duas fontes em paralelo). Isso não tem solução física única. Coloque um resistor na malha.'); });
    var cut = connected(comps, nodes, ['R', 'V']);
    if (cut.length) throw new Error('O(s) nó(s) ' + cut.join(', ') + ' se liga(m) ao resto apenas por fontes de corrente. A tensão ficaria indefinida. Adicione um caminho com resistor.');
    var ground = input.ground && nodes.indexOf(input.ground) >= 0 ? input.ground : (srcs.filter(function (c) { return c.type === 'V'; })[0] || srcs[0]).b;
    var log = [], sol = potentials(comps, nodes, ground, log);
    var items = comps.map(function (c) { var e = element(c, sol); return { name: c.name, type: c.type, a: c.a, b: c.b, value: c.value, shown: c.shown, unit: c.unit, V: num(e.u), I: num(e.i), P: num(e.p), exact: e }; });
    var volt = {}; nodes.forEach(function (n) { volt[n] = num(sol.v[n]); });
    var out = { kind: 'network', mode: 'solve', input: input, comps: comps, nodes: nodes, ground: ground, voltages: volt, items: items, equations: sol.sys.info, matrix: sol.sys.rows.map(function (r) { return showRow(r, sol.sys.vars); }), solveLog: log, warnings: warnings(comps, nodes, []) };

    /* superposição: uma fonte ligada de cada vez (as outras fontes de tensão viram fio; as de corrente, circuito aberto) */
    out.superposition = srcs.length < 2 ? [] : srcs.map(function (s) {
      var only = comps.map(function (c) { return c.type === 'R' || c === s ? c : Object.assign({}, c, { q: ZERO, value: 0 }); });
      var part = potentials(only, nodes, ground), cur = {};
      only.forEach(function (c) { if (c.type === 'R') cur[c.name] = element(c, part).i; });
      return { source: s.name, currents: cur };
    });

    /* conferências exatas */
    var checks = [], check = function (name, text, ok) { checks.push({ name: name, text: text, ok: ok }); };
    var kcl = nodes.every(function (n) {
      var total = ZERO;
      items.forEach(function (x) {
        if (x.a !== n && x.b !== n) return;
        var leaving = x.type === 'R' ? (x.a === n ? x.exact.i : neg(x.exact.i)) : (x.a === n ? neg(x.exact.i) : x.exact.i);
        total = add(total, leaving);
      });
      return isZero(total);
    });
    check('Lei das correntes (Kirchhoff)', 'Nos ' + nodes.length + ' nós, inclusive o de referência ' + ground + ', a soma das correntes é zero.', kcl);
    var cycles = loops(comps, nodes);
    var kvl = cycles.every(function (cy) {
      var total = ZERO;
      cy.forEach(function (s) {
        var x = items.filter(function (y) { return y.name === s.c.name; })[0];
        var u = x.type === 'R' ? mul(x.exact.i, s.c.q) : x.type === 'V' ? s.c.q : x.exact.u;
        total = add(total, s.from === s.c.a ? u : neg(u));
      });
      return isZero(total);
    });
    check('Lei das tensões (Kirchhoff)', 'Em ' + cycles.length + ' malha(s) independente(s), a soma das tensões ao dar a volta é zero.', kvl);
    var given = ZERO, used = ZERO;
    items.forEach(function (x) { if (x.type === 'R') used = add(used, x.exact.p); else given = add(given, x.exact.p); });
    check('Potência', 'Potência líquida das fontes (' + eng(num(given), 'W') + ') = potência dissipada nos resistores (' + eng(num(used), 'W') + ').', isZero(sub(given, used)));
    if (out.superposition.length) {
      var sp = items.filter(function (x) { return x.type === 'R'; }).every(function (x) {
        return isZero(sub(out.superposition.reduce(function (a, s) { return add(a, s.currents[x.name]); }, ZERO), x.exact.i));
      });
      check('Superposição', 'Somando o efeito de cada fonte sozinha, obtemos as mesmas correntes nos resistores.', sp);
    }
    out.checks = checks;
    out.P = num(used);
    return out;
  }

  /* ---------- resistência entre dois pontos: reduções série, paralelo e estrela → triângulo ---------- */
  function reduce(comps, t1, t2) {
    var edges = comps.map(function (c) { return { name: c.name, a: c.a, b: c.b, R: c.value }; }), steps = [], k = 0;
    var snapshot = function () { return edges.map(function (e) { return { type: 'R', name: e.name, a: e.a, b: e.b, value: e.R }; }); };
    var at = function (n) { return edges.filter(function (e) { return e.a === n || e.b === n; }); };
    var other = function (e, n) { return e.a === n ? e.b : e.a; };
    var inner = function () { return nodesOf(edges).filter(function (n) { return n !== t1 && n !== t2; }); };
    function apply(type, removed, created, text, subs, divisions) {
      var before = snapshot();
      edges = edges.filter(function (e) { return removed.indexOf(e) < 0; }).concat(created);
      steps.push({ type: type, removed: removed.map(function (e) { return e.name; }), created: created.map(function (e) { return e.name; }), text: text, subs: subs, divisions: divisions || [], before: before, after: snapshot() });
    }
    var made = function (a, b, R) { return { name: 'X' + (++k), a: a, b: b, R: R }; };
    for (var guard = 0; guard < 200; guard++) {
      if (edges.length === 1 && ((edges[0].a === t1 && edges[0].b === t2) || (edges[0].a === t2 && edges[0].b === t1))) return { ok: true, steps: steps, R: edges[0].R };
      var done = false;
      /* ponta solta */
      inner().some(function (n) {
        var l = at(n); if (l.length !== 1) return false;
        apply('dangling', l, [], l[0].name + ' termina no nó ' + n + ', sem outra ligação. Não passa corrente por ele, então pode ser retirado.', []); return (done = true);
      });
      if (done) continue;
      /* paralelo */
      edges.some(function (e, i) {
        return edges.slice(i + 1).some(function (f) {
          if (!((e.a === f.a && e.b === f.b) || (e.a === f.b && e.b === f.a))) return false;
          var R = 1 / (1 / e.R + 1 / f.R), x = made(e.a, e.b, R);
          apply('parallel', [e, f], [x], e.name + ' e ' + f.name + ' ligam os mesmos nós (' + e.a + ' e ' + e.b + '): estão em PARALELO e viram ' + x.name + '.',
            [x.name + ' = (' + e.name + ' × ' + f.name + ') ÷ (' + e.name + ' + ' + f.name + ')', x.name + ' = ' + fmt(e.R * f.R) + ' ÷ ' + fmt(e.R + f.R) + ' ≈ ' + fmt(R) + ' Ω'], [[e.R * f.R, e.R + f.R]]);
          return (done = true);
        });
      });
      if (done) continue;
      /* série */
      inner().some(function (n) {
        var l = at(n); if (l.length !== 2) return false;
        var e = l[0], f = l[1], x = made(other(e, n), other(f, n), e.R + f.R);
        apply('series', [e, f], [x], e.name + ' e ' + f.name + ' são os únicos ligados ao nó ' + n + ': estão em SÉRIE e viram ' + x.name + '.', [x.name + ' = ' + fmt(e.R) + ' + ' + fmt(f.R) + ' ≈ ' + fmt(x.R) + ' Ω']);
        return (done = true);
      });
      if (done) continue;
      /* estrela -> triângulo */
      inner().some(function (n) {
        var l = at(n); if (l.length !== 3) return false;
        var e = l[0], f = l[1], g = l[2], ne = other(e, n), nf = other(f, n), ng = other(g, n);
        var N = e.R * f.R + f.R * g.R + g.R * e.R;
        var x = made(ne, nf, N / g.R), y = made(nf, ng, N / e.R), z = made(ng, ne, N / f.R);
        apply('star', [e, f, g], [x, y, z], 'Não há série nem paralelo disponível. ' + e.name + ', ' + f.name + ' e ' + g.name + ' formam uma ESTRELA com centro no nó ' + n + '. Transformamos em um TRIÂNGULO entre os nós ' + ne + ', ' + nf + ' e ' + ng + '.',
          ['N = ' + e.name + '×' + f.name + ' + ' + f.name + '×' + g.name + ' + ' + g.name + '×' + e.name + ' ≈ ' + fmt(N),
            x.name + ' (entre ' + ne + ' e ' + nf + ') = N ÷ ' + g.name + ' = ' + fmt(N) + ' ÷ ' + fmt(g.R) + ' ≈ ' + fmt(x.R) + ' Ω',
            y.name + ' (entre ' + nf + ' e ' + ng + ') = N ÷ ' + e.name + ' = ' + fmt(N) + ' ÷ ' + fmt(e.R) + ' ≈ ' + fmt(y.R) + ' Ω',
            z.name + ' (entre ' + ng + ' e ' + ne + ') = N ÷ ' + f.name + ' = ' + fmt(N) + ' ÷ ' + fmt(f.R) + ' ≈ ' + fmt(z.R) + ' Ω'],
          [[N, g.R], [N, e.R], [N, f.R]]);
        return (done = true);
      });
      if (!done) break;
    }
    return { ok: false, steps: steps, R: null };
  }

  function requivalent(input) {
    var comps = read(input), nodes = nodesOf(comps), t = input.terminals || [];
    if (comps.some(function (c) { return c.type !== 'R'; })) throw new Error('No modo "Resistência entre dois pontos" use apenas resistores. Remova as fontes ou mude o modo.');
    if (t.length !== 2 || t[0] === t[1]) throw new Error('Escolha dois pontos de medição diferentes.');
    if (nodes.indexOf(t[0]) < 0 || nodes.indexOf(t[1]) < 0) throw new Error('Os pontos de medição precisam estar ligados a algum resistor.');
    var apart = connected(comps, nodes, ['R']);
    if (apart.length) throw new Error('Há resistores sem ligação com o restante. Verifique o(s) nó(s) ' + apart.join(', ') + '.');
    var test = { type: 'V', name: 'V1', a: t[0], b: t[1], value: 1, q: ONE };
    var log = [], sol = potentials(comps.concat([test]), nodes, t[1], log);
    var R = div(ONE, sol.j.V1), reduction = reduce(comps, t[0], t[1]), Req = num(R);
    var checks = [{ name: 'Método nodal', text: 'Com uma fonte de teste de 1 V, a corrente é ' + eng(num(sol.j.V1), 'A') + ', logo Req = 1 V ÷ I = ' + eng(Req, 'Ω') + '.', ok: Req > 0 }];
    if (reduction.ok) checks.push({ name: 'Dois métodos', text: 'A redução passo a passo (' + eng(reduction.R, 'Ω') + ') e o método nodal (' + eng(Req, 'Ω') + ') concordam.', ok: Math.abs(reduction.R - Req) <= Req * 1e-6 });
    return { kind: 'network', mode: 'req', input: input, comps: comps, nodes: nodes, terminals: t, Req: Req, reduction: reduction, equations: sol.sys.info, solveLog: log, testCurrent: num(sol.j.V1), checks: checks, warnings: warnings(comps, nodes, t) };
  }

  /* ---------- conversor triângulo <-> estrela ---------- */
  function deltaStar(direction, r) {
    r.forEach(function (v, i) { if (typeof v !== 'number' || !isFinite(v) || v <= 0 || v < 1e-6 || v > 1e12) throw new Error('O valor ' + (i + 1) + ' precisa ser maior que zero e estar na faixa aceita.'); });
    var x = r[0], y = r[1], z = r[2], out, steps = [], divs = [];
    if (direction === 'toStar') { /* x=Rab y=Rbc z=Rca */
      var s = x + y + z; out = [x * z / s, x * y / s, y * z / s];
      steps = ['Soma S = Rab + Rbc + Rca = ' + fmt(x) + ' + ' + fmt(y) + ' + ' + fmt(z) + ' = ' + fmt(s) + ' Ω',
        'Ra = (Rab × Rca) ÷ S = ' + fmt(x * z) + ' ÷ ' + fmt(s) + ' ≈ ' + fmt(out[0]) + ' Ω',
        'Rb = (Rab × Rbc) ÷ S = ' + fmt(x * y) + ' ÷ ' + fmt(s) + ' ≈ ' + fmt(out[1]) + ' Ω',
        'Rc = (Rbc × Rca) ÷ S = ' + fmt(y * z) + ' ÷ ' + fmt(s) + ' ≈ ' + fmt(out[2]) + ' Ω'];
      divs = [[x * z, s], [x * y, s], [y * z, s]];
    } else if (direction === 'toDelta') { /* x=Ra y=Rb z=Rc */
      var n = x * y + y * z + z * x; out = [n / z, n / x, n / y];
      steps = ['N = Ra×Rb + Rb×Rc + Rc×Ra = ' + fmt(x * y) + ' + ' + fmt(y * z) + ' + ' + fmt(z * x) + ' = ' + fmt(n),
        'Rab = N ÷ Rc = ' + fmt(n) + ' ÷ ' + fmt(z) + ' ≈ ' + fmt(out[0]) + ' Ω',
        'Rbc = N ÷ Ra = ' + fmt(n) + ' ÷ ' + fmt(x) + ' ≈ ' + fmt(out[1]) + ' Ω',
        'Rca = N ÷ Rb = ' + fmt(n) + ' ÷ ' + fmt(y) + ' ≈ ' + fmt(out[2]) + ' Ω'];
      divs = [[n, z], [n, x], [n, y]];
    } else throw new Error('Escolha o sentido da conversão.');
    return { values: out, steps: steps, divisions: divs, names: direction === 'toStar' ? ['Ra', 'Rb', 'Rc'] : ['Rab', 'Rbc', 'Rca'] };
  }

  /* conversão como cálculo completo: aula, correção, histórico */
  function delta(input) {
    var m = input.units || ['Ω', 'Ω', 'Ω'];
    var ohms = input.values.map(function (v, i) { return v * UNITS.R[m[i]]; });
    var d = deltaStar(input.direction, ohms), toStar = input.direction === 'toStar';
    var from = toStar ? ['Rab', 'Rbc', 'Rca'] : ['Ra', 'Rb', 'Rc'];
    /* conferência: a resistência entre cada par de terminais precisa ser igual nas duas formas */
    var D = toStar ? ohms : d.values, Y = toStar ? d.values : ohms, total = D[0] + D[1] + D[2];
    var checks = [['A', 'B', 0, 0, 1], ['B', 'C', 1, 1, 2], ['C', 'A', 2, 2, 0]].map(function (t) {
      var viaD = D[t[2]] * (total - D[t[2]]) / total, viaY = Y[t[3]] + Y[t[4]];
      return { name: 'Entre ' + t[0] + ' e ' + t[1], text: 'triângulo ' + eng(viaD, 'Ω') + ' = estrela ' + eng(viaY, 'Ω') + '.', ok: Math.abs(viaD - viaY) <= viaD * 1e-9 };
    });
    return { kind: 'delta', input: input, direction: input.direction, from: from, given: ohms, names: d.names, values: d.values, steps: d.steps, divisions: d.divisions, checks: checks };
  }
  function deltaLesson(c) {
    var toStar = c.direction === 'toStar';
    var order = '1º: anotar os três valores e onde estão. 2º: calcular a soma (ou N). 3º: calcular os três novos resistores. 4º: conferir.';
    var first = step('data', 'Anotar os dados', { why: toStar ? 'No triângulo, Rab liga A e B, Rbc liga B e C e Rca liga C e A.' : 'Na estrela, Ra, Rb e Rc ligam os terminais A, B e C ao nó central.', simple: 'Confira a posição de cada resistor antes da conta.', symbols: [SYM.star], subs: c.from.map(function (n, i) { return n + ' = ' + fmt(c.given[i]) + ' Ω'; }) });
    first.order = order;
    var s = [first, step(toStar ? 'sum' : 'sum', toStar ? 'Somar os resistores do triângulo' : 'Somar os produtos dois a dois', { why: 'Este número se repete nas três fórmulas.', simple: 'Calcule uma vez e reutilize.', formula: toStar ? 'S = Rab + Rbc + Rca' : 'N = Ra×Rb + Rb×Rc + Rc×Ra', symbols: [SYM.star], subs: [c.steps[0]] })];
    var formulas = toStar ? ['Ra = Rab × Rca ÷ S', 'Rb = Rab × Rbc ÷ S', 'Rc = Rbc × Rca ÷ S'] : ['Rab = N ÷ Rc', 'Rbc = N ÷ Ra', 'Rca = N ÷ Rb'];
    c.names.forEach(function (n, i) {
      s.push(step('out' + i, 'Calcular ' + n, { why: toStar ? 'Cada resistor da estrela é o produto dos dois resistores do triângulo que tocam o mesmo terminal, dividido pela soma.' : 'Cada lado do triângulo é N dividido pelo resistor da estrela do terminal oposto.', simple: 'Troque as letras pelos números e faça a divisão.', formula: formulas[i], symbols: [SYM.star], subs: [c.steps[i + 1]], divisions: [c.divisions[i]], result: n + ' = ' + eng(c.values[i], 'Ω') }));
    });
    s.push(step('check', 'Conferir o resultado', { why: 'As duas formas precisam ter a mesma resistência entre cada par de terminais, com o terceiro desligado.', simple: 'Quem olha de fora não percebe a troca.', subs: c.checks.map(function (k) { return (k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text; }) }));
    return s;
  }
  function deltaFields(c) { return c.names.map(function (n, i) { return { key: 'D' + i, label: n, unit: 'Ω', value: c.values[i], topic: 'out' + i }; }); }
  function deltaDiagnose(c, key, user) {
    var f = deltaFields(c)[Number(key.slice(1))], i = Number(key.slice(1));
    var match = function (u, v) { return Math.abs(u - v) <= Math.abs(v) * 0.01; };
    var out = { key: key, label: f.label, unit: 'Ω', user: user, expected: f.value, topic: f.topic, ok: match(user, f.value), carried: false, message: '' };
    var say = function (m) { out.message = m; return out; };
    if (out.ok) return say('Correto!');
    if (c.values.some(function (v, j) { return j !== i && match(user, v); })) return say('Esse é o valor de outro resistor da conversão. Confira quais terminais ele liga.');
    if ([1e3, 1e-3].some(function (k) { return match(user, f.value * k); })) return say('Há um erro de unidade ou de vírgula. Confira os prefixos.');
    var g = c.given, S = g[0] + g[1] + g[2];
    if (c.direction === 'toStar' && [g[0] * g[1], g[1] * g[2], g[0] * g[2]].some(function (v) { return match(user, v); })) return say('Faltou dividir o produto pela soma S.');
    if (c.direction === 'toStar' && match(user, S)) return say('Essa é a soma S. Ainda falta calcular o resistor da estrela.');
    return say('Não reconheci o tipo de erro. Confira quais resistores entram na fórmula e refaça a conta.');
  }

  /* ---------- aula ---------- */
  function step(topic, title, o) {
    return { topic: topic, title: title, why: o.why || '', simple: o.simple || '', formula: o.formula || '', symbols: o.symbols || [], subs: o.subs || [], divisions: o.divisions || [], result: o.result || '', graph: o.graph || null };
  }
  var SYM = {
    node: 'Nó = ponto em que componentes se ligam. VA, VB… = tensão de cada nó em relação ao nó de referência, em volts (V).',
    ref: 'Nó de referência (terra) = ponto escolhido como 0 V.',
    J: 'J1, J2… = corrente fornecida por cada fonte de tensão, em ampères (A), saindo pelo polo +. É uma incógnita.',
    R: 'R = resistência em ohms (Ω). (VA − VB)/R é a corrente que vai de A para B.',
    star: 'Estrela (Y) = três resistores unidos em um nó central. Triângulo (Δ) = três resistores formando um laço entre três nós.',
    N: 'N = soma dos produtos dois a dois dos três resistores da estrela. X1, X2… = resistores equivalentes criados.'
  };
  function describeComponent(c) {
    if (c.type === 'R') return c.name + ' = ' + fmt(c.value) + ' Ω, entre ' + c.a + ' e ' + c.b;
    if (c.type === 'V') return c.name + ' = fonte de ' + fmt(c.value) + ' V, polo + em ' + c.a + ' e polo − em ' + c.b;
    return c.name + ' = fonte de corrente de ' + fmt(c.value) + ' A, entrega corrente no nó ' + c.a + ' e retira do nó ' + c.b;
  }
  function graphOf(comps) { return comps.map(function (c) { return { type: c.type, name: c.name, a: c.a, b: c.b, value: c.value }; }); }

  function lesson(c) { return c.mode === 'req' ? reqLesson(c) : solveLesson(c); }

  function reqLesson(c) {
    var s = [], t = c.terminals, order = 'Procure primeiro pontas soltas, depois paralelos e séries. Só quando não houver nenhum, use a transformação estrela → triângulo.';
    var first = step('data', 'Ler o circuito', { why: 'Queremos a resistência vista entre os nós ' + t[0] + ' e ' + t[1] + '. ' + order, simple: 'Vamos trocar pedaços do circuito por pedaços equivalentes até sobrar um resistor entre ' + t[0] + ' e ' + t[1] + '.', symbols: [SYM.R, SYM.star, SYM.N], subs: c.comps.map(describeComponent), graph: graphOf(c.comps) });
    first.order = order + (c.reduction.steps.length ? '\nNeste circuito:\n' + c.reduction.steps.map(function (x, i) { return (i + 1) + 'º: ' + x.text; }).join('\n') : '');
    s.push(first);
    c.reduction.steps.forEach(function (x, i) {
      var title = { dangling: 'Retirar ponta solta', parallel: 'Reduzir paralelo', series: 'Reduzir série', star: 'Transformar estrela em triângulo' }[x.type];
      s.push(step('red' + i, (i + 1) + 'ª redução: ' + title, { why: x.text, simple: x.type === 'star' ? 'A estrela e o triângulo se comportam igual para o resto do circuito. A troca abre caminho para novos paralelos.' : 'O novo circuito se comporta igual ao anterior entre os pontos de medição.', formula: { dangling: '', parallel: 'X = (R1 × R2) ÷ (R1 + R2)', series: 'X = R1 + R2', star: 'Rab = N ÷ Rc,  Rbc = N ÷ Ra,  Rca = N ÷ Rb' }[x.type], symbols: x.type === 'star' ? [SYM.star, SYM.N] : [SYM.R], subs: x.subs, divisions: x.divisions, graph: x.after }));
    });
    s.push(step('req', 'Calcular pelo método nodal', { why: (c.reduction.ok ? 'Como segundo método, ' : 'A redução não basta para este circuito. Usamos o método nodal: ') + 'ligamos uma fonte de teste de 1 V entre ' + t[0] + ' e ' + t[1] + ' e calculamos a corrente que ela fornece.', simple: 'Se 1 V produz uma corrente I, a resistência é 1 dividido por I.', formula: 'Req = 1 V ÷ I', symbols: [SYM.node, SYM.J], subs: c.equations.concat(['I = J1 ≈ ' + fmt(c.testCurrent) + ' A', 'Req = 1 ÷ ' + fmt(c.testCurrent) + ' ≈ ' + fmt(c.Req) + ' Ω']), divisions: [[1, c.testCurrent]], result: 'Req = ' + eng(c.Req, 'Ω') }));
    s.push(step('solve', 'Resolver o sistema, linha por linha', { why: 'Eliminação: usamos uma equação para fazer uma incógnita sumir das outras e depois substituímos de volta.', simple: 'É como resolver um sistema da escola, uma letra de cada vez.', symbols: [SYM.node, SYM.J], subs: c.solveLog }));
    s.push(step('check', 'Conferir o resultado', { why: 'Conferimos o valor.', simple: 'É a prova real.', subs: c.checks.map(function (k) { return (k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text; }) }));
    return s;
  }

  function solveLesson(c) {
    var s = [], rs = c.items.filter(function (x) { return x.type === 'R'; }), vs = c.items.filter(function (x) { return x.type === 'V'; });
    var order = '1º: anotar os dados. 2º: escolher o nó de referência. 3º: escrever uma equação por nó e uma por fonte de tensão. 4º: resolver o sistema. 5º: calcular as correntes dos resistores. 6º: potências e conferência.';
    var first = step('data', 'Ler o circuito', { why: 'Circuitos com ponte ou várias fontes nem sempre se reduzem com série e paralelo. O método nodal funciona para circuitos de resistores com fontes ideais bem ligadas.', simple: 'Cada ponto de ligação recebe um nome. Vamos descobrir a tensão de cada ponto.', symbols: [SYM.node, SYM.R], subs: c.comps.map(describeComponent), graph: graphOf(c.comps) });
    first.order = order; s.push(first);
    s.push(step('ground', 'Escolher o nó de referência', { why: 'Tensão é sempre uma diferença entre dois pontos. Definimos o nó ' + c.ground + ' como 0 V e medimos os outros em relação a ele.', simple: 'É como escolher o andar térreo antes de medir alturas.', symbols: [SYM.ref], subs: ['V' + c.ground + ' = 0 V'] }));
    s.push(step('equations', 'Montar as equações', { why: 'Lei das correntes de Kirchhoff: em cada nó, a soma das correntes que SAEM é zero. Cada fonte de tensão fixa a diferença entre seus dois nós e tem uma corrente desconhecida J.', simple: 'Para cada ponto, escreva tudo o que sai dele. Corrente que entra aparece com sinal de menos.', formula: 'Σ (Vnó − Vvizinho)/R ± correntes das fontes = 0', symbols: [SYM.node, SYM.ref, SYM.J, SYM.R], subs: c.equations.concat(['', 'Forma organizada (coeficientes calculados):']).concat(c.matrix.map(function (m, i) { return (i + 1) + ') ' + m; })), divisions: rs.slice(0, 12).map(function (x) { return [1, x.value]; }) }));
    s.push(step('solve', 'Resolver o sistema', { why: 'Eliminamos uma incógnita por vez e depois substituímos de volta. A calculadora usa frações exatas; os números mostrados são arredondados.', simple: 'Use uma equação para fazer uma letra desaparecer das outras. Quando sobrar uma letra só, ache o valor e volte.', symbols: [SYM.node, SYM.J], subs: c.solveLog, result: c.nodes.map(function (n) { return 'V' + n + ' = ' + eng(c.voltages[n], 'V'); }).join('   ') }));
    s.push(step('current', 'Calcular a corrente em cada resistor', { why: 'Com as tensões dos nós, a tensão no resistor é a diferença entre suas pontas. A corrente positiva vai do primeiro nó para o segundo; se der negativa, ela corre no sentido contrário.', simple: 'Subtraia as tensões das duas pontas e divida pela resistência.', formula: 'I = (Va − Vb) ÷ R', symbols: [SYM.node, SYM.R], subs: rs.map(function (x) { return x.name + ' (' + x.a + '→' + x.b + '): V = ' + fmt(c.voltages[x.a]) + ' − ' + wrap(c.voltages[x.b]) + ' ≈ ' + fmt(x.V) + ' V; I = ' + fmt(x.V) + ' ÷ ' + fmt(x.value) + ' ≈ ' + fmt(x.I) + ' A'; }).concat(vs.map(function (x) { return 'Fonte ' + x.name + ': corrente fornecida ≈ ' + fmt(x.I) + ' A'; })), divisions: rs.filter(function (x) { return x.V !== 0; }).map(function (x) { return [Math.abs(x.V), x.value]; }) }));
    if (c.superposition.length) s.push(step('superposition', 'Entender o efeito de cada fonte (superposição)', { why: 'Deixamos uma fonte ligada de cada vez: as outras fontes de tensão viram um fio e as de corrente ficam abertas. A soma das correntes parciais é a corrente real. Isso vale para correntes e tensões, mas NÃO para potências.', simple: 'Calcule o que cada fonte faz sozinha e some, respeitando os sinais.', formula: 'I = I(só fonte 1) + I(só fonte 2) + …', subs: rs.map(function (x) { return x.name + ': ' + c.superposition.map(function (p) { return '(' + fmt(num(p.currents[x.name]), 5) + ' de ' + p.source + ')'; }).join(' + ') + ' = ' + fmt(x.I, 5) + ' A'; }) }));
    s.push(step('pi', 'Calcular as potências', { why: 'Resistor sempre dissipa potência. Uma fonte com potência positiva está entregando energia; negativa, está recebendo (como uma bateria sendo carregada).', simple: 'Multiplique tensão por corrente. Nos resistores o resultado nunca é negativo.', formula: 'P = V × I', symbols: ['P = potência em watts (W).'], subs: c.items.map(function (x) { return x.name + ': ' + fmt(x.V) + ' × ' + wrap(x.I) + ' ≈ ' + fmt(x.P) + ' W' + (x.type === 'R' ? '' : x.P >= 0 ? ' (entrega)' : ' (recebe)'); }) }));
    s.push(step('check', 'Conferir pelas leis de Kirchhoff', { why: 'A conferência é feita com frações exatas, sem arredondamento.', simple: 'É a prova real do circuito.', subs: c.checks.map(function (k) { return (k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text; }) }));
    return s;
  }
  function wrap(x) { return x < 0 ? '(' + fmt(x) + ')' : fmt(x); }

  /* ---------- correção ---------- */
  function fields(c) {
    if (c.mode === 'req') return [{ key: 'Req', label: 'Resistência entre ' + c.terminals[0] + ' e ' + c.terminals[1], unit: 'Ω', value: c.Req, topic: 'req' }];
    var f = [];
    c.nodes.forEach(function (n) { if (n !== c.ground) f.push({ key: 'N' + n, label: 'Tensão no nó ' + n, unit: 'V', value: c.voltages[n], topic: 'solve', signed: true, node: n }); });
    c.items.forEach(function (x) { if (x.type === 'R') f.push({ key: 'I' + x.name, label: 'Corrente em ' + x.name + ' (de ' + x.a + ' para ' + x.b + ')', unit: 'A', value: x.I, topic: 'current', signed: true, item: x }); });
    c.items.forEach(function (x) { if (x.type === 'V') f.push({ key: 'J' + x.name, label: 'Corrente fornecida por ' + x.name, unit: 'A', value: x.I, topic: 'current', signed: true, item: x }); });
    c.items.forEach(function (x) { if (x.type === 'R') f.push({ key: 'P' + x.name, label: 'Potência em ' + x.name, unit: 'W', value: x.P, topic: 'pi', item: x }); });
    return f;
  }
  function diagnose(c, key, user, answers) {
    var all = fields(c), f = all.filter(function (x) { return x.key === key; })[0];
    var scale = Math.max.apply(null, all.filter(function (x) { return x.unit === f.unit; }).map(function (x) { return Math.abs(x.value); }));
    var match = function (u, v) { return Math.abs(u - v) <= Math.max(Math.abs(v) * 0.01, scale * 1e-9); };
    var out = { key: key, label: f.label, unit: f.unit, user: user, expected: f.value, topic: f.topic, ok: match(user, f.value), carried: false, message: '' };
    var say = function (m) { out.message = m; return out; };
    if (out.ok) return say('Correto!');
    var a = answers || {};
    var node = function (n) { return n === c.ground ? 0 : a['N' + n]; };
    var x = f.item;
    if (x && key[0] === 'I' && node(x.a) !== undefined && node(x.b) !== undefined) {
      var chain = (node(x.a) - node(x.b)) / x.value;
      if (!match(chain, f.value) && match(user, chain)) { out.carried = true; return say('A conta desta etapa está certa, mas usou tensões de nó erradas. Corrija o primeiro erro.'); }
    }
    if (x && key[0] === 'P' && a['I' + x.name] !== undefined) {
      var p = a['I' + x.name] * a['I' + x.name] * x.value;
      if (!match(p, f.value) && match(user, p)) { out.carried = true; return say('A conta desta etapa está certa, mas usou uma corrente errada. Corrija o primeiro erro.'); }
    }
    if (f.value !== 0 && match(-user, f.value)) return say(f.signed ? 'O valor está certo, mas o SINAL está invertido. Confira o sentido pedido: corrente positiva vai do primeiro nó para o segundo, e a tensão do nó é medida em relação à referência.' : 'A potência em um resistor nunca é negativa.');
    var scales = [1e3, 1e-3, 1e6, 1e-6];
    for (var i = 0; i < scales.length; i++) if (f.value !== 0 && match(user, f.value * scales[i])) return say('Os algarismos estão certos, mas há um erro de unidade ou de vírgula. Confira os prefixos (k, M, m).');
    if (c.mode === 'req') {
      var rs = c.comps.map(function (z) { return z.value; }), total = rs.reduce(function (u, v) { return u + v; }, 0);
      if (match(user, total)) return say('Você somou todos os resistores como se estivessem em série.');
      if (match(user, 1 / rs.reduce(function (u, v) { return u + 1 / v; }, 0))) return say('Você tratou todos os resistores como se estivessem em paralelo.');
    } else {
      if (key[0] === 'I' && x) {
        for (var s = 0; s < c.superposition.length; s++) if (match(user, num(c.superposition[s].currents[x.name]))) return say('Esse é o efeito de apenas uma das fontes. Some as contribuições de todas, com os sinais.');
        if (x.V !== 0 && match(user, x.V * x.value)) return say('Você multiplicou. A corrente é a diferença de tensão DIVIDIDA pela resistência.');
        if (match(user, c.voltages[x.a] / x.value)) return say('Você usou só a tensão de um nó. Use a diferença: (Va − Vb) ÷ R.');
      }
      if (key[0] === 'P' && x) { if (match(user, x.V / x.I)) return say('Você dividiu. A potência é V × I.'); }
    }
    if (Math.abs(user - f.value) <= Math.abs(f.value) * 0.05) return say('Está perto. Provavelmente você arredondou cedo demais.');
    return say('Não reconheci o tipo de erro. Refaça esta etapa conferindo as equações, os sinais e a aritmética.');
  }

  /* ---------- modelos prontos e desafios ---------- */
  var r = function (a, b, v, u) { return { type: 'R', a: a, b: b, value: v, unit: u || 'Ω' }; };
  var vs = function (a, b, v) { return { type: 'V', a: a, b: b, value: v, unit: 'V' }; };
  var cs = function (a, b, v, u) { return { type: 'I', a: a, b: b, value: v, unit: u || 'A' }; };
  var bridge = function (v) { return [r('A', 'B', v[0]), r('A', 'C', v[1]), r('B', 'D', v[2]), r('C', 'D', v[3]), r('B', 'C', v[4])]; };
  var PRESETS = [
    { id: 'bridge-v', title: 'Ponte de Wheatstone com fonte', input: { mode: 'solve', components: [vs('A', 'D', 12)].concat(bridge([100, 200, 300, 400, 500])) } },
    { id: 'bridge-req', title: 'Ponte: resistência entre A e D', input: { mode: 'req', terminals: ['A', 'D'], components: bridge([10, 20, 30, 40, 50]) } },
    { id: 'two-sources', title: 'Duas fontes de tensão', input: { mode: 'solve', components: [vs('A', 'D', 12), r('A', 'B', 100), r('B', 'D', 300), r('C', 'B', 200), vs('C', 'D', 6)] } },
    { id: 'mix-sources', title: 'Fonte de tensão e de corrente', input: { mode: 'solve', components: [vs('A', 'C', 10), r('A', 'B', 100), r('B', 'C', 100), cs('B', 'C', 50, 'mA')] } },
    { id: 'delta', title: 'Triângulo: entre A e B', input: { mode: 'req', terminals: ['A', 'B'], components: [r('A', 'B', 300), r('B', 'C', 300), r('C', 'A', 300)] } },
    { id: 'star', title: 'Estrela com fonte', input: { mode: 'solve', components: [vs('A', 'C', 12), r('A', 'N', 100), r('B', 'N', 200), r('C', 'N', 300), r('A', 'B', 400)] } }
  ];
  PRESETS[5].input.components.forEach(function (c) { if (c.a === 'N') c.a = 'D'; if (c.b === 'N') c.b = 'D'; });

  function challenge(level, rng) {
    rng = rng || Math.random;
    var pick = function (l) { return l[Math.floor(rng() * l.length)]; };
    var input, keys;
    if (level === 1) { /* duas fontes, um único nó desconhecido */
      var R = pick([100, 200, 300]);
      input = { mode: 'solve', components: [vs('A', 'D', pick([9, 12, 18])), r('A', 'B', R), r('B', 'D', R), r('C', 'B', R), vs('C', 'D', pick([3, 6]))] };
      keys = ['NB', 'IR2'];
    } else if (level === 2) {
      var k = pick([1, 2, 5, 10]);
      input = { mode: 'req', terminals: ['A', 'D'], components: bridge([10 * k, 20 * k, 20 * k, 40 * k, pick([30, 50, 100])]) }; /* ponte equilibrada */
      keys = ['Req'];
    } else {
      input = { mode: 'solve', components: [vs('A', 'D', pick([10, 12, 24]))].concat(bridge([pick([100, 150]), pick([200, 220]), pick([300, 330]), pick([100, 120]), pick([100, 470])])) };
      keys = ['NB', 'NC', 'IR5'];
    }
    return { level: level, input: input, keys: keys };
  }

  L.network = network;
  L.networkLesson = lesson;
  L.networkFields = fields;
  L.networkDiagnose = diagnose;
  L.deltaStar = deltaStar;
  L.delta = delta;
  L.deltaLesson = deltaLesson;
  L.deltaFields = deltaFields;
  L.deltaDiagnose = deltaDiagnose;
  L.networkChallenge = challenge;
  L.NETWORK_PRESETS = PRESETS;
  L.NETWORK_UNITS = UNITS;
  L.NETWORK_NODES = NODES;
  L.NETWORK_LIMIT = MAX;
  if (node) module.exports = L;
})(this);
