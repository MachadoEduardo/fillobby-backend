# Roadmap contínuo do Fillobby

## Direção do produto

O Fillobby deve ser o ponto de encontro anterior à partida: o lugar em que um grupo decide **o que jogar, quando jogar, com quem jogar e se todos estão prontos**. O produto atual já cobre grupos, catálogo, sugestões, votos, participantes, prontidão e histórico. A evolução deve primeiro consolidar essa base, depois completar a organização da partida e somente então adicionar integrações e recursos de retenção.

Este documento é um backlog priorizado, não um compromisso de implementar tudo. Antes de iniciar uma etapa, valide a hipótese com usuários e reordene os itens conforme uso, suporte e métricas.

### Critérios de prioridade

- **P0:** corrige risco, inconsistência ou bloqueio da evolução.
- **P1:** entrega valor direto e recorrente ao usuário.
- **P2:** aumenta conveniência ou retenção depois que o fluxo principal estiver validado.
- Em cada entrega, revise apenas as camadas afetadas: contrato, testes, segurança, acessibilidade e estados da interface quando forem relevantes. Evite infraestrutura ou cobertura sem benefício concreto.
- Novas regras devem seguir TDD, com foco em testes E2E dos fluxos importantes, não em cobertura artificial.

## Diagnóstico atual

Pontos fortes:

- autorização contextual por grupo e papéis `OWNER`, `ADMIN` e `MEMBER`;
- máquina de estados explícita para a fila;
- validação com Zod, respostas e erros consistentes;
- índices e transações protegendo votos, membros e itens ativos;
- frontend organizado por features, responsivo e com feedback contextual.

Limitações que devem ser tratadas antes de uma expansão grande:

- `QueueItem` representa sugestão, votação, formação de time, partida e histórico ao mesmo tempo;
- services de grupos e fila concentram regras, persistência e coordenação entre módulos;
- a base de CI e E2E está pronta, mas deve crescer junto com cada novo fluxo de negócio relevante;
- JWT fica no `localStorage`, sem revogação, recuperação de senha ou ciclo de sessões;
- paginação de grupos ocorre em memória e a interface usa limites fixos de 50/100 itens;
- polling frequente substitui uma estratégia de sincronização orientada a eventos;
- preferências de plataforma são cadastradas, mas ainda não influenciam decisões;
- não há logs estruturados, auditoria administrativa ou readiness do banco.

## Etapa 0 — Fundação confiável

### 1. Padronizar toolchain e CI — P0 ✅

Escolher uma versão de Node e um único gerenciador de pacotes para frontend e backend. Adicionar CI ao backend com lint, testes, MongoDB preparado para transações e validação do OpenAPI. Manter lint, typecheck, testes e build no frontend.

- **Valor:** elimina diferenças entre ambiente local e CI e impede entregas com testes críticos ignorados.
- **Complexidade:** média.
- **Dependências:** MongoDB de teste ou Testcontainers; definição da versão oficial do Node.
- **Impacto:** infraestrutura, ambos os repositórios e documentação.
- **Tipo:** técnico.

**Concluído:** Node.js 24.21.0 e npm 11.19.0 foram padronizados nos dois repositórios. O backend agora possui CI com ESLint, validação OpenAPI, testes obrigatórios em MongoDB replica set e build Docker; o frontend mantém lint, typecheck, testes, build e validação da imagem. Um Compose local sobe MongoDB, API e interface sem alterar os deploys na Vercel e no Render.

### 2. Testes E2E dos fluxos centrais — P0 ✅

Adicionar Playwright para cadastro/login, criação ou entrada em grupo, sugestão, votação, seleção de participantes, prontidão e conclusão. O backend deve falhar na CI quando o banco de integração não estiver configurado, em vez de ignorar a maior parte da suíte.

- **Valor:** detecta regressões que testes isolados do cliente HTTP não encontram.
- **Complexidade:** média.
- **Dependências:** ambiente de teste determinístico e dados descartáveis.
- **Impacto:** frontend, backend e CI.
- **Tipo:** qualidade.

**Concluído:** Playwright em Chromium valida a proteção de autenticação e uma jornada com dois usuários, cobrindo cadastro, login, criação e entrada em grupo, catálogo, sugestão, votação, participantes, prontidão, conclusão e histórico. O Compose E2E usa portas, banco e volumes isolados; ambos os repositórios executam o cenário como verificação obrigatória combinando o código em validação com a `main` do projeto irmão. Em falhas, CI publica relatório, screenshot, vídeo e trace.

### 3. OpenAPI como fonte única — P0 ✅

