# Fillobby — Backend

API REST do Fillobby, aplicação para grupos de amigos escolherem jogos e organizarem partidas. O fluxo principal reúne grupo, sugestões, votação, seleção de participantes, prontidão e histórico. O backend concentra autenticação, permissões e regras de transição da fila; o cliente React está no repositório irmão `fillobby-frontend`.

## Requisitos e configuração

Use Node.js 24.21.0 e npm 11.19.0 (veja `.nvmrc` e `package.json`). Para desenvolvimento nativo, tenha um MongoDB com replica set: as operações entre coleções usam transações. Copie `.env.example` para `.env` e ajuste `MONGO_URI`, `JWT_SECRET` e `FRONTEND_URL`. Para os testes de integração, configure `TEST_MONGO_URI` com um banco **isolado**, também em replica set. Não versione o `.env`.

```bash
nvm use
npm ci
npm run dev
```

A API fica em `http://localhost:3000` por padrão. O contrato dos endpoints, parâmetros e respostas está em [`docs/openapi.yaml`](docs/openapi.yaml).

## Solução completa com Docker

Mantenha `fillobby-backend` e `fillobby-frontend` como diretórios irmãos. A partir deste diretório:

```bash
docker compose up --build
```

Isso inicia MongoDB, API (`http://localhost:3000`) e frontend (`http://localhost:5173`) para desenvolvimento. Encerre com `docker compose down`; os volumes permanecem para a próxima execução. O Compose usa configuração local de desenvolvimento, não de produção.

## Verificação

| Comando | Finalidade |
| --- | --- |
| `npm run lint` | Verifica o código com ESLint |
| `npm run lint:openapi` | Valida o contrato da API |
| `npm test` | Executa testes unitários e de integração; estes exigem `TEST_MONGO_URI` |
| `npm run test:ci` | Exige `TEST_MONGO_URI` e impede integrações ignoradas |

Com o Compose ativo, rode os testes de integração sem configurar MongoDB no host com `docker compose exec backend npm run test:ci`. Os testes E2E com Playwright ficam no frontend; seu README descreve como iniciar o ambiente isolado e executá-los.

Ao alterar a API pública, atualize o OpenAPI e os testes de contrato em `tests/openapi-contract.test.js`. A implementação e as regras de domínio estão organizadas em `src/modules/`, com modelos em `src/models/`.
