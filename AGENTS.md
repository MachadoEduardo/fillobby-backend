# AGENTS.md

## Contexto do projeto

Fillobby é uma API REST para grupos de amigos organizarem uma fila compartilhada de jogos. O backend deve permitir criar grupos privados, administrar membros, sugerir e votar em jogos, selecionar participantes, confirmar prontidão, controlar o ciclo de cada item da fila e consultar o histórico.

O principal valor do projeto está nas regras de negócio executadas no backend:

- somente membros ativos acessam os recursos internos de um grupo;
- permissões dependem do papel do usuário em cada grupo (`OWNER`, `ADMIN` ou `MEMBER`);
- cada usuário pode votar uma única vez em cada item;
- participantes precisam ser membros ativos e respeitar o limite do jogo;
- somente participantes podem marcar prontidão;
- um item só fica `READY` quando todos os participantes estiverem prontos;
- mudanças de status seguem uma máquina de estados explícita;
- itens concluídos compõem um histórico somente leitura.

Priorize primeiro o MVP descrito em `doc_fillobby.docx`. Não implemente chat, notificações, WebSocket, integrações com plataformas, recomendações, estatísticas ou outras melhorias opcionais sem solicitação explícita.

## Stack e convenções existentes

- Node.js com ESM (`import` e `export`);
- Express 5;
- MongoDB com Mongoose;
- variáveis de ambiente com `dotenv`;
- CORS para integração com um frontend separado;
- JavaScript, sem TypeScript no escopo atual.

Tecnologias previstas para as próximas etapas incluem JWT, bcrypt, uma biblioteca de validação, middleware de segurança, rate limiting, logs estruturados e testes com Jest ou Vitest e Supertest. Antes de usar uma dessas bibliotecas, confirme que ela já está instalada. Não adicione dependências sem necessidade concreta.

Mantenha nomes de código em inglês e mensagens voltadas ao usuário em português. Use ESM em todos os arquivos JavaScript e inclua a extensão `.js` nos imports locais.

## Princípios de implementação

1. Prefira a solução mais simples que preserve corretamente as regras do domínio.
2. Não crie abstrações antecipadas, classes-base, factories genéricas ou wrappers sem reutilização real.
3. Separe responsabilidades, mas evite arquivos que apenas repassam chamadas sem acrescentar comportamento.
4. Use funções pequenas, nomes descritivos e retornos antecipados para reduzir aninhamento.
5. Evite duplicação de regras críticas. Autorização, transições de estado e validações de pertencimento devem ter uma fonte clara.
6. Faça mudanças focadas. Não refatore áreas não relacionadas durante uma correção ou funcionalidade.
7. Não esconda regras importantes em hooks complexos do Mongoose. Regras que dependem do usuário autenticado, de permissões ou de várias entidades pertencem ao service.
8. Comentários devem explicar decisões ou restrições não óbvias, não repetir o código.

## Organização do código

À medida que a aplicação crescer, prefira organização por módulo de negócio:

```text
src/
  app.js
  server.js
  config/
  modules/
    auth/
    users/
    groups/
    games/
    queue/
    votes/
  middlewares/
  shared/
    errors/
    utils/
tests/
```

Cada módulo pode conter apenas os arquivos de que realmente precisa, por exemplo `*.routes.js`, `*.controller.js`, `*.service.js`, `*.model.js` e `*.validation.js`.

Não reorganize todo o projeto apenas para atingir essa estrutura. Faça a migração incrementalmente quando novas funcionalidades forem implementadas. Enquanto os models permanecerem em `src/models`, mantenha-os consistentes entre si.

Responsabilidades:

- **Routes:** definem método, caminho, middlewares e controller.
- **Controllers:** extraem dados da requisição, chamam o service e enviam a resposta. Não implementam regra de negócio nem acessam o Mongoose diretamente.
- **Services:** concentram regras de negócio, autorização contextual, transições de estado e operações que coordenam mais de um model.
- **Models:** definem schema, tipos, validações locais, referências e índices.
- **Repositories:** são opcionais. Crie-os somente se consultas complexas/repetidas justificarem uma camada adicional; não envolva cada método do Mongoose mecanicamente.
- **Middlewares:** tratam preocupações HTTP reutilizáveis, como autenticação, validação e erros.
- **Validators:** validam e normalizam `body`, `params` e `query` antes do service.

## Regras para models Mongoose

- Use `mongoose.Schema.Types.ObjectId` e referências por nome de model, por exemplo `ref: 'User'`.
- Campos relacionais essenciais devem ser `required`.
- Use `{ timestamps: true }` quando o recurso precisar de auditoria básica.
- Declare índices que representam invariantes do domínio, não apenas índices de performance.
- `GroupMember` deve ter índice único `{ group: 1, user: 1 }`.
- `Vote` deve ter índice único `{ queueItem: 1, user: 1 }`.
- Lembre que `unique` cria índice; ele não funciona como validator comum. Converta erros `E11000` em respostas de conflito adequadas.
- Para defaults dinâmicos, passe a função (`default: Date.now`), sem executá-la na definição do schema.
- Arrays de IDs devem evitar duplicatas. Quando houver concorrência, prefira operadores como `$addToSet` e `$pull`.
- `required` em array não garante que ele tenha elementos; use validator explícito quando a lista não puder estar vazia.
- Campos derivados, como `voteCount`, devem ter estratégia clara de consistência. Prefira calcular quando o custo for aceitável; se usar cache, atualize atomicamente.
- Não presuma exclusão em cascata. Trate referências e limpeza de dados explicitamente no service.
- Validação do schema não substitui regras que consultam outras coleções.

