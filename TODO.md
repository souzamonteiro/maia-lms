# TODO — Maia Learn como plataforma completa de cursos em vídeo

Auditoria: 27/09/2026. Este é o backlog de implementação do produto completo,
solicitado após a publicação do protótipo. A entrega anterior é uma base para
cursos em texto; não atende ainda ao objetivo de cursos em vídeo.

## Primeira implementação — 27/09/2026

Entregue no checkout local, ainda sem implantação: separação de revisão pública e
rascunho, editor Markdown com prévia sanitizada, recuperação local, autosave de
cursos existentes, conflitos entre abas, duplicação/ordenação por botões e seleção
editorial da home. Novos componentes disponíveis em inglês, português e espanhol.
Guia: [autoria e página inicial](docs/12-authoring.md).

- Concluídos: BASE-01, EDIT-01 e HOME-01 (seções fixas hero, destaques e recomendações).
- BASE-02 parcial: migração 004 preserva texto, matrículas e progresso em fixture;
  restauração do banco real, mídia e traduções ainda pendentes.
- EDIT-02 parcial: parser e sanitização compartilhados/testados; versionamento
  persistido da política de renderização ainda pendente.
- EDIT-03/04 parciais: editor modular, ordenação por botões e recuperação implementados;
  telas por aula, arraste e salvamento incremental por unidade ainda pendentes.
- I18N-01 parcial: troca de idioma preserva o editor; e-mails/API legados pendentes.
- Validação local: build, 38 testes automatizados e 3 testes no Chrome.

E1 ainda tem os complementos acima. Upload, processamento, legendas e player de
vídeo continuam em E2; a plataforma completa não está concluída.

## Primeira implementação de vídeo — 28/09/2026

Fluxo MP4 entregue no checkout local: armazenamento privado, envio em blocos com
retomada/verificação, associação à aula, fila separada, FFprobe/FFmpeg, capa,
validação de publicação, player com Range/HEAD e retomada de posição. Instalação
atualizada para FFmpeg e limites do worker. Validação: build/lint, 41 testes
automatizados, quatro fluxos no Chrome e três testes de implantação. Não implantado.
[Guia de vídeo](docs/13-video.md).

MEDIA-01/02/03/04, JOB-01, PLAY-01/02/04, EDIT-05 e OPS-01 avançaram, mas ficam
abertos: falta concluir HLS, legendas, biblioteca completa, limpeza automática de
órfãos/expiração, progresso de transcode, navegação do aluno e homologação no Maia
Edge/dispositivos. E2 e a plataforma completa permanecem em andamento.

## Evidências e limites da revisão original

Revisados API, interface, internacionalização, esquema SQLite, worker, adaptadores,
testes, instalação e documentos 01–11. A página pública de
`https://learn.maiaplatform.org/` respondeu à consulta HTTP e contém o seletor de
idiomas e o script modular. Não foram acessados painel autenticado, credenciais,
dados privados nem configuração remota da VPS. Os detalhes internos abaixo são
observações do checkout local, que pode diferir da release publicada. Não houve
alteração funcional nem implantação nesta auditoria; os testes anteriores não
comprovam as funcionalidades pendentes.

Estado na auditoria, antes da primeira implementação acima:

