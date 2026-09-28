# Materiais complementares

O editor permite anexar até 30 materiais ao curso e até 30 por aula, cada um com
**título**, **descrição** e ordem. PDF, ZIP e código-fonte usam o mesmo armazenamento
privado e upload retomável dos vídeos, com validação própria.

## Usar no editor

1. Salve o curso e reabra **Editar**, caso ainda seja um curso novo.
2. Em **Materiais complementares** do curso ou da aula, clique **Adicionar material**.
3. Preencha título e descrição. Escolha um arquivo existente do mesmo curso ou use
   **Enviar / retomar arquivo** para enviar um novo.
4. Use **Atualizar estado** até aparecer **Pronto**. O worker valida o arquivo; se
   falhar, confira formato/tamanho antes de repetir a validação.
5. Ordene com as setas ou remova a linha com o botão de remoção. Salve e publique.

Para substituir um arquivo, envie um novo e selecione-o na linha do material. A
alteração cria outra revisão: alunos já matriculados conservam os arquivos e as
descrições da revisão anterior. Remover uma linha não apaga o arquivo físico.
O cancelamento de um envio incompleto remove seus blocos; remova também a linha
vazia se não desejar anexar outro arquivo.

O aluno encontra os materiais na página do curso ou da aula, com descrição, nome
e tamanho do arquivo. Clicar no título inicia o download.

## Formatos, limites e acesso

- PDF e ZIP: até 128 MiB; cabeçalho/assinatura conferidos pelo worker.
- Texto/código-fonte UTF-8: até 2 MiB; rejeita bytes inválidos e controles binários.
  Extensões: txt, md, csv, json, yaml, yml, xml, toml, js, ts, tsx, jsx, py, java,
  c, cpp, h, cs, go, rs, rb, php, sql, sh, css, html e ipynb.
- Vídeos e anexos compartilham a quota de 20 GiB de originais por autor.
- Não há extração de ZIP, execução de código ou visualizador de documentos no site.
- A validação de assinatura/codificação **não é uma análise antimalware** nem uma
  inspeção completa do conteúdo de PDF/ZIP. Essa integração continua em MEDIA-02.

Downloads são servidos como `application/octet-stream`, com
`Content-Disposition: attachment`, `nosniff` e cache privado desabilitado. Eles
revalidam a autorização a cada pedido. Materiais do curso seguem o acesso do curso;
os da aula seguem também a política de prévia. Um URL copiado não libera arquivos
privados. Matrículas revogadas não permitem novos downloads. Não é possível retirar
uma cópia que o aluno já tenha baixado.

## Operação e API

A atualização normal aplica a migração aditiva `006_attachments.sql`. Não há nova
porta, dependência ou mudança de Nginx. O worker existente valida os arquivos e a
publicação recusa materiais não READY. Faça backup do banco **e** do armazenamento.

`video_uploads.media_kind` distingue vídeo/anexo, preservando os dados existentes.
`course_attachments` registra metadados e ordem por revisão e aula opcional.
`/admin/files` oferece criação, lista, estado, chunks, conclusão, cancelamento e
retentativa. `/attachments/:id/download` oferece GET/HEAD autorizados. O contrato
completo está em [OpenAPI](../spec/openapi.yaml).

Anexos não concluem os demais itens de E2: HLS, legendas, coleta de órfãos, biblioteca
de imagens e homologação pela VPS continuam pendentes no [TODO](../TODO.md).
