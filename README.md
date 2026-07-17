# Fillobby

Fillobby é uma aplicação colaborativa para grupos de amigos organizarem quais jogos desejam jogar juntos. Cada grupo mantém uma fila própria, recebe sugestões de jogos, registra votos, seleciona participantes, acompanha confirmações de disponibilidade e preserva um histórico dos jogos concluídos.

O diferencial do projeto é concentrar regras de grupo no backend: voto único, controle de membros, permissões por grupo, transições válidas de status e avanço condicionado à confirmação dos participantes.

## Desenvolvimento

Instale as dependências com `npm install` e configure um arquivo `.env` a partir de `.env.example`. A API usa `MONGO_URI` e `JWT_SECRET`; em produção, o segredo JWT é obrigatório.

As rotas de autenticação estão disponíveis em `/api/v1/auth`:

- `POST /register` para criar uma conta;
- `POST /login` para obter um JWT;
- `GET /me` com `Authorization: Bearer <token>` para consultar o usuário autenticado.

Execute `npm test` para a suíte automatizada. Os testes de integração são executados quando `TEST_MONGO_URI` aponta para um banco MongoDB isolado.