| Área | O que existe | O que falta / evidência |
|---|---|---|
| Identidade | Cadastro, login, sessão SQLite, recuperação/verificação, bootstrap admin | Administração de usuários, reenvio de verificação, perfil, MFA; criação de admin ainda precisa de teste real de instalação |
| Idiomas | `en`, `pt-BR`, `es`, seletor, detecção e persistência local | Erros da API/e-mails, preferência de conta, formatos, testes e proteção do formulário ao trocar idioma; [i18n.js](apps/web/public/i18n.js) |
| Autoria | Formulário de título, resumo, módulos e aulas | Só `textarea` de texto; não há mídia, Markdown, capa, reordenação assistida ou autosave; [app.js](apps/web/public/app.js) |
| Conteúdo | `body` exibido com escape de HTML | Sem renderização Markdown; `lessonSchema` exige texto e não recebe `kind`/`mediaId`; [courses.ts](apps/api/src/routes/courses.ts) |
| Publicação | Criar revisão, publicar, arquivar, matrícula presa à revisão | Edição muda curso para DRAFT e substitui `current_revision_id`, retirando a versão publicada do catálogo |
| Vídeos | Colunas `media_id`, `kind` e tabela `assets` | Sem upload, inspeção, transcodificação, legendas, player ou entrega autorizada |
| Worker | Outbox persistente, leases e retentativas de e-mail | Rejeita eventos diferentes de `email.send`; [jobs.ts](apps/worker/src/jobs.ts) |
| Armazenamento | Adaptador local ainda desconectado das rotas | Leitura inteira em Buffer; resolução de caminho sem garantia de confinamento na raiz; [local.ts](packages/providers/src/storage/local.ts) |
| Página inicial | Hero fixo e mesma listagem usada em `/courses` | Sem seleção editorial, ordem ou seções; tabela `promotions` não tem API/interface |
| Aprendizado | Matrícula gratuita, conclusão manual, contagem no painel | Sem retomada de vídeo, navegação entre aulas, política de conclusão ou avaliações |
| Comércio | Tabelas e adaptadores fake/Mercado Pago | API aceita só OPEN_FREE/ENROLLED_FREE; sem pedidos/checkout/webhooks/reconciliação operacional |
| Certificados | Tabela e requisitos escritos | Sem elegibilidade, emissão, PDF, QR, verificação ou revogação |
| Operação | systemd, SQLite, backup, Nginx e instaladores | Vídeos grandes, processamento, backup de mídia, monitoramento e atualização do protótipo precisam de validação própria |

## Prioridades e regra de conclusão

- **P0:** tornar viável publicar e consumir um curso real em vídeo, com editor e home curada.
- **P1:** completar gestão, avaliação, comércio, certificados e operação do produto especificado. Faz parte da entrega completa, não fica descartado por ser posterior a P0.
- **P2:** extensões previstas para depois do produto principal, explicitamente separadas ao final.

Cada checkbox representa trabalho pendente. Só concluir quando UI + API + banco
+ permissões + falhas + testes pertinentes + documentação estiverem entregues.
Tabela SQL, adaptador isolado, mock ou botão sem fluxo real não satisfazem a tarefa.
Preservar as alterações locais de internacionalização e os dados do protótipo.

## P0 — base de edição e publicação

- [x] **BASE-01 — Separar rascunho e versão publicada.**
  Introduzir referências distintas para revisão de trabalho e revisão pública;
  atualizar catálogo, detalhes, autorizações e matrícula para escolher a revisão
  correta. Dependências: nenhuma. Aceite: salvar um rascunho não retira o curso do
  ar; visitante vê a publicação anterior, autor vê o rascunho e aluno antigo mantém
  sua revisão. Publicação troca a referência pública em uma transação.
- [ ] **BASE-02 — Migrar os dados existentes sem reinterpretar texto.**
  Novas migrações aditivas para revisões, formato de conteúdo, relações de mídia,
  traduções/metadados e slots editoriais conforme os fluxos abaixo. Dependência:
  BASE-01. Aceite: banco do protótipo restaurado em ambiente isolado conserva
  contas, matrículas, progresso e aulas; textos antigos continuam `plain`, sem
  executar marcação antes inofensiva. Não editar migrações já aplicadas.
- [x] **EDIT-01 — Editor Markdown com barra de ferramentas e prévia.**
  Títulos, negrito, itálico, listas, links, citações, blocos de código, tabelas e
  imagens com alt text; edição e prévia acessíveis. Dependências: BASE-01/02.
  Aceite: autor formata, salva, reabre e aluno recebe a mesma estrutura renderizada.
  Markdown é a primeira solução escolhida; editor visual pode ser adicionado sem
  exigir HTML livre para concluir esta entrega.
- [ ] **EDIT-02 — Renderização segura e versionada.**
  Definir `content_format`, parser e sanitização por allowlist no servidor; bloquear
  scripts, handlers, URLs perigosas, SVG/HTML arbitrário e embeds não aprovados.
  Dependência: EDIT-01. Aceite: prévia e aula usam a mesma política; casos de XSS
  falham; conteúdo legítimo e traduções permanecem legíveis. Instalar um parser
  sozinho não basta.
