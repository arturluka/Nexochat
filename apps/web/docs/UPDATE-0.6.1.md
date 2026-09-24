# Atualização 0.6.1 — comunidade e áudio

## Exclusão somente pelo dono

Abra Gerenciar comunidade → Excluir esta comunidade. Digite o nome exato e confirme. A API verifica o dono no banco; nenhum cargo, nem com todas as permissões, pode executar essa ação. A exclusão remove os dados vinculados, encerra chamadas nos canais e remove os arquivos de anexos vinculados aos canais. Contas, DMs e outras comunidades permanecem. Imagens pessoais reutilizáveis de perfil/figurinhas sem vínculo a um canal não são apagadas do disco por essa ação.

## Tela funciona, áudio não

A tela recebida indica que uma conexão de mídia foi estabelecida. Não é evidência suficiente para culpar a falta de TURN. Nesta atualização:

- A reprodução de áudio é retomada quando a faixa remota deixa de estar temporariamente muda.
- Ativar som desbloqueia a reprodução dentro do toque/clique, inclusive ao sair de ensurdecido; a proteção contra eco da mesma conta é preservada.
- Os elementos de áudio recebem a indicação de reprodução inline.
- Dispositivos → Diagnóstico de áudio mostra conexão direta/TURN, estado ICE, bytes enviados/recebidos e atividade recente. Não diz mais que o áudio está funcionando só porque você entrou na sala.
- TURN configurado significa apenas configuração presente, não comprova serviço/credenciais operacionais.

Para testar entre pessoas: use contas diferentes, entre em Conversar no aparelho com microfone, toque Ativar som no receptor e confira volume/saída. Usar PC com celular desliga propositalmente o som do PC. A mesma conta em dois dispositivos é silenciada entre eles; para teste, habilite Ouvir meu outro dispositivo com fones.

Se houver áudio recebido aumentando, mas nada audível, confira reprodução, volume, saída/Bluetooth e esses modos. Se não houver pacotes recebidos apesar de o outro aparelho enviar, registre o diagnóstico nos dois aparelhos. O contador inclui áudio de microfone e de compartilhamento; silencie o áudio da tela durante esse teste. Não representa uma medição do que está saindo fisicamente do alto-falante.

## Configuração Railway

No serviço que executa a API, abra Variables e confira ICE_SERVERS. O padrão só contém STUN; para redes em que a conexão direta falha, use credenciais de um serviço TURN que você controla/contrata. O domínio HTTPS do aplicativo no Railway não é um servidor TURN.

Formato de exemplo, substitua todos os valores pelos fornecidos pelo seu serviço (não cole credenciais em conversas):

```json
[{"urls":"stun:stun.l.google.com:19302"},{"urls":["turn:SEU_HOST:3478?transport=udp","turns:SEU_HOST:443?transport=tcp"],"username":"SEU_USUARIO","credential":"SUA_CREDENCIAL_TURN"}]
```

Use somente URLs/portas efetivamente suportadas pelo provedor. ICE_TRANSPORT_POLICY=all mantém tentativa direta e TURN. Para diagnosticar especificamente TURN, pode usar temporariamente relay; sem TURN funcional isso impede todas as conexões. Após alterar as variáveis, aplique o deploy e todos saiam/entrem novamente na chamada. Configuração inválida retorna uma mensagem explícita sem expor os valores secretos.

Referências: https://webrtc.org/getting-started/turn-server e https://docs.railway.com/networking/public-networking

## Atualizar

Faça backup, preserve .env/variáveis e volume, substitua o código, execute npm ci e npm run build e inicie com npm start. Nenhuma nova migração é necessária em relação à 0.6. Código testado localmente não significa deploy realizado nem correção confirmada no celular físico.
