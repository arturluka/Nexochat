# Instalar o NexoChat no celular e no PC — 0.6.2

Depois de atualizar os arquivos do GitHub e concluir o deploy no Railway, abra o endereço HTTPS do NexoChat.

- Android: abra no Chrome e toque em **Instalar app** no NexoChat. Se o navegador ainda não oferecer o botão nativo, use seu menu ⋮ → Instalar app / Adicionar à tela inicial.
- iPhone/iPad: abra no Safari → Compartilhar → Adicionar à Tela de Início → Adicionar.
- PC: abra no Chrome ou Edge e clique em **Instalar app** no NexoChat. Também pode usar a opção de instalação na barra de endereço/menu do navegador.

O botão está disponível na tela de login e na barra superior após entrar. No aplicativo aberto em janela independente, o botão é ocultado. A instalação final é confirmada pelo navegador; a aplicação não instala nada sem esse passo.

Esta é uma instalação pelo navegador (PWA), sem APK, EXE ou loja de aplicativos. O suporte e os nomes dos menus variam conforme o navegador. Não há garantia de chamadas em segundo plano, com a tela bloqueada ou com o aplicativo fechado. Mensagens e chamadas precisam de internet. Sem rede, uma tela oferece tentar novamente. O service worker guarda somente a página/estilo de aviso offline; não armazena mensagens, páginas autenticadas ou arquivos privados.

Deploy: preserve as variáveis e o volume; atualize o código e os arquivos de apps/web/public, execute npm ci, npm run build e npm start. Não há novas variáveis ou migrações nesta atualização. Não envie .env, data ou node_modules. Ao atualizar um app já instalado, feche e abra novamente com internet para obter a versão nova.

Referência de compatibilidade: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

Validação local: npm run test:install. O teste verifica manifesto, ícones, fluxo do botão e aviso offline; a confirmação nativa de instalação no sistema operacional é feita pelo usuário.