- [ ] **EDIT-03 — Estúdio por curso/módulo/aula.**
  Dividir o formulário único em telas/componentes, reordenar com teclado e arraste,
  duplicar/remover rascunhos com confirmação e pré-visualizar como aluno/visitante.
  Dependência: BASE-01. Aceite: montar curso com vários módulos sem editar JSON/SQL;
  exclusão não quebra revisões já matriculadas nem remove mídia ainda referenciada.
- [ ] **EDIT-04 — Autosave, conflitos e proteção de trabalho não salvo.**
  Salvar por unidade de edição, indicar estado/erro, recuperar rascunho e detectar
  edições concorrentes via versão/ETag. Dependência: EDIT-03. Aceite: queda de rede,
  duas abas, navegação e troca de idioma não apagam nem sobrescrevem silenciosamente
  o conteúdo. Hoje `languageSelect` chama `main()` e recria o formulário.
- [ ] **EDIT-05 — Tipos de aula e validação de publicação.**
  Suportar `video`, `article`, `mixed`, associação de mídia e anexos, duração,
  obrigatoriedade e prévia. Dependências: BASE-02, MEDIA-03, EDIT-02. Aceite: aula
  exclusivamente de vídeo não precisa de texto fictício; publicação lista campos
  faltantes e impede mídia não READY, ordem inválida e relações com outro curso/autor.

## P0 — mídia e vídeo de ponta a ponta

- [ ] **MEDIA-01 — Armazenamento privado e seguro.**
  Confinar caminhos à raiz inclusive contra `../`, caminhos absolutos e symlinks;
  chaves geradas pelo servidor, streaming, gravação temporária/rename e limpeza
  após falha. Dependência: nenhuma. Aceite: testes de confinamento e isolamento
  entre autores; transferência de arquivo grande sem Buffer integral na memória.
  O adaptador atual não deve ser exposto antes desta correção.
- [ ] **MEDIA-02 — Upload de vídeos, imagens e anexos.**
  Endpoints autorizados, streaming/chunks com retomada, progresso, cancelar/repetir,
  quotas e limpeza de uploads incompletos. Conferir tamanho e conteúdo real,
  armazenar originais em quarentena e definir inspeção/antimalware para anexos.
  Dependências: MEDIA-01, BASE-02. Aceite: upload interrompido retoma sem duplicar;
  arquivo inválido ou de outro autor é recusado; disco cheio tem mensagem recuperável.
- [ ] **MEDIA-03 — Processamento FFprobe/FFmpeg.**
  Validar container/streams, gerar MP4 de reprodução e HLS adaptativo compatíveis,
  poster, duração e metadados; limites de CPU/memória/tempo e subprocessos sem
  interpolação de shell. Dependências: MEDIA-02, JOB-01. Aceite: vídeo real chega a
  READY com saídas verificadas; arquivo corrompido fica FAILED com erro útil;
  publicação não aponta para arquivos incompletos. Não aumentar resolução artificialmente.
- [ ] **JOB-01 — Jobs longos e concorrência controlada.**
  Separar capacidade de mídia da fila de e-mail; renovar lease, progresso, heartbeat,
  cancelamento e recuperação após crash; idempotência das saídas e retentativa manual.
  Dependência: MEDIA-01. Aceite: transcode maior que cinco minutos não é reclamado
  por outro worker; queda/reinício não produz duas saídas concorrentes nem bloqueia SMTP.
- [ ] **MEDIA-04 — Biblioteca e ciclo de vida de mídia.**
  Listar por autor/curso, pesquisar, selecionar, substituir por nova versão, associar
  imagem/capa/poster/anexo e exibir fila/erro. Dependências: MEDIA-02/03, EDIT-03.
  Aceite: autor acompanha todo o processo sem terminal; coleta de órfãos considera
  revisões antigas e só remove arquivos elegíveis após período definido.
