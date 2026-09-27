# Operação e instalação

## Topologia

```text
Internet → learn.maiaplatform.org:443 → Nginx/Maia Edge na VPS
                                         ↓ WireGuard
                               hospedeira:3200 → API + interface
                                                    ↓
                                             SQLite local
                                                    ↑
                                              worker SMTP
```

A aplicação não exige SQLite, Redis ou Nginx na hospedeira. API e worker compartilham o mesmo arquivo SQLite **em disco local**, com WAL e `busy_timeout=5000`. Não use NFS, Samba ou réplicas em máquinas diferentes sobre esse arquivo. O processo HTTP é único; expansão exige medição e revisão da arquitetura.

## Preparação

Use Linux com systemd (referência: Ubuntu 24.04), Node.js 22.12+ instalado em caminho acessível ao serviço, npm, rsync, curl, openssl, Python 3, make, g++, iproute2 e util-linux. O instalador verifica os pré-requisitos; não baixa scripts de instalação de runtime nem altera pacotes do sistema.

Configure primeiro a VPN pelo [CLI do Maia Edge](../../maia-edge/docs/CLI.md). Mantenha os IPs/interface já usados. Exemplos neste guia: hospedeira `10.77.0.2`, VPS `10.77.0.1`, porta da aplicação `3200`. Substitua pelos valores reais.

Restrinja TCP 3200 à VPS pela interface WireGuard no firewall da hospedeira; não abra essa porta no roteador público. O serviço faz bind somente no endereço informado. Na VPS, libere HTTPS 443 e o transporte WireGuard conforme sua configuração. DNS A de `learn.maiaplatform.org` aponta para o IPv4 público da VPS. Não configure AAAA sem preparar e testar IPv6.

## Hospedeira

Execute no checkout do maia-lms:

```bash
./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1 --dry-run
sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1
```

`--port` muda a porta 3200; `--domain` muda o domínio padrão. A instalação:

1. Cria o usuário de serviço `maia-lms` e uma release em `/opt/maia-lms/releases`.
2. Instala dependências e compila com o usuário sem privilégios; código publicado passa a pertencer ao root.
3. Preserva `/etc/maia-lms/app.env`; cria segredos aleatórios somente na primeira instalação.
4. Para os processos, salva backup verificável se existir banco e aplica migrações.
5. Atualiza `/opt/maia-lms/current`, instala e inicia `maia-lms` e `maia-lms-worker`.
6. Verifica `/readyz`. Releases e backups anteriores são preservados.

Dados: `/var/lib/maia-lms/maia-lms.db`, sessões na tabela `http_sessions`, armazenamento em `/var/lib/maia-lms/storage`. Diretório de dados 0700 e `UMask=0077`; segredos 0640 root:maia-lms.

Edite `/etc/maia-lms/app.env` com `sudoedit`. Configure `MAIL_TRANSPORT` com SMTP real e `MAIL_FROM` com remetente autorizado; não deixe o SMTP local de exemplo em produção. Se SMTP exigir caracteres especiais na URL, codifique-os para URL. Então:

```bash
sudo systemctl restart maia-lms maia-lms-worker
sudo systemctl status maia-lms maia-lms-worker
sudo journalctl -u maia-lms -u maia-lms-worker -n 100
```

Para criar o administrador em produção:

```bash
read -rsp 'Senha do administrador (12–128 caracteres): ' ADMIN_PASSWORD
export ADMIN_PASSWORD
sudo --preserve-env=ADMIN_PASSWORD -u maia-lms node \
  --env-file=/etc/maia-lms/app.env \
  /opt/maia-lms/current/scripts/admin.mjs admin@example.com
unset ADMIN_PASSWORD
```

O comando não substitui contas existentes. Não há senha padrão. Cadastre autores pelo procedimento administrativo controlado do banco; a interface atual cria alunos e cursos, não gerencia papéis de usuários.

## VPS e TLS — padrão maia-chat

