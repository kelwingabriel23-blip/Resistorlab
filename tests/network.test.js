const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../app/src/main/assets/network.js');
const near = (a, b, t = 1e-9, scale = 0) => assert.ok(Math.abs(a - b) <= Math.max(Math.abs(b), scale) * t, `${a} != ${b}`);
const R = (a, b, value, unit = 'Ω') => ({ type: 'R', a, b, value, unit });
const V = (a, b, value) => ({ type: 'V', a, b, value, unit: 'V' });
const I = (a, b, value) => ({ type: 'I', a, b, value, unit: 'A' });
const solve = components => L.network({ mode: 'solve', components });
const req = (components, terminals = ['A', 'D']) => L.network({ mode: 'req', terminals, components });
const bridge = v => [R('A', 'B', v[0]), R('A', 'C', v[1]), R('B', 'D', v[2]), R('C', 'D', v[3]), R('B', 'C', v[4])];
const item = (c, n) => c.items.find(x => x.name === n);
const rnd = seed => () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const ALL_OK = c => assert.ok(c.checks.every(k => k.ok), JSON.stringify(c.checks));

test('duas fontes: valores calculados à mão', () => {
  // nó B: (VB-12)/100 + VB/300 + (VB-6)/200 = 0  ->  VB = 90/11
  const c = solve([V('A', 'D', 12), R('A', 'B', 100), R('B', 'D', 300), R('C', 'B', 200), V('C', 'D', 6)]);
  near(c.voltages.B, 90 / 11); near(item(c, 'R2').I, 3 / 110); near(item(c, 'R3').I, (6 - 90 / 11) / 200);
  assert.ok(item(c, 'V2').P < 0, 'a fonte menor recebe energia'); ALL_OK(c);
});
test('fonte de corrente: sentido e valores', () => {
  const c = solve([I('A', 'B', 2), R('A', 'B', 10)]); near(c.voltages.A - c.voltages.B, 20); near(item(c, 'R1').I, 2); ALL_OK(c);
  const d = solve([V('A', 'C', 10), R('A', 'B', 100), R('B', 'C', 100), I('B', 'C', 0.05)]); near(d.voltages.B, 7.5); ALL_OK(d);
});
test('ponte: equilibrada e desequilibrada (fórmula de Thévenin)', () => {
  const eq = solve([V('A', 'D', 12), ...bridge([10, 20, 20, 40, 50])]); assert.equal(item(eq, 'R5').I, 0); ALL_OK(eq);
  near(req(bridge([10, 20, 20, 40, 999])).Req, 20);
  const [r1, r2, r3, r4, r5] = [100, 200, 300, 400, 500], E = 12;
  const c = solve([V('A', 'D', E), ...bridge([r1, r2, r3, r4, r5])]);
  const vth = E * (r3 / (r1 + r3) - r4 / (r2 + r4)), rth = r1 * r3 / (r1 + r3) + r2 * r4 / (r2 + r4);
  near(item(c, 'R5').I, vth / (rth + r5));
});
test('triângulo e estrela', () => {
  near(req([R('A', 'B', 300), R('B', 'C', 300), R('C', 'A', 300)], ['A', 'B']).Req, 200);
  const y = L.deltaStar('toStar', [30, 60, 90]); const d = L.deltaStar('toDelta', y.values);
  d.values.forEach((v, i) => near(v, [30, 60, 90][i]));
  // resistência entre cada par de terminais é igual nos dois formatos
  const delta = [R('A', 'B', 30), R('B', 'C', 60), R('C', 'A', 90)], star = [R('A', 'D', y.values[0]), R('B', 'D', y.values[1]), R('C', 'D', y.values[2])];
  [['A', 'B'], ['B', 'C'], ['C', 'A']].forEach(t => near(req(delta, t).Req, req(star, t).Req));
  assert.throws(() => L.deltaStar('toStar', [1, 0, 1]));
});
test('ponte reduzida por estrela → triângulo concorda com o método nodal', () => {
  const c = req(bridge([10, 20, 30, 40, 50])); assert.ok(c.reduction.ok); assert.ok(c.reduction.steps.some(s => s.type === 'star')); near(c.reduction.R, c.Req, 1e-9); ALL_OK(c);
});
test('quando a redução não basta, o método nodal ainda resolve', () => {
  const list = []; // cinco nós internos de grau >= 4 (octaedro)
  const n = ['A', 'B', 'C', 'D', 'E', 'F'], opposite = { A: 'D', B: 'E', C: 'F', D: 'A', E: 'B', F: 'C' };
  n.forEach((a, i) => n.slice(i + 1).forEach(b => { if (opposite[a] !== b) list.push(R(a, b, 10)); }));
  const c = req(list, ['A', 'D']); assert.equal(c.reduction.ok, false); near(c.Req, 5); assert.ok(L.lesson(c).some(s => /não basta/.test(s.why)));
});
test('400 circuitos aleatórios com várias fontes: confere com relaxação iterativa independente', () => {
  const r = rnd(11), names = L.NETWORK_NODES;
  for (let t = 0; t < 400; t++) {
    const n = 3 + Math.floor(r() * 5), comps = [];
    for (let i = 1; i < n; i++) comps.push(R(names[i], names[Math.floor(r() * i)], 10 + Math.round(r() * 90)));
    for (let k = 0; k < 4; k++) { const a = Math.floor(r() * n), b = (a + 1 + Math.floor(r() * (n - 1))) % n; comps.push(R(names[a], names[b], 10 + Math.round(r() * 90))); }
    // fontes de tensão em relação ao nó A (valores impostos) e fontes de corrente
    const fixed = { A: 0 }; const vcount = 1 + Math.floor(r() * 2);
    for (let k = 1; k <= vcount && k < n; k++) { fixed[names[k]] = 1 + Math.round(r() * 20); comps.push(V(names[k], 'A', fixed[names[k]])); }
    const inj = {}; if (n - 1 > vcount) { const a = vcount + 1; const amps = (1 + Math.round(r() * 9)) / 100; comps.push(I(names[a], 'A', amps)); inj[names[a]] = amps; }
    const c = L.network({ mode: 'solve', components: comps, ground: 'A' }); ALL_OK(c);
    const v = {}; c.nodes.forEach(x => v[x] = fixed[x] || 0);
    for (let it = 0; it < 20000; it++) {
      let move = 0;
      c.nodes.filter(x => !(x in fixed)).forEach(x => {
        let g = 0, s = inj[x] || 0;
        comps.filter(e => e.type === 'R' && (e.a === x || e.b === x)).forEach(e => { g += 1 / e.value; s += v[e.a === x ? e.b : e.a] / e.value; });
        move = Math.max(move, Math.abs(s / g - v[x])); v[x] = s / g;
      });
      if (move < 1e-13) break;
    }
    c.nodes.forEach(x => near(c.voltages[x], v[x], 1e-7, 1));
    const steps = L.lesson(c); L.fields(c).forEach(f => { assert.ok(steps.some(s => s.topic === f.topic)); assert.ok(L.diagnose(c, f.key, f.value).ok, f.key); });
    steps.forEach(s => s.divisions.forEach(d => L.longDivision(d[0], d[1])));
  }
});
test('circuito misto resolvido pelos dois motores dá o mesmo resultado', () => {
  const m = L.mixed(L.MIXED_EXAMPLES[2].input);
  const c = solve([V('A', 'E', 16), R('A', 'B', 1, 'kΩ'), R('B', 'F', 2.2, 'kΩ'), R('F', 'C', 1.8, 'kΩ'), R('B', 'C', 4, 'kΩ'), R('C', 'E', 600), R('C', 'E', 300)]);
  m.items.forEach((x, i) => near(item(c, 'R' + (i + 1)).I, x.I));
});
test('redução entre dois pontos: 600 redes aleatórias', () => {
  const r = rnd(5), names = L.NETWORK_NODES; let reduced = 0;
  for (let t = 0; t < 600; t++) {
    const n = 3 + Math.floor(r() * 4), comps = [];
    for (let i = 1; i < n; i++) comps.push(R(names[i], names[Math.floor(r() * i)], 1 + Math.round(r() * 99)));
    for (let k = 0; k < 3; k++) { const a = Math.floor(r() * n), b = (a + 1 + Math.floor(r() * (n - 1))) % n; comps.push(R(names[a], names[b], 1 + Math.round(r() * 99))); }
    const c = req(comps, ['A', names[n - 1]]); ALL_OK(c); if (c.reduction.ok) reduced++;
  }
  assert.ok(reduced > 550, 'reduzidas: ' + reduced);
});
test('validação das ligações', () => {
  const bad = [
    [[], /Adicione/], [[R('A', 'B', 1)], /fonte/], [[V('A', 'A', 1), R('A', 'B', 1)], /mesmo nó/], [[V('A', 'B', 1), R('A', 'B', 0)], /zero/],
    [[V('A', 'B', 1), R('A', 'B', -2)], /negativo/], [[V('A', 'B', 1), V('A', 'B', 2), R('A', 'B', 5)], /só por fontes de tensão/],
    [[V('A', 'B', 1), V('B', 'C', 1), V('C', 'A', 1)], /só por fontes de tensão/], [[V('A', 'B', 1), R('A', 'B', 1), R('C', 'D', 1)], /sem ligação/],
    [[V('A', 'B', 1), R('A', 'B', 1), I('C', 'A', 1)], /fontes de corrente/], [[V('A', 'Z', 1)], /nós/], [[V('A', 'B', NaN)], /válido/]
  ];
  bad.forEach(([list, re]) => assert.throws(() => solve(list), re, JSON.stringify(list)));
  assert.throws(() => req([V('A', 'B', 1)], ['A', 'B']), /apenas resistores/);
  assert.throws(() => req([R('A', 'B', 1)], ['A', 'A']), /diferentes/);
  assert.throws(() => req([R('A', 'B', 1)], ['A', 'D']), /precisam/);
  assert.ok(solve([V('A', 'B', 1), R('A', 'B', 1), R('B', 'C', 1)]).warnings.length === 1);
});
test('valores muito diferentes continuam exatos', () => {
  const c = solve([V('A', 'D', 5), ...bridge([1e-3, 1e12, 7, 3e9, 0.01])]); ALL_OK(c);
});
test('correção de respostas no circuito livre', () => {
  const c = solve(L.NETWORK_PRESETS[2].input.components);
  const r2 = item(c, 'R2');
  assert.match(L.diagnose(c, 'IR2', -r2.I).message, /SINAL/);
  assert.match(L.diagnose(c, 'IR1', c.superposition[0].currents.R1 ? Number(c.superposition[0].currents.R1.n) / Number(c.superposition[0].currents.R1.d) : 0).message, /apenas uma/);
  assert.equal(L.diagnose(c, 'IR2', 10 / 300, { NB: 10 }).carried, true);
  assert.match(L.ask('qual a ordem? o que faço primeiro?', L.lesson(c), 3), /1º/);
});
test('modelos prontos e desafios (misto e circuito livre) são válidos', () => {
  L.NETWORK_PRESETS.forEach(p => ALL_OK(L.network(p.input)));
  const r = rnd(99);
  for (let i = 0; i < 900; i++) {
    const level = 1 + i % 3;
    const a = L.mixedChallenge(level, r), mc = L.mixed(a.input), mf = L.mixedFields(mc); ALL_OK(mc);
    a.keys.forEach(k => assert.ok(mf.some(f => f.key === k), 'misto ' + level + ' ' + k));
    const b = L.networkChallenge(level, r), nc = L.network(b.input), nf = L.networkFields(nc); ALL_OK(nc);
    b.keys.forEach(k => assert.ok(nf.some(f => f.key === k), 'livre ' + level + ' ' + k));
  }
});
test('conversor triângulo/estrela: aula, conferência e correção', () => {
  const c = L.delta({ direction: 'toStar', values: [30, 60, 90] }); ALL_OK(c);
  assert.deepEqual(c.values.map(v => +v.toFixed(9)), [15, 10, 30]);
  const d = L.delta({ direction: 'toDelta', values: [15, 10, 30] }); ALL_OK(d); d.values.forEach((v, i) => near(v, [30, 60, 90][i]));
  const steps = L.lesson(c); L.fields(c).forEach(f => { assert.ok(steps.some(s => s.topic === f.topic)); assert.ok(L.diagnose(c, f.key, f.value).ok); });
  assert.match(L.diagnose(c, 'D0', 2700).message, /dividir/);
});
