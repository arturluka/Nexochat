# Validação executada

## Atualização 0.2 — resultado final

`npm run build` e `npm test` passaram após a atualização. `node tests/browser.mjs` passou com duas contas e um terceiro contexto de navegador usando a mesma conta, em viewport de celular.

Cobertura nova:

- Migration 002 aplicada e reaplicada sem apagar usuários; campos de perfil persistidos.
- Validação de cor e limites de texto; rejeição de banner pertencente a outra conta; autorização e remoção de imagem pública.
- Prévia e salvamento de nome, bio, pronomes, status, cor, avatar e banner; interface desktop e mobile sem overflow horizontal.
- Áudio e vídeo WebRTC recebidos e decodificados; câmera e tela simultâneas; parar e reiniciar a tela sem interromper a câmera, e vice-versa.
- `NotFoundError` e `NotAllowedError` no microfone mantêm a pessoa como ouvinte; recebimento de áudio sem microfone; ativação tardia do microfone durante a mesma conexão.
- Cancelar o seletor de tela mantém a chamada; todas as tracks capturadas são encerradas ao sair.
- Modos Só ouvir e PC + celular não chamam getUserMedia para áudio; duas sessões da mesma conta entram juntas, tela do PC chega ao celular e ao amigo, áudio da própria conta é silenciado e sair do PC preserva as outras sessões.
- Estado de mídia validado pelo servidor, identidade obtida da sessão e eventos antigos de saída ignorados.

**Limite dos testes de mídia:** microfone/câmera são dispositivos simulados pelo Edge; a captura de tela usa um canvas sintético no lugar do seletor nativo. O transporte e a decodificação são WebRTC reais. Não foram testados um celular físico, áudio de sistema/aba capturado pelo seletor nativo, redes distintas/TURN, Safari/iOS ou TLS do seu Railway. O deploy remoto continua sendo uma etapa do usuário.

Capturas da atualização: [perfil desktop](screenshots/profile-desktop.png), [perfil mobile](screenshots/profile-mobile.png), [entrada na chamada](screenshots/call-lobby.png).

## Registro da versão 0.1

Data: 21/09/2026. Ambiente: Windows, Node.js 24.19.0, Edge headless, banco PostgreSQL embutido PGlite.

## Resultados

- `npm install`: concluído; auditoria reportou zero vulnerabilidades na instalação. Versões resolvidas estão no `package-lock.json`.
- `npm run build`: passou. TypeScript da API e do frontend, e build Vite de produção.
- `npm test`: passou. Uma suíte integrada com dezenas de verificações reais de HTTP, SQL e WebSocket, usando diretório de banco temporário apagado ao concluir.
- `node tests/browser.mjs`: passou. Aplicação compilada executada com duas sessões independentes no Edge, desktop 1440×960 e mobile 390×844.

## Cobertura exercitada

Cadastro, username duplicado, login inválido/válido, logout, revogação de sessão, recusa de mutação sem origem, privacidade inicial de DM, envio/aceite de amizade, DM única para o par, rejeição de terceiro não participante, evento de digitação, envio/resposta/edição/exclusão/reação, confirmação de leitura, upload permitido e rejeição de HTML disfarçado de PNG, autorização de download, grupos, salas temporárias, comunidades, categorias, convite/entrada, restrição de criação de canal, cargo sem envio, atribuição de cargo, banimento, bloqueio/desbloqueio e recusa de sinalização fora da chamada.

No navegador: cadastro pela interface, solicitação/aceite de amizade, abertura de DM, entrega de mensagens nos dois sentidos, chamada com duas conexões WebRTC no estado `connected`, áudio recebido (`bytesReceived > 0`) e vídeo recebido (`framesDecoded > 0`), mute/deafen, abertura de dispositivos, saída de chamada, tela desktop, ausência de overflow horizontal mobile e abertura de configurações no celular.

As chamadas do teste utilizam microfone e câmera simulados pelo navegador, mas o transporte e a decodificação são WebRTC reais. O teste não substitui uma chamada com dispositivos físicos e redes diferentes.

## Limites da validação

PostgreSQL dedicado/Docker não foram executados, pois não estavam instalados neste ambiente. O SQL foi exercitado no PostgreSQL embutido PGlite. Compartilhamento de tela foi implementado, mas o seletor nativo de tela não foi testado automaticamente. Também não foram validados TURN em rede externa, TLS em proxy real, dispositivos físicos, recuperação após falha de disco, carga/escala, Safari/iOS ou push.

## Reproduzir

```powershell
npm install
npm run build
npm test
node tests/browser.mjs
```

O teste de navegador usa o canal `msedge`, porta local 3101 e banco descartável. Para outro navegador instalado compatível, defina `BROWSER_CHANNEL` (por exemplo `chrome`). Ele usa mídia simulada e não acessa a câmera ou o microfone físico. As capturas são gravadas em `docs/screenshots/`.

![Desktop](screenshots/desktop.png)
![Mobile](screenshots/mobile.png)
