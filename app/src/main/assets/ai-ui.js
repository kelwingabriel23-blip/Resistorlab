/* Ligação da IA com a tela. A chave fica no Android (criptografada); a página nunca a lê de volta. */
window.AIUI = function (ui) {
  'use strict';
  var AI = window.LabAI, h = ui.h, btn = ui.btn, card = ui.card, add = ui.add, field = ui.field, select = ui.select;
  var waiting = {}, serial = 0;
  var bridge = function () { return window.AndroidAI || null; };
  var hasKey = function () { try { return !!bridge() && bridge().hasKey() === true; } catch (e) { return false; } };
  var active = function () { return hasKey() && ui.store.get('aiOn', false) === true && ui.store.get('aiConsent', false) === true; };

  window.aiReply = function (id, status, text) { if (waiting[id]) waiting[id](status, text); };
  function ask(options, done) {
    var id = 'q' + (++serial), timer;
    var finish = function (status, text) { if (!waiting[id]) return; delete waiting[id]; clearTimeout(timer); done(AI.parseReply(status, text)); };
    waiting[id] = finish;
    timer = setTimeout(function () { finish(-1, ''); }, 100000);
    options.model = ui.store.get('aiModel', AI.MODELS[0][0]);
    try { bridge().ask(id, JSON.stringify(AI.buildRequest(options))); } catch (e) { finish(-1, ''); }
  }

  function screen() {
    ui.go('Professor com IA', function (main) {
      add(main, card(h('p', {}, 'O professor do app funciona sem internet e sem custo, respondendo por regras. Com a IA ativada, você pode fazer perguntas livres sobre qualquer etapa.'),
        h('ul', {}, ['Precisa de internet e de uma chave de API sua (crie em platform.claude.com). É uma conta de desenvolvedor, cobrada à parte, conforme o uso.',
          'Cada pergunta envia à Anthropic: o texto da pergunta, os dados e passos do cálculo e as últimas respostas desta aula.',
          'A IA pode errar. Os resultados da calculadora continuam sendo a referência.',
          'Defina um limite de gastos na sua conta e não compartilhe a chave. Menores de idade devem pedir a um responsável.'].map(function (t) { return h('li', {}, t); }))));
      if (!bridge()) { add(main, card(h('p', {}, 'A IA só está disponível no aplicativo Android instalado. Nesta prévia no navegador, o professor continua no modo offline.'))); return; }
      var model = select(AI.MODELS, ui.store.get('aiModel', AI.MODELS[0][0]), function (v) { ui.store.set('aiModel', v); });
      if (hasKey()) {
        var on = h('input', { type: 'checkbox', id: 'aion', checked: active(), on: { change: function () { ui.store.set('aiOn', on.checked); ui.toast(on.checked ? 'IA ligada' : 'IA desligada'); } } });
        add(main, card(h('p', {}, '✓ Chave salva neste aparelho.'), h('div', { className: 'switch' }, on, h('label', { htmlFor: 'aion' }, 'Responder com IA')), field('Modelo', model),
          btn('Apagar minha chave', function () { bridge().clearKey(); ui.store.set('aiOn', false); ui.store.set('aiConsent', false); ui.render(false); ui.toast('Chave apagada'); })));
      } else {
        var key = h('input', { type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, placeholder: 'Cole sua chave aqui' });
        var ok = h('input', { type: 'checkbox', id: 'aiok' }), err = ui.errorBox();
        add(main, card(field('Chave de API', key), field('Modelo', model), h('div', { className: 'switch' }, ok, h('label', { htmlFor: 'aiok' }, 'Entendi o custo e o envio de dados, e quero ativar a IA')), err,
          btn('Salvar e ativar', function () {
            var v = key.value.trim();
            if (!ok.checked) return ui.showError(err, new Error('Marque a caixa de confirmação para ativar a IA.'));
            if (v.length < 20 || /\s/.test(v)) return ui.showError(err, new Error('A chave parece incompleta. Copie-a inteira, sem espaços.'));
            if (bridge().saveKey(v) !== true) return ui.showError(err, new Error('Não foi possível guardar a chave com segurança neste aparelho.'));
            key.value = ''; ui.store.set('aiConsent', true); ui.store.set('aiOn', true); ui.render(false); ui.toast('IA ativada');
          }, 'primary')));
      }
    });
  }
  return { screen: screen, active: active, ask: ask };
};