- [ ] **MEDIA-05 — Materiais complementares com descrição.**
  Permitir anexar múltiplos arquivos ao curso ou a uma aula, incluindo PDF, ZIP,
  código-fonte e outros formatos permitidos. Cada anexo deve ter título e descrição
  editáveis; mostrar nome do arquivo, formato e tamanho ao aluno. Oferecer upload,
  ordenação, substituição e remoção pelo editor, preservando arquivos referenciados
  por revisões anteriores. Dependências: MEDIA-01/02/04, BASE-01, EDIT-03.
  Aceite: autor adiciona um PDF, um ZIP e um arquivo de código-fonte com descrições;
  aluno autorizado vê os materiais no contexto do curso/aula e consegue baixá-los.
  Downloads respeitam matrícula, revisão, revogação e política de prévia; URLs
  diretas não contornam autorização. Aplicar limites e validação de tipos; servir
  como download, sem executar código nem extrair arquivos ZIP automaticamente.
- [ ] **PLAY-01 — Entrega autorizada de MP4 e HLS.**
  Endpoints de playback vinculados à aula/revisão/entitlement, HTTP Range/206/416,
  Content-Type correto, HEAD, expiração/renovação de sessão de reprodução; verificar
  também playlists secundárias, segmentos, chaves e anexos. Dependências: MEDIA-03,
  BASE-01. Aceite: acesso direto/URL copiada não contorna matrícula nem revogação;
  preview público só libera o ativo aprovado, nunca o diretório inteiro.
- [ ] **PLAY-02 — Player integrado e responsivo.**
  Player HTML5 com HLS nativo/fallback adequado, play/pause, seek, volume, velocidade,
  fullscreen, teclado, estados de carregamento/erro e qualidade. Dependência: PLAY-01.
  Aceite: reprodução e avanço funcionam em desktop, Android e Safari/iOS; renovação
  de acesso durante aula longa não interrompe indevidamente a reprodução.
- [ ] **PLAY-03 — Legendas e transcrição.**
  Upload/validação WebVTT, idioma e seleção de faixa, transcrição textual acessível,
  fluxo de substituição e indicação de disponibilidade. Dependências: MEDIA-04,
  PLAY-02. Aceite: autor publica legenda e aluno a ativa no player; as faixas de
  cursos privados obedecem à mesma autorização do vídeo.
- [ ] **PLAY-04 — Retomada e navegação do aluno.**
  Sumário persistente de módulos, anterior/próxima, última aula, posição salva com
  debounce, continuar assistindo e progresso de curso. Dependências: PLAY-02, BASE-01.
  Aceite: recarregar/trocar dispositivo retoma posição; chamadas ficam dentro dos
  limites da API; conclusão explícita segue política do curso, sem tomar segundos
  informados pelo navegador como prova de aprendizagem.
- [ ] **OPS-01 — Adaptar HTTP e instalação para vídeo.**
  Separar upload do middleware JSON-only atual; autenticação/CSRF específicos para
  multipart/chunks. Definir limites por rota e taxa para upload/player; revisar
  Nginx (hoje 1 MB), buffering, timeouts, Range, armazenamento temporário, FFmpeg e
  dependências nas instalações systemd/Docker. Dependências: MEDIA-02, PLAY-01.
  Aceite: upload representativo, seek e reprodução longa atravessam a VPS/WireGuard
  sem 413/415/429 indevidos, sem expor novos serviços públicos ou reiniciar a VPN.

## P0 — página inicial e apresentação de cursos

- [x] **HOME-01 — Seleção editorial de cursos.**
  Painel para escolher curso do hero, cursos em destaque e coleções, ordenar,
  agendar início/fim e remover da home sem despublicar. Usar/evoluir `promotions`;
  oferecer API pública própria, separada da busca geral. Dependência: BASE-01.
  Aceite: administrador escolhe explicitamente os cursos da página inicial e a ordem;
  rascunhos/arquivados nunca vazam; curso retirado do destaque continua no catálogo.
- [ ] **HOME-02 — Capas, cards e página de venda/apresentação.**
  Capa e alt text, trailer/prévia, autor/bio, objetivos, pré-requisitos, nível,
  idioma, carga horária, currículo e condições de acesso/certificado. Dependências:
  MEDIA-04, EDIT-03, HOME-01. Aceite: edição pelo painel aparece na página pública;
  cards possuem imagens e CTAs coerentes com matrícula/preço, sem estatísticas falsas.
