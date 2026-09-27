const app = document.querySelector('#app');
const message = document.querySelector('#message');
const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const e = escapeHtml;
let me;
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method !== 'GET' ? { body: JSON.stringify(data ?? {}) } : {}),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}
function notify(error) {
  message.textContent = error.message || error;
  message.scrollIntoView({ block: 'nearest' });
}
function bindForm(id, callback) {
  document.querySelector(id).addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    const button = event.target.querySelector('button[type=submit]');
    if (button) button.disabled = true;
    try {
      await callback(new FormData(event.target));
    } catch (error) {
      notify(error);
    } finally {
      if (button) button.disabled = false;
    }
  });
}
function button(id, callback) {
  document
    .querySelector(id)
    ?.addEventListener('click', () => Promise.resolve().then(callback).catch(notify));
}
function cards(courses) {
  return courses.length
    ? `<div class="grid">${courses.map(c => `<article class="card"><span class="badge">${c.access_mode === 'OPEN_FREE' ? 'Acesso aberto' : 'Inscrição gratuita'}</span><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${e(c.summary)}</p></article>`).join('')}</div>`
    : '<p>Nenhum curso publicado por enquanto. Volte em breve.</p>';
}
async function catalog() {
  app.innerHTML = `<section class="hero"><p class="eyebrow">Maia Learn</p><h1>Aprenda. Experimente.<br>Crie algo seu.</h1><p>Cursos para explorar tecnologia e transformar conhecimento em prática, no seu ritmo.</p></section><h2>Explore os cursos</h2><form id="search"><label>Buscar cursos<input name="q" type="search" placeholder="O que você quer aprender?"></label><button type="submit">Buscar</button></form><div id="catalog"></div>`;
  const load = async query => {
    document.querySelector('#catalog').innerHTML = cards(
      await api(`/courses?q=${encodeURIComponent(query || '')}`),
    );
  };
  bindForm('#search', data => load(data.get('q')));
  await load('');
}
async function auth(kind) {
  const titles = {
    login: 'Entre para continuar',
    register: 'Comece a aprender',
    'forgot-password': 'Recupere seu acesso',
    'reset-password': 'Escolha uma nova senha',
  };
  const reset = kind === 'reset-password';
  app.innerHTML = `<h1>${titles[kind]}</h1><form id="auth" class="auth">${!reset ? '<label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="255"></label>' : ''}${kind !== 'forgot-password' ? `<label>Senha<input name="password" type="password" autocomplete="${kind === 'login' ? 'current-password' : 'new-password'}" minlength="8" maxlength="128" required></label>` : ''}<button type="submit">Continuar</button></form><p><a href="/auth/register">Criar conta</a> · <a href="/auth/login">Entrar</a> · <a href="/auth/forgot-password">Esqueci minha senha</a></p>`;
  bindForm('#auth', async data => {
    const payload = Object.fromEntries(data);
    if (reset) payload.token = new URLSearchParams(location.search).get('token');
    await api(`/auth/${kind}`, 'POST', payload);
    if (kind === 'login') location.href = '/my-learning';
    else if (kind === 'register')
      notify('Conta criada. Confira o e-mail de verificação e entre para estudar.');
    else if (reset) {
      app.innerHTML = '<h1>Senha atualizada</h1><a href="/auth/login">Entrar</a>';
    } else notify('Se o e-mail estiver cadastrado, enviaremos um link de recuperação.');
  });
}
async function detail(slug) {
  const c = await api(`/courses/${encodeURIComponent(slug)}`);
  app.innerHTML = `<a href="/courses">← Cursos</a><h1>${e(c.title)}</h1><p>${e(c.summary)}</p>${c.enrollment ? '<p class="badge">Você está matriculado neste curso.</p>' : me ? '<button id="enroll">Inscrever-se gratuitamente</button>' : '<p><a href="/auth/login">Entre</a> para se inscrever e salvar seu progresso.</p>'}${c.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(l => `<li><a href="/lessons/${e(l.id)}">${e(l.title)}</a>${l.is_preview ? ' · Prévia aberta' : ''}</li>`).join('')}</ol></section>`).join('')}`;
  button('#enroll', async () => {
    await api(`/courses/${c.id}/enroll`, 'POST');
    await detail(slug);
  });
}
async function lesson(id) {
  const l = await api(`/lessons/${encodeURIComponent(id)}`);
  app.innerHTML = `<a href="/courses/${e(l.course_id)}">← Voltar ao curso</a><article class="lesson"><h1>${e(l.title)}</h1><div class="lesson-body">${e(l.body)}</div></article>${me ? `<button id="complete">${l.progress?.completed_at ? 'Aula concluída ✓' : 'Marcar como concluída'}</button>` : '<p>Entre e inscreva-se para salvar seu progresso.</p>'}`;
  button('#complete', async () => {
    await api(`/lessons/${id}/progress`, 'PUT', { complete: true });
    await lesson(id);
  });
}
async function learning() {
  if (!me) {
    location.href = '/auth/login';
    return;
  }
  const courses = await api('/me/enrollments');
  app.innerHTML = `<h1>Meu aprendizado</h1>${courses.length ? courses.map(c => `<article class="card"><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${c.completed_lessons} de ${c.required_lessons} aulas obrigatórias concluídas${c.state === 'revoked' ? ' · Acesso revogado' : ''}.</p><progress value="${c.completed_lessons}" max="${Math.max(1, c.required_lessons)}" aria-label="Progresso do curso"></progress></article>`).join('') : '<p>Seu próximo aprendizado começa no <a href="/courses">catálogo de cursos</a>.</p>'}`;
}
function addLesson(module, lesson = {}) {
  const field = document.createElement('fieldset');
  field.className = 'lesson-editor';
  field.innerHTML = `<legend>Aula</legend><label>Título<input class="lesson-title" required maxlength="200" value="${e(lesson.title)}"></label><label>Conteúdo (texto)<textarea class="lesson-content" required maxlength="100000">${e(lesson.body)}</textarea></label><label><input class="lesson-required" type="checkbox" ${lesson.is_required !== 0 ? 'checked' : ''}>Obrigatória</label><label><input class="lesson-preview" type="checkbox" ${lesson.is_preview ? 'checked' : ''}>Prévia pública</label><button type="button" class="remove secondary">Remover aula</button>`;
  field.querySelector('.remove').onclick = () => field.remove();
  module.querySelector('.lessons').append(field);
}
function addModule(data = {}) {
  const field = document.createElement('fieldset');
  field.className = 'module-editor';
  field.innerHTML = `<legend>Módulo</legend><label>Título do módulo<input class="module-title" required maxlength="200" value="${e(data.title)}"></label><div class="lessons"></div><div class="actions"><button type="button" class="add-lesson secondary">Adicionar aula</button><button type="button" class="remove secondary">Remover módulo</button></div>`;
  field.querySelector('.add-lesson').onclick = () => addLesson(field);
  field.querySelector('.remove').onclick = () => field.remove();
  document.querySelector('#modules').append(field);
  for (const lesson of data.lessons || [{}]) addLesson(field, lesson);
}
async function admin() {
  if (!me || !['admin', 'author'].includes(me.role))
    throw new Error('Acesso restrito a autores e administradores.');
  const courses = await api('/admin/courses');
  app.innerHTML = `<h1>Publicar conhecimento</h1><p>Crie cursos gratuitos com módulos e aulas em texto. Alterações geram uma nova revisão; alunos já inscritos conservam a anterior.</p><div id="admin-list">${courses.map(c => `<article class="card"><h2>${e(c.title)}</h2><p>${e(c.status)}</p><div class="actions"><button data-edit="${c.id}">Editar</button>${me.role === 'admin' ? `<button data-publish="${c.id}">Publicar</button><button data-archive="${c.id}" class="secondary">Arquivar</button>` : ''}<a href="/courses/${e(c.slug)}">Visualizar</a></div></article>`).join('')}</div><h2 id="editor-title">Novo curso</h2><form id="editor"><label>Título<input name="title" required minlength="3" maxlength="255"></label><label>Endereço do curso<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="100" placeholder="introducao-a-maia"></label><label>Resumo<textarea name="summary" required minlength="10" maxlength="1000"></textarea></label><label>Acesso<select name="accessMode" aria-label="Acesso"><option value="OPEN_FREE">Aberto, sem login</option><option value="ENROLLED_FREE">Gratuito com inscrição</option></select></label><div id="modules"></div><div class="actions"><button type="button" id="add-module" class="secondary">Adicionar módulo</button><button type="submit">Salvar rascunho</button></div></form>`;
  let editingId;
  addModule();
  button('#add-module', () => addModule());
  bindForm('#editor', async data => {
    const modules = [...document.querySelectorAll('.module-editor')].map(m => ({
      title: m.querySelector('.module-title').value,
      lessons: [...m.querySelectorAll('.lesson-editor')].map(l => ({
        title: l.querySelector('.lesson-title').value,
        body: l.querySelector('.lesson-content').value,
        required: l.querySelector('.lesson-required').checked,
        preview: l.querySelector('.lesson-preview').checked,
      })),
    }));
    await api(`/admin/courses${editingId ? `/${editingId}` : ''}`, editingId ? 'PUT' : 'POST', {
      ...Object.fromEntries(data),
      modules,
    });
    await admin();
    notify('Rascunho salvo. A publicação exige um administrador.');
  });
  document.querySelector('#admin-list').addEventListener('click', async event => {
    const target = event.target;
    try {
      if (target.dataset.publish || target.dataset.archive) {
        await api(
          `/admin/courses/${target.dataset.publish || target.dataset.archive}/${target.dataset.publish ? 'publish' : 'archive'}`,
          'POST',
        );
        await admin();
      }
      if (target.dataset.edit) {
        const c = await api(`/courses/${target.dataset.edit}`);
        editingId = c.id;
        const form = document.querySelector('#editor');
        for (const key of ['title', 'slug', 'summary']) form.elements[key].value = c[key];
        form.elements.accessMode.value = c.access_mode;
        document.querySelector('#modules').innerHTML = '';
        for (const m of c.modules) {
          const lessons = await Promise.all(m.lessons.map(l => api(`/lessons/${l.id}`)));
          addModule({ ...m, lessons });
        }
        document.querySelector('#editor-title').textContent = 'Editar curso';
        form.scrollIntoView();
      }
    } catch (error) {
      notify(error);
    }
  });
}
async function main() {
  try {
    me = await api('/auth/me');
  } catch {
    me = null;
  }
  if (me) {
    document.querySelector('#account').innerHTML =
      `${['admin', 'author'].includes(me.role) ? '<a href="/admin">Administrar</a> · ' : ''}<button id="logout" class="secondary">Sair</button>`;
    button('#logout', async () => {
      await api('/auth/logout', 'POST');
      location.href = '/';
    });
  }
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'auth') await auth(parts[1]);
  else if (parts[0] === 'courses' && parts[1]) await detail(parts[1]);
  else if (parts[0] === 'lessons') await lesson(parts[1]);
  else if (parts[0] === 'my-learning') await learning();
  else if (parts[0] === 'admin') await admin();
  else await catalog();
}
main().catch(error => {
  app.innerHTML =
    '<h1>Não foi possível abrir esta página</h1><p><a href="/courses">Voltar aos cursos</a> · <a href="/auth/login">Entrar</a></p>';
  notify(error);
});
