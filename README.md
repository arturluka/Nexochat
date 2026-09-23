# NexoChat 0.6.2

MVP executável para um pequeno grupo de amigos. Monorepo TypeScript com React 19 + Vite, API Node.js/Express, PostgreSQL, Socket.IO/WebSocket e chamadas WebRTC. Interface própria, responsiva e em português.

**Esta MVP não oferece E2EE.** O servidor pode ler as mensagens e os anexos. HTTPS/WSS deve proteger o transporte fora de localhost. A mídia WebRTC usa DTLS-SRTP do navegador; não há verificação de identidade ou protocolo E2EE de aplicação implementado.

## Executar localmente

Requisito: Node.js 22.12+ (testado com Node 24). Abra um terminal nesta pasta:

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

No macOS/Linux, substitua `Copy-Item .env.example .env` por `cp .env.example .env`.

Abra **http://localhost:5173**. Crie uma conta, abra outro navegador ou perfil privado e crie a segunda conta. Adicione o username em **Adicionar amigo**, aceite a solicitação na segunda conta e abra uma conversa. A senha deve ter pelo menos 10 caracteres; usernames aceitam 3–24 letras minúsculas, números e `_`.

Sem `DATABASE_URL`, o aplicativo usa **PGlite**, uma distribuição embutida do PostgreSQL, persistida em `data/postgres`. É o modo mais fácil de testar sem instalar um servidor de banco. Execute somente uma instância da API para esse diretório. O banco local e os anexos não são enviados a um serviço externo.

## Usar celular para falar e PC para transmitir

1. Entre na **mesma conta e conversa** nos dois dispositivos.
2. No celular, entre com **Conversar** e permita o microfone.
3. No PC, escolha **Usar PC com celular**. O PC entra com microfone e áudio desligados para evitar eco.
4. No PC, clique em **Compartilhar tela** e escolha uma janela, aba ou tela inteira.
5. A transmissão do PC e a voz do celular aparecem para os amigos. Sair em um dispositivo mantém o outro conectado.

O áudio da própria conta recebido de outro dispositivo fica silenciado automaticamente. Cada dispositivo ocupa uma das seis vagas. Para ouvir diretamente no PC sem celular, escolha **Só ouvir**. A qualidade selecionada (720p ou 1080p, até 30 fps) é uma preferência, sujeita à rede e ao navegador.

## PostgreSQL dedicado

```powershell
docker compose up -d
```

Defina no `.env`:

```dotenv
DATABASE_URL=postgresql://nexo:nexo_local@localhost:5432/nexochat
```

Depois execute `npm run db:migrate` e `npm run dev`. A API aplica a migration inicial idempotente também ao iniciar. Os dados de PGlite e PostgreSQL dedicado são separados; mudar a variável não transfere o histórico. `docker-compose.yml` só expõe o banco em loopback; altere as credenciais antes de hospedar.

## Seed opcional

Defina uma senha de pelo menos 10 caracteres em `SEED_PASSWORD` e rode:

```powershell
npm run db:seed
```

São criadas as contas `aurora` e `leo`, com a senha escolhida. O seed não substitui contas existentes. Essas duas contas permitem novas DMs de todos; contas criadas normalmente permitem apenas amigos. Não há senha fixa embutida no projeto.

## Scripts

| Comando | Função |
| --- | --- |
| `npm run dev` | API em 3001 e interface em 5173, com proxy para API/WebSocket |
| `npm run build` | Verificação TypeScript e build otimizado da interface |
| `npm start` | API e interface compilada no mesmo processo, porta 3001 |
| `npm test` | Integração real da API com banco PostgreSQL embutido descartável |
| `npm run typecheck` | Verificar os tipos de ambos os aplicativos |
| `npm run db:migrate` | Aplicar migrations pendentes |
| `npm run db:seed` | Criar duas contas opcionais |

Para usar `npm start` localmente, rode `npm run build`, configure `APP_ORIGIN=http://localhost:3001` e abra essa URL. Use exatamente o hostname configurado: `localhost` e `127.0.0.1` são origens diferentes.

## Novidades 0.5

Enquetes, eventos com confirmação de presença, favoritos e mensagens fixadas, emojis/figurinhas da comunidade, canais privados por cargo, modo lento, denúncias e timeout. Cinco temas, cores de nome, estilos de banner e melhorias nas chamadas. Veja [como usar e atualizar](docs/UPDATE-0.5.md).

## Novidades 0.4

Oito insígnias gratuitas, conquistas com progresso, recompensas únicas em Faíscas e vitrine com até três insígnias no perfil. Coleção e filtro de resgates disponíveis, com atalho na loja. Veja [o guia de insígnias](docs/UPDATE-0.4.md).

## Novidades 0.3

Loja com seis molduras, carteira de Faíscas, resgate diário grátis, coleção e extrato. Chamadas recebidas com aceitar/recusar, histórico, medidor de microfone, botão Ativar som e reconexão de mídia. Veja [como atualizar e testar o áudio](docs/UPDATE-0.3.md).

## Recursos implementados

