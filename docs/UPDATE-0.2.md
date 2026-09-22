# NexoChat 0.2 — perfis e chamadas em dois dispositivos

## Novidades sem assinatura

- Editor de perfil com navegação entre perfil, privacidade e dispositivos.
- Prévia ao vivo, banner, avatar/GIF, paleta e cor personalizada, pronomes, status e bio com contadores.
- Cartão público de perfil com a mesma identidade visual.
- Entrada na chamada com **Conversar**, **Só ouvir** ou **Usar PC com celular**.
- Ausência ou recusa de microfone mantém a pessoa na chamada como ouvinte.
- Câmera e tela simultâneas, transmissão em 720p/1080p como preferência e áudio da tela quando suportado pelo navegador.
- Tela em destaque, expansão, volume individual e saída de áudio em navegadores compatíveis.
- Mesma conta no PC e no celular; áudio da própria conta é silenciado entre os dispositivos. O modo PC + celular também desliga a reprodução dos outros participantes no PC para evitar duplicação com o celular.
- Entrada/saída organizada pelo servidor, metadados de mídia validados e limpeza das capturas ao encerrar.

## Como usar no seu caso

1. No celular, faça login e abra a conversa/chamada. Escolha **Conversar** e permita o microfone.
2. No PC, faça login na mesma conta e abra a mesma conversa. Escolha **Usar PC com celular**.
3. No PC, clique em **Compartilhar tela**. Escolha a tela, janela ou aba no seletor do navegador.
4. Ouça e fale pelo celular. Os amigos recebem a voz do celular e a tela do PC.

Você também pode usar **Só ouvir** no PC para escutar os amigos e transmitir a tela sem abrir o microfone. Os dois dispositivos contam como duas das seis vagas. Use fones no dispositivo em que está ouvindo.

## Atualizar o Railway sem perder contas e mensagens

1. Faça backup do PostgreSQL e do volume de anexos no Railway.
2. Substitua o código do repositório pelo conteúdo da pasta `nexochat` deste pacote, incluindo `apps`, `packages`, `package.json` e `package-lock.json`. Não envie `.env`, `data` ou `node_modules`.
3. Mantenha **o mesmo serviço e o mesmo PostgreSQL/volume**. Não recrie o banco. As variáveis existentes (`DATABASE_URL`, `APP_ORIGIN`, `COOKIE_SECURE`, `DATA_DIR`, etc.) continuam válidas.
4. Build: `npm run build`. Start: `npm start`, ambos na raiz do projeto.
5. A inicialização aplica a migration `002_profiles.sql` automaticamente: ela só adiciona campos e registra a versão; não apaga contas nem mensagens.
6. Após o deploy, atualize a página nos dois dispositivos. Clientes antigos de chamadas precisam recarregar antes de usar os novos controles.

Os novos arquivos não foram enviados ao seu GitHub ou Railway automaticamente. Este pacote contém o projeto completo para substituir o código da versão anterior.

## Limites que continuam existindo

Não é uma implementação de todas as funcionalidades do Discord. O NexoChat mantém identidade própria. Bots, push, E2EE, SFU, apps nativos e recursos de grande escala continuam como fases futuras. Os recursos implementados não têm plano pago, mas hospedagem e TURN podem ter custos próprios.

A captura nativa exige que você escolha e autorize a fonte a cada vez. Compartilhar áudio depende do navegador, do sistema e da fonte; não há promessa de áudio de sistema em todos os aparelhos. A opção 1080p é uma preferência de captura, não uma garantia de resolução/banda. TURN ainda pode ser necessário entre redes diferentes. Celulares podem suspender a chamada quando o navegador fica em segundo plano ou a tela bloqueia.