## Regras centrais do domínio

### Autorização

- Toda rota privada exige JWT válido.
- Toda operação dentro de grupo verifica associação ativa em `GroupMember`.
- Ações administrativas exigem `OWNER` ou `ADMIN`.
- Exclusão do grupo e transferência de propriedade são exclusivas do `OWNER`.
- Um usuário só altera o próprio voto e a própria prontidão.
- Recursos de grupos inacessíveis não devem vazar informações; use `404` quando isso evitar enumeração indevida.

### Fila e estados

Estados:

```text
SUGGESTED -> VOTING -> WAITING_PLAYERS -> READY -> PLAYING -> COMPLETED
```

`CANCELLED` é um destino permitido a partir dos estados ativos conforme autorização administrativa. Não permita edição comum de itens `COMPLETED` ou `CANCELLED`.

Mantenha as transições permitidas em uma estrutura explícita e centralizada no módulo da fila. Não espalhe comparações de status por controllers e rotas.

No mesmo grupo, um jogo não pode possuir dois itens ativos simultaneamente. `COMPLETED` e `CANCELLED` não contam como ativos.

### Votos, participantes e prontidão

- Um segundo voto no mesmo item deve resultar em `409 VOTE_ALREADY_EXISTS`.
- Votos só podem ser criados ou removidos enquanto o item estiver em `VOTING`.
- Todos os participantes precisam ser membros ativos do grupo.
- Quando `maxPlayers` estiver definido, exija um inteiro positivo e respeite o limite.
- `readyUsers` deve ser subconjunto de `participants`.
- Use operações idempotentes para prontidão sempre que possível.
- O status muda automaticamente para `READY` quando houver ao menos um participante e todos estiverem prontos.
- Somente `OWNER` ou `ADMIN` pode iniciar ou concluir um jogo.
- Ao concluir, preencha `completedAt`; fora de `COMPLETED`, evite manter esse campo preenchido.

### Histórico e remoções

- Itens `COMPLETED` são histórico somente leitura.
- Jogos referenciados pelo histórico não devem ser excluídos fisicamente; prefira inativação.
- O dono não pode sair antes de transferir a propriedade ou excluir o grupo.
- Ao remover um membro, retire-o de participantes e prontidão dos itens anteriores a `PLAYING` e remova seus votos dos itens ativos.
- Operações que alteram várias coleções devem usar transação quando uma falha parcial puder quebrar invariantes importantes.

## API, validação e erros

- Use o prefixo `/api/v1`.
- Todas as respostas são JSON.
- Adote um formato consistente:

```json
{
  "success": true,
  "data": {}
}
```

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem legível.",
    "details": []
  }
}
```

- Centralize o tratamento de erros em middleware.
- Use erros de aplicação com código HTTP e código estável; não compare textos de mensagens para decidir comportamento.
- Valide `ObjectId`, body, params e query antes de executar a regra.
- Limite paginação e use limite máximo de 100.
- Não aceite do cliente campos controlados pelo servidor, como `owner`, `role`, `createdBy`, `voteCount`, `completedAt` e identidade do autor.
- Use adequadamente `400`, `401`, `403`, `404`, `409` e `500`. Se o projeto adotar `422`, aplique-o de forma consistente.
- Controllers devem encaminhar erros ao middleware, sem blocos repetidos de resposta.

## Segurança

- Armazene somente `passwordHash`; nunca persista senha em texto puro.
- Nunca retorne hash, token, segredo ou credencial.
- O hash deve ser produzido com bcrypt no fluxo de cadastro/alteração de senha.
- JWT deve ter expiração e segredo obrigatório em produção.
- Não mantenha fallback inseguro de `JWT_SECRET` em produção.
- Restrinja CORS à URL configurada do frontend em produção.
- Aplique rate limit especialmente em login e cadastro.
- Não registre senhas, JWTs ou valores sensíveis.
- `.env` não deve ser versionado; mantenha `.env.example` atualizado sem segredos reais.

## Testes e verificação

Toda alteração deve ser verificada na proporção do risco. Ao adicionar uma regra de negócio, inclua teste correspondente assim que a infraestrutura de testes existir.

Prioridades de teste:

- cadastro, normalização e unicidade de e-mail;
- senha armazenada com hash e omitida das respostas;
- autenticação e rotas protegidas;
- acesso por associação e papel no grupo;
- índice e comportamento de voto único;
- bloqueio de jogo duplicado na fila ativa;
- seleção e limite de participantes;
- prontidão e promoção automática para `READY`;
- transições válidas e inválidas;
- imutabilidade do histórico;
- remoção de membro e limpeza dos itens ativos.

Prefira:

- testes unitários para services com regras puras;
- testes de integração com Supertest para endpoints e middlewares;
- banco de teste isolado;
- factories pequenas e explícitas em vez de fixtures globais difíceis de entender.

Não afirme que uma mudança está concluída sem executar os testes e verificações disponíveis. Se o projeto ainda não tiver testes ou lint, informe claramente essa limitação.

## Critérios para concluir uma alteração

- A regra solicitada está implementada na camada apropriada.
- Entradas inválidas e falta de permissão são tratadas.
- Invariantes importantes também estão protegidas por índices ou operações atômicas quando possível.
- A resposta HTTP segue o padrão do projeto.
- Não há exposição de dados sensíveis.
- Nomes e estrutura permanecem legíveis.
- Não foram adicionadas dependências ou abstrações sem justificativa.
- Testes relevantes passam, ou a ausência de infraestrutura de teste é registrada.
- README e `.env.example` são atualizados quando instalação, configuração ou API pública mudarem.
