# Videoaulas — primeira entrega E2

Esta entrega permite enviar, processar e publicar uma videoaula MP4 pelo editor.
Ainda não encerra E2: HLS adaptativo, legendas/transcrição, anexos, biblioteca de
imagens, navegação anterior/próxima e homologação pela VPS permanecem no TODO.

## Instalar ou atualizar

Na hospedeira Debian/Ubuntu, instale as ferramentas de mídia antes de atualizar:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
cd /home/roberto/projects/maia-lms
sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1
```

O instalador verifica `ffmpeg` e `ffprobe` antes de parar os serviços. A migração
005 é aditiva. O worker tem limite de 2 GiB de RAM, duas CPUs e 128 tarefas na
instalação systemd e no Compose. A imagem compartilhada do Compose inclui FFmpeg;
reconstrua-a ao atualizar. API e worker usam o mesmo `STORAGE_ROOT` privado.

Não é necessária outra porta ou rota pública. Os blocos enviados têm no máximo
512 KiB, abaixo do limite de 1 MiB do vhost existente. A API tem limite de 300 pedidos/minuto por IP;
blocos têm limite separado de 300/minuto por conta autenticada. Range/HEAD passam pelo proxy
atual. A validação local não comprova capacidade da VPN, banda ou configuração real
da VPS; faça o teste final pelo domínio após a atualização.

## Fluxo do autor

1. Crie o curso, módulo e título da aula e salve o rascunho. O texto pode ficar
   vazio enquanto prepara o vídeo; publicação exige texto ou vídeo pronto.
2. Reabra **Editar**. Em **Videoaula**, selecione um arquivo e clique **Enviar / retomar**.
3. O indicador mostra o progresso. **Pausar** interrompe após o bloco atual.
   Para retomar após recarregar a página, escolha o envio no seletor e selecione
   novamente o mesmo arquivo. O navegador verifica SHA-256 de todos os blocos já
   recebidos antes de continuar; arquivo diferente é recusado.
4. Ao terminar o envio, o vídeo entra na fila. Use **Atualizar estado** para
   acompanhar. **Pronto** significa que MP4 e imagem de capa foram gerados.
5. Salve a aula (ou aguarde o autosave) e publique como administrador. Vídeos em
   processamento, cancelados ou com falha impedem a publicação.

Um vídeo pode ser reutilizado em aulas do mesmo curso; outro curso é recusado.
Escolher **Sem vídeo** remove a associação do novo rascunho, preservando revisões
anteriores. Para substituir um vídeo, envie um novo arquivo e publique nova revisão.

**Repetir processamento** recoloca um vídeo FAILED na fila. Confira FFmpeg/FFprobe,
espaço livre e os limites abaixo. **Cancelar envio incompleto** remove os blocos
persistidos de uploads ainda incompletos; não remove vídeos publicados. Se o envio
estiver ativo, pause-o antes de confirmar o cancelamento.

## Limites atuais

- Entradas MP4/MOV ou Matroska/WebM, conferidas pelo FFprobe; extensão/MIME não bastam.
- Até 2 GiB por original, quatro horas e dimensão máxima de 4096 pixels por eixo.
- Quota de 20 GiB de originais reservados por autor, incluindo envios incompletos.
- Saída H.264/AAC em MP4 com início rápido, até 1280×720, preservando proporção e sem
  ampliar a resolução; até 4 GiB de saída. Capa JPEG gerada automaticamente.
- Um processamento por worker, com dois threads de codificação, timeout de quatro
  horas, heartbeat a cada 15 segundos e retomada de jobs sem heartbeat por dois minutos.
- Originais em blocos são mantidos para retentativa. Reserve espaço também para
  temporários e saídas; a quota de originais não é um limite total de uso de disco.
- Ainda não há expiração automática de uploads abandonados nem coleta de órfãos
  após crash. Cancele envios incompletos pelo painel e monitore disco. Não apague
  diretórios de vídeos referenciados por revisões antigas.

Os objetos têm nomes gerados no servidor, gravação temporária seguida de publicação
atômica e não são sobrescritos. O adaptador recusa traversal e symlinks. A raiz deve
ser gravável somente pela conta do serviço; não a compartilhe com usuários locais
não confiáveis. O endpoint recebe somente um bloco limitado por requisição; montagem
e reprodução usam streams, sem carregar o vídeo inteiro em RAM.

## Reprodução e acesso

O player nativo oferece reprodução, avanço, volume, tela cheia e controle de
velocidade. Alunos matriculados salvam posição aproximadamente a cada 15 segundos
e ao pausar; a conclusão continua explícita. A sessão deve continuar válida.

Cada pedido de vídeo/capa revalida publicação, prévia, autoria ou matrícula ativa
na revisão correspondente. Não há acesso público à pasta de armazenamento.
HTTP Range suporta 206/416 e HEAD; respostas usam cache privado desabilitado.
Revogação bloqueia novos pedidos, mas não recolhe bytes já recebidos no navegador.

## Validação e implementação

Use FFmpeg/FFprobe disponíveis no PATH:

```bash
npm run build
npm run lint
VIDEO_TEST_REAL=1 npm test
VIDEO_TEST_REAL=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

Sem `VIDEO_TEST_REAL=1`, os testes de conversão/reprodução real são explicitamente
ignorados. A CI instala FFmpeg e habilita esses testes. O teste HTTP verifica também
permissões, origem, limite, offset, cancelamento, arquivo inválido e revogação.

A implementação usa [FFmpeg](https://ffmpeg.org/ffmpeg.html) e
[FFprobe](https://ffmpeg.org/ffprobe.html), executados sem shell, com formatos de
entrada restritos e sem protocolos de rede. A fila `video_uploads` é independente
da outbox de e-mail. Jobs só publicam saídas se ainda possuem o lease atual.

Faça backup do SQLite **e** de `STORAGE_ROOT`, preservando referências e permissões.
O backup automático de banco do instalador, sozinho, não copia os vídeos.
