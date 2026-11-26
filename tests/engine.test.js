const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../app/src/main/assets/engine.js');
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b)) * t, `${a} != ${b}`);
const inp = (list, known = 'V', source = 12) => ({ resistors: list.map(v => Array.isArray(v) ? { value: v[0], unit: v[1] } : { value: v, unit: 'Ω' }), known, source });

test('série: valores conhecidos', () => {
  const c = L.circuit('series', inp([100, 220, 330], 'V', 13));
  near(c.Req, 650); near(c.I, 0.02); near(c.items[0].V, 2); near(c.items[1].V, 4.4); near(c.items[2].V, 6.6); near(c.P, 0.26);
});
test('paralelo: valores conhecidos', () => {
  const c = L.circuit('parallel', inp([60, 30, 20]));
  near(c.Req, 10); near(c.I, 1.2); near(c.items[0].I, 0.2); near(c.items[1].I, 0.4); near(c.items[2].I, 0.6); near(c.P, 14.4);
});
test('corrente conhecida e sem fonte', () => {
  const c = L.circuit('parallel', inp([100, 100], 'I', 0.5)); near(c.V, 25); near(c.items[0].I, 0.25);
  const d = L.circuit('series', inp([[1, 'kΩ'], [1, 'MΩ']], 'none')); near(d.Req, 1001000); assert.equal(d.I, null);
});
test('2000 circuitos aleatórios respeitam as leis', () => {
  let s = 1; const r = () => (s = (s * 48271) % 2147483647) / 2147483647;
  for (let t = 0; t < 2000; t++) {
    const list = Array.from({ length: 1 + Math.floor(r() * 12) }, () => 10 ** (r() * 12 - 3));
    const c = L.circuit(t % 2 ? 'series' : 'parallel', inp(list, t % 3 ? 'V' : 'I', 10 ** (r() * 6 - 3)));
    assert.ok(c.checks.every(k => k.ok), JSON.stringify(c.checks));
    assert.ok(L.lesson(c).length > 3);
    L.lesson(c).forEach(st => st.divisions.forEach(d => {
      const q = L.longDivision(d[0], d[1]).quotient, e = d[0] / d[1];
      assert.ok(Math.abs(q - e) <= e * 2e-3, `divisão ${d}: ${q} != ${e}`);
    }));
  }
});
test('validação e divisão por zero', () => {
  for (const bad of [0, -5, NaN, Infinity, 1e13]) assert.throws(() => L.circuit('parallel', inp([100, bad])));
  assert.throws(() => L.circuit('series', inp([])));
  assert.throws(() => L.circuit('series', inp([10], 'V', 0)));
  assert.throws(() => L.longDivision(1, 0));
  assert.throws(() => L.ohm('I', { V: 10, R: 0 }), /zero/);
});
test('leitura de números', () => {
  assert.equal(L.parseNumber('4,7').value, 4.7);
  assert.equal(L.parseNumber('0.001').value, 0.001);
  assert.equal(L.parseNumber('1.250,5').value, 1250.5);
  for (const bad of ['', 'abc', '1.000', '1,2,3', '12a', '1.2.3']) assert.equal(L.parseNumber(bad).ok, false, bad);
});
test('formatação e conversão', () => {
  assert.equal(L.fmt(1234567.5), '1.234.570'); assert.equal(L.fmt(0.012), '0,012'); assert.equal(L.fmt(100), '100');
  assert.equal(L.eng(0.012, 'A'), '12 mA'); assert.equal(L.eng(999.99999, 'Ω'), '1 kΩ');
  assert.equal(L.convert(4.7, 'kΩ', 'Ω'), 4700); near(L.convert(2200, 'Ω', 'MΩ'), 0.0022);
});
test('divisão explicada', () => {
  assert.equal(L.longDivision(12, 4).quotient, 3); assert.equal(L.longDivision(7.5, 2.5).quotient, 3);
  const d = L.longDivision(1, 220); near(d.quotient, 0.004545); assert.equal(d.exact, false);
});
test('Ohm e potência', () => {
  near(L.ohm('V', { I: 2, R: 5 }).values.V, 10); near(L.ohm('I', { V: 10, R: 5 }).values.I, 2); near(L.ohm('R', { V: 10, I: 2 }).values.R, 5);
  near(L.power('VI', 12, 2).values.P, 24); near(L.power('VR', 12, 6).values.P, 24); near(L.power('IR', 2, 6).values.P, 24);
  assert.ok(L.lesson(L.power('VR', 12, 6)).at(-1).subs.every(x => x.startsWith('✓')));
});
test('identificação de erros', () => {
  const p = L.circuit('parallel', inp([60, 30, 20]));
  assert.match(L.diagnose(p, 'Req', 110).message, /SÉRIE/);
  assert.match(L.diagnose(p, 'Req', 0.1).message, /1\/Req/);
  assert.match(L.diagnose(p, 'I', 120).message, /multiplicou/);
  assert.match(L.diagnose(p, 'I0', 1.2).message, /DIVIDE/);
  assert.match(L.diagnose(p, 'Req', 10000).message, /unidade/);
  assert.equal(L.diagnose(p, 'I', 12 / 110, { Req: 110 }).carried, true);
  assert.equal(L.diagnose(p, 'Req', 10.05).ok, true);
  assert.match(L.diagnose(L.circuit('series', inp([60, 30])), 'Req', 20).message, /PARALELO/);
});
test('perguntas ao professor', () => {
  const s = L.lesson(L.circuit('parallel', inp([60, 30])));
  assert.match(L.ask('Por que essa fórmula?', s, 1), /paralelo/i);
  assert.match(L.ask('O que significa cada letra?', s, 3), /Req/);
  assert.match(L.ask('como faço essa divisão com vírgula', s, 1), /1 ÷ 60/);
  assert.match(L.ask('o que é corrente?', s, 0), /ampères/);
  assert.match(L.ask('qual a capital da França', s, 0), /não sei/);
});
test('exemplos e desafios são válidos', () => {
  L.EXAMPLES.forEach(e => assert.ok(L.circuit(e.type, e.input).checks.every(k => k.ok)));
  for (let i = 0; i < 600; i++) {
    const q = L.challenge(1 + i % 3), c = L.circuit(q.type, q.input), f = L.fields(c);
    q.keys.forEach(k => assert.ok(f.some(x => x.key === k)));
  }
});
