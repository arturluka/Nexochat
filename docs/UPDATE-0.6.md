# Atualização NexoChat 0.6

## O que chegou

- Mensagens de voz: grave até 2 minutos, ouça a prévia, descarte ou anexe ao compositor e envie. O navegador precisa de HTTPS e permissão de microfone. Reprodução dentro da conversa, sem download obrigatório. Formatos de gravação: WebM/Opus ou MP4, conforme o navegador; até 10 MB.
- Busca em todo o histórico acessível, com texto, username, conversa e intervalo de datas. Resultados paginados em grupos de 50, incluindo respostas em tópicos. Bloqueios e canais privados continuam protegidos.
- Tópicos vinculados a mensagens, respostas separadas da conversa principal, encerramento/reabertura e exclusão das próprias respostas. Limite explícito de 200 respostas por tópico nesta versão; texto, sem anexos internos.
- Agendamentos de texto entre 30 segundos e 30 dias, com consulta e cancelamento. Até 20 pendentes por pessoa. O servidor processa a fila a cada 5 segundos, retoma após reiniciar e verifica novamente acesso, bloqueios, timeout e modo lento. Mensagens impedidas ficam como falhas, sem contornar a moderação. O horário é exibido no fuso do navegador.
- Convites compartilháveis por link. A pessoa entra na conta e confirma antes de ingressar na comunidade.
- Apelido, bio e avatar exclusivos por comunidade, exibidos nas mensagens e no perfil aberto por elas. Campos vazios usam o perfil principal.
- Três missões semanais: presente diário em três dias, guardar uma mensagem e confirmar um evento da semana. Recompensas únicas de 80, 30 e 40 Faíscas. Semana começa segunda-feira às 00h UTC; spam não rende progresso.
- Acessibilidade: texto das mensagens de 14 a 22 px, contraste reforçado e redução de movimento, salvos na conta. A preferência de movimento do sistema também é respeitada.
- Segurança: autenticador TOTP com OTPAuth (RFC 6238), proteção contra reutilização e oito códigos de recuperação de uso único. A chave é adicionada manualmente ao aplicativo autenticador; não há leitor/gerador de QR nesta versão.
- Recuperação de senha com código previamente salvo. Recuperar encerra todas as sessões, remove o autenticador antigo e invalida os códigos restantes. Entre novamente, reative 2FA se desejar e gere códigos novos. Não há recuperação automática por e-mail sem configuração adicional.
- Backup completo com senha e restauração em instalação vazia, por comandos exclusivos do operador. Inclui contas, conteúdo, personalizações e anexos; não restaura sessões de login.

## Atualizar no Railway

1. Faça backup dos dados e do volume antes de atualizar. Preserve as variáveis existentes, especialmente DATA_DIR, DATABASE_URL, APP_ORIGIN e COOKIE_SECURE.
2. Atualize os arquivos do repositório com este pacote. Não envie .env, node_modules ou data.
3. Instalação: npm ci. Build: npm run build. Inicialização: npm start.
4. A migração 006 é aplicada automaticamente na inicialização. Mantém os dados das versões anteriores.
5. Depois do deploy, teste cadastro/login, envio de mensagem, áudio e chamada entre seus dispositivos reais.

A versão continua sem E2EE. Use HTTPS/WSS. Os segredos TOTP ficam no banco, protegido pelo controle de acesso da instalação; restrinja acesso ao banco e aos backups. O backup usa AES-256-GCM com chave derivada por scrypt e salt/nonce aleatórios, através das APIs padrão do Node. Isso protege o arquivo de backup, não implementa E2EE nas conversas.

## Backup e restauração

Pare a aplicação primeiro para manter consistência entre banco e anexos. Para PGlite, nunca abra o mesmo diretório em dois processos. Execute na raiz do projeto, com acesso ao DATA_DIR/volume e às variáveis da instalação.

PowerShell:

```powershell
$env:BACKUP_PASSWORD = 'SUBSTITUA por uma senha longa exclusiva'
npm run backup:create -- C:/backups/nexochat.nexobackup
```

Linux/Railway shell (digite a senha sem registrá-la no histórico):

```sh
read -rs BACKUP_PASSWORD
export BACKUP_PASSWORD
npm run backup:create -- /backups/nexochat.nexobackup
unset BACKUP_PASSWORD
```

Guarde a senha separada do arquivo. Arquivo existente não é sobrescrito. Copie o backup para fora do volume da aplicação.

Para restaurar, mantenha a origem intacta e escolha **um novo DATA_DIR vazio**. Se usar PostgreSQL externo, a DATABASE_URL também deve apontar para um banco vazio. Configure a mesma BACKUP_PASSWORD usada na criação:

```powershell
$env:DATA_DIR = 'C:/nexochat-restaurado'
# Se a origem era PGlite e a restauração também será:
$env:DATABASE_URL = ''
npm run backup:restore -- C:/backups/nexochat.nexobackup
```

A restauração recusa banco com usuários ou pasta de anexos ocupada. Não apaga dados existentes. Depois, inicie a aplicação com essas variáveis e entre novamente. Se uma restauração falhar por disco ou arquivo inválido, use outro destino vazio na próxima tentativa; a origem não é alterada. A ferramenta destina-se a um pequeno grupo e carrega o arquivo em memória (limite de descompressão de 256 MB). Backups maiores exigem uma estratégia operacional dedicada. A senha incorreta ou alterações no arquivo são rejeitadas antes da restauração.

## Limites de validação

Os testes automatizados usam PGlite e Edge com mídia simulada. Celulares físicos, Safari, TURN e PostgreSQL externo precisam de teste no ambiente publicado. Esta atualização não promete corrigir incompatibilidades de áudio específicas de um aparelho sem esse diagnóstico.
