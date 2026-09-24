# NexoChat 0.8.0

## Onde encontrar

- **Novidades e versão:** botão de brilho no topo. Também em Configurações → Versão e novidades. Verifica a versão publicada ao abrir, ao recuperar foco/conexão e a cada dois minutos. Atualizar pede confirmação para não perder rascunhos e não interrompe uma chamada automaticamente.
- **Pastas:** botão Organizar comunidades na barra de servidores. Crie uma pasta e atribua comunidades pelo seletor. Arraste ícones para ordenar; no celular ou teclado use Subir/Descer no painel. Desfazer uma pasta não exclui nem abandona comunidades. Preferências salvas na conta, carregadas ao abrir o app.
- **Diagnóstico:** antes de entrar na call, teste o microfone e o alto-falante; grave até cinco segundos e reproduza a própria voz. A gravação é local, nunca enviada ao servidor. Dentro da call, Dispositivos mostra tráfego de áudio, tipo de conexão, qualidade e reconexão.
- **PC + celular:** entre na mesma conta e conversa nos dois. No PC escolha Usar PC com celular; no celular, Conversar. O PC deixa microfone e som desligados para evitar eco e informa quando seu outro aparelho entrou. Compartilhe a tela pelo PC.
- **Busca:** lupa do topo, filtros por texto, nome do arquivo, pessoa, conversa, período e tipo de anexo. Resultados respeitam bloqueios e acesso aos canais.
- **Atividade manual:** Configurações → Meu perfil, botões Jogando, Estudando, Disponível para call e Já volto. Você pode completar o nome do jogo no campo de status. Não detecta aplicativos automaticamente.
- **Emojis e figurinhas:** Painel da comunidade → Emojis e figurinhas. Administração adiciona itens, membros usam o seletor da conversa ou `:nome:` para emojis.
- **Denúncias:** Início → Minhas denúncias. Moderadores respondem em Painel da comunidade → Denúncias. A decisão exige uma explicação e fica registrada; quem denunciou pode acompanhar enquanto participa da comunidade.
- **Acessibilidade:** Configurações → Acessibilidade, com tamanho de texto, contraste e redução de movimentos salvos na conta.

## Publicar

Use o pacote GitHub, que não inclui `node_modules`, `data`, `.env` ou `apps/web/dist`. Extraia e envie o conteúdo para a raiz do repositório. Se o GitHub limitar a quantidade de arquivos, envie a pasta `apps` em um lote e os demais arquivos/pastas em outro, mantendo a estrutura. Não envie o ZIP como arquivo único.

No Railway, use a raiz do monorepo, instalação com dependências de desenvolvimento, build `npm run build` e start `npm run start --workspace=@nexo/api`. O build gera `version.json` e a interface; não reutilize uma pasta `dist` antiga. Confira o commit do deploy ativo. O volume de dados continua em `/data` quando essa for a configuração do projeto; não o remova.

A migração 008 roda na inicialização e adiciona preferências de pastas e campos de decisão às denúncias. Faça backup antes de atualizar produção. Nenhuma tabela de mensagens é apagada.

## Limites

Não há atualização silenciosa enquanto você usa o app: há detecção e botão para recarregar com confirmação. A versão só muda depois de o servidor publicar o código novo. Rede restritiva ainda pode exigir TURN configurado pelo administrador. O teste local de voz não comprova conectividade entre duas redes. A MVP continua sem E2EE de aplicação e sem push em segundo plano.
