# Resistor Lab

Calculadora de circuitos resistivos com o Professor de Cálculos. App Android que funciona sem internet (só o Professor com IA, opcional, usa a rede).

## Como gerar o APK

### Opção A: Android Studio (computador)
1. Extraia o zip e abra a pasta `ResistorLab` em **File > Open**.
2. Aguarde a sincronização do Gradle (precisa de internet na primeira vez). Instale o SDK 35 se for pedido.
3. Use **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
4. O arquivo fica em `app/build/outputs/apk/debug/app-debug.apk`.

### Opção B: GitHub
1. Crie um repositório e envie o **conteúdo** da pasta `ResistorLab`, incluindo a pasta oculta `.github`.
2. Abra a aba **Actions > Gerar APK** e aguarde terminar.
3. Baixe `ResistorLab-apk` em **Artifacts**, extraia e instale `app-debug.apk` no celular.
   O Android pedirá permissão para instalar apps dessa origem.

O APK de depuração serve para testes e uso pessoal. Para publicar na Play Store, é preciso gerar uma versão assinada (AAB).
Cada compilação no GitHub pode usar uma chave de depuração diferente. Se a instalação de uma atualização falhar,
desinstale a versão anterior (isso apaga o histórico).

## Estrutura (em `app/src/main/assets/`)
- `engine.js`: série, paralelo, Lei de Ohm, potência e base do Professor
- `mixed.js`, `mixed-ui.js`: circuitos mistos e desafios mistos
- `network.js`, `network-ui.js`: ponte, triângulo/estrela, várias fontes (análise nodal) e seus desafios
- `ai.js`, `ai-ui.js`: Professor com IA (opcional)
- `app.js`, `style.css`: telas e aparência
- `java/.../MainActivity.java`, `AiBridge.java`, `AiClient.java`: app Android, chave criptografada e chamada à API
- `tests/`: testes (`node --test tests/*.test.js`)

## Professor com IA (opcional)
1. Crie uma chave em https://platform.claude.com (conta de API, cobrada conforme o uso). Prefira uma chave de um único workspace e defina um limite de gastos.
2. No app instalado, abra **Professor com IA**, leia o aviso, cole a chave e ative.
3. A chave é cifrada com o Android Keystore. Cada pergunta envia à Anthropic o texto, os passos do cálculo e até 4 perguntas e respostas anteriores da aula.
4. Modelos: Claude Haiku 5.5 (padrão) e Claude Sonnet 5.5. Confira os preços atuais em https://platform.claude.com/docs/en/about-claude/pricing

Esse modelo (cada pessoa com a própria chave) serve para uso pessoal. Para distribuir o app a outras pessoas com IA incluída,
é preciso um servidor próprio que guarde a chave. Nunca coloque uma chave dentro do APK nem no repositório.

## Limites
- Circuitos de corrente contínua com resistores e fontes ideais. Sem capacitores, indutores, diodos, corrente alternada ou fontes controladas.
- Circuito livre: até 40 componentes e 16 nós.
- A redução passo a passo entre dois pontos usa série, paralelo e estrela → triângulo. Em redes que isso não reduz, o valor e a explicação vêm do método nodal.
- Sem IA, o professor responde por regras. A correção identifica os erros mais comuns e aceita até 1% de diferença.
- A IA pode errar; os valores da calculadora são a referência.
