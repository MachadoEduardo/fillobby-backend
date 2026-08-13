# Roadmap de evolução do Fillobby

## Objetivo do produto

O Fillobby deve ser o ponto de encontro anterior à partida: o lugar em que um
grupo decide **o que jogar, quando jogar, com quem jogar e se todos estão
prontos**. O produto já cobre bem a primeira versão desse ciclo com grupos,
catálogo manual, sugestões, votos, participantes, prontidão e histórico.

As próximas entregas abaixo foram ordenadas para primeiro remover atritos e
riscos do produto atual, depois completar o ciclo de organização de uma sessão
e, por último, adicionar integrações, descoberta e recursos de escala.

### Como usar este arquivo

- A numeração é a ordem recomendada de execução; itens posteriores podem
  depender dos anteriores.
- **P0** é fundamento ou correção de atrito importante, **P1** é alto impacto no
  uso recorrente e **P2** amplia retenção ou conveniência. A etiqueta indica o
  valor dentro do seu contexto; a ordem numérica continua sendo o guia de
  execução.
- Cada item deve incluir frontend, backend, contrato OpenAPI, testes e estados
  de carregamento/erro/vazio quando essas camadas forem afetadas.
- Segurança, privacidade, acessibilidade, responsividade e observabilidade são
  critérios de aceite de todas as entregas, mesmo quando também aparecem em
  itens próprios de aprofundamento.
- Antes de iniciar uma fase grande, validar a hipótese com usuários reais e
  medir adoção. Não é necessário implementar todos os itens de uma fase em um
  único lançamento.

## Fase 1 — Fechar lacunas essenciais de conta e confiança

### 1. Mostrar e ocultar senha nos formulários — P0

Adicionar um controle acessível nos campos de senha de login, cadastro e troca
de senha. É uma melhoria pequena, reduz erros de digitação e ajuda bastante em
dispositivos móveis.

### 2. Confirmar senha no cadastro — P0

Adicionar `confirmPassword` ao cadastro, validar a igualdade no cliente e no
servidor e manter a regra de força da senha visível durante o preenchimento.
Evita que uma conta seja criada com uma senha digitada incorretamente.

### 3. Recuperação de senha por e-mail — P0

Criar os fluxos “Esqueci minha senha” e “Definir nova senha”, com token de uso
único, curta duração, hash do token no banco, rate limit e invalidação após o
uso. O envio deve acontecer por um provedor de e-mail e nunca revelar se um
endereço está cadastrado.

### 4. Verificação e alteração segura de e-mail — P0

Verificar o e-mail no cadastro e permitir sua alteração mediante senha atual e
confirmação no novo endereço. Contas não verificadas podem receber um período
de tolerância, mas ações sensíveis e convites devem exigir verificação.

### 5. Sessões seguras e encerramento remoto — P0

Substituir o JWT único no `localStorage` por sessão com access token curto e
refresh token rotativo em cookie `HttpOnly`, com proteção contra reutilização.
Adicionar “Dispositivos conectados”, “Sair deste dispositivo” e “Sair de todos”.
Essa base também facilita login social e conexão com plataformas no futuro.

### 6. Controles da conta e privacidade — P0

Permitir desativar/excluir a própria conta, exportar os dados pessoais e
explicar o destino de votos, histórico e grupos pertencentes ao usuário. A
exclusão deve exigir reautenticação e tratar transferência de propriedade antes
de remover ou anonimizar dados.

### 7. Proteção operacional e qualidade contínua — P0

Criar CI para executar testes, typecheck, lint, build e validação do OpenAPI em
cada alteração. Acrescentar logs estruturados com identificador de requisição,
monitoramento de erros, telemetria mínima do funil do produto, health/readiness
checks, limites de payload e rate limits por operação sensível. Isso reduz
regressões e permite validar as fases seguintes com dados.

## Fase 2 — Tornar entrada e administração de grupos mais simples

### 8. Convite por link com entrada direta — P0

Além de copiar o código, gerar uma URL como `/invite/:code`, com prévia segura
do nome e da imagem do grupo e redirecionamento de volta após login/cadastro.
Adicionar compartilhamento nativo no celular e manter a opção de revogar o
convite. É uma das melhorias com maior potencial de aquisição orgânica.

### 9. Convites administráveis — P1

Evoluir o código único para convites identificáveis, com criador, validade,
limite de usos e opção de revogação. Exibir os convites ativos e o número de
entradas geradas por cada um sem expor informações privadas para não membros.

### 10. Onboarding orientado à primeira partida — P1

Após o cadastro, conduzir o usuário por um checklist curto: criar ou entrar em
um grupo, escolher plataformas, sugerir um jogo e convidar amigos. Mostrar
progresso apenas até o primeiro ciclo útil para não transformar a interface em
um tutorial permanente.

