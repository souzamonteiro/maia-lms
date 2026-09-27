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

## VPS e TLS

O Maia Edge deve estar instalado e configurado na VPS. Emita previamente um certificado para `learn.maiaplatform.org`. O padrão do instalador usa:

```text
/etc/letsencrypt/live/learn.maiaplatform.org/fullchain.pem
/etc/letsencrypt/live/learn.maiaplatform.org/privkey.pem
```

Use o procedimento Certbot/DNS do seu provedor para emissão e renovação automática. Uma emissão DNS manual é possível, mas requer intervenção na renovação; não equivale a automação. Não use `certbot --nginx` nos arquivos gerenciados pelo Maia Edge, pois isso cria alterações fora do controle do CLI.

Com o checkout do maia-lms na VPS:

```bash
./install.sh vps --edge-dir /opt/maia-edge --upstream 10.77.0.2:3200 --dry-run
sudo ./install.sh vps --edge-dir /opt/maia-edge --upstream 10.77.0.2:3200
```

É possível informar `--cert` e `--key`. O instalador verifica a aplicação pela VPN, registra `service add DOMAIN proxy UPSTREAM 443 CERT KEY`, executa `plan` e `apply`. O Maia Edge verifica conflitos, testa Nginx e mantém seu mecanismo de rollback. Ele pode reiniciar a VPN gerenciada durante `apply`; planeje a janela de manutenção. Não são criados peers, túneis ou credenciais de VPN pelo instalador LMS.

Configure o hook de renovação TLS para `nginx -t && systemctl reload nginx`. A rota gerada atende HTTPS; o Maia Edge não cria automaticamente redirecionamento HTTP. Se desejar redirecionamento de 80 para 443, administre um vhost separado e sem conflito com seus desafios ACME.

Confira `https://learn.maiaplatform.org/readyz`, login, inscrição e recebimento de e-mail. `TRUST_PROXY` deve conter somente o endereço da VPS. A configuração foi alinhada ao [comportamento de proxy do Express](https://expressjs.com/en/guide/behind-proxies/); não use confiança global em todos os endereços.

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
