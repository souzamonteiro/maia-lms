# Autoria e página inicial

## Criar e editar

Entre como autor ou administrador em `/admin`. Preencha título, slug, resumo,
idioma do conteúdo e acesso gratuito; acrescente módulos e aulas. O idioma do
curso é independente do seletor de idioma da interface.

Novas aulas usam Markdown. A barra usa ícones com dicas traduzidas e nomes acessíveis. Ela insere títulos, negrito, itálico, listas,
citação, código, link, imagem e tabela. Use **Prévia** para conferir o resultado
renderizado pelo servidor. HTML escrito na aula é exibido literalmente; scripts,
URLs perigosas e embeds não são executados. Imagens aceitam somente caminhos
locais do site; o botão insere marcação, não faz upload. Upload de mídia e vídeo
continuam pendentes.

Aulas antigas mantêm texto simples. Escolher Markdown explicitamente converte a
interpretação do conteúdo; confira a prévia antes de publicar.

Salve uma vez para criar o curso. Depois, alterações válidas são salvas após uma
pausa de aproximadamente 1,6 segundo. O salvamento ainda cria uma revisão do curso
inteiro. Campos inválidos impedem o salvamento no servidor; o estado informa o erro.
Há recuperação local no mesmo navegador/conta, quando o armazenamento do navegador
está disponível. Ela não substitui backup nem sincroniza rascunhos entre dispositivos.
Trocar o idioma da interface preserva a edição. Sair com alterações pendentes
aciona o aviso do navegador.

Os botões permitem duplicar, remover e mover módulos/aulas para cima ou para baixo.
Remoção pede confirmação. Arraste e telas independentes por aula ainda não existem.

Duas abas não sobrescrevem silenciosamente a mesma revisão: o segundo salvamento
recebe conflito e mantém o texto local. Copie o conteúdo que deseja preservar antes
de confirmar o recarregamento da versão do servidor.

## Publicação

Salvar altera apenas o rascunho. Visitantes e novas matrículas continuam usando a
revisão publicada; alunos existentes permanecem na revisão da matrícula. O
administrador publica pelo painel. Essa ação promove conteúdo, slug, idioma e
acesso da revisão em uma transação. Arquivar remove descoberta pública e novas
matrículas, preservando acesso já concedido.

## Selecionar a página inicial

Como administrador, abra `/admin/home`. Adicione cursos publicados ao hero (no
máximo um), destaques ou recomendações. Defina prioridade (menor primeiro), início
e fim opcional. O formulário usa horário local e envia UTC. Salve a seleção.

A home mostra somente seleções ativas e publicadas. Remover um destaque não
remove o curso do catálogo em `/courses`. Não há ainda coleções com nomes livres,
capas ou upload. Edições simultâneas da seleção geram conflito de versão.

## Migração e validação

A migração aditiva `004_authoring.sql` é aplicada pelo migrador existente. Ela
preserva `current_revision_id` como ponteiro editável e acrescenta
`published_revision_id`. Só associa automaticamente uma revisão pública de curso
PUBLISHED/ARCHIVED cuja revisão já tenha `published_at`; não republica antigos
rascunhos. Metadados de revisão e `content_format` preservam conteúdo legado.

Antes de atualizar produção, siga backup/restauração e instalação descritos em
[operações](08-operations.md). Esta entrega foi validada em bancos temporários;
não houve migração do banco publicado nem reinício dos serviços.

Validação local: build, 38 testes automatizados e 3 testes no Chrome. Cobrem migração
legada, permissões, revisão pública/matrícula, sanitização, agenda da home,
concorrência, recuperação local, troca entre três idiomas e largura móvel de 390px.
Essa verificação não equivale a homologação Safari/Android ou auditoria completa de
acessibilidade. A política de renderização ainda não tem versão persistida por aula.