### 11. Imagem, banner e identidade do grupo — P1

Permitir ao `OWNER`/`ADMIN` anexar avatar e banner, escolher cor de destaque e
remover ou recortar as imagens. Usar armazenamento de objetos com URLs
assinadas/CDN, validação real do tipo do arquivo, limites de dimensão/tamanho e
miniaturas; não armazenar novos binários grandes no MongoDB.

### 12. Preferências e regras do grupo — P1

Adicionar fuso horário, plataformas usadas, idioma, limite padrão de
participantes e regras de entrada (livre por convite ou aprovação de admin).
Essas configurações serão a base de agenda, catálogo e notificações.

### 13. Melhorias na lista de grupos — P1

Incluir busca, ordenação por atividade recente, contagem de membros, indicador
de ações pendentes e opção de fixar/arquivar grupos. O card deve mostrar algo
útil para retornar, como “votação aberta” ou “2 participantes aguardando”.

### 14. Solicitação e aprovação de entrada — P2

Para grupos que optarem por aprovação, criar uma caixa de solicitações com
aceitar, recusar e bloquear novo pedido. Mantém links fáceis de compartilhar
sem abrir mão do controle do grupo.

## Fase 3 — Substituir o catálogo manual por dados confiáveis

### 15. Definir a fonte externa e o modelo canônico de jogos — P0

Fazer uma prova de conceito com provedores como IGDB ou RAWG e decidir com base
em licença, qualidade das capas, plataformas, rate limit, estabilidade e custo.
O modelo local deve guardar o ID externo, origem, slug, gêneros, imagens,
lançamento, modos de jogo, suporte online/local, cross-play quando disponível e
data da última sincronização.

### 16. Busca e importação do catálogo externo — P1

Fazer a busca pelo backend, com cache, deduplicação e proteção das credenciais.
Ao sugerir um jogo, importar ou atualizar o registro local de forma idempotente.
A experiência principal deixa de exigir título, capa, descrição e quantidade de
jogadores preenchidos manualmente.

### 17. Migração e curadoria do catálogo existente — P1

Vincular os jogos manuais aos IDs externos, revisar possíveis duplicatas e
preservar todas as referências da fila e do histórico. Depois da migração,
restringir criação/edição manual a administradores do sistema ou a um fluxo de
“jogo não encontrado”, com aprovação e trilha de origem.

### 18. Capas por anexo e processamento de mídia — P1

Como fallback para jogos sem imagem, permitir anexo em vez de apenas URL.
Reaproveitar o pipeline de mídia da identidade dos grupos para validar,
redimensionar e gerar formatos otimizados. URLs remotas devem ser importadas e
servidas de forma controlada para evitar conteúdo quebrado ou malicioso.

### 19. Catálogo mais útil para o grupo — P1

Adicionar filtros por gênero, modo online/local, número de jogadores,
plataforma e cross-play, além de páginas de detalhe e links oficiais/lojas. Na
hora de sugerir, destacar jogos compatíveis com as plataformas preferidas dos
membros do grupo.

### 20. Biblioteca pessoal e disponibilidade por plataforma — P2

Permitir marcar “Tenho”, “Quero jogar” e a plataforma em que cada usuário possui
o jogo. A fila pode então mostrar quantas pessoas já têm acesso ao título e
evitar escolher um jogo indisponível para parte do grupo.

## Fase 4 — Completar a organização da sessão de jogo

### 21. Criar a entidade `GameSession` — P0

Separar “item candidato na fila” de “sessão que realmente vai acontecer”. Uma
sessão deve pertencer ao grupo e registrar jogo escolhido, criador, início,
duração estimada, participantes, fuso horário e estados `DRAFT`, `SCHEDULED`,
`READY`, `PLAYING`, `COMPLETED` e `CANCELLED`. Migrar o histórico atual sem
perder dados.

### 22. Enquete de data e disponibilidade — P1

Permitir que membros proponham horários e respondam “posso”, “talvez” ou “não
posso”. Exibir todos os horários no fuso local de cada pessoa e destacar a opção
com maior interseção de participantes. Esse recurso resolve a maior lacuna do
ciclo atual: decidir quando jogar.

### 23. Agendamento e RSVP — P1

Após escolher data e jogo, publicar a sessão e coletar confirmação de presença.
Administradores podem definir capacidade; excedentes entram em lista de espera
e são promovidos automaticamente quando surgir uma vaga.

### 24. Ligar votação, fila e sessão — P1

Permitir abrir uma votação para uma sessão específica e transformar o vencedor
em jogo agendado, preservando votos e participantes. A fila geral continua útil
como backlog de ideias, mas cada decisão passa a ter contexto e prazo claros.

