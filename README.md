# Fillobby

Fillobby é uma aplicação colaborativa para grupos de amigos organizarem quais jogos desejam jogar juntos. Cada grupo mantém uma fila própria, recebe sugestões de jogos, registra votos, seleciona participantes, acompanha confirmações de disponibilidade e preserva um histórico dos jogos concluídos.

O diferencial do projeto é concentrar regras de grupo no backend: voto único, controle de membros, permissões por grupo, transições válidas de status e avanço condicionado à confirmação dos participantes.

## Desenvolvimento

Use Node.js 24.21.0 e npm 11.19.0, definidos em `.nvmrc` e `package.json`. Com o NVM instalado, prepare o ambiente nativo com:

```bash
nvm use
npm ci
```

Configure um arquivo `.env` a partir de `.env.example`. A API usa `MONGO_URI` e `JWT_SECRET`; em produção, o segredo JWT é obrigatório. Para executar os testes de integração, `TEST_MONGO_URI` deve apontar para um banco MongoDB isolado com replica set, pois a aplicação usa transações.

### Scripts principais

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia a API com recarga automática |
| `npm run lint` | Verifica o padrão de código com ESLint |
| `npm run lint:openapi` | Valida o contrato OpenAPI |
| `npm test` | Executa a suíte; integrações exigem `TEST_MONGO_URI` |
| `npm run test:ci` | Exige o banco de teste e impede integrações ignoradas |
| `npm start` | Inicia a API sem modo de observação |

### Solução completa com Docker

O Compose é a forma recomendada de subir a aplicação completa sem instalar MongoDB localmente. Mantenha `fillobby-backend` e `fillobby-frontend` como diretórios irmãos e, neste diretório, execute:

```bash
docker compose up --build
```

O frontend ficará em `http://localhost:5173`, a API em `http://localhost:3000` e o MongoDB em `localhost:27017`. O banco sobe como replica set para reproduzir as transações usadas pela aplicação. Para executar os testes no container:

```bash
docker compose exec backend npm run test:ci
```

Encerre os serviços com `docker compose down`. Use `docker compose down -v` somente quando quiser apagar também os dados e dependências armazenados nos volumes locais. As imagens são destinadas a desenvolvimento e CI; os deploys continuam na Vercel e no Render.

### Testes E2E

Os testes Playwright ficam no frontend e usam um projeto Compose isolado, sem alterar os volumes do ambiente de desenvolvimento. Com os dois repositórios em diretórios irmãos:

```bash
docker compose --env-file .env.e2e up --build --detach --wait
cd ../fillobby-frontend
npm run test:e2e
cd ../fillobby-backend
docker compose --env-file .env.e2e down --volumes --remove-orphans
```

Esse ambiente usa frontend em `http://localhost:5174`, API em `http://localhost:3100`, MongoDB em `localhost:27018` e dados descartáveis no banco `fillobby_e2e`.

As rotas de autenticação estão disponíveis em `/api/v1/auth`:

- `POST /register` para criar uma conta;
- `POST /login` para obter um JWT;
- `GET /me` com `Authorization: Bearer <token>` para consultar o usuário autenticado.

O contrato completo da API para integração com clientes está em
[`docs/openapi.yaml`](docs/openapi.yaml). A especificação usa OpenAPI 3.1 e
documenta autenticação, entradas, respostas, paginação, regras e erros dos
endpoints atuais.

As rotas de grupos estão disponíveis em `/api/v1/groups`:

- `POST /` para criar um grupo;
- `GET /` e `GET /:groupId` para listar e detalhar grupos acessíveis;
- `POST /join` para entrar usando convite;
- `GET /:groupId/members` para listar membros;
- `PATCH /:groupId` e `DELETE /:groupId` para administrar o grupo;
- `PATCH /:groupId/members/:userId/role`, `DELETE /:groupId/members/:userId` e `POST /:groupId/transfer-owner` para administração de membros e propriedade.
- `POST /:groupId/leave` para um membro ou administrador sair do grupo;
- `POST /:groupId/members/:userId/restore` para `OWNER` ou `ADMIN` restaurar um membro removido;
- `POST /:groupId/regenerate-invite` para `OWNER` ou `ADMIN` renovar o código de convite;
- `GET /:groupId/members?status=REMOVED` para administradores consultarem membros removidos e restaurá-los.

As rotas do catálogo de jogos estão disponíveis em `/api/v1/games`:

- `POST /` para cadastrar um jogo; se um título normalizado existir apenas
  como inativo, o registro é reativado. Duplicatas ativas são rejeitadas;
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

As respostas da fila também incluem `participants` com `id`, `name` e
`avatarUrl`, além de `participantIds`. O histórico retorna esses resumos mesmo
depois de uma saída ou remoção do grupo.

As rotas de votos estão disponíveis em `/api/v1/groups/:groupId/queue/:itemId/votes`:

- `POST /` para um membro ativo criar o próprio voto;
- `DELETE /me` para remover o próprio voto;
- `GET /` para listar votos com paginação, sem expor o e-mail dos usuários.

Criação e remoção são permitidas somente enquanto o item está em `VOTING`. O voto é único por usuário e item, e sua persistência é atualizada na mesma transação que o `voteCount`.

O histórico está disponível em `GET /api/v1/groups/:groupId/history` para membros ativos. A rota retorna somente itens `COMPLETED`, ordenados por conclusão mais recente, e aceita:

- `from` e `to` no formato `YYYY-MM-DD`, com intervalo inclusivo em UTC;
- `gameId` e `participantId`;
- `page` e `limit`, com limite máximo de 100.

Itens históricos permanecem somente leitura e continuam disponíveis quando o jogo é inativado.

O CI executa lint de código, validação do OpenAPI, testes com MongoDB em replica set, build da imagem de produção e os fluxos E2E centrais em Chromium. Pull requests não devem ser integrados enquanto alguma dessas verificações falhar.
