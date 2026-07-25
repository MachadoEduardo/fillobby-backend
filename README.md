# Fillobby

Fillobby é uma aplicação colaborativa para grupos de amigos organizarem quais jogos desejam jogar juntos. Cada grupo mantém uma fila própria, recebe sugestões de jogos, registra votos, seleciona participantes, acompanha confirmações de disponibilidade e preserva um histórico dos jogos concluídos.

O diferencial do projeto é concentrar regras de grupo no backend: voto único, controle de membros, permissões por grupo, transições válidas de status e avanço condicionado à confirmação dos participantes.

## Desenvolvimento

Instale as dependências com `npm install` e configure um arquivo `.env` a partir de `.env.example`. A API usa `MONGO_URI` e `JWT_SECRET`; em produção, o segredo JWT é obrigatório.

As rotas de autenticação estão disponíveis em `/api/v1/auth`:

- `POST /register` para criar uma conta;
- `POST /login` para obter um JWT;
- `GET /me` com `Authorization: Bearer <token>` para consultar o usuário autenticado.

As rotas de grupos estão disponíveis em `/api/v1/groups`:

- `POST /` para criar um grupo;
- `GET /` e `GET /:groupId` para listar e detalhar grupos acessíveis;
- `POST /join` para entrar usando convite;
- `GET /:groupId/members` para listar membros;
- `PATCH /:groupId` e `DELETE /:groupId` para administrar o grupo;
- `PATCH /:groupId/members/:userId/role`, `DELETE /:groupId/members/:userId` e `POST /:groupId/transfer-owner` para administração de membros e propriedade.

As rotas do catálogo de jogos estão disponíveis em `/api/v1/games`:

- `POST /` para cadastrar um jogo, rejeitando títulos normalizados duplicados;
- `GET /` para listar jogos ativos com busca, plataforma e paginação;
- `GET /:gameId` para detalhar um jogo ativo;
- `PATCH /:gameId` para o autor editar o jogo;
- `DELETE /:gameId` para o autor inativar o jogo sem remover referências.

As rotas da fila estão disponíveis em `/api/v1/groups/:groupId/queue`:

- `POST /` para um membro ativo sugerir um jogo ativo;
- `GET /` para listar itens ativos com status, busca, plataforma, ordenação e paginação;
- `GET /:itemId` para detalhar um item ativo;
- `PATCH /:itemId/status` para `OWNER` ou `ADMIN` executar uma transição pública válida;
- `PUT /:itemId/participants` para `OWNER` ou `ADMIN` definir participantes ativos;
- `POST /:itemId/ready` para o participante autenticado marcar prontidão;
- `DELETE /:itemId/ready` para o participante autenticado retirar prontidão;
- `DELETE /:itemId` para `OWNER` ou `ADMIN` cancelar sem excluir fisicamente.

Itens novos começam em `SUGGESTED`. `COMPLETED` e `CANCELLED` são somente leitura, e o mesmo jogo não pode possuir dois itens ativos no mesmo grupo.

A seleção de participantes encerra a votação, respeita o `maxPlayers` do jogo e mantém `readyUsers` como subconjunto de `participants`. A prontidão é idempotente: o último participante pronto promove o item para `READY`, e qualquer retirada devolve o item para `WAITING_PLAYERS`.

As rotas de votos estão disponíveis em `/api/v1/groups/:groupId/queue/:itemId/votes`:

- `POST /` para um membro ativo criar o próprio voto;
- `DELETE /me` para remover o próprio voto;
- `GET /` para listar votos com paginação, sem expor o e-mail dos usuários.

Criação e remoção são permitidas somente enquanto o item está em `VOTING`. O voto é único por usuário e item, e sua persistência é atualizada na mesma transação que o `voteCount`.

Execute `npm test` para a suíte automatizada. Os testes de integração são executados quando `TEST_MONGO_URI` aponta para um banco MongoDB isolado.
