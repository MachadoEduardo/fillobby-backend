Quero criar o frontend web responsivo do Fillobby.

  O arquivo `openapi.yaml` anexado é o contrato oficial do backend. Leia-o antes de gerar código e siga exatamente seus
  endpoints, schemas, enums, regras, respostas e códigos de erro.

  Regras obrigatórias:

  - Crie somente o frontend. Não crie Supabase, banco de dados, backend alternativo, Edge Functions ou endpoints próprios.
  - A API existente usa MongoDB, Express e JWT.
  - Use `VITE_API_URL` como URL base da API. Exemplo: `https://minha-api.com`.
  - Todas as rotas da API começam com `/api/v1`.
  - Após o login, envie o JWT em todas as rotas privadas:
    `Authorization: Bearer <token>`.
  - Faça login com `POST /api/v1/auth/login`.
  - O cadastro não retorna token; após cadastrar, redirecione para a tela de login.
  - Ao iniciar o app com token salvo, valide a sessão em `GET /api/v1/auth/me`.
  - Em uma resposta `401`, remova a sessão local e redirecione para `/login`.
  - Logout deve apenas remover token e usuário salvos localmente.
  - Use um cliente HTTP centralizado e React Query/TanStack Query para buscas, cache e invalidação após mutações.
  - Todas as mensagens da interface devem estar em português do Brasil.
  - Não invente propriedades, endpoints ou fluxos ausentes no OpenAPI.
  - Use `error.code` para comportamentos específicos e `error.message` como mensagem principal ao usuário.
  - Não trate permissões do frontend como segurança: o backend é a autoridade. Use `role` somente para mostrar ou ocultar
  controles na interface.

  Telas e fluxos a implementar:

  1. Autenticação
     - Cadastro;
     - Login;
     - Sessão persistente;
     - Logout;
     - Rotas privadas.

  2. Grupos
     - Listagem de grupos;
     - Criação de grupo;
     - Entrada por código de convite;
     - Detalhe do grupo;
     - Configurações do grupo;
     - Lista de membros;
     - Ações administrativas conforme `OWNER`, `ADMIN` e `MEMBER`;
     - Exibir código de convite apenas quando ele vier na resposta da API.

  3. Jogos
     - Catálogo com busca, filtro por plataforma e paginação;
     - Cadastro de jogo;
     - Edição e inativação apenas quando o usuário autenticado for o autor.

  4. Fila do grupo
     - Listar itens ativos;
     - Sugerir jogos;
     - Votar e remover o próprio voto;
     - Mostrar contagem de votos;
     - Selecionar participantes;
     - Marcar e retirar a própria prontidão;
     - Iniciar e concluir jogo para `OWNER` e `ADMIN`;
     - Cancelar item para `OWNER` e `ADMIN`;
     - Mostrar claramente os estados:
       `SUGGESTED`, `VOTING`, `WAITING_PLAYERS`, `READY`, `PLAYING`,
       `COMPLETED` e `CANCELLED`.

  5. Histórico
     - Listar itens concluídos;
     - Filtros por período, jogo e participante;
     - Paginação.

  Regras de interface para a fila:

  - Não exiba ações de voto fora de `VOTING`.
  - A seleção de participantes é permitida apenas em `VOTING` e `WAITING_PLAYERS`.
  - Prontidão é permitida apenas para o próprio usuário, quando ele estiver em `participantIds`, e apenas em `WAITING_PLAYERS`
  ou `READY`.
  - Ações de iniciar e concluir são administrativas e devem respeitar as transições descritas no OpenAPI.
  - Depois de qualquer mutação, use a resposta retornada ou invalide a query correspondente; não calcule o próximo estado
  localmente.
  - Itens históricos são somente leitura.

  Comece criando a estrutura da aplicação, o cliente HTTP, os tipos derivados do OpenAPI, autenticação e as telas principais.
  Use dados reais da API, sem mocks após a integração.