### 25. Ciclo da sessão e registro da partida — P1

Adaptar prontidão, início e conclusão para a sessão agendada. Registrar início e
fim reais, participantes finais, quem faltou e motivo de cancelamento, sem
permitir que a edição posterior corrompa o histórico.

### 26. Calendário e exportação — P1

Criar visualização de próximas sessões e exportação `.ics`, além de links para
Google Calendar, Outlook e Apple Calendar. Convites e atualizações devem manter
um identificador estável para não duplicar eventos.

### 27. Sessões recorrentes — P2

Permitir padrões como “toda sexta às 21h”, criando ocorrências editáveis
individualmente. É especialmente útil para grupos fixos, mas deve vir depois do
agendamento simples estar validado.

## Fase 5 — Melhorar decisão, fila e pós-partida

### 28. Prazo e regras configuráveis de votação — P1

Adicionar horário de encerramento, quantidade máxima de votos por pessoa e
opção de resultado visível ou oculto até o fim. Começar com voto de aprovação,
que já existe, e só depois avaliar votação ranqueada para evitar complexidade
prematura.

### 29. Encerramento automático e desempate explícito — P1

Ao vencer o prazo, fechar a votação por job idempotente e aplicar uma regra
definida pelo grupo: decisão do admin, sorteio transparente entre empatados ou
nova rodada. Registrar a regra e o resultado para que ninguém precise resolver
o empate fora do Fillobby.

### 30. Priorização e organização da fila — P1

Permitir ao admin fixar, reordenar, adiar ou reabrir sugestões, mantendo um log
das alterações. Adicionar visualizações por etapa e paginação/infinite scroll;
hoje a tela busca um lote fixo de itens e depende apenas da ordenação por votos.

### 31. Participantes mais flexíveis — P1

Incluir autoinscrição quando habilitada, lista de espera, número mínimo de
jogadores, saída voluntária e substituição antes do início. Mudanças de
participantes precisam recalcular prontidão e respeitar a capacidade do jogo ou
da sessão.

### 32. Prontidão com prazo e contexto — P1

Exibir quanto falta para a sessão, definir limite para confirmar e avisar quem
ainda não respondeu. Ao expirar, o grupo pode promover alguém da espera ou
manter a vaga, conforme sua configuração.

### 33. Pós-partida e histórico enriquecido — P2

Depois da conclusão, permitir avaliação rápida, nota privada do grupo,
“jogar novamente” e registro opcional de resultado/duração. O histórico ganha
busca textual, filtros por período/status e uma página de detalhe, sem virar um
sistema complexo de placares antes de existir demanda.

### 34. Atividade e auditoria do grupo — P2

Criar uma linha do tempo para eventos relevantes: entrada/remoção de membro,
mudança de papel, votação aberta, jogo escolhido, sessão marcada e cancelada.
Ações administrativas devem indicar autor e horário; eventos sensíveis ficam
visíveis apenas para admins.

## Fase 6 — Atualizações em tempo real e notificações úteis

### 35. Sincronização em tempo real — P1

Substituir o polling de 10 segundos por SSE ou WebSocket autenticado para votos,
participantes, prontidão, sessões e membros. Eventos devem ser pequenos,
versionados e apenas invalidar/atualizar o cache necessário; manter reconexão e
fallback para atualização manual.

### 36. Central de notificações e preferências — P1

Criar notificações internas lidas/não lidas com deep link e preferências por
evento e canal. Priorizar apenas eventos acionáveis: convite/entrada, votação
terminando, sessão confirmada/alterada, pedido de RSVP e prontidão pendente.
Agrupar eventos repetidos para não gerar ruído.

### 37. Notificações por navegador e e-mail — P1

Adicionar Web Push/PWA e e-mail para lembretes importantes, sempre com opt-in,
silêncio por horário e cancelamento fácil. Envio, retry e expiração devem rodar
em uma fila de jobs, fora do ciclo da requisição HTTP.

### 38. Integração gradual com Discord — P1

Começar por webhook configurável por grupo para publicar votação, vencedor e
sessão agendada. Depois criar bot com comandos e botões para votar/confirmar e,
somente com demanda comprovada, sincronizar cargos ou membros. Guardar tokens
criptografados, limitar permissões e permitir desconectar a integração.

### 39. Login social, vinculação de contas e passkeys — P2

Oferecer Discord e Google como métodos de entrada, além de passkeys/WebAuthn.
Implementar vinculação e desvinculação dentro de uma conta autenticada e tratar
com segurança e-mails coincidentes para não criar contas duplicadas nem permitir
sequestro de conta. O login social não deve ser requisito para usar integrações.

