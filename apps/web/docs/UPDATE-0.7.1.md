# Atualização 0.7.1 — gestos no celular

- Segure o texto ou anexo de uma mensagem por cerca de meio segundo para abrir o menu inferior com as ações disponíveis: favorito, fixar, denunciar, tópico, responder, reagir, editar e apagar. As permissões continuam validadas pela API.
- O botão discreto de três pontos também abre o menu, inclusive com teclado. Escape, o botão Fechar ou tocar fora fecha o menu. Apagar continua pedindo confirmação.
- A coluna de ícones fica escondida em telas de até 700 px, deixando a mensagem ocupar o espaço. Desktop mantém ações ao passar o mouse/focar.
- Mover o dedo mais de 10 px cancela a espera do menu, preservando a rolagem. Links, áudio e botões continuam com interação normal em toque curto.
- Para abrir a navegação, deslize para a direita começando perto da borda esquerda (até 44 px). Para fechar, deslize para a esquerda na área livre da lista ou toque fora dela. O botão de menu permanece disponível.

Extraia o ZIP GitHub e envie seu conteúdo à raiz do repositório. No Railway, mantenha a construção `npm ci --include=dev && npm run build` e inicialização `npm start`, com as variáveis e armazenamento existentes. Não é necessária uma nova migração de banco.

Teste automatizado: `npm run test:mobile`, com navegador Edge em viewport de celular e eventos de toque. Valida menu ao segurar, favorito, resposta, edição, ausência de edição em mensagem alheia, cancelamento na rolagem, abertura/fechamento por deslizar, Escape, layout sem overflow e barra desktop. Ainda é necessário conferir o comportamento em celulares físicos, especialmente Safari/iOS.
