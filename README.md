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

Execute `npm test` para a suíte automatizada. Os testes de integração são executados quando `TEST_MONGO_URI` aponta para um banco MongoDB isolado.