- [ ] **HOME-03 — Catálogo, categorias e busca paginada.**
  Taxonomia gerenciável, filtros de acesso/idioma/nível, ordenação e paginação real
  em vez do limite fixo de 100. Dependências: HOME-02. Aceite: filtros combináveis,
  URL compartilhável, estado vazio útil e cursos além da primeira página acessíveis.

## P1 — identidade, gestão e internacionalização

- [ ] **I18N-01 — Completar internacionalização existente.**
  Preservar `en`, `pt-BR`, `es` e comportamento atual de detecção; traduzir todos os
  novos componentes, estados, validações, e-mails e mensagens da API por códigos
  estáveis; formatar datas/números/preços com locale. Dependência: transversal a cada
  entrega, não uma reescrita posterior. Aceite: mesmos fluxos testados nos três idiomas,
  chaves ausentes detectadas e mudança de idioma sem perda do formulário (EDIT-04).
- [ ] **I18N-02 — Separar idioma da interface e do curso.**
  Salvar preferência do usuário, permitir autor definir locale de conteúdo/legendas
  e metadados traduzidos com fallback explícito. Dependências: BASE-02, I18N-01.
  Aceite: escolher espanhol na interface não reclassifica curso em português nem
  promete tradução automática do vídeo; preferência persiste entre dispositivos.
- [ ] **ADMIN-01 — Gestão de usuários e autores.**
  Listagem/busca, papéis, suspensão/reativação, perfil público do instrutor e auditoria;
  bootstrap/redefinição administrativa com erros específicos, sem senhas padrão.
  Dependência: identidade existente. Aceite: administrador delega autoria pelo painel;
  autor não altera outro autor/conta; mudanças de acesso invalidam sessões necessárias.
- [ ] **AUTH-01 — Completar os fluxos de conta.**
  Perfil, troca de senha, reenvio/feedback de verificação, recuperação traduzida,
  estados de conta e política explícita para e-mail não verificado; MFA de admin
  com recuperação. Dependências: I18N-01, ADMIN-01. Aceite: cenários de token usado,
  expirado, SMTP indisponível e perda do segundo fator têm recuperação verificável.
- [ ] **ADMIN-02 — Matrículas, concessões e auditoria.**
  Painel para inscrições, progresso, concessão/revogação manual com motivo, histórico
  e tratamento de suporte. Dependência: BASE-01, ADMIN-01. Aceite: operação autorizada
  e auditada altera acesso sem apagar histórico; não exige editar SQL manualmente.
- [ ] **ADMIN-03 — Publicação, revisão e retirada urgente.**
  Fluxo DRAFT → REVIEW → PUBLISHED, checklist, agendamento opcional e notificações;
  distinguir arquivar (mantém acesso) de retirar acesso por motivo urgente.
  Dependências: EDIT-05, ADMIN-02. Aceite: regras de cada transição são testadas e
  retirada urgente não deixa o conteúdo acessível por URL/media grant antigo.

## P1 — avaliações e conclusão

- [ ] **QUIZ-01 — Construtor e versionamento de avaliações.**
  Questões de uma/múltiplas alternativas, pontuação, nota mínima, tentativas,
  avaliação por aula/final e prévia. Dependências: BASE-01, EDIT-03. Aceite: autor
  monta prova pelo painel; gabaritos não aparecem no payload do aluno; revisão
  nova não muda respostas/política de tentativas antigas.
- [ ] **QUIZ-02 — Tentativas e correção no servidor.**
  Início/submissão atômicos, limites, duplicação, prazos e feedback de resultado.
  Dependência: QUIZ-01. Aceite: respostas manipuladas, repetidas, concorrentes ou de
  outro curso não criam aprovação; uma submissão aceita torna-se imutável.
- [ ] **LEARN-01 — Política de conclusão consistente.**
  Snapshot de aulas obrigatórias/nota/tentativas por revisão, cálculo server-side e
  conclusão idempotente. Dependências: PLAY-04, QUIZ-02. Aceite: painel e certificado
  usam a mesma decisão; acesso revogado e prova reprovada não permitem emissão.

## P1 — venda e pagamentos