Como no maia-chat, o Nginx público encaminha pela VPN diretamente para o Node
em `10.77.0.2:3200`. O maia-rag usa uma variante com Nginx adicional na
hospedeira (4311 → localhost:4310); essa camada não é necessária para o LMS já
escutando no endereço WireGuard.

O instalador VPS padrão instala somente o vhost do LMS em `sites-available` e
`sites-enabled`, testa Nginx e recarrega o serviço. Não executa `maia-edge apply`
nem reinicia a VPN. Exige Nginx, Python 3, curl e util-linux já instalados. Os
modelos ficam em `deploy/nginx/learn-{acme,vps}.conf.template`.

Aponte o DNS A de `learn.maiaplatform.org` para a VPS e permita HTTP 80 e HTTPS
443 no firewall da VPS/provedor. Para a primeira emissão do certificado, execute
**na VPS**, a partir do checkout atualizado:

```bash
sudo ./install.sh vps --upstream 10.77.0.2:3200 --acme-only
sudo certbot certonly --webroot -w /var/www/html -d learn.maiaplatform.org
sudo ./install.sh vps --upstream 10.77.0.2:3200
```

O primeiro comando publica somente o desafio ACME em HTTP; outras URLs retornam
404 até a configuração HTTPS ser instalada. Se o certificado já existe, execute
apenas o último comando. Use `--dry-run` para visualizar, e `--cert`/`--key` para
certificados fora de `/etc/letsencrypt/live/learn.maiaplatform.org/`.

A configuração final redireciona HTTP para HTTPS e mantém o desafio ACME para
renovação. Configure o hook de renovação para `nginx -t && systemctl reload nginx`
e confira o agendamento do Certbot. O instalador preserva backup do vhost anterior
e restaura o arquivo se a validação ou recarga falhar. Recusa substituir sites de
outro gerenciador ou criar outro vhost para um domínio já encontrado nos diretórios
padrão de sites ativos.

Caso já tenha registrado o LMS pelo CLI do Maia Edge, mantenha esse método ou
planeje a migração explicitamente; não instale dois vhosts para o mesmo domínio.
Por compatibilidade, passar `--edge-dir /opt/maia-edge` seleciona o instalador
antigo, que exige certificado e usa `service add`, `plan`, `apply`. Esse modo pode
reiniciar a interface VPN gerenciada e não é o padrão dos exemplos maia-chat/RAG.

### Verificação da conexão entre VPS e hospedeira

Execute **na VPS**, antes de ativar o proxy HTTPS:

```bash
curl --connect-timeout 5 --fail http://10.77.0.2:3200/readyz
```

Uma resposta local na hospedeira não comprova acesso pela VPN. Em caso de timeout,
confira rota/túnel e firewall. O exemplo maia-chat libera a porta pela interface
WireGuard; para o LMS na **hospedeira**, se UFW estiver ativo e a VPS usar
`10.77.0.1`, a regra restrita equivalente é:

```bash
sudo ufw status verbose
sudo ufw allow in on wg0 proto tcp from 10.77.0.1 to 10.77.0.2 port 3200
```

Não habilite ou redefina UFW se a máquina usa outro gerenciador de firewall. Não
é necessário encaminhamento no roteador doméstico. O instalador não presume qual
firewall administra sua infraestrutura.

