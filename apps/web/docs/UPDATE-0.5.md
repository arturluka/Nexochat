# NexoChat 0.5 — sua comunidade mais completa

Esta versão inclui todos os recursos das versões 0.3 e 0.4 e adiciona:

## Conversas

- **Enquetes:** botão Enquete abaixo das mensagens. De 2 a 8 opções, duração de 1 hora a 7 dias, um voto por conta, troca/retirada de voto e encerramento pelo autor ou moderador. Os totais são atualizados para os participantes conectados.
- **Fixadas:** o criador da conversa ou um moderador com `manage_messages` pode fixar até 30 mensagens. A lista aparece acima do histórico.
- **Favoritos:** a estrela de uma mensagem salva em sua lista pessoal. Abra Favoritos no menu inicial. A lista mostra os 100 itens mais recentes e oculta mensagens apagadas ou de conversas às quais você perdeu acesso.
- **Emojis e figurinhas:** administradores com `manage_channels` enviam imagens de até 2 MB em Painel da comunidade → Emojis e figurinhas. Aceita PNG, JPG, WebP e GIF; até 50 itens por comunidade. Emojis usam `:nome:` nas mensagens; figurinhas são enviadas pelo seletor da conversa. Só funcionam na comunidade de origem. Remover um item também remove sua imagem das mensagens antigas; não apaga os arquivos físicos automaticamente.

## Eventos

No Painel da comunidade → Eventos, membros com permissão para enviar podem publicar título, descrição e data/hora. Cada pessoa escolhe Vou, Talvez ou Não vou. A lista mostra quem confirmou. O autor ou administrador de canais pode editar ou cancelar. Não há inscrição após o horário ou cancelamento. Os horários são exibidos no fuso local de cada navegador. A lista exibe os 60 eventos mais recentes por data; não há push, email ou lembrete automático nesta versão.

## Canais privados e moderação

- Em Painel da comunidade → Privacidade dos canais, escolha os cargos permitidos. Canais privados ficam acessíveis ao dono e aos cargos selecionados. Administradores de canais conseguem ver e alterar a configuração, mas precisam de acesso ao canal para ler seu conteúdo. Sem cargos selecionados, só o dono acessa.
- A proteção vale para mensagens, enquetes, fixados, anexos, favoritos, notificações e entrada nas chamadas. Alterar permissões ou cargos encerra as conexões afetadas, exigindo nova entrada.
- **Modo lento:** de 0 a 120 segundos entre mensagens do membro naquele canal. Dono e moderadores de mensagens são isentos. A repetição imediata do mesmo texto é recusada por 15 segundos; o limite geral de envio continua ativo. Não é um classificador de abuso nem substitui moderação humana.
- **Denúncias:** use a bandeira na mensagem de outra pessoa em uma comunidade. Moderadores com `manage_messages` acessam a fila, resolvem/descartam ou apagam a mensagem. Só veem denúncias de canais acessíveis. Uma denúncia por pessoa/mensagem; a fila mostra as 100 mais recentes. A avaliação mostra o conteúdo atual da mensagem, não uma cópia histórica imutável. Para DMs, use Bloquear.
- **Timeout:** em Gerenciar comunidade, moderadores de membros aplicam 10 minutos, 1 hora ou 1 dia; podem remover o timeout. A API aceita até 7 dias. Impede envio, reações, votos, eventos e entrada na chamada daquela comunidade, preservando leitura. Apenas o dono pode moderar pessoas com cargo; dono e a própria conta não podem receber timeout pela ação.

## Aparência e chamadas

Configurações → Meu perfil inclui cinco temas, cor do nome e quatro estilos de banner sem imagem. As escolhas ficam na conta; nome/banner aparecem no perfil e a cor do nome também nas mensagens.

Antes de entrar na chamada, **Testar microfone antes de entrar** abre um teste local sem transmitir áudio. O teste para ao sair da tela ou clicar Parar teste. Quem não tem microfone pode continuar entrando só para ouvir e compartilhar a tela. Durante a chamada, há indicador de voz recebida e **Destacar transmissão**, além dos controles anteriores de PC + celular, mute/deafen, câmera, tela, saída de som e reconexão.

## Atualizar

Mantenha o banco e uploads em armazenamento persistente. A migration 005 adiciona as tabelas e campos sem apagar contas ou mensagens. Na raiz: `npm install`, `npm run build`, `npm start`. A configuração HTTPS/cookies e o volume do Railway continuam iguais à [versão 0.3](UPDATE-0.3.md). `/api/health` informa `0.5.0`.

Execute uma instância da API. Os recursos são destinados a uma pequena comunidade, sem SFU, push ou infraestrutura de grande escala. TURN continua sendo necessário em algumas redes e deve ser configurado pelo administrador. A MVP continua sem E2EE; nenhum protocolo de criptografia próprio foi criado.