- [ ] **PAY-01 — Preço, pedido e checkout real.**
  Habilitar PAID no editor com preço/moeda/termos, snapshot de pedido, idempotência,
  checkout hospedado e telas pendente/cancelado/aprovado. Dependências: BASE-01,
  HOME-02, ADMIN-02. Aceite: preço enviado pelo navegador não é confiado; redirecionamento
  de retorno não concede acesso; pedidos e estado são visíveis ao comprador.
- [ ] **PAY-02 — Revisar contrato do adaptador e receber webhooks.**
  Conferir documentação oficial vigente antes de implementar; testar assinatura,
  origem dos identificadores, headers/query/body e deduplicação correta. Hoje
  `verifyWebhook` tenta extrair `data.id` do corpo como URLSearchParams e usa esse
  identificador como evento; não considerar integração homologada. Middleware de
  sessão/origin/JSON e captura de bytes devem respeitar o contrato específico do
  provedor sem exceção ampla nas demais rotas. Dependência: PAY-01. Aceite: fixtures
  oficiais/sandbox aceitas, adulteradas recusadas, transições distintas do mesmo
  pagamento processadas sem duplicar concessões.
- [ ] **PAY-03 — Confirmação, reconciliação e direitos de acesso.**
  Consultar estado autoritativo e conferir vendedor, referência, moeda e valor;
  gravar pedido/pagamento/matrícula/entitlement/outbox em transação curta SQLite;
  reconciliar eventos perdidos/atrasados. Dependência: PAY-02. Aceite: pagamento
  aprovado concede uma vez; notificação repetida/fora de ordem não gera acesso errado;
  pedido aprovado sem matrícula é detectado e recuperado.
- [ ] **PAY-04 — Reembolso, contestação e suporte comercial.**
  Reembolso total/parcial, chargeback, trilha de auditoria, revogação de acesso e
  política para certificado já emitido; painel de pedidos e comprovantes.
  Dependências: PAY-03, ADMIN-02. Aceite: retentativa não duplica reembolso; estado
  local reconcilia com provedor; regras de reembolso parcial são explícitas.
- [ ] **PAY-05 — Homologação e configuração comercial.**
  Separar sandbox/produção, revisar identidade do vendedor, moeda, condições de
  acesso/reembolso, suporte, recibos e exigências fiscais com responsável competente.
  Dependências: PAY-01–04. Aceite: fluxo de compra/reversão testado em sandbox e
  liberação real condicionada às credenciais/configuração do titular. Não substituir
  integração pendente por pagamento fake em produção.

## P1 — certificados

- [ ] **CERT-01 — Elegibilidade e emissão idempotente.**
  Conferir conclusão, entitlement, e-mail verificado, nome e consentimento de
  divulgação; snapshot da identidade/curso/carga horária/emitente. Dependências:
  LEARN-01, AUTH-01 e PAY-04 para cursos pagos. Aceite: requisições concorrentes
  geram uma emissão válida; alteração posterior de perfil/curso não reescreve o documento.
- [ ] **CERT-02 — PDF, QR e consulta pública.**
  Geração assíncrona, download autorizado, código opaco, verificação pública com
  dados mínimos e estado válido/revogado; tela de certificados do aluno.
  Dependências: CERT-01, JOB-01. Aceite: QR abre URL canônica, PDF mantém texto
  legível, worker pode repetir sem duplicar emissão, e busca não enumera identidades.
- [ ] **CERT-03 — Revogação e reemissão.**
  Painel e motivo privado, novo documento quando necessário, vínculo com anterior
  e preservação da consulta de códigos antigos. Dependências: CERT-02, ADMIN-02.
  Aceite: documento revogado continua verificável como revogado; só admin autorizado
  reemite e o histórico é auditável.

## P1 — confiabilidade, proteção e lançamento completo

- [ ] **DATA-01 — Reforçar invariantes do SQLite.**
  Validar referências cruzadas de revisões/mídia/curso e unicidade de quiz final,
  emissão ativa e identificação de pagamentos antes de ligar os fluxos. Hoje
  `UNIQUE(revision_id, lesson_id)` não impede múltiplos quizzes com lesson_id NULL;
  certificado não tem unicidade de emissão por política. Dependências: BASE-02 e
  desenho QUIZ/PAY/CERT. Aceite: migrações e testes de concorrência impedem estados
  inválidos sem depender exclusivamente de verificações prévias no código.