Gerar tipos e cliente TypeScript a partir do contrato, validar o YAML na CI e adicionar testes de contrato para respostas importantes.

- **Valor:** evita divergência silenciosa entre API, tipos manuais e interface.
- **Complexidade:** baixa/média.
- **Dependências:** escolha do gerador e política de versionamento.
- **Impacto:** documentação, API e frontend.
- **Tipo:** técnico e arquitetural.

**Concluído:** `docs/openapi.yaml` é validado na CI do backend e serve de origem para o snapshot versionado, os tipos e o cliente tipado do frontend. A CI do frontend verifica a geração e compara o snapshot com a `main` do backend; testes de contrato verificam respostas reais dos fluxos principais. O upload binário mantém tratamento específico. Isso não equivale a validar todas as respostas em runtime: os retornos `429` de autenticação, por exemplo, têm teste de comportamento, mas ainda não possuem schema de resposta no YAML. Corrija essa lacuna quando o fluxo de autenticação for revisado, sem ampliar a infraestrutura de contrato por cobertura artificial. Reavalie a comparação rígida entre repositórios se ela passar a bloquear mudanças documentais sem valor para o cliente.

### 4. Paginação e consultas previsíveis — P0

Aplicar `skip/limit` ou cursor diretamente no banco para grupos e remover limites invisíveis de fila, membros, votos e seletores. Adicionar paginação ou infinite scroll na interface e revisar índices com base nas consultas reais.

- **Valor:** impede dados inacessíveis e crescimento de memória/latência.
- **Complexidade:** média.
- **Dependências:** padrão único de paginação.
- **Impacto:** services, índices, API e React Query.
- **Tipo:** técnico e UX.

### 5. Observabilidade e saúde operacional — P0

Adicionar logs JSON com request ID, monitoramento de erros, endpoint de liveness e readiness com verificação do MongoDB. Configurar corretamente proxy e rate limits para o ambiente de produção e corrigir dependências vulneráveis apontadas pelo audit.

- **Valor:** reduz tempo de diagnóstico e torna falhas de produção observáveis.
- **Complexidade:** média.
- **Dependências:** plataforma de logs/erros e política de retenção.
- **Impacto:** middleware, deploy e suporte.
- **Tipo:** técnico e segurança.

### 6. Evolução incremental para DDD — P0

Definir os contextos Identidade, Grupos, Catálogo, Decisão/Fila e Sessões. Extrair políticas de autorização, transições e participantes para regras de domínio independentes do Mongoose. Introduzir repositories apenas para consultas ou transações complexas, sem reescrita total.

- **Valor:** evita que novos módulos ampliem o acoplamento dos services atuais.
- **Complexidade:** média/alta.
- **Dependências:** ADR com limites dos contextos e eventos relevantes.
- **Impacto:** services, models e testes.
- **Tipo:** arquitetural.

## Etapa 1 — Melhorar o produto atual

### 7. Convite por link e onboarding curto — P1

Criar `/invite/:code` e facilitar o compartilhamento do link. Quem ainda não estiver autenticado deve poder fazer login ou cadastro sem perder o convite; depois, entra no grupo e é levado diretamente à página dele. Se já for membro, abrir o grupo; se o convite for inválido ou a pessoa tiver sido removida, mostrar uma mensagem clara. Na página do grupo, oferecer apenas uma orientação opcional para conhecer a fila ou sugerir um jogo — sem tour ou checklist obrigatório. Avaliar validade e limite de usos somente se o uso real justificar; a regeneração do código atual já permite revogar convites compartilhados.

- **Valor:** reduz o maior atrito de aquisição e ativação.
- **Complexidade:** baixa/média.
- **Dependências:** rota pública segura e redirecionamento pós-login.
- **Impacto:** autenticação, grupos e frontend.
- **Tipo:** funcional e UX.

**Concluído:** `/invite/:code` preserva o convite no cadastro/login, exige confirmação para entrar e abre o grupo após sucesso. O ingresso de membro ativo é idempotente (`200`); convite inválido e membro removido recebem mensagens específicas. Administradores podem compartilhar o link pelo botão do grupo. A orientação curta já é dada pelo estado vazio da fila; não há tour obrigatório, prazo ou limite de usos.

### 8. Fechamento real de votação — P1

Criar uma rodada de votação com prazo opcional, encerramento explícito, resultado, empate e responsável pela decisão. Começar com voto de aprovação e desempate pelo admin; votação ranqueada só deve ser considerada após demanda real.

