const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../app/src/main/assets/network.js');
const AI = require('../app/src/main/assets/ai.js');
const steps = L.lesson(L.circuit('series', { resistors: [{ value: 100, unit: 'Ω' }, { value: 200, unit: 'Ω' }], known: 'V', source: 12 }));

test('IA: o pedido usa os campos aceitos pela API e leva o cálculo como contexto', () => {
  const r = AI.buildRequest({ model: 'claude-haiku-5-5', steps, index: 1, question: 'por quê?', beginner: true, history: [{ q: 'a', a: 'b' }] });
  assert.deepEqual(Object.keys(r).sort(), ['max_tokens', 'messages', 'model', 'output_config', 'system']);
  assert.deepEqual(r.messages.map(m => m.role), ['user', 'assistant', 'user']);
  assert.match(r.system, /iniciante/); assert.match(r.system, /Req = 300/);
  assert.equal(AI.buildRequest({ model: 'inexistente', steps, index: 0, question: 'x'.repeat(5000) }).model, 'claude-haiku-5-5');
  assert.ok(AI.buildRequest({ steps, index: 0, question: 'x'.repeat(5000) }).messages[0].content.length < 1100);
  const long = Array.from({ length: 400 }, () => steps[1]);
  assert.ok(AI.buildRequest({ steps: long, index: 0, question: 'x' }).system.length < 26000);
});
test('IA: leitura da resposta e erros', () => {
  const ok = AI.parseReply(200, JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'oculto' }, { type: 'text', text: 'Some os resistores.' }] }));
  assert.deepEqual(ok, { ok: true, text: 'Some os resistores.' });
  assert.equal(AI.parseReply(200, '{"stop_reason":"refusal","content":[]}').ok, false);
  assert.equal(AI.parseReply(200, 'xx').ok, false); assert.equal(AI.parseReply(200, '{"content":[]}').ok, false);
  assert.match(AI.parseReply(401, '').error, /inválida/); assert.match(AI.parseReply(-1, '').error, /internet/);
  assert.match(AI.parseReply(429, '').error, /Limite/); assert.match(AI.parseReply(500, '').error, /problemas/);
});