- [ ] **OPS-02 — Backup integrado e restauração de mídia.**
  Banco + manifestos/versões/arquivos referenciados + configuração, retenção,
  cópia externa e restauração ensaiada. Dependências: MEDIA-04. Aceite: restaurar
  curso publicado e revisão antiga permite assistir, retomar e validar certificado;
  backup SQLite isolado não conta como backup completo dos vídeos.
- [ ] **OPS-03 — Observabilidade e operação pelo painel.**
  Métricas de fila/transcode/playback/SMTP/pagamentos/disco, logs sem tokens/PII,
  alertas, inspeção e retentativa administrativa. Dependências: JOB-01, PAY-03.
  Aceite: operador identifica job travado e causa de erro sem examinar segredos;
  readiness da API não é usada como prova de que todos os workers estão saudáveis.
- [ ] **OPS-04 — Capacidade real no Maia Edge.**
  Definir público/bitrate/limite de upload e testar banda da hospedeira, VPN, VPS,
  disco e concorrência SQLite/FFmpeg. Dependências: PLAY-02, OPS-01. Aceite: registrar
  cenário, latência, taxa de erro, uso de recursos e limite suportado; se ultrapassar
  capacidade, habilitar armazenamento/CDN pelo adaptador sem mudar direitos de acesso.
- [ ] **OPS-05 — Atualização segura do protótipo publicado.**
  Ambiente de homologação, backup antes de migração, artefatos/permissões verificados
  pelo usuário do serviço, smoke test via HTTPS, rollback e roteiro hospedeira/VPS.
  Dependências: BASE-02, OPS-01/02. Aceite: atualizar uma cópia representativa e testar
  restauração antes de publicar; preservar `.env`, contas, idiomas e VPN. Docker e
  systemd precisam ser exercitados, não apenas validados por sintaxe.
- [ ] **SEC-01 — Autorização, abuso e conteúdo hostil.**
  Testes de acesso entre usuários/autores/cursos, mídia privada e revogada, Markdown,
  upload, extração/transcode, replay de pagamento e limites de armazenamento.
  Dependências: entregas correspondentes. Aceite: nenhum endpoint novo contorna
  políticas; arquivos de teste hostis falham de modo controlado, sem vazamento.
- [ ] **PRIV-01 — Privacidade e autosserviço.**
  Perfil/correção, exportação, solicitação de exclusão, consentimentos versionados,
  retenção de contas/mídia/pagamentos e contato de suporte. Dependências: ADMIN-01,
  PAY-04, CERT-03. Aceite: pedidos rastreáveis respeitam retenção definida; consulta
  pública de certificado expõe somente dados consentidos. Revisão jurídica é uma
  dependência externa, não uma afirmação de conformidade já alcançada.
- [ ] **UX-01 — Acessibilidade e estados reais de uso.**
  Teclado/foco, leitor de tela, contraste, zoom/mobile, legendas, mensagens de erro,
  esqueletos/carregamento e telas vazias; testar nos três idiomas. Dependências:
  EDIT-03, PLAY-03, HOME-03, I18N-01. Aceite: publicar e assistir sem mouse; player,
  editor e formulários não perdem contexto em erros.
- [ ] **SEO-01 — Páginas públicas indexáveis.**
  Conteúdo útil renderizado no servidor, título/descrição por curso, canonical,
  sitemap, Open Graph/capas e locale; bloquear indexação das áreas privadas.
  Dependências: HOME-02/03, I18N-02. Aceite: HTML inicial de um curso publicado
  contém sua apresentação; crawler não recebe somente o shell genérico atual.
- [ ] **QA-01 — Suíte e demonstração do produto completo.**
  Ampliar testes HTTP, banco, jobs e navegador para todos os fluxos abaixo, incluindo
  Chrome/Firefox/Safari e mobile quando aplicável. Dependências: todas as entregas
  P0/P1. Aceite: relatórios novos por versão; o teste atual de artigo em inglês
  não serve como aceite de vídeo, editor, idiomas, checkout ou certificado.
