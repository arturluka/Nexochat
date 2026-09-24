# Arquitetura e limites

## Componentes

React/Vite serve a interface. Express recebe comandos HTTP; Socket.IO em transporte WebSocket informa alterações, presença, digitação, leitura e sinalização. Mensagens são gravadas antes de notificar clientes; reconexão recarrega o histórico persistido. A sinalização SDP/ICE não é persistida. O áudio/vídeo trafega por WebRTC entre os navegadores ou pelo TURN configurado. Cada conexão negocia quatro transceivers sendrecv fixos (microfone, câmera, vídeo de tela, áudio de tela), mesmo quando entra sem dispositivos. Somente o recém-chegado oferece; o participante existente responde. Alternar dispositivos usa replaceTrack, preservando a conexão e separando câmera de tela.

O banco usa tabelas relacionais com chaves estrangeiras e índices para identidade, sessões, relações, comunidades/cargos, salas, mensagens, reações e notificações. PGlite executa PostgreSQL embutido para desenvolvimento; o adaptador `pg` utiliza PostgreSQL dedicado com o mesmo SQL. O esquema inicial é uma migration idempotente com registro de versão; mudanças futuras devem criar novas migrations versionadas, sem editar retroativamente dados existentes.

Cada requisição autenticada valida a sessão. `access` e `serverAccess` centralizam acesso e permissões; eventos de sinalização exigem que ambos os sockets estejam na mesma chamada autorizada. Revogação de sessão desconecta os sockets associados; acesso das chamadas é revalidado em eventos e na manutenção periódica. O limite de seis dispositivos reduz o custo de mesh para esta fase. Cada conta pode usar mais de um dispositivo. Estados de microfone, câmera, tela e áudio são validados e propagados pelo servidor; a identidade de quem sinaliza vem da sessão, nunca de um campo fornecido pelo cliente. Operações de entrada/saída são serializadas para que entradas simultâneas se enxerguem.

O evento global `refresh` não contém dados de usuário: os clientes buscam apenas os dados autorizados por HTTP. É simples e apropriado a grupos pequenos, mas não é uma arquitetura para grande escala. Presença deriva das conexões atuais e respeita invisibilidade/bloqueios no estado enviado a cada usuário. Não há Redis, filas, sharding ou distribuição de presença.

## Segurança e privacidade

- Hash Argon2id, 64 MiB/3 iterações/1 thread no cadastro, token de sessão de 256 bits, hash SHA-256 do token no banco.
- Cookies HttpOnly, SameSite=Lax, Secure no modo de produção. Origem exata é exigida em mutações e no handshake de socket; não usar origens curinga.
- DTOs Zod, queries com parâmetros, limite de corpo JSON e payload WebSocket, escapes padrão do React (sem HTML de mensagens).
- Upload limitado em tamanho e frequência, assinatura binária permitida, arquivo armazenado por UUID; download autenticado e autorização da sala. Imagens são exibidas inline; demais anexos são baixados. SVG/HTML/executáveis são recusados.
- A checagem de assinatura não é antivírus nem decodificação/reprocessamento completo de mídia. Hospedagem pública exige scanner, armazenamento em origem isolada, quotas por usuário, limpeza de órfãos e políticas de retenção.
- A privacidade de novas DMs/grupos não fecha conversas já existentes. Use bloqueio para interromper contato.
- Anexos removidos da mensagem ou de salas expiradas podem permanecer no disco até limpeza administrativa; não se promete eliminação segura de bytes ou backups. Não há exportação/exclusão integral de conta nesta fase.
- Algumas operações compostas (criar comunidade com canais, consumir convite e adicionar membro) não usam uma transação abrangente nesta MVP. Restrições únicas e verificações protegem os registros, mas uma falha de banco no meio pode exigir reparo; implementar transações antes de produção pública.
- Rate limits ficam em memória e reiniciam com a API. Para múltiplas instâncias, mover contadores e presença para infraestrutura compartilhada.

## E2EE futura — não implementada

Não adicionar uma cifra própria nem chamar esta MVP de E2EE. Hoje as mensagens/anexos chegam em texto claro à aplicação no servidor, protegidos apenas pelo transporte HTTPS quando configurado. O banco não tem criptografia de aplicação. O WebRTC negocia DTLS-SRTP, mas não existe verificação independente da identidade dos participantes.

