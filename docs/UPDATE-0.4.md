# NexoChat 0.4 — insígnias e conquistas

Abra **Insígnias e conquistas** no menu lateral ou pelo atalho na loja. Há oito conquistas gratuitas, progresso individual, filtro de resgates disponíveis e coleção. Cada conquista dá uma insígnia permanente e uma recompensa única em Faíscas, registrada no extrato da loja.

| Insígnia | Requisito | Faíscas |
| --- | --- | --- |
| Primeiro Nexo | Ter uma conta | 25 |
| Sua identidade | Bio e status personalizado preenchidos | 50 |
| Boa companhia | Uma amizade aceita | 50 |
| Ponto de encontro | Criar uma comunidade | 75 |
| Toque pessoal | Adquirir uma moldura | 25 |
| Colecionador | Adquirir três molduras diferentes | 100 |
| Presença constante | Sete resgates diários, consecutivos ou não | 100 |
| Alô, turma! | Ligação aceita, como quem liga ou atende | 50 |

Clique em **Resgatar conquista** quando o objetivo estiver completo. A verificação usa os registros atuais do servidor; ações anteriores à atualização também contam se ainda estiverem registradas. Uma conquista já resgatada permanece na coleção mesmo que depois você remova a amizade, altere a bio ou exclua a comunidade.

Escolha até três insígnias com **Exibir no perfil**. A ordem de seleção é a ordem da vitrine. Ocultar uma insígnia não remove a conquista nem o prêmio. As insígnias exibidas são públicas no cartão do perfil, inclusive na busca e para pessoas com quem você interage. Os objetivos pendentes ficam na sua página pessoal.

As insígnias são cosméticas: não são verificação de identidade nem cargos administrativos. Esta versão não tem ranking competitivo, compra de insígnias com dinheiro real ou prêmios por enviar mensagens repetidas.

## Instalação e atualização

Mesmos comandos e configuração da versão 0.3. A migration 004 adiciona a coleção e a vitrine sem apagar dados. Build: `npm run build`; inicialização: `npm start`. O endpoint `/api/health` retorna versão 0.4.0.

O resgate usa a mesma transação da carteira, com bloqueio por usuário e chave única por conquista. Pedidos simultâneos não duplicam Faíscas. O servidor rejeita insígnias não conquistadas, IDs desconhecidos, repetidos e mais de três seleções. O cliente não escolhe o valor do prêmio.

Mantenha banco e uploads em armazenamento persistente, conforme [configuração da versão 0.3](UPDATE-0.3.md). A MVP continua sem E2EE.