- [ ] **DOC-01 — Contrato e operação sincronizados com a implementação.**
  Atualizar OpenAPI, modelo de dados, instalação/configuração, manual de autor/aluno/
  admin, limites e procedimentos de recuperação a cada entrega. Dependência:
  transversal. Aceite: API implementada e planejamento futuro separados; exemplos
  executáveis não dependem de credenciais padrão nem de passos omitidos.

## Sequência de entregas demonstráveis

| Entrega | Itens centrais | Demonstração exigida |
|---|---|---|
| E1 — Autoria utilizável e home editorial | BASE, EDIT-01–04, HOME-01, I18N transversal | Formatar/reabrir aula; editar sem tirar publicação do ar; selecionar e ordenar destaques |
| E2 — Curso em vídeo gratuito completo | MEDIA, JOB, PLAY, EDIT-05, HOME-02/03, OPS-01 | Subir vídeo real, acompanhar processamento, publicar com legenda e reproduzir/retomar pelo domínio público |
| E3 — Gestão e avaliação | ADMIN, AUTH, I18N-02, QUIZ, LEARN, DATA pertinente | Administrador delega autoria; aluno realiza prova; conclusão calculada no servidor |
| E4 — Comércio e credenciais | PAY, CERT, DATA pertinente | Compra sandbox, confirmação, acesso, conclusão, PDF/QR, reembolso e revogação |
| E5 — Homologação e lançamento completo | OPS-02–05, SEC, PRIV, UX, SEO, QA, DOC | Restauração, carga, acessibilidade, três idiomas e atualização da instalação existente |

Segurança, migração e i18n acompanham cada entrega; E5 consolida os ensaios e não
é o primeiro momento em que esses aspectos são considerados. E2 torna o produto
utilizável para vídeo gratuito, mas não encerra o escopo completo P0/P1.

## Teste final de aceitação do produto

- [ ] Administrador cria autor e configura a seleção editorial da home.
- [ ] Autor cria curso com capa/objetivos, módulos reordenáveis, Markdown, vídeo,
  legenda e materiais complementares (PDF, ZIP e código-fonte) com descrição;
  interrompe e retoma upload; corrige um erro de processamento.
- [ ] Autor prepara nova revisão enquanto a publicação antiga continua acessível.
- [ ] Visitante encontra curso por busca/filtro e assiste somente às prévias permitidas.
- [ ] Aluno se cadastra, verifica e-mail, matricula-se ou paga, assiste em desktop/mobile,
  retoma posição, faz avaliação e recebe o certificado conforme a política.
- [ ] Nenhuma URL de mídia ou resposta do navegador concede acesso a quem não tem direito.
- [ ] Administrador consulta pedido, reembolsa/revoga e confere os efeitos no acesso e certificado.
- [ ] Trocar entre inglês/português/espanhol preserva rascunhos e traduz o fluxo inteiro.
- [ ] Operador recupera falha de worker e restaura banco/mídia em outra instalação funcional.
- [ ] Toda a jornada acima funciona em `learn.maiaplatform.org`, além dos testes locais.

## P2 — extensões registradas, sem bloquear o núcleo

- [ ] **EXT-01:** PayPal e outros provedores após estabilizar o contrato de pagamentos.
- [ ] **EXT-02:** Cupons e campanhas comerciais com política de preços e auditoria.
- [ ] **EXT-03:** Assistente por curso via Maia Chat/RAG com acesso e referências restritos.
- [ ] **EXT-04:** Geração/tradução automática de legendas com revisão humana.

Marketplace, divisão de pagamentos entre vendedores, SCORM, aplicativo nativo,
proctoring e promessa de DRM continuam fora do escopo definido em
[produto](docs/01-product.md). Não são pré-requisitos para completar a plataforma
single-publisher solicitada.

## Parâmetros externos a definir antes da publicação das respectivas etapas

Pico de espectadores e banda disponível; tamanho/duração dos vídeos; limites e
retenção de originais; identidade/conta do vendedor; preço/moeda; duração de acesso
e reembolso parcial; carga horária e texto do certificado; SMTP; política de
privacidade e responsáveis pelo suporte. O desenvolvimento de editor, upload,
player e home não precisa esperar essas definições comerciais. Estimativas de
prazo devem ser feitas por entrega após validar o pipeline com arquivos reais;
não há porcentagem de conclusão confiável baseada apenas em tabelas existentes.