Fase de implementação proposta:

1. Escolher biblioteca mantida e revisada de protocolo consolidado: Signal Protocol para DMs com suporte a múltiplos dispositivos; MLS (RFC 9420) como opção para grupos após avaliação de implementação e requisitos.
2. Criar identidade criptográfica por dispositivo, publicação de chaves/prekeys, verificação de identidade pelo usuário, rotação/revogação e recuperação segura. Servidor de sessões não deve custodiar chaves privadas de conteúdo.
3. Separar envelopes opacos e metadados de roteamento; versionar o formato e migrar conversas explicitamente. Criptografar anexos no cliente e enviar a chave somente dentro do envelope autenticado.
4. Definir comportamento para perda de dispositivo, histórico, adição/remoção de membros e backups. Notificações e busca precisarão respeitar a ausência de acesso ao texto no servidor.
5. Para mídia, avaliar SFrame (RFC 9605)/WebRTC Encoded Transforms com gerenciamento de chaves autenticado, especialmente se for introduzido SFU. Não supor que TLS para sinalização autentica a identidade ponta a ponta.
6. Fazer testes de interoperabilidade e revisão externa antes de habilitar o selo E2EE.

## Fases seguintes

SFU/TURN com credenciais temporárias; mensagens/eventos incrementais; filas e push; bots com permissões próprias; apps nativos; verificação de email/recuperação de senha/2FA; quotas e antivírus; moderação automatizada avançada; acessibilidade aprimorada de diálogos; backup/restauração; CI com PostgreSQL dedicado; testes de rede e carga; E2EE auditada.

## Referências técnicas

- [PGlite e arquivos persistidos](https://pglite.dev/docs/filesystems)
- [Socket.IO: autenticação por middleware](https://socket.io/docs/v4/middlewares/)
- [MDN: negociação WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
- [MDN: compartilhamento de tela](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API/Using_Screen_Capture)

## Atualização 0.2

A migration 002 adiciona campos de perfil sem apagar contas ou mensagens e é registrada na tabela migrations. Avatares/banners só aceitam uploads de imagem pertencentes à própria conta. O navegador oferece uma prévia local antes de salvar; URLs temporárias são revogadas ao trocar a seleção ou fechar o editor.

## Atualização 0.5

A migration 005 adiciona enquetes/votos, favoritos/fixados, eventos/presença, mídia da comunidade, denúncias, timeout, regras de acesso por cargo e preferências visuais. Enquetes e cadastro de mídia usam transações para preservar limites e unicidade. O acesso a canais privados é conferido na API, arquivos, chamadas e listagens. Votos e presença expõem totais/participantes apenas no espaço autorizado. Favoritos são privados. O indicador de fala analisa áudio recebido localmente no navegador; não cria gravações. Consulte UPDATE-0.5.md para limites e permissões.

## Arquitetura da versão 0.6

`security.ts` usa OTPAuth para TOTP padrão, janela de um passo e contador persistido contra reutilização. Códigos de recuperação têm 160 bits aleatórios e somente seus hashes SHA-256 ficam no banco; consumo, recuperação e invalidação de sessões são transacionais. A configuração e alterações exigem senha atual e, quando habilitado, segundo fator. As rotas de segurança têm limitação própria.

`everyday.ts` concentra busca, tópicos, agendamentos, perfis locais e missões. A busca primeiro determina conversas acessíveis; a consulta paginada aplica bloqueios. Agendamentos são registros persistentes, com processamento serial por instância e bloqueio de linha no banco; mensagem e estado enviado são confirmados na mesma transação. A notificação é posterior ao commit, portanto uma queda pode deixar uma mensagem entregue sem notificação, mas não duplica o conteúdo. Não há promessa de pontualidade enquanto a instalação está offline.

`backup.ts` usa AES-256-GCM e scrypt das APIs do Node, não implementa criptografia própria de mensagens. A restauração aceita apenas tabelas e colunas conhecidas, usa transação e recusa banco ocupado. O operador deve parar o serviço para capturar banco e uploads de modo consistente. O formato é voltado a instalações pequenas e não substitui snapshots/backup operacional de grandes bancos PostgreSQL.
