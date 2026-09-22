# NexoChat 0.3 — Faíscas e chamadas

## Loja gratuita

Abra Loja de molduras e resgate 100 Faíscas por dia. O dia vira às 00:00 UTC; a interface mostra o próximo horário local. São seis molduras de 100 a 400 Faíscas, com prévia, confirmação de compra, coleção, equipar/remover e extrato das últimas 20 movimentações. A moldura aparece no perfil, amigos e mensagens. Não há compra de moeda com dinheiro real, anúncios, transferência ou saque.

O servidor determina preços e saldo. Resgate e compra usam transação e bloqueio da carteira, impedindo crédito duplicado ou gasto simultâneo acima do saldo. A compra é permanente na coleção.

## Chamadas

Entrar em uma DM ou grupo vazio chama as pessoas disponíveis por até 45 segundos. Elas podem aceitar, recusar ou aceitar só ouvindo. O microfone não é solicitado antes do aceite. Histórico registra aceita, recusada, cancelada, perdida e ocupada. Sair da sala cancela os convites enviados pelo dispositivo. Silenciar a conversa ou usar status Ocupado impede o toque. Canais de comunidade continuam abertos para entrada livre.

O aviso aparece com a página conectada. O toque sonoro exige uma interação anterior com a página. Esta versão não recebe chamadas com o navegador fechado e não garante entrega com o celular em segundo plano.

### Seu PC sem microfone + celular

1. No PC, entre em **Usar PC com celular** e compartilhe a tela.
2. Na mesma conta e conversa pelo celular, entre em **Conversar** e permita o microfone.
3. Use o celular para falar e ouvir seus amigos. O áudio entre seus próprios dispositivos fica silenciado por padrão para evitar eco.
4. Para testar o microfone do celular ouvindo pelo PC, use fones e ative **Dispositivos → Ouvir meu outro dispositivo (teste com fones)**.

Se não ouvir outra pessoa, clique em **Ativar som**, confira o volume individual e a saída de áudio. O medidor mostra se o microfone local recebe sinal. Em Dispositivos, os contadores mostram áudio enviado/recebido; **Reconectar mídia** tenta restabelecer a conexão. Alguns roteadores exigem TURN configurado em `ICE_SERVERS`; o projeto não fornece um serviço TURN público gratuito. Dispositivos e captura de áudio da tela dependem do navegador.

## Atualização no Railway

Use a raiz do repositório, build `npm run build`, start `npm start`. As migrations 002 e 003 são aplicadas automaticamente na inicialização, adicionando tabelas/campos sem apagar contas ou mensagens. `GET /api/health` informa versão 0.3.0.

Mantenha `APP_ORIGIN` com a URL HTTPS pública, `COOKIE_SECURE=true`, `NODE_ENV=production`, `HOST=0.0.0.0` e o proxy configurado. Não envie `.env`, banco ou uploads ao GitHub.

Se usar PGlite sem `DATABASE_URL`, **DATA_DIR precisa estar em um volume persistente**, por exemplo volume em `/data` e `DATA_DIR=/data`. Sem volume, redeploy pode perder contas, mensagens, Faíscas e anexos. PostgreSQL dedicado também precisa de backup e os uploads continuam exigindo armazenamento persistente. Alterar o diretório/banco não copia os dados existentes: faça backup e migração antes. Execute uma única instância da API; presença, convites e sinalização são locais ao processo.

O sistema continua sendo uma MVP sem E2EE. Não há criptografia própria adicionada nesta versão.
