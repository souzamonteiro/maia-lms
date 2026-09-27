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