## Fase 7 — Perfil, compatibilidade e descoberta

### 40. Perfil mais expressivo e controlado — P2

Adicionar nome de usuário único, bio curta, fuso horário, idiomas, gêneros
favoritos, horários habituais e visibilidade por campo. Criar perfil de membro
acessível dentro do grupo, sem expor e-mail ou dados privados.

### 41. Contas e identidades de jogos — P2

Permitir informar Steam, Xbox, PlayStation, Nintendo e Riot/Epic quando fizer
sentido. Começar por links/nomes informados manualmente; usar OAuth e importação
de biblioteca apenas onde a API e seus termos permitirem. Cada identificador
deve ter controle de visibilidade.

### 42. Estatísticas pessoais e do grupo — P2

Mostrar métricas compreensíveis, como jogos mais escolhidos, participação,
presença, horas estimadas e frequência por plataforma/período. Não transformar
prontidão ou ausência em ranking competitivo; as estatísticas devem ajudar o
grupo, não constranger membros.

### 43. Recomendações explicáveis — P2

Recomendar jogos a partir das plataformas em comum, bibliotecas, tamanho do
grupo, histórico e interesses declarados. Sempre explicar o motivo (“todos têm
no PC” ou “funciona com 6 jogadores”) e permitir dispensar sugestões. Começar
com regras simples antes de considerar modelos de recomendação.

## Fase 8 — Experiência móvel, crescimento e escala

### 44. PWA instalável e tolerância a conexão ruim — P2

Criar manifesto, ícones, instalação guiada e cache seguro da estrutura da
aplicação. Permitir consultar próximos eventos e últimos dados offline, mas
exigir conexão para votos e ações que precisam de consistência.

### 45. Acessibilidade e preferências de interface — P1

Auditar navegação por teclado, foco, contraste, leitores de tela, redução de
movimento, mensagens de erro e áreas de toque. Preservar tema e preferências por
conta, não apenas no dispositivo, e testar os fluxos críticos em telas pequenas.

### 46. Busca global e atalhos — P2

Adicionar uma busca/command palette para abrir rapidamente grupo, jogo ou
sessão e executar ações frequentes. Só indexar recursos que o usuário pode
acessar e manter o estado dos filtros na URL para permitir compartilhamento e
navegação previsível.

### 47. Moderação e segurança comunitária — P2

Adicionar bloqueio de usuário, denúncia de imagem/nome, remoção de mídia,
histórico de moderação e proteção contra spam em convites e uploads. Preparar
termos de uso, política de privacidade, canal de suporte e processo de resposta
antes de abrir descoberta pública.

### 48. Infraestrutura para crescer — P1

Consolidar a fila de jobs, armazenamento de objetos e cache introduzidos nas
fases anteriores e evoluir índices com base em medições. Adicionar backups
testados, retenção de logs, migrações versionadas, paginação por cursor nos feeds
movimentados, ambiente de staging e alertas de latência/erro. Não adotar serviços
distribuídos sem uma necessidade observada.

### 49. Amadurecer o painel de saúde do produto — P2

Evoluir a telemetria inicial sem coletar conteúdo desnecessário: cadastro,
entrada no primeiro grupo, primeira sugestão, votação concluída, sessão agendada
e sessão concluída. Usar coortes de retenção, segmentação por fase do funil e
feedback curto após ações-chave para decidir a ordem real das próximas versões.

## Itens que não devem ser prioridade agora

- **Chat completo:** concorre com Discord/WhatsApp, aumenta muito o custo de
  moderação e não melhora diretamente a decisão. Comentários curtos ligados a
  uma sessão só devem ser avaliados depois das notificações e do Discord.
- **Feed público ou rede social:** grupos privados são o valor central atual.
  Descoberta pública exige privacidade e moderação maduras.
- **Gamificação competitiva:** pontos por voto, presença ou prontidão podem
  incentivar comportamento artificial e gerar atrito entre amigos.
- **IA generativa como destaque:** recomendações explicáveis baseadas em dados
  do grupo entregam valor antes de chatbots ou resumos automáticos.
- **Aplicativos nativos separados:** uma PWA responsiva cobre primeiro a maior
  parte do ganho móvel com menos custo de manutenção.

## Marcos sugeridos

1. **Produto confiável:** itens 1–7 concluídos.
2. **Grupo fácil de formar:** itens 8–14 concluídos.
3. **Catálogo sem trabalho manual:** itens 15–20 concluídos.
4. **Noite de jogo organizada de ponta a ponta:** itens 21–34 concluídos.
5. **Retorno recorrente:** itens 35–43 concluídos.
6. **Escala sustentável:** itens 44–49 concluídos conforme uso e métricas.