- **Valor:** torna os votos uma decisão verificável, não apenas um indicador informal.
- **Complexidade:** média.
- **Dependências:** definir a relação entre rodada, itens e futura sessão.
- **Impacto:** fila, votos, histórico e interface.
- **Tipo:** funcional e regra de negócio.

### 9. Participação mais autônoma — P1

Permitir autoinscrição quando habilitada, saída voluntária antes da partida, capacidade, mínimo de jogadores e lista de espera. Toda alteração deve recalcular prontidão atomicamente.

- **Valor:** reduz trabalho administrativo e representa melhor a disponibilidade real.
- **Complexidade:** média.
- **Dependências:** política configurável do grupo ou da sessão.
- **Impacto:** participantes, prontidão e notificações.
- **Tipo:** funcional.

### 10. Navegação e sincronização mais claras — P1

Persistir aba, filtros e paginação na URL, mostrar quando os dados foram atualizados e reduzir polling conforme aba e visibilidade. Manter atualização manual e dados anteriores quando houver falha.

- **Valor:** melhora navegação, compartilhamento e confiança em dados colaborativos.
- **Complexidade:** baixa/média.
- **Dependências:** convenção de parâmetros de busca no router.
- **Impacto:** rotas, componentes e React Query.
- **Tipo:** UX e performance.

### 11. Contas e sessões seguras — P0

Implementar recuperação de senha, verificação de e-mail e sessões revogáveis com access token curto e refresh token rotativo em cookie `HttpOnly`. Adicionar logout de todos os dispositivos, desativação e exportação da conta.

- **Valor:** evita perda definitiva de acesso e reduz impacto de roubo de token.
- **Complexidade:** alta.
- **Dependências:** provedor de e-mail, modelo de sessões e política de retenção.
- **Impacto:** autenticação, perfil, frontend e banco.
- **Tipo:** segurança e funcional.

## Etapa 2 — Completar a organização da partida

### 12. Criar `GameSession` — P1

Manter `QueueItem` como sugestão ou backlog e criar uma entidade para a partida escolhida, com jogo, origem da decisão, criador, horário, fuso, capacidade, participantes, início/fim real e estados `DRAFT`, `SCHEDULED`, `READY`, `PLAYING`, `COMPLETED` e `CANCELLED`.

- **Valor:** remove a sobrecarga conceitual da fila e desbloqueia agenda e histórico confiável.
- **Complexidade:** alta.
- **Dependências:** migração dos itens atuais sem perda de histórico.
- **Impacto:** fila, histórico, API, banco e frontend.
- **Tipo:** funcional e arquitetural.

### 13. Disponibilidade, agenda e RSVP — P1

Permitir propor horários e responder “posso”, “talvez” ou “não posso”, sempre exibindo no fuso local. Após escolher um horário, publicar a sessão e coletar confirmação de presença.

- **Valor:** resolve a principal lacuna atual: decidir quando jogar sem voltar ao chat externo.
- **Complexidade:** alta.
- **Dependências:** `GameSession`, fuso horário e preferências do grupo.
- **Impacto:** novo módulo, perfil, grupos e frontend.
- **Tipo:** funcional.

### 14. Calendário e recorrência gradual — P1/P2

Exportar `.ics` e oferecer links para calendários usando identificador estável. Só depois validar sessões recorrentes, permitindo editar uma ocorrência sem alterar toda a série.

- **Valor:** conecta a decisão do grupo à rotina real dos participantes.
- **Complexidade:** média para exportação; alta para recorrência.
- **Dependências:** sessões agendadas estáveis.
- **Impacto:** sessões e integrações.
- **Tipo:** funcional e integração.

### 15. Histórico e auditoria enriquecidos — P1

Registrar `startedAt`, `endedAt`, duração, motivo de cancelamento, participantes finais e opção “jogar novamente”. Criar trilha para entrada/remoção de membro, mudança de papel, convite renovado, votação encerrada e sessão cancelada.

- **Valor:** aumenta confiança administrativa e transforma o histórico em memória útil do grupo.
- **Complexidade:** média.
- **Dependências:** eventos de domínio e política de visibilidade.
- **Impacto:** grupos, sessões, histórico e suporte.
- **Tipo:** funcional, segurança e auditoria.

## Etapa 3 — Catálogo, mídia e personalização

### 16. Corrigir governança do catálogo — P1

Rever autoria e edição de jogos globais, reativação de registros inativos e títulos com edições diferentes. Um item reativado não deve preservar dados obsoletos nem ficar sem responsável capaz de corrigi-lo.