- Cadastro, login, logout, username único normalizado; Argon2id; cookies HttpOnly/SameSite; sessões revogáveis de 30 dias, com token aleatório armazenado apenas como hash.
- Editor de perfil com prévia ao vivo, avatar e banner (até 2 MB cada, incluindo GIF), cor personalizada, pronomes, status personalizado, bio, online/ausente/ocupado/invisível; privacidade para novas conversas e confirmação de leitura.
- Solicitações de amizade, aceitar/recusar/cancelar/remover; busca por username, bloqueio/desbloqueio.
- DMs, grupos privados até 16 membros; adicionar/remover membros e renomear grupo pelo dono.
- Comunidades, categorias, canais de texto/voz, convites de 7 dias e até 25 usos; cargos com permissões; banimento, expulsão, desbanimento e registro de moderação.
- Mensagens persistentes, edição pelo autor, exclusão pelo autor/moderador, respostas, seis reações, paginação, busca no histórico carregado, digitação e leitura.
- Anexos autenticados de até 10 MB, validação por assinatura e formatos permitidos; nomes de arquivo não controlam o caminho no disco.
- Notificações internas de DMs/grupos, amizades e menções `@username`; silenciar conversas.
- Voz, câmera e compartilhamento de tela com sinalização autorizada; chamadas mesh para até 6 dispositivos, entrada só para ouvir ou PC + celular, fallback sem microfone, câmera e tela simultâneas, mute/deafen, volume individual, troca de microfone e escolha de câmera/saída de áudio quando suportada.
- Salas temporárias de 24 horas. Acesso expira no horário definido; histórico é removido pela manutenção periódica.
- Limites de requisições, tentativas de login, mensagens, uploads e eventos de socket; validação Zod, SQL parametrizado, cabeçalhos de segurança e verificação de origem nas mutações e sockets.

As permissões são por comunidade: dono com acesso total; membro padrão com envio e convites; cargo personalizado define as permissões da lista. Nesta primeira versão, criar/atribuir cargos fica reservado ao dono, mesmo quando a opção `manage_roles` existe para evolução. Há canais privados por cargo na versão 0.5; não há hierarquia complexa de múltiplos cargos. Moderação de membros com cargo também é reservada ao dono.

Bloqueios impedem DMs e novas chamadas com a pessoa, ocultam suas mensagens em espaços compartilhados e interrompem conexões existentes para revalidar acesso. As comunidades continuam compartilhadas; canais privados seguem as permissões do cargo. Invisível aparece offline para outras pessoas. Silenciar afeta novas notificações, não a entrega das mensagens.

## Chamadas

Entre na mesma conversa e clique no telefone. Escolha **Conversar**, **Só ouvir** ou **Usar PC com celular**. O modo Conversar tenta abrir o microfone; se ele estiver ausente ou a permissão for negada, você permanece ouvindo. Os outros dois modos não pedem microfone. Câmera e tela podem ser ligadas separadamente, ao mesmo tempo. Em DMs e grupos, entrar na sala vazia toca para participantes disponíveis: aceitar, recusar ou aceitar só ouvindo. O convite expira em 45 segundos e fica no histórico. O toque depende de interação prévia com a página; chamadas com a página fechada ou aplicativo em segundo plano não têm push nesta MVP. A saída de áudio pode ser escolhida nas configurações quando o navegador oferece suporte; caso contrário, use o sistema operacional. A opção de áudio da tela depende do navegador, da origem capturada e da marcação de “Compartilhar áudio” no seletor nativo.

Localhost é um contexto seguro para o navegador. Em outros dispositivos, microfone/câmera/tela exigem **HTTPS**. Para redes diferentes, configure um serviço **TURN** seu; STUN sozinho não garante conexão em todos os roteadores. Exemplo:

```dotenv
ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.seudominio:3478","username":"usuario","credential":"credencial"}]
```

O STUN padrão faz contato com um serviço externo do Google apenas para descoberta de conectividade. É possível substituir por infraestrutura própria. A configuração TURN é entregue a usuários autenticados; use credenciais curtas e rotativas ao hospedar (a emissão automática ainda é futura). Sem SFU, a banda cresce com o número de participantes.

## Compartilhar com amigos na rede

1. Use PostgreSQL dedicado, faça backup do banco e de `data/uploads`.
2. Compile a interface com `npm run build`.
3. Coloque a API atrás de um proxy HTTPS com suporte a WebSocket. Defina `APP_ORIGIN=https://seu-host`, `NODE_ENV=production`, `COOKIE_SECURE=true` e `TRUST_PROXY=true` apenas se houver um proxy confiável.
4. Defina `HOST=0.0.0.0` somente quando precisar escutar fora de loopback; restrinja a porta no firewall ao proxy.
5. Configure TURN e execute `npm start`.

O backend recusa a configuração de produção sem HTTPS e cookies Secure. TLS é terminado no proxy; certificados não são gerados pelo projeto. Não exponha o servidor de desenvolvimento Vite à internet.

## Estrutura

```text
apps/api/src/       API, autenticação, autorização, uploads e sinalização
apps/api/test/      Testes de integração com banco real embutido
apps/web/src/       React, interface responsiva e WebRTC
packages/shared/   Schemas de validação e lista de permissões
docs/              Arquitetura, limites e plano de E2EE
data/              Persistência local (ignorada pelo Git)
```

Leia [arquitetura e limites](docs/ARCHITECTURE.md) e [validação](docs/VALIDATION.md). O código está preparado em módulos para futuras fases, mas bots, push, recuperação de senha por email, 2FA, apps nativos, SFU e E2EE ainda não são implementados.

## Novidades da versão 0.6

Mensagens de voz, busca completa, tópicos, agendamentos, convites por link, perfil por comunidade, missões semanais, acessibilidade, autenticador TOTP, códigos de recuperação e backup protegido por senha.

Veja [instalação da atualização e backup/restauração](docs/UPDATE-0.6.md). Códigos de recuperação precisam ser gerados e guardados antes de perder o acesso. Esta versão não envia e-mails de recuperação e continua sem E2EE.



Atualização 0.6.1: exclusão de comunidade somente pelo dono e melhorias de reprodução/diagnóstico de áudio. Veja [o guia](docs/UPDATE-0.6.1.md).


Versão 0.6.2: [instalar no celular e no PC](docs/INSTALL-APP.md), com ícones e botão de instalação.
