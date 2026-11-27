/* Resistor Lab: motor de cálculo e Professor de Cálculos (sem dependências de tela). */
(function (root) {
  'use strict';

  var MULT = { 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 };
  var UNIT_NAME = { 'Ω': 'ohm', 'V': 'volt', 'A': 'ampère', 'W': 'watt', 'S': 'siemens' };

  /* ---------- números ---------- */
  function parseNumber(text) {
    var s = String(text == null ? '' : text).trim().replace(/\s/g, '');
    if (!s) return { ok: false, error: 'está vazio. Digite um número.' };
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      if (!/^[+-]?\d{1,3}(\.\d{3})+,\d*$/.test(s)) return { ok: false, error: 'tem pontos e vírgulas fora do lugar. Exemplo válido: 1.250,5.' };
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^[+-]?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) {
      return { ok: false, error: 'é ambíguo: "' + s + '" pode ser milhar ou decimal. Escreva sem o ponto (ex.: 1000) ou use vírgula para decimais (ex.: 1,5).' };
    } else {
      s = s.replace(',', '.');
    }
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(s)) return { ok: false, error: 'não é um número válido. Use apenas algarismos e vírgula (ex.: 4,7).' };
    var v = Number(s);
    if (!isFinite(v)) return { ok: false, error: 'é grande demais para ser calculado.' };
    return { ok: true, value: v };
  }

  function positive(v, name) {
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(name + ': informe um número válido.');
    if (v === 0) throw new Error(name + ' não pode ser zero. Isso causaria uma divisão por zero ou um curto-circuito.');
    if (v < 0) throw new Error(name + ' não pode ser negativo. Digite um valor maior que zero.');
    if (v < 1e-6 || v > 1e12) throw new Error(name + ' está fora da faixa aceita pelo aplicativo (de 0,000001 a 1 trilhão).');
    return v;
  }

  function finite(v) {
    if (!isFinite(v)) throw new Error('O resultado ficou grande demais. Revise os valores.');
    return v;
  }

  /* Formata no padrão brasileiro com até `sig` algarismos significativos. */
  function fmt(x, sig) {
    sig = sig || 6;
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 1e15 || a < 1e-9) return x.toExponential(sig - 1).replace(/\.?0+e/, 'e').replace('.', ',');
    var dec = Math.max(0, sig - 1 - Math.floor(Math.log10(a)));
    var s = x.toFixed(Math.min(dec, 20));
    if (dec === 0) s = Number(x.toPrecision(sig)).toFixed(0);
    var p = s.split('.');
    var int = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var frac = (p[1] || '').replace(/0+$/, '');
    return frac ? int + ',' + frac : int;
  }

  function isRounded(x, sig) {
    sig = sig || 6;
    return x !== 0 && Math.abs(Number(x.toPrecision(sig)) - x) > Math.abs(x) * 1e-12;
  }
  function eq(x, sig) { return (isRounded(x, sig) ? '≈ ' : '= ') + fmt(x, sig); }

  /* Notação de engenharia: 0,012 A -> 12 mA */
  function eng(x, unit, sig) {
    sig = sig || 4;
    if (x === 0) return '0 ' + unit;
    var P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    var r = Number(Math.abs(x).toPrecision(sig));
    for (var i = 0; i < P.length; i++) if (r >= P[i][0]) return fmt(x / P[i][0], sig) + ' ' + P[i][1] + unit;
    return fmt(x, sig) + ' ' + unit;
  }

  function convert(value, from, to) { return value * MULT[from] / MULT[to]; }

  /* ---------- divisão explicada (conta armada) ---------- */
  function decimalParts(x) {
    /* inteiro (BigInt) e quantidade de casas, a partir de 6 algarismos significativos */
    var m = Number(x.toPrecision(6)).toExponential().split('e');
    var digits = m[0].replace('.', '');
    var places = digits.length - 1 - Number(m[1]);
    if (places < 0) { digits += '0'.repeat(-places); places = 0; }
    return { n: BigInt(digits), places: places };
  }

  function longDivision(a, b) {
    if (b === 0) throw new Error('Não existe divisão por zero.');
    var pa = decimalParts(a), pb = decimalParts(b);
    var k = Math.max(pa.places, pb.places);
    var A = pa.n * (10n ** BigInt(k - pa.places));
    var B = pb.n * (10n ** BigInt(k - pb.places));
    var big = function (n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var lines = [];
    var shownA = fmt(a), shownB = fmt(b);
    lines.push('Queremos fazer ' + shownA + ' ÷ ' + shownB + ' (dividendo ÷ divisor).');
    if (isRounded(a) || isRounded(b)) lines.push('Para a conta à mão, usamos os números arredondados para 6 algarismos significativos.');
    if (k > 0) lines.push('Há casas decimais. Multiplique os DOIS números por ' + big(10n ** BigInt(k)) + ' (a vírgula anda ' + k + (k > 1 ? ' casas' : ' casa') + ' para a direita). O resultado não muda: ' + big(A) + ' ÷ ' + big(B) + '.');
    var q = A / B, r = A % B;
    lines.push('Parte inteira: ' + big(B) + ' cabe ' + big(q) + (q === 1n ? ' vez' : ' vezes') + ' em ' + big(A) + '. Como ' + big(q) + ' × ' + big(B) + ' = ' + big(q * B) + ', o resto é ' + big(r) + '.');
    var digits = '', sig = q > 0n ? q.toString().length : 0, places = 0;
    if (r !== 0n && sig < 4) lines.push(q === 0n ? 'Como o divisor é maior que o dividendo, escrevemos "0," e continuamos.' : 'Sobrou resto: colocamos uma vírgula no resultado e continuamos.');
    while (r !== 0n && sig < 4 && places < 20) {
      var x = r * 10n, d = x / B, nr = x % B;
      places++;
      lines.push(places + 'ª casa: acrescente um zero ao resto → ' + big(x) + ' ÷ ' + big(B) + ' dá ' + d + ', resto ' + big(nr) + '.');
      digits += d.toString();
      if (sig > 0 || d > 0n) sig++;
      r = nr;
    }
    var text = big(q) + (digits ? ',' + digits : '');
    lines.push(r === 0n ? 'Resto zero: a divisão é exata. Resultado: ' + text + '.' : 'A divisão continua. Paramos aqui: resultado ≈ ' + text + '.');
    return { title: shownA + ' ÷ ' + shownB, lines: lines, quotient: Number(q.toString() + '.' + (digits || '0')), exact: r === 0n };
  }

  /* ---------- circuitos ---------- */
  var sum = function (l) { return l.reduce(function (a, b) { return a + b; }, 0); };

  function circuit(type, input) {
    if (type !== 'series' && type !== 'parallel') throw new Error('Tipo de circuito desconhecido.');
    var rs = input.resistors || [];
    if (!rs.length) throw new Error('Adicione pelo menos um resistor.');
    rs.forEach(function (r, i) { positive(r.value * MULT[r.unit || 'Ω'], 'O resistor R' + (i + 1)); });
    var ohms = rs.map(function (r) { return r.value * MULT[r.unit || 'Ω']; });
    var known = input.known || 'none';
    if (known !== 'none') positive(input.source, known === 'V' ? 'A tensão da fonte' : 'A corrente total');
    var S = type === 'parallel' ? sum(ohms.map(function (r) { return 1 / r; })) : null;
    var Req = type === 'series' ? sum(ohms) : 1 / S;
    var out = { kind: type, input: input, ohms: ohms, S: S, Req: finite(Req), known: known, V: null, I: null, P: null, items: [], checks: [] };
    if (known !== 'none') {
      out.V = finite(known === 'V' ? input.source : input.source * Req);
      out.I = finite(known === 'I' ? input.source : input.source / Req);
      out.items = ohms.map(function (R) {
        var v, i;
        if (type === 'series') { i = out.I; v = i * R; } else { v = out.V; i = v / R; }
        return { R: R, V: finite(v), I: finite(i), P: finite(v * i) };
      });
      out.P = finite(out.V * out.I);
    } else {
      out.items = ohms.map(function (R) { return { R: R, V: null, I: null, P: null }; });
    }
    out.checks = verify(out);
    return out;
  }

  function close(a, b, tol) { return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * (tol || 1e-9); }

  /* Conferência independente pelas leis de Ohm e de Kirchhoff. */
  function verify(c) {
    var list = [], add = function (name, text, ok) { list.push({ name: name, text: text, ok: ok }); };
    var n = c.ohms.length;
    if (c.kind === 'series') {
      add('Resistência', 'Em série, o total nunca é menor que o maior resistor: ' + eng(c.Req, 'Ω') + ' ≥ ' + eng(Math.max.apply(null, c.ohms), 'Ω') + '.', c.Req >= Math.max.apply(null, c.ohms) * (1 - 1e-9));
    } else {
      add('Resistência', 'Em paralelo, o total nunca é maior que o menor resistor: ' + eng(c.Req, 'Ω') + (n > 1 ? ' < ' : ' = ') + eng(Math.min.apply(null, c.ohms), 'Ω') + '.', c.Req <= Math.min.apply(null, c.ohms) * (1 + 1e-9));
    }
    if (c.V !== null) {
      add('Lei de Ohm', 'V = I × Req → ' + eng(c.I, 'A') + ' × ' + eng(c.Req, 'Ω') + ' = ' + eng(c.V, 'V') + '.', close(c.I * c.Req, c.V));
      if (c.kind === 'series') {
        var sv = sum(c.items.map(function (x) { return x.V; }));
        add('Lei das tensões (Kirchhoff)', 'A soma das tensões nos resistores (' + eng(sv, 'V') + ') é igual à tensão da fonte (' + eng(c.V, 'V') + ').', close(sv, c.V));
      } else {
        var si = sum(c.items.map(function (x) { return x.I; }));
        add('Lei das correntes (Kirchhoff)', 'A soma das correntes dos ramos (' + eng(si, 'A') + ') é igual à corrente total (' + eng(c.I, 'A') + ').', close(si, c.I));
      }
      var sp = sum(c.items.map(function (x) { return x.P; }));
      add('Potência', 'A soma das potências individuais (' + eng(sp, 'W') + ') é igual a V × I (' + eng(c.P, 'W') + ').', close(sp, c.P));
    }
    return list;
  }

  /* ---------- Lei de Ohm e potência ---------- */
  var QTY = {
    V: { name: 'Tensão', unit: 'V' }, I: { name: 'Corrente', unit: 'A' },
    R: { name: 'Resistência', unit: 'Ω' }, P: { name: 'Potência', unit: 'W' }
  };

  function solvePair(a, av, b, bv) {
    var v = {}; v[a] = positive(av, QTY[a].name); v[b] = positive(bv, QTY[b].name);
    if (v.V === undefined) v.V = v.I * v.R;
    if (v.I === undefined) v.I = v.V / v.R;
    if (v.R === undefined) v.R = v.V / v.I;
    v.P = v.V * v.I;
    ['V', 'I', 'R', 'P'].forEach(function (k) { finite(v[k]); });
    return v;
  }

  function ohm(target, values) {
    var g = ['V', 'I', 'R'].filter(function (k) { return k !== target; });
    var v = solvePair(g[0], values[g[0]], g[1], values[g[1]]);
    return { kind: 'ohm', target: target, given: g, values: v, input: { target: target, values: values } };
  }

  function power(mode, a, b) {
    if (['VI', 'VR', 'IR'].indexOf(mode) < 0) throw new Error('Escolha quais valores você conhece.');
    var v = solvePair(mode[0], a, mode[1], b);
    return { kind: 'power', mode: mode, given: [mode[0], mode[1]], values: v, input: { mode: mode, a: a, b: b } };
  }

  /* ---------- aula passo a passo ---------- */
  var SYM = {
    Req: 'Req = resistência equivalente (total) do circuito, em ohms (Ω).',
    R: 'R = resistência: o quanto o componente dificulta a passagem da corrente. Unidade: ohm (Ω).',
    Rn: 'R1, R2, R3… = cada resistor. O número pequeno é só o "nome" dele; ele não entra na conta.',
    V: 'V = tensão elétrica: o "empurrão" da fonte. Unidade: volt (V).',
    I: 'I = corrente elétrica: quantidade de carga que passa por segundo. Unidade: ampère (A).',
    P: 'P = potência: energia usada a cada segundo. Unidade: watt (W).',
    one: 'O número 1 em 1/R faz parte da fórmula: ele indica o "inverso" da resistência.',
    sq: 'O ² (ao quadrado) significa multiplicar o número por ele mesmo.',
    S: '1/R é a condutância (facilidade de passar corrente), medida em siemens (S).'
  };

  function lesson(c) {
    if (c.kind === 'delta') return api.deltaLesson(c);
    if (c.kind === 'network') return api.networkLesson(c);
    if (c.kind === 'mixed') return api.mixedLesson(c);
    return (c.kind === 'series' || c.kind === 'parallel') ? circuitLesson(c) : pairLesson(c);
  }

  function step(topic, title, o) {
    return { topic: topic, title: title, why: o.why || '', simple: o.simple || '', formula: o.formula || '', symbols: o.symbols || [], subs: o.subs || [], divisions: o.divisions || [], result: o.result || '' };
  }

  function circuitLesson(c) {
    var s = [], ser = c.kind === 'series', n = c.ohms.length;
    var names = c.ohms.map(function (_, i) { return 'R' + (i + 1); });
    var conv = c.input.resistors.map(function (r, i) {
      var u = r.unit || 'Ω';
      return u === 'Ω' ? 'R' + (i + 1) + ' = ' + fmt(r.value) + ' Ω' : 'R' + (i + 1) + ' = ' + fmt(r.value) + ' ' + u + ' × ' + fmt(MULT[u]) + ' = ' + fmt(c.ohms[i]) + ' Ω';
    });
    if (c.known !== 'none') conv.push((c.known === 'V' ? 'Tensão da fonte: V = ' : 'Corrente total: I = ') + fmt(c.input.source) + (c.known === 'V' ? ' V' : ' A'));
    s.push(step('data', 'Reconhecer o circuito e anotar os dados', {
      why: ser ? 'Os resistores estão em SÉRIE: um depois do outro, com um único caminho para a corrente.' : 'Os resistores estão em PARALELO: todos ligados entre os mesmos dois pontos, cada um em um ramo.',
      simple: ser ? 'Pense em um único cano com vários trechos estreitos em fila. Toda a água passa por todos eles.' : 'Pense em vários canos lado a lado saindo do mesmo lugar. A água se divide entre eles.',
      formula: 'Antes de calcular, deixe tudo em Ω, V e A.', symbols: [SYM.Rn, SYM.R], subs: conv
    }));

    if (ser) {
      s.push(step('req', 'Calcular a resistência total', {
        why: 'Em série, a corrente atravessa um resistor após o outro, então as dificuldades se somam.',
        simple: 'É só somar todos os resistores.',
        formula: 'Req = ' + names.join(' + '), symbols: [SYM.Req, SYM.Rn],
        subs: ['Req = ' + c.ohms.map(function (r) { return fmt(r); }).join(' + '), 'Req ' + eq(c.Req) + ' Ω'], result: 'Req = ' + eng(c.Req, 'Ω')
      }));
    } else {
      s.push(step('inverse', 'Calcular o inverso de cada resistor', {
        why: 'Em paralelo, cada ramo é um caminho a mais. O que se soma é a facilidade de passagem (1/R), e não a resistência.',
        simple: 'Para cada resistor, divida 1 pelo valor dele.',
        formula: '1 / R', symbols: [SYM.one, SYM.R, SYM.S],
        subs: c.ohms.map(function (r, i) { return '1/R' + (i + 1) + ' = 1 ÷ ' + fmt(r) + ' ' + eq(1 / r) + ' S'; }),
        divisions: c.ohms.map(function (r) { return [1, r]; })
      }));
      s.push(step('invsum', 'Somar os inversos', {
        why: 'A soma mostra a facilidade total de passagem. Atenção: este número ainda NÃO é a resistência total.',
        simple: 'Some os números do passo anterior, alinhando as vírgulas.',
        formula: '1/Req = ' + names.map(function (x) { return '1/' + x; }).join(' + '), symbols: [SYM.Req, SYM.Rn, SYM.one],
        subs: ['1/Req = ' + c.ohms.map(function (r) { return fmt(1 / r); }).join(' + '), '1/Req ' + eq(c.S) + ' S']
      }));
      var subs = ['Req = 1 ÷ ' + fmt(c.S), 'Req ' + eq(c.Req) + ' Ω'];
      if (n === 2) subs.push('Atalho só para 2 resistores: Req = (R1 × R2) ÷ (R1 + R2) = ' + fmt(c.ohms[0] * c.ohms[1]) + ' ÷ ' + fmt(c.ohms[0] + c.ohms[1]) + ' ' + eq(c.Req) + ' Ω');
      s.push(step('req', 'Inverter o resultado para achar a resistência total', {
        why: 'Calculamos 1/Req. Para chegar em Req, invertemos: dividimos 1 pela soma.',
        simple: 'Divida 1 pela soma que você acabou de fazer. Se usar a soma arredondada, o final pode variar um pouco; a calculadora usa o número completo.',
        formula: 'Req = 1 ÷ (soma dos inversos)', symbols: [SYM.Req, SYM.one], subs: subs, divisions: [[1, c.S]], result: 'Req = ' + eng(c.Req, 'Ω')
      }));
    }

    if (c.known === 'none') {
      s.push(step('check', 'Conferir o resultado', { why: 'Para calcular corrente, tensão e potência, informe a tensão da fonte ou a corrente total.', simple: 'Conferir evita erros.', subs: c.checks.map(function (k) { return (k.ok ? '✓ ' : '✗ ') + k.text; }) }));
      return s;
    }

    if (c.known === 'V') {
      s.push(step('current', 'Calcular a corrente total', {
        why: 'Conhecemos a tensão e a resistência total. A Lei de Ohm, isolando a corrente, é I = V ÷ R.' + (ser ? '' : ' No final, vamos conferir somando as correntes dos ramos.'),
        simple: 'Divida a tensão da fonte pela resistência total.',
        formula: 'I = V ÷ Req', symbols: [SYM.I, SYM.V, SYM.Req],
        subs: ['I = ' + fmt(c.V) + ' ÷ ' + fmt(c.Req), 'I ' + eq(c.I) + ' A'], divisions: [[c.V, c.Req]], result: 'I = ' + eng(c.I, 'A')
      }));
    } else {
      s.push(step('voltage', 'Calcular a tensão total', {
        why: 'Conhecemos a corrente total e a resistência total. Pela Lei de Ohm, V = R × I.',
        simple: 'Multiplique a corrente pela resistência total.',
        formula: 'V = I × Req', symbols: [SYM.V, SYM.I, SYM.Req],
        subs: ['V = ' + fmt(c.I) + ' × ' + fmt(c.Req), 'V ' + eq(c.V) + ' V'], result: 'V = ' + eng(c.V, 'V')
      }));
    }

    if (ser) {
      s.push(step('vi', 'Calcular a tensão em cada resistor', {
        why: 'Em série a corrente é a MESMA em todos. Aplicamos a Lei de Ohm em cada um. A tensão da fonte se divide entre eles.',
        simple: 'Multiplique a corrente por cada resistor. O maior resistor fica com a maior tensão.',
        formula: 'Vn = I × Rn', symbols: [SYM.V, SYM.I, SYM.Rn],
        subs: c.items.map(function (x, i) { return 'V' + (i + 1) + ' = ' + fmt(c.I) + ' × ' + fmt(x.R) + ' ' + eq(x.V) + ' V'; })
      }));
    } else {
      s.push(step('ii', 'Calcular a corrente em cada resistor', {
        why: 'Em paralelo a tensão é a MESMA em todos os resistores: ' + eng(c.V, 'V') + '. Aplicamos a Lei de Ohm em cada ramo.',
        simple: 'Divida a tensão por cada resistor. O menor resistor deixa passar mais corrente.',
        formula: 'In = V ÷ Rn', symbols: [SYM.I, SYM.V, SYM.Rn],
        subs: c.items.map(function (x, i) { return 'I' + (i + 1) + ' = ' + fmt(c.V) + ' ÷ ' + fmt(x.R) + ' ' + eq(x.I) + ' A'; }),
        divisions: c.items.map(function (x) { return [c.V, x.R]; })
      }));
    }
    s.push(step('pi', 'Calcular a potência de cada resistor', {
      why: 'A potência é a tensão do resistor multiplicada pela corrente dele. Ela indica quanto o resistor vai aquecer.',
      simple: 'Para cada resistor, multiplique a tensão dele pela corrente dele.',
      formula: 'Pn = Vn × In', symbols: [SYM.P, SYM.V, SYM.I],
      subs: c.items.map(function (x, i) { return 'P' + (i + 1) + ' = ' + fmt(x.V) + ' × ' + fmt(x.I) + ' ' + eq(x.P) + ' W'; })
    }));
    s.push(step('pt', 'Calcular a potência total', {
      why: 'É a potência que a fonte entrega ao circuito. Ela deve ser igual à soma das potências individuais.',
      simple: 'Multiplique a tensão da fonte pela corrente total.',
      formula: 'P = V × I', symbols: [SYM.P, SYM.V, SYM.I],
      subs: ['P = ' + fmt(c.V) + ' × ' + fmt(c.I), 'P ' + eq(c.P) + ' W'], result: 'P = ' + eng(c.P, 'W')
    }));
    s.push(step('check', 'Conferir o resultado', {
      why: 'Conferimos usando outras leis da eletricidade. Se tudo bate, o cálculo está coerente.',
      simple: 'É como tirar a prova real de uma conta.',
      subs: c.checks.map(function (k) { return (k.ok ? '✓ ' : '✗ ') + k.name + ': ' + k.text; })
    }));
    return s;
  }

  var FORMULAS = {
    V: { IR: ['V = R × I', '×'] },
    I: { VR: ['I = V ÷ R', '÷'] },
    R: { VI: ['R = V ÷ I', '÷'] },
    P: { VI: ['P = V × I', '×'], VR: ['P = V² ÷ R', 'v2r'], IR: ['P = I² × R', 'i2r'] }
  };

  function pairLesson(c) {
    var v = c.values, a = c.given[0], b = c.given[1], s = [];
    var target = c.kind === 'ohm' ? c.target : 'P';
    var f = FORMULAS[target][a + b];
    var subs = [], divs = [];
    if (f[1] === 'v2r') {
      subs = ['P = ' + fmt(v.V) + '² ÷ ' + fmt(v.R), 'P = ' + fmt(v.V * v.V) + ' ÷ ' + fmt(v.R)]; divs = [[v.V * v.V, v.R]];
    } else if (f[1] === 'i2r') {
      subs = ['P = ' + fmt(v.I) + '² × ' + fmt(v.R), 'P = ' + fmt(v.I * v.I) + ' × ' + fmt(v.R)];
    } else {
      var order = target === 'V' ? ['R', 'I'] : target === 'I' ? ['V', 'R'] : ['V', 'I'];
      subs = [target + ' = ' + fmt(v[order[0]]) + ' ' + f[1] + ' ' + fmt(v[order[1]])];
      if (f[1] === '÷') divs = [[v[order[0]], v[order[1]]]];
    }
    subs.push(target + ' ' + eq(v[target]) + ' ' + QTY[target].unit);
    s.push(step('data', 'Anotar os dados e o que se pede', {
      why: 'Saber o que temos e o que queremos é o que define a fórmula.',
      simple: 'Escreva os dois valores conhecidos, com suas unidades.',
      symbols: [SYM[a], SYM[b]],
      subs: [QTY[a].name + ': ' + a + ' = ' + fmt(v[a]) + ' ' + QTY[a].unit, QTY[b].name + ': ' + b + ' = ' + fmt(v[b]) + ' ' + QTY[b].unit, 'Queremos: ' + QTY[target].name.toLowerCase() + ' (' + target + ')']
    }));
    s.push(step(target === 'P' ? 'pt' : { V: 'voltage', I: 'current', R: 'req' }[target], 'Escolher a fórmula e calcular', {
      why: 'Temos ' + a + ' e ' + b + ' e queremos ' + target + '. A fórmula que liga exatamente essas três grandezas é ' + f[0] + '.',
      simple: 'Troque cada letra pelo seu número e faça a conta.',
      formula: f[0], symbols: [SYM[target], SYM[a], SYM[b]].concat(f[0].indexOf('²') >= 0 ? [SYM.sq] : []),
      subs: subs, divisions: divs, result: target + ' = ' + eng(v[target], QTY[target].unit)
    }));
    var checks = [['V = R × I', v.R * v.I, v.V, 'V'], ['P = V × I', v.V * v.I, v.P, 'W'], ['P = I² × R', v.I * v.I * v.R, v.P, 'W']];
    s.push(step('check', 'Conferir o resultado', {
      why: 'Substituímos o resultado em outras fórmulas. Os dois lados precisam ser iguais.', simple: 'É a prova real.',
      subs: checks.map(function (k) { return (close(k[1], k[2]) ? '✓ ' : '✗ ') + k[0] + ' → ' + eng(k[1], k[3]) + ' = ' + eng(k[2], k[3]); })
    }));
    return s;
  }

  /* ---------- perguntas ao professor (respostas por regras, funciona offline) ---------- */
  var CONCEPTS = [
    [/\bmisto\b/, 'Circuito misto: combina trechos em série e em paralelo. Resolve-se trocando um grupo de cada vez por seu resistor equivalente, do mais interno para o mais externo.'],
    [/\bserie\b/, 'Série: resistores em fila, com um único caminho. A corrente é a mesma em todos, a tensão se divide e Req = R1 + R2 + …'],
    [/\bparalelo\b/, 'Paralelo: resistores ligados entre os mesmos dois pontos. A tensão é a mesma em todos, a corrente se divide e 1/Req = 1/R1 + 1/R2 + …'],
    [/\b(corrente|ampere|amperes)\b/, 'Corrente (I) é o fluxo de carga elétrica. É medida em ampères (A). 1 mA é a milésima parte de 1 A.'],
    [/\b(tensao|volt|volts|voltagem|ddp)\b/, 'Tensão (V) é a diferença de potencial: o "empurrão" que faz a corrente circular. É medida em volts (V).'],
    [/\b(potencia|watt|watts)\b/, 'Potência (P) é a energia usada por segundo, medida em watts (W). P = V × I. Escolha resistores com potência nominal acima da calculada, de preferência o dobro.'],
    [/\b(resistencia|resistor|ohm|ohms)\b/, 'Resistência é a dificuldade que o componente oferece à corrente. É medida em ohms (Ω). Resistor é o componente feito para ter essa resistência.']
  ];

  function ask(question, steps, index) {
    var q = String(question).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    var st = steps[index];
    var named = q.match(/(?:passo|etapa)\s*(\d+)/);
    if (named && steps[+named[1] - 1]) { index = +named[1] - 1; st = steps[index]; }
    if (!q) return 'Escreva sua dúvida ou toque em uma das perguntas prontas.';
    var has = function (re) { return re.test(q); };
    if (steps[0].order && has(/primeir|ordem|comec|qual grupo/)) return steps[0].order;
    if (has(/divi[ds]|virgula|decima|resto|conta armada/)) {
      if (!st.divisions.length) {
        var w = steps.map(function (x, i) { return x.divisions.length ? i + 1 : 0; }).filter(Boolean);
        return 'Esta etapa não tem divisão.' + (w.length ? ' Há divisões no(s) passo(s) ' + w.join(', ') + '.' : '') + ' Regra geral com decimais: multiplique os dois números por 10, 100, 1000… até sumirem as vírgulas e então divida.';
      }
      return longDivision(st.divisions[0][0], st.divisions[0][1]).lines.join('\n') + (st.divisions.length > 1 ? '\nAs outras divisões desta etapa estão nos botões "Como dividir".' : '');
    }
    if (has(/invert|inverso|1\s*\/|fracao|fracoes/)) return 'Inverter um número é fazer 1 dividido por ele. O inverso de 4 é 1/4 = 0,25. No paralelo, somamos os inversos dos resistores e, no fim, invertemos a soma para obter Req. Exemplo com 10 Ω e 10 Ω: 1/10 + 1/10 = 0,2 e 1 ÷ 0,2 = 5 Ω.';
    if (has(/convert|prefixo|\bkilo|quilo|\bmega|\bmili|\bmicro|kω|mω|\bk\b/)) return 'Prefixos: M (mega) = × 1.000.000; k (quilo) = × 1.000; m (mili) = ÷ 1.000; µ (micro) = ÷ 1.000.000. Exemplos: 4,7 kΩ = 4.700 Ω; 25 mA = 0,025 A. Atenção: M (mega) e m (mili) são diferentes.';
    if (has(/letra|signific|simbolo|unidade|o que (e|quer dizer) (o |a )?(req|rn|r\d|v\d?|i\d?|p\d?)\b/)) return st.symbols.length ? st.symbols.join('\n') : 'Esta etapa não usa uma fórmula nova. Letras: R = resistência (Ω), V = tensão (V), I = corrente (A), P = potência (W).';
    if (has(/por ?que|pq\b|motivo|qual formula|que formula|escolh/)) return st.why + (st.formula ? '\nFórmula: ' + st.formula : '');
    if (has(/de onde|veio|vieram|esse numero|esses numeros|esse valor|substitu/)) {
      return st.subs.length ? 'Cada letra foi trocada pelo seu número. Os valores vêm dos dados do passo 1 ou de resultados de passos anteriores:\n' + st.subs.join('\n') : 'Esta etapa não substitui valores.';
    }
    if (has(/o que e|explique o que|defini/)) {
      for (var j = 0; j < CONCEPTS.length; j++) if (CONCEPTS[j][0].test(q)) return CONCEPTS[j][1];
    }
    if (has(/nao entendi|nao compreendi|simples|facil|de novo|explica|ajuda/)) return st.simple + (st.formula ? '\nFórmula: ' + st.formula : '') + (st.subs.length ? '\nNa prática: ' + st.subs[0] : '');
    if (has(/confer|esta cert|verific|prova real/)) return steps[steps.length - 1].subs.join('\n');
    if (has(/resultado|resposta|quanto/)) return st.result || (st.subs.length ? st.subs.join('\n') : 'Veja o resultado nas etapas seguintes.');
    for (var k = 0; k < CONCEPTS.length; k++) if (CONCEPTS[k][0].test(q)) return CONCEPTS[k][1];
    return 'Ainda não sei responder a essa pergunta. Eu funciono sem internet e entendo dúvidas sobre: o porquê da fórmula, o significado das letras e unidades, a origem dos números, como dividir, como inverter, conversão de unidades e os conceitos de resistência, tensão, corrente, potência, série e paralelo.';
  }

  /* ---------- correção de respostas ---------- */
  var TOL = 0.01; /* aceita 1% de diferença por arredondamento */

  function fields(c) {
    if (c.kind === 'delta') return api.deltaFields(c);
    if (c.kind === 'network') return api.networkFields(c);
    if (c.kind === 'mixed') return api.mixedFields(c);
    var f = [{ key: 'Req', label: 'Resistência total', unit: 'Ω', value: c.Req }];
    if (c.known === 'none') return f;
    var total = c.known === 'V' ? { key: 'I', label: 'Corrente total', unit: 'A', value: c.I } : { key: 'V', label: 'Tensão total', unit: 'V', value: c.V };
    f.push(total);
    c.items.forEach(function (x, i) {
      if (c.kind === 'series') f.push({ key: 'V' + i, label: 'Tensão em R' + (i + 1), unit: 'V', value: x.V, i: i });
      else f.push({ key: 'I' + i, label: 'Corrente em R' + (i + 1), unit: 'A', value: x.I, i: i });
    });
    c.items.forEach(function (x, i) { f.push({ key: 'P' + i, label: 'Potência em R' + (i + 1), unit: 'W', value: x.P, i: i }); });
    f.push({ key: 'P', label: 'Potência total', unit: 'W', value: c.P });
    return f;
  }

  /* Hipóteses de erro: [valor que o erro produziria, explicação] */
  function hypotheses(c, f) {
    var h = [], add = function (v, msg) { if (isFinite(v)) h.push([v, msg]); };
    var R = c.ohms, n = R.length, ser = c.kind === 'series';
    var S = sum(R.map(function (r) { return 1 / r; }));
    if (f.key === 'Req') {
      if (ser) {
        if (n > 1) add(1 / S, 'Você usou a fórmula de PARALELO. Em série, basta somar os resistores.');
      } else if (n > 1) {
        add(sum(R), 'Você somou os resistores como se estivessem em SÉRIE. Em paralelo, some os inversos (1/R) e depois inverta.');
        add(S, 'Faltou o último passo: você encontrou 1/Req. Agora calcule 1 ÷ essa soma.');
        if (n === 2) { add(R[0] * R[1], 'No atalho de 2 resistores, faltou dividir o produto pela soma: (R1 × R2) ÷ (R1 + R2).'); add((R[0] + R[1]) / (R[0] * R[1]), 'Você inverteu o atalho. O correto é produto ÷ soma.'); }
      }
      if (n > 1) {
        add(sum(R) / n, 'Você calculou a média dos resistores. A resistência total não é uma média.');
        R.forEach(function (_, i) {
          var rest = R.filter(function (_, j) { return j !== i; });
          add(ser ? sum(rest) : 1 / sum(rest.map(function (r) { return 1 / r; })), 'Parece que R' + (i + 1) + ' ficou fora da conta.');
        });
      }
    } else if (f.key === 'I' && c.known === 'V') {
      add(c.V * c.Req, 'Você multiplicou V por Req. Para achar a corrente, divida: I = V ÷ Req.');
      add(c.Req / c.V, 'A divisão está invertida. O correto é I = V ÷ Req (a tensão vem primeiro).');
      if (n > 1) R.forEach(function (r, i) { add(c.V / r, 'Você dividiu a tensão apenas por R' + (i + 1) + '. A corrente total usa Req.'); });
    } else if (f.key === 'V' && c.known === 'I') {
      add(c.I / c.Req, 'Você dividiu. Para achar a tensão, multiplique: V = I × Req.');
      add(c.Req / c.I, 'Para achar a tensão, multiplique: V = I × Req.');
    } else if (f.key === 'P') {
      add(c.V / c.I, 'Você dividiu V por I (isso dá resistência). Potência é V × I.');
      add(c.items[0].P, 'Esse é o valor da potência de um só resistor. A total é a soma de todos.');
    } else if (f.i !== undefined) {
      var x = c.items[f.i], t = f.key[0];
      if (t === 'V') {
        add(c.V, 'Em série a tensão da fonte se DIVIDE entre os resistores. Use V' + (f.i + 1) + ' = I × R' + (f.i + 1) + '.');
        add(c.V / n, 'A tensão só se divide em partes iguais se os resistores forem iguais. Use I × R.');
        add(c.I / x.R, 'Você dividiu I por R. A tensão é I × R.');
      } else if (t === 'I') {
        add(c.I, 'Em paralelo a corrente total se DIVIDE entre os ramos. Use I' + (f.i + 1) + ' = V ÷ R' + (f.i + 1) + '.');
        add(c.I / n, 'A corrente só se divide em partes iguais se os resistores forem iguais. Use V ÷ R.');
        add(c.V * x.R, 'Você multiplicou. A corrente do ramo é V ÷ R.');
        add(x.R / c.V, 'A divisão está invertida. O correto é V ÷ R.');
      } else {
        add(c.P, 'Esse é o valor da potência TOTAL. Aqui se pede só a de R' + (f.i + 1) + '.');
        add(x.V / x.I, 'Você dividiu V por I. A potência é V × I.');
        add(ser ? c.V * x.I : x.V * c.I, ser ? 'Você usou a tensão da fonte. Use a tensão que está sobre este resistor.' : 'Você usou a corrente total. Use a corrente deste ramo.');
      }
    }
    return h;
  }

  /* Qual seria a resposta desta etapa usando os valores que o usuário calculou antes? */
  function fromUser(c, f, a) {
    var has = function (k) { return typeof a[k] === 'number' && isFinite(a[k]); };
    var V = c.known === 'V' ? c.V : a.V, I = c.known === 'I' ? c.I : a.I;
    if (f.key === 'I' && has('Req') && a.Req !== 0) return c.V / a.Req;
    if (f.key === 'V' && has('Req')) return c.I * a.Req;
    if (f.i !== undefined) {
      var r = c.ohms[f.i], t = f.key[0];
      if (t === 'V') return typeof I === 'number' ? I * r : null;
      if (t === 'I') return typeof V === 'number' ? V / r : null;
      var own = a[(c.kind === 'series' ? 'V' : 'I') + f.i], other = c.kind === 'series' ? I : V;
      return typeof own === 'number' && typeof other === 'number' ? own * other : null;
    }
    if (f.key === 'P') return typeof V === 'number' && typeof I === 'number' ? V * I : null;
    return null;
  }

  function matches(u, v) { return v === 0 ? u === 0 : Math.abs(u - v) <= Math.abs(v) * TOL; }

  function diagnose(c, key, user, answers) {
    if (c.kind === 'delta') return api.deltaDiagnose(c, key, user);
    if (c.kind === 'network') return api.networkDiagnose(c, key, user, answers);
    if (c.kind === 'mixed') return api.mixedDiagnose(c, key, user, answers);
    var f = fields(c).filter(function (x) { return x.key === key; })[0];
    var out = { key: key, label: f.label, unit: f.unit, user: user, expected: f.value, topic: topicOf(c, f), ok: matches(user, f.value), carried: false, message: '' };
    if (out.ok) { out.message = 'Correto!'; return out; }
    var chain = answers ? fromUser(c, f, answers) : null;
    if (chain !== null && isFinite(chain) && !matches(chain, f.value) && matches(user, chain)) {
      out.carried = true; out.message = 'A conta desta etapa está certa, mas usou um valor errado de uma etapa anterior. Corrija o primeiro erro e refaça.'; return out;
    }
    var scales = [1e3, 1e-3, 1e6, 1e-6];
    for (var i = 0; i < scales.length; i++) if (matches(user, f.value * scales[i])) {
      out.message = 'Os algarismos estão certos, mas há um erro de unidade ou de vírgula: sua resposta ficou ' + (scales[i] > 1 ? fmt(scales[i]) + ' vezes maior' : fmt(1 / scales[i]) + ' vezes menor') + '. Confira os prefixos (k, M, m) e responda na unidade pedida.'; return out;
    }
    var h = hypotheses(c, f);
    for (var j = 0; j < h.length; j++) if (matches(user, h[j][0])) { out.message = h[j][1]; return out; }
    if (matches(Math.abs(user), Math.abs(f.value))) { out.message = 'O número está certo, mas o sinal não. Aqui o valor é positivo.'; return out; }
    if (Math.abs(user - f.value) <= Math.abs(f.value) * 0.05) { out.message = 'Está perto. Provavelmente você arredondou cedo demais. Mantenha pelo menos 4 algarismos significativos nas etapas intermediárias.'; return out; }
    out.message = 'Não reconheci o tipo de erro. Refaça esta etapa conferindo a fórmula, os valores substituídos e a aritmética.';
    return out;
  }

  function topicOf(c, f) {
    if (f.key === 'Req') return 'req';
    if (f.key === 'I') return 'current';
    if (f.key === 'V') return 'voltage';
    if (f.key === 'P') return 'pt';
    return { V: 'vi', I: 'ii', P: 'pi' }[f.key[0]];
  }

  /* ---------- exemplos e desafios ---------- */
  function ex(level, type, title, tip, values, V) {
    return { level: level, type: type, title: title, tip: tip, input: { resistors: values.map(function (v) { return { value: v[0], unit: v[1] }; }), known: 'V', source: V } };
  }
  var o = function (v) { return [v, 'Ω']; }, k = function (v) { return [v, 'kΩ']; };
  var EXAMPLES = [
    ex(1, 'series', 'Dois resistores iguais', 'Veja a tensão se dividir ao meio.', [o(100), o(100)], 10),
    ex(2, 'series', 'Três resistores diferentes', 'O maior resistor recebe a maior tensão.', [o(100), o(220), o(330)], 13),
    ex(3, 'series', 'Misturando Ω e kΩ', 'Pratique conversão de unidades e decimais.', [k(1), k(2.2), o(470), k(4.7)], 12),
    ex(1, 'parallel', 'Dois resistores iguais', 'Dois iguais em paralelo dão a metade.', [o(100), o(100)], 10),
    ex(2, 'parallel', 'Três resistores diferentes', 'Pratique a soma dos inversos.', [o(60), o(30), o(20)], 12),
    ex(3, 'parallel', 'Decimais e kΩ', 'Divisões com vírgula e correntes em mA.', [k(1), k(2.2), k(4.7), o(680)], 9)
  ];

  function challenge(level, rng) {
    rng = rng || Math.random;
    var pick = function (l) { return l[Math.floor(rng() * l.length)]; };
    var type = pick(['series', 'parallel']), values;
    if (level === 1) {
      if (type === 'series') values = [pick([10, 20, 30, 50, 100]), pick([10, 20, 40, 50, 100])].map(o);
      else values = pick([[10, 10], [60, 30], [100, 100], [20, 30], [40, 120], [30, 15]]).map(o);
    } else if (level === 2) {
      if (type === 'series') values = [0, 1, 2].map(function () { return o(pick([47, 100, 150, 220, 330, 470])); });
      else values = pick([[60, 30, 20], [100, 200, 200], [120, 60, 40], [90, 45, 30], [300, 150, 100]]).map(o);
    } else {
      values = [k(pick([1, 1.5, 2.2, 3.3])), o(pick([220, 470, 680, 820])), k(pick([4.7, 5.6, 6.8, 10]))];
    }
    var V = pick(level === 1 ? [6, 10, 12, 20] : [5, 9, 12, 24]);
    var input = { resistors: values.map(function (v) { return { value: v[0], unit: v[1] }; }), known: 'V', source: V };
    var c = circuit(type, input);
    var keys = ['Req'];
    if (level >= 2) keys.push('I', (type === 'series' ? 'V0' : 'I0'));
    if (level >= 3) keys.push('P');
    return { level: level, type: type, input: input, keys: keys };
  }

  var api = { MULT: MULT, QTY: QTY, parseNumber: parseNumber, fmt: fmt, eng: eng, convert: convert, longDivision: longDivision, circuit: circuit, ohm: ohm, power: power, lesson: lesson, ask: ask, fields: fields, diagnose: diagnose, challenge: challenge, EXAMPLES: EXAMPLES, UNIT_NAME: UNIT_NAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Lab = api;
})(this);