Depois confira `https://learn.maiaplatform.org/readyz`, login e matrícula.
`TRUST_PROXY` continua sendo o IP WireGuard da VPS, conforme o
[comportamento de proxy do Express](https://expressjs.com/en/guide/behind-proxies/).

## Atualização e rollback

Execute o instalador host novamente a partir da nova versão. A configuração existente é preservada: mudar flags na atualização **não** modifica `app.env`. Ajuste o arquivo explicitamente quando mudar IP/porta/domínio. Migrações são aditivas; uma falha interrompe a instalação e deve ser investigada antes de reiniciar os processos. Falhas de build acontecem antes da parada dos serviços.

Para reverter código, pare API/worker, aponte `current` para uma release anterior compatível com o esquema atual e reinicie. Não faça downgrade automático do banco. Se for indispensável restaurar backup, use o procedimento abaixo, conservando antes uma cópia do estado recente.

## Backup e restauração

O backup usa a [API de backup do SQLite](https://www.sqlite.org/backup.html), seguida de `integrity_check` e `foreign_key_check`. Não copie somente o `.db` enquanto a aplicação escreve: o WAL pode conter dados ainda não incorporados.

```bash
sudo -u maia-lms node --env-file=/etc/maia-lms/app.env \
  /opt/maia-lms/current/scripts/backup.mjs \
  /var/lib/maia-lms/backups/manual-2026-09-27.db
```

Use nomes novos; o comando recusa sobrescrever arquivos. Agende diariamente, envie cópias criptografadas para outro equipamento e defina retenção. Inclua armazenamento e configuração em backup separado. O arquivo contém dados pessoais, sessões e tokens de e-mail pendentes; controle o acesso também aos backups.

Teste a restauração primeiro numa pasta isolada, executando `PRAGMA integrity_check` e `PRAGMA foreign_key_check` e iniciando uma instância de teste com o arquivo restaurado. Em recuperação real:

1. Pare `maia-lms-worker` e `maia-lms`.
2. Preserve o diretório atual completo, incluindo eventuais arquivos `-wal` e `-shm`.
3. Coloque o backup verificado num diretório de restauração **novo**, com permissões para `maia-lms`; nunca sobreponha um `.db` deixando WAL antigo ao lado.
4. Configure `DATABASE_URL` no `app.env` para o novo arquivo; restaure o armazenamento correspondente se aplicável.
5. Aplique as migrações da release selecionada, reinicie e verifique `/readyz`, login e progresso.
6. Registre tempo de recuperação e perda de dados desde o backup. Decida se sessões e tokens antigos devem ser invalidados antes de publicar novamente.

## E-mails e monitoramento

O worker reclama jobs em uma transação `IMMEDIATE`, atribui uma concessão de cinco minutos e tenta até cinco vezes, com backoff. Falha não marca o evento como processado. Entrega é pelo menos uma vez: uma queda após o SMTP aceitar pode repetir o e-mail. Eventos não suportados ficam em falha, sem fingir transcodificação ou emissão de certificado.

Inspecione `outbox` para eventos com `processed_at IS NULL` e `attempts >= 5`. Depois de corrigir a causa, um operador pode zerar `attempts`, limpar `lease_token` e definir `available_at=datetime('now')` para os IDs selecionados. Evite reprocessar em massa sem avaliar duplicações.

Monitore readiness, erros, idade da fila, espaço livre, backups, renovação TLS e funcionamento da VPN. Não há implantação remota automática: executar os instaladores no destino e validar DNS/TLS/SMTP depende da configuração real de cada máquina.

## Correção de permissões de instalações anteriores

Se o Node registrar `MODULE_NOT_FOUND` para `current/apps/api/dist/server.js` ou
`current/apps/worker/dist/worker.js`, confira o caminho com:

```bash
namei -l /opt/maia-lms/current/apps/api/dist/server.js
sudo journalctl -u maia-lms -u maia-lms-worker -n 100 --no-pager --full
```

O instalador inicial deixava `umask 077` ativo após criar os segredos: a compilação
produzia diretórios `dist` com modo 0700, que ficavam inacessíveis ao serviço após
mudar o proprietário para root. O instalador corrigido limita essa máscara à criação
do arquivo de segredos, normaliza a leitura dos artefatos e verifica os pontos de
entrada como usuário `maia-lms` antes de ativar a release.

Para reparar uma instalação afetada sem reinstalar ou modificar o banco, execute
no checkout atualizado:

```bash
sudo ./scripts/repair-permissions.sh
```

O reparo ajusta apenas a leitura do código da release ativa e das unidades systemd,
preserva as permissões dos segredos/dados e reinicia API e worker.
