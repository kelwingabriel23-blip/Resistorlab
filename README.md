# Resistor Lab

Calculadora de circuitos resistivos com o Professor de Cálculos. App Android que funciona sem internet.

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

## Estrutura
- `app/src/main/assets/engine.js`: fórmulas, validação, aulas, perguntas e correção
- `app/src/main/assets/app.js` e `style.css`: telas e aparência
- `app/src/main/java/.../MainActivity.java`: app Android (WebView local, sem permissão de internet)
- `tests/engine.test.js`: testes (`node --test tests/engine.test.js`)

## Limites
- O professor responde por regras, sem inteligência artificial. Ele entende dúvidas sobre as etapas, fórmulas, símbolos, divisões, unidades e conceitos básicos.
- A correção identifica os erros mais comuns. Outros erros são marcados como errados, com a resolução da etapa.
- Respostas com até 1% de diferença são aceitas.
- Apenas circuitos em série ou em paralelo puros (sem circuitos mistos). Modelo ideal em corrente contínua.