- **Valor:** evita dados globais inconsistentes e conflitos entre usuários.
- **Complexidade:** média.
- **Dependências:** política de curadoria e modelo canônico.
- **Impacto:** catálogo, fila e histórico.
- **Tipo:** regra de negócio e arquitetural.

### 17. Catálogo externo e compatibilidade — P1

Fazer prova de conceito com IGDB ou RAWG considerando licença, custo, qualidade e rate limit. Importar pelo backend com cache e deduplicação. Usar plataformas preferidas e, futuramente, biblioteca pessoal para destacar jogos compatíveis com o grupo.

- **Valor:** remove cadastro manual e torna as preferências já existentes realmente úteis.
- **Complexidade:** alta.
- **Dependências:** provedor escolhido e migração dos jogos atuais.
- **Impacto:** catálogo, perfil, busca e fila.
- **Tipo:** funcional e integração.

### 18. Privacidade e armazenamento de mídia — P1

Não expor e-mail de membros para todos por padrão. Validar dimensões e conteúdo de imagens, adicionar cache HTTP e mover novos avatares, capas e imagens de grupo para object storage com miniaturas.

- **Valor:** melhora privacidade, desempenho e custo de servir mídia.
- **Complexidade:** média.
- **Dependências:** política de privacidade e provedor de armazenamento.
- **Impacto:** perfil, grupos, catálogo e frontend.
- **Tipo:** segurança e técnico.

## Etapa 4 — Retenção e integrações

### 19. Notificações úteis — P1

Criar central interna com preferências e deep links. Notificar apenas eventos acionáveis: votação terminando, horário escolhido, RSVP pendente, mudança de sessão e prontidão. E-mail e Web Push devem ser opt-in e processados por jobs idempotentes.

- **Valor:** traz o usuário de volta no momento em que sua ação é necessária.
- **Complexidade:** alta.
- **Dependências:** sessões, eventos de domínio e fila de jobs.
- **Impacto:** backend, frontend e infraestrutura.
- **Tipo:** funcional e técnico.

### 20. Tempo real e Discord — P2

Substituir polling por SSE para eventos de grupo quando o volume justificar. Iniciar Discord por webhook para votação encerrada e sessão agendada; bot interativo só deve vir após adoção comprovada.

- **Valor:** melhora colaboração e encontra os grupos no canal que já utilizam.
- **Complexidade:** média/alta.
- **Dependências:** eventos versionados, sessões e notificações.
- **Impacto:** API, cache do frontend e integrações.
- **Tipo:** integração e técnico.

### 21. Métricas e recomendações explicáveis — P2

Medir cadastro, entrada no primeiro grupo, primeira sugestão, votação encerrada, sessão agendada e sessão concluída. Recomendar jogos somente quando houver dados suficientes, explicando motivos como plataforma em comum e capacidade adequada.

- **Valor:** orienta o roadmap por uso real e melhora descoberta sem decisões opacas.
- **Complexidade:** média/alta.
- **Dependências:** telemetria com privacidade, catálogo e sessões.
- **Impacto:** produto, analytics, perfil e catálogo.
- **Tipo:** produto e funcional.

## Próximos cinco passos imediatos

1. **Corrigir paginação em memória e limites invisíveis** nas listas atuais.
2. **Adicionar logs estruturados, request ID e readiness do MongoDB** para melhorar diagnóstico operacional.
3. **Definir contextos e políticas de domínio em um ADR**, orientando a evolução incremental para DDD.
4. **Especificar fechamento de votação e `GameSession` em ADRs**, antes de implementar agenda ou notificações.
5. **Simplificar convites por link e onboarding**, após estabilizar as listas e permissões envolvidas.

## Itens que não devem ser prioridade agora

- chat completo, pois compete com Discord e WhatsApp sem melhorar o núcleo da decisão;
- feed público ou rede social, que exigiriam moderação e privacidade muito mais maduras;
- gamificação por votos, presença ou prontidão, que pode incentivar comportamento artificial;
- IA generativa como destaque, antes de existirem dados de compatibilidade e uso suficientes;
- microsserviços, filas e caches distribuídos sem gargalo observado;
- aplicativos nativos separados antes de validar uma PWA responsiva.

## Marcos de evolução

1. **Base confiável:** CI, E2E, contrato automatizado, paginação e observabilidade.
2. **Decisão clara:** convite simples, votação encerrável e participação autônoma.
3. **Partida organizada:** `GameSession`, agenda, RSVP e calendário.
4. **Produto recorrente:** histórico enriquecido, notificações e catálogo confiável.
5. **Expansão validada:** Discord, tempo real, recomendações e escala conforme métricas.
