# Atualização 0.7 — sua comunidade, do seu jeito

## O que chegou

- **Editar comunidade** na barra lateral: nome, foto, banner, bio, boas-vindas e regras. As imagens usam o upload validado de até 2 MB. Só o dono altera a identidade.
- **Transferir propriedade**: o dono confirma o nome, escolhe um membro e envia um convite válido por sete dias. O escolhido aceita em **Boas-vindas e cargos**. O antigo dono perde seus poderes de proprietário e sai das chamadas dessa comunidade para revalidar o acesso. Seus cargos atribuídos continuam sujeitos às permissões normais.
- **Sair da comunidade**: disponível para membros em **Boas-vindas e cargos**, com confirmação. O dono precisa concluir uma transferência primeiro; a exclusão da comunidade continua restrita ao dono. Mensagens existentes permanecem.
- **Regras versionadas**: os membros precisam aceitar a versão atual antes de enviar mensagens ou entrar em chamadas. Mudanças nas regras exigem nova aceitação. Mensagem de boas-vindas aparece no radar ao entrar.
- **Cargos de entrada e por conquistas**: o dono habilita cargos comuns para escolha e pode exigir uma insígnia já resgatada. Há um cargo ativo por membro. Cargos com poderes de administração não podem ser escolhidos livremente; cargos atribuídos pela administração não são substituídos pelo próprio membro. Mudar de cargo encerra as conexões aos canais para revalidar o acesso.
- **Fórum** no seletor de novo canal: assuntos, até três etiquetas por assunto, até 12 etiquetas configuradas, busca, filtro, paginação e respostas em tópicos. Permissões de canal privado, bloqueios, modo lento e limite de 200 respostas por tópico continuam valendo.
- **Notificações por canal**: todas, só menções/respostas diretas ou silenciado. Em canais de texto, abra os detalhes; no fórum, use o seletor no topo. O padrão continua sendo menções nas comunidades e todas em DMs/grupos.
- **Loja de Faíscas**: seis molduras e seis novos itens entre fundos, cores e efeitos. Cada categoria pode ser equipada/removida separadamente. Fundos/efeitos aparecem no perfil; cores também nas mensagens.
- **Presentes**: compre uma cópia para um amigo pelo username. O item e o desconto acontecem na mesma transação; bloqueados, não amigos, itens repetidos ou falta de saldo impedem a compra. Até 20 presentes por dia. Faíscas não têm valor monetário.
- **Eventos**: enquete com um voto editável por pessoa, encerramento pelo organizador/gerente, lembretes de 0, 5, 15 ou 60 minutos e confirmação de presença. O lembrete aparece no radar, uma vez por horário do evento. Não há push com aplicativo fechado; o serviço precisa estar ativo. Eventos cancelados e membros que saíram não recebem avisos.
- **Chamadas**: volume de 0–100 salvo na conta por pessoa (também vale para outro dispositivo dela), teste local de alto-falante e qualidade estimada por atraso/perda de pacotes. O teste não pede microfone. Saída selecionada depende do suporte do navegador. O indicador não prova que alguém está ouvindo o alto-falante. A mídia física entre celular e PC em redes externas ainda precisa ser conferida no ambiente publicado.

## Atualizar no Railway

1. Faça backup do banco e dos anexos antes de atualizar. Não envie `.env`, `data`, backups ou `node_modules` ao GitHub.
2. Extraia **NexoChat-v0.7-GitHub.zip** e envie seu conteúdo para a raiz do repositório, preservando `apps`, `packages` e `package.json`. Esse pacote não contém a pasta de compilação nem capturas de tela; o Railway deve compilar o código.
3. Use **`npm ci --include=dev && npm run build`** como comando de construção na raiz do monorepo e **`npm start`** para iniciar a API, que também serve a interface. Mantenha o armazenamento persistente do banco/anexos e as variáveis de produção existentes (`APP_ORIGIN` HTTPS, `COOKIE_SECURE=true`, `NODE_ENV=production`, configuração de proxy, `DATABASE_URL`/`DATA_DIR`).
4. A migração 007 roda automaticamente na inicialização. Não apague o volume/banco existente. Reinicie e confira `/api/health`: versão `0.7.0`.
5. Faça uma recarga completa para receber a interface nova. Caso haja dois serviços separados, confira que o serviço público está servindo a compilação atual e encaminhando API/WebSocket para o backend.

Os recursos desta atualização não exigem um novo serviço pago. TURN continua sendo infraestrutura separada quando necessário para chamadas; esta atualização não configura um provedor TURN no Railway automaticamente.

## Validação e limites

`npm test` cobre migrações, permissões, regras, fórum, presentes concorrentes, preferências individuais, eventos, lembretes e backup/restauração. `npm run test:community-plus` exercita as novas telas em contas temporárias pelo Edge. `node tests/browser.mjs` cobre WebRTC entre navegadores locais com dispositivos simulados, áudio/vídeo, PC + celular, teste de saída e volume após reentrada.

Backups novos incluem os dados da versão 0.7. A restauração continua aceitando backups 0.6, em banco e pasta de anexos vazios. Sessões não são restauradas.

Não há nova moeda vendida, bots, aplicativo nativo, push ou E2EE. A instalação PWA da versão 0.6.2 permanece disponível em navegadores compatíveis.
