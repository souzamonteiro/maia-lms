# Registro de validação — 2026-09-27

Validação local da entrega MVP, em Node.js 24.18.1:

- `npm run build`: compilação de todos os workspaces em ordem de dependência.
- `npm run lint`: sem erros.
- `npm test`: 28 testes aprovados; políticas, migrações, autenticação, cookies HTTPS atrás de proxy, permissões, matrícula idempotente, acesso/revisões/progresso, revogação de sessões, leases/retries, SMTP e backup/restauração.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e`: aprovado no Chrome; administrador cria/publica curso, aluno cadastra/entra/matricula/conclui aula e consulta progresso. Texto com marcação de script é exibido como texto.
- `npm audit` e `npm audit --omit=dev`: nenhuma vulnerabilidade reportada na consulta desta validação.
- `npm ci --dry-run`: lockfile consistente.
- Instaladores: sintaxe Bash e simulação host/VPS aprovadas.
- CLI real do repositório maia-edge: registro e planejamento da rota HTTPS `learn.maiaplatform.org → 10.77.0.2:3200` em estado temporário, com certificado de teste; sem aplicação à infraestrutura.
- YAML de Compose, OpenAPI e CI: parseado sem erros.

Não executados neste ambiente: instalação real de systemd na hospedeira/VPS, build Docker (Docker indisponível), emissão/renovação TLS, DNS público, SMTP externo, testes de carga e auditoria completa de acessibilidade. CI configura Node.js 22/24, browser e build Docker, mas sua execução remota não faz parte deste registro.

Estes resultados cobrem o MVP documentado no README. Não validam funcionalidades futuras de vídeo, comércio, quizzes ou certificados.

## Autoria e home — 27/09/2026

Validação da primeira implementação E1 no checkout local: `npm run build`,
`npm run lint`, `npm test` (38 testes, 8 arquivos) e
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e`
(3 testes) passaram. `npm audit` não reportou vulnerabilidades.

Cobertura acrescentada: migração 004 sobre fixture legada, publicação independente
do rascunho, revisão da matrícula, conflitos, permissões, sanitização Markdown,
seleção/agendamento da home, recuperação local e troca de idioma sem perda de
conteúdo. O teste móvel verifica largura de 390px no Chrome; não representa
homologação em dispositivos reais. Sessões consultadas pela navegação deixam de
consumir a quota de tentativas de login; o limite de credenciais continua testado.

Não houve implantação nem acesso ao banco de produção. Vídeo e demais etapas do
[TODO](../TODO.md) permanecem pendentes; veja o [guia de autoria](12-authoring.md).

## Vídeo MP4 — 28/09/2026

Build, lint, 41 testes automatizados (com `VIDEO_TEST_REAL=1`), quatro testes
no Chrome e três testes do instalador/proxy passaram. FFmpeg e FFprobe foram
disponibilizados em uma pasta temporária para os testes locais, sem instalar
pacotes no sistema da hospedeira. O teste de navegador enviou um MP4 real,
aguardou processamento, publicou a aula e verificou avanço do tempo de reprodução.

Cobertura nova inclui confinamento/symlinks, falha de stream, original imutável,
chunks concorrentes, SHA-256, origem, permissões, limite de tamanho, cancelamento,
claim exclusivo, conversão/capa, arquivo inválido, Range/HEAD/416 e revogação.
O teste completo identificou quota HTTP consumida por arquivos estáticos: o
limite agora cobre a API e uploads têm limite próprio por usuário.

Não foram executados implantação, Docker build, Safari/Android, carga ou teste
HTTPS pela VPS nesta entrega. HLS e legendas ainda não estão disponíveis.
