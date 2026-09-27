# Maia Learn / Maia LMS

Plataforma de cursos em `https://learn.maiaplatform.org`, com Node.js, TypeScript, Express e **SQLite**. Aplicação e banco ficam na máquina hospedeira; a VPS com **Maia Edge** publica HTTPS e encaminha as requisições pela VPN WireGuard.

## Estado da implementação

Esta versão entrega o **MVP de cursos gratuitos com aulas em texto**:

- Interface em português: catálogo, busca, curso, aula, cadastro, login, recuperação de senha e área do aluno.
- Autoria de cursos, módulos e aulas; publicação e arquivamento por administrador.
- Revisões preservadas para alunos já matriculados; prévias públicas e controle de acesso.
- Matrícula idempotente, progresso por aula e painel de aprendizado.
- Sessões persistentes em SQLite; e-mails em outbox com tentativas de entrega pelo worker.
- Instaladores da hospedeira e da VPS, backup verificável e testes HTTP e de navegador.

**Ainda não implementados:** upload/transcodificação e player de vídeo, quizzes, checkout/webhooks/reembolsos, certificados, MFA e exportação/exclusão de conta. As tabelas e alguns adaptadores herdados preparam essas etapas, mas não são funcionalidades disponíveis. Os documentos de produto registram a visão completa; [o roadmap](docs/09-roadmap.md) distingue o estado atual.

## Desenvolvimento

Requisitos: Node.js **22.12+** (22 ou 24), npm, Python 3, make e compilador C++ caso os módulos nativos precisem de compilação.

```bash
npm ci
cp .env.example .env
# Substitua SESSION_SECRET e MEDIA_SIGNING_KEY por valores de: openssl rand -hex 32
npm run build
npm run migrate
npm run dev:api
```

Abra `http://localhost:3000`. Em outro terminal:

```bash
npm run dev:worker
```

Configure um SMTP em `MAIL_TRANSPORT`. Para capturar e-mails localmente com Docker:

```bash
docker compose --env-file .env -f infra/docker-compose.yml --profile dev up -d mailpit
```

Abra `http://localhost:8025`. Sem SMTP, a aplicação funciona, mas verificação e recuperação de senha permanecem na fila, com até cinco tentativas de entrega.

Crie o primeiro administrador sem colocar a senha no histórico:

```bash
read -rsp 'Senha do administrador (12–128 caracteres): ' ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run admin -- admin@example.com
unset ADMIN_PASSWORD
```

Entre com essa conta e acesse `/admin`. O comando recusa sobrescrever uma conta existente. Novos usuários pelo site recebem o papel de aluno.

## Hospedeira + VPS

Primeiro configure o túnel usando o [Maia Edge](../maia-edge/README.md). Os IPs abaixo são exemplos: use os endereços reais do túnel existente.

Na hospedeira:

```bash
./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1 --dry-run
sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1
```

Na VPS, com certificado TLS já emitido e o Maia Edge instalado:

```bash
./install.sh vps --edge-dir /opt/maia-edge --upstream 10.77.0.2:3200 --dry-run
sudo ./install.sh vps --edge-dir /opt/maia-edge --upstream 10.77.0.2:3200
```

O instalador da hospedeira cria serviços systemd, segredos aleatórios, diretórios persistentes e backup antes de atualizar. O da VPS usa o CLI do Maia Edge para registrar a rota HTTPS, validar e aplicar a configuração. Nenhum instalador redefine a VPN. O `apply` do Maia Edge pode reiniciar a interface que ele gerencia.

Consulte [o guia de operações](docs/08-operations.md) para SMTP, DNS, TLS, firewall, administrador em produção, atualização, backup e restauração. Os instaladores fornecem `--help` e `--dry-run`.

## Docker opcional

```bash
# Em .env: PUBLIC_BASE_URL=http://localhost:3200
# MAIL_TRANSPORT=smtp://mailpit:1025
# NODE_ENV=development para HTTP local

docker compose --env-file .env -f infra/docker-compose.yml --profile dev up -d --build
```

O volume `maia_data` contém SQLite e armazenamento. Não use `down -v` para atualizações. Para produção, configure `NODE_ENV=production`, a URL HTTPS, `BIND_IP` com o IP da VPN e `TRUST_PROXY` com o IP da VPS; use SMTP real. Não há outro Nginx nem portas públicas 80/443 no Compose.

## Validação

```bash
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

A suíte usa bancos temporários. Para usar um Chrome já instalado, informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome` ao teste de navegador.

## Estrutura

| Diretório | Responsabilidade |
|---|---|
| `apps/api` | HTTP, autenticação, cursos, matrículas e progresso |
| `apps/web` | HTML, CSS e JavaScript, servidos pelo mesmo processo da API |
| `apps/worker` | Fila persistente de e-mails |
| `packages/domain` | Tipos, validação e políticas |
| `packages/providers` | SMTP e adaptadores reservados para pagamentos/armazenamento |
| `migrations` | Migrações SQLite sequenciais e transacionais |
| `scripts` | Instalação, administrador e backup |
| `spec/openapi.yaml` | Contrato da API implementada |

`/healthz` informa vida do processo; `/readyz` verifica o banco. SQLite opera com WAL, foreign keys e busy timeout, em disco local. Não é necessário servidor PostgreSQL.

Licença: [Apache 2.0](LICENSE).
