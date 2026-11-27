const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../app/src/main/assets/mixed.js');
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= Math.abs(b) * t, `${a} != ${b}`);
const R = (value, unit = 'Ω') => ({ type: 'R', value, unit });
const S = (...items) => ({ type: 'series', items });
const P = (...items) => ({ type: 'parallel', items });
const calc = (tree, known = 'V', source = 12) => L.mixed({ tree, known, source });

test('misto: valores calculados à mão', () => {
  const c = calc(S(R(100), P(R(200), R(200))));
  near(c.Req, 200); near(c.I, 0.06);
  [[6, 0.06, 0.36], [6, 0.03, 0.18], [6, 0.03, 0.18]].forEach((e, i) => { near(c.items[i].V, e[0]); near(c.items[i].I, e[1]); near(c.items[i].P, e[2]); });
  near(c.P, 0.72);
  const d = calc(P(S(R(100), R(200)), R(600))); near(d.Req, 200); near(d.items[0].V, 4); near(d.items[1].V, 8); near(d.items[2].I, 0.02);
  const e = calc(L.MIXED_EXAMPLES[2].input.tree, 'V', 16); near(e.Req, 3200); near(e.I, 0.005); near(e.items[1].V, 5.5); near(e.items[4].I, 0.005 / 3);
});
test('misto: corrente conhecida e somente resistência', () => {
  near(calc(S(R(1, 'kΩ'), P(R(2, 'kΩ'), R(2, 'kΩ'))), 'I', 0.01).V, 20);
  const c = calc(S(R(10), P(R(10), R(10))), 'none'); near(c.Req, 15); assert.equal(c.I, null); assert.ok(c.checks.every(k => k.ok));
  assert.equal(L.lesson(c).at(-1).topic, 'check');
});
test('misto: grupos internos são calculados primeiro', () => {
  const c = calc(S(R(1), P(R(2), S(R(3), P(R(4), R(5)))), P(R(6), R(7))));
  const done = new Set();
  c.order.forEach(g => { g.items.filter(x => x.items).forEach(x => assert.ok(done.has(x))); done.add(g); });
  assert.equal(c.order.at(-1), c.top); assert.equal(c.top.name, 'Req');
  assert.deepEqual(c.order.map(g => g.name), ['RA', 'RB', 'RC', 'RD', 'Req']);
  assert.equal(c.expression, 'R1 + (R2 ∥ (R3 + (R4 ∥ R5))) + (R6 ∥ R7)');
});

/* Solução independente por análise nodal (condutâncias + eliminação de Gauss). */
function nodal(tree, V) {
  const edges = []; let n = 2;
  (function wire(x, a, b) {
    if (x.type === 'R') return edges.push([a, b, x.value]);
    if (x.type === 'parallel') return x.items.forEach(y => wire(y, a, b));
    let from = a; x.items.forEach((y, i) => { const to = i === x.items.length - 1 ? b : n++; wire(y, from, to); from = to; });
  })(tree, 0, 1);
  const m = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  edges.forEach(([a, b, r]) => { const g = 1 / r; m[a][a] += g; m[b][b] += g; m[a][b] -= g; m[b][a] -= g; });
  m[0] = m[0].map((_, j) => (j === 0 ? 1 : j === n ? V : 0));
  m[1] = m[1].map((_, j) => (j === 1 ? 1 : 0));
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
    [m[c], m[p]] = [m[p], m[c]];
    for (let i = 0; i < n; i++) if (i !== c && m[i][c]) { const f = m[i][c] / m[c][c]; for (let j = c; j <= n; j++) m[i][j] -= f * m[c][j]; }
  }
  const v = m.map((row, i) => row[n] / row[i]);
  return edges.map(([a, b, r]) => ({ V: v[a] - v[b], I: (v[a] - v[b]) / r }));
}

test('misto: 1500 circuitos aleatórios conferem com análise nodal e Kirchhoff', () => {
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const make = depth => (depth > 0 && (depth > 3 || rnd() < 0.55)) ? R(1 + Math.round(rnd() * 100000) / 10)
    : { type: rnd() < 0.5 ? 'series' : 'parallel', items: Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => make(depth + 1)) };
  for (let t = 0; t < 1500; t++) {
    const tree = make(0), V = 1 + rnd() * 100, c = calc(tree, 'V', V);
    assert.ok(c.checks.every(k => k.ok), JSON.stringify(c.checks));
    nodal(tree, V).forEach((e, i) => { near(c.items[i].V, e.V, 1e-6); near(c.items[i].I, e.I, 1e-6); });
    const steps = L.lesson(c);
    steps.forEach(s => s.divisions.forEach(d => near(L.longDivision(d[0], d[1]).quotient, d[0] / d[1], 2e-3)));
    L.fields(c).forEach(f => { assert.ok(steps.some(s => s.topic === f.topic), f.topic); assert.ok(L.diagnose(c, f.key, f.value).ok); });
  }
});
test('misto: valida ligações e valores', () => {
  const bad = [
    [R(10), /começar/], [S(R(10)), /pelo menos 2/], [S(R(10), P(R(5))), /pelo menos 2/], [S(R(10), P()), /pelo menos 2/],
    [S(R(10), R(0)), /zero/], [S(R(10), P(R(0), R(0))), /zero/], [S(R(10), R(-1)), /negativo/], [S(R(10), R(NaN)), /válido/],
    [S(R(10), R(1e13)), /faixa/], [S(R(10), null), /incompleta/], [S(R(10), { type: 'ponte', items: [] }), /desconhecido/],
    [S(...Array.from({ length: 51 }, () => R(1))), /limite/]
  ];
  bad.forEach(([tree, re]) => assert.throws(() => calc(tree), re));
  const same = R(10); assert.throws(() => calc(S(same, same)), /duas vezes/);
  let deep = P(R(1), R(1)); for (let i = 0; i < 6; i++) deep = S(R(1), deep);
  assert.throws(() => calc(deep), /níveis/);
  assert.throws(() => calc(S(R(1), R(2)), 'V', 0), /maior que zero/);
});
test('misto: identifica erros e explica a ordem', () => {
  const c = calc(S(R(100), P(R(200), R(300))));  // RA = 120, Req = 220
  assert.match(L.diagnose(c, 'G0', 500).message, /SÉRIE/);
  assert.match(L.diagnose(c, 'Req', 600).message, /todos os resistores/);
  assert.equal(L.diagnose(c, 'Req', 600, { G0: 500 }).carried, true);
  assert.match(L.diagnose(c, 'V1', 12).message, /tensão da fonte/);
  assert.match(L.diagnose(c, 'I1', c.I).message, /corrente total/);
  const steps = L.lesson(c);
  assert.match(L.ask('Qual devo calcular primeiro?', steps, 2), /1º: RA = R2 ∥ R3/);
  assert.match(L.ask('o que é um circuito misto?', steps, 0), /combina/);
  assert.match(L.ask('como faço a divisão?', steps, 1), /1 ÷ 200/);
});
