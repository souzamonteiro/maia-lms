import { applyTranslations, detectLocale, storeLocale, translate } from './i18n.js';
const app = document.querySelector('#app');
const message = document.querySelector('#message');
const languageSelect = document.querySelector('#languageSelect');
const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const e = escapeHtml;
let me;
let locale = detectLocale();
function t(key, values) {
  return translate(locale, key, values);
}
function applyLocale() {
  locale = applyTranslations(locale);
  languageSelect.value = locale;
}
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method !== 'GET' ? { body: JSON.stringify(data ?? {}) } : {}),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result.error || t('genericError'));
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
    ? `<div class="grid">${courses.map(c => `<article class="card"><span class="badge">${c.access_mode === 'OPEN_FREE' ? t('accessOpen') : t('accessEnrolled')}</span><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${e(c.summary)}</p></article>`).join('')}</div>`
    : `<p>${t('noCoursesPublished')}</p>`;
}
async function catalog() {
  app.innerHTML = `<section class="hero"><p class="eyebrow">Maia Learn</p><h1>${t('heroTitle')}</h1><p>${t('heroText')}</p></section><h2>${t('exploreCourses')}</h2><form id="search"><label>${t('searchCoursesLabel')}<input name="q" type="search" placeholder="${t('searchPlaceholder')}"></label><button type="submit">${t('search')}</button></form><div id="catalog"></div>`;
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
    login: t('authTitleLogin'),
    register: t('authTitleRegister'),
    'forgot-password': t('authTitleForgotPassword'),
    'reset-password': t('authTitleResetPassword'),
  };
  const reset = kind === 'reset-password';
  app.innerHTML = `<h1>${titles[kind]}</h1><form id="auth" class="auth">${!reset ? `<label>${t('email')}<input name="email" type="email" autocomplete="email" required maxlength="255"></label>` : ''}${kind !== 'forgot-password' ? `<label>${t('password')}<input name="password" type="password" autocomplete="${kind === 'login' ? 'current-password' : 'new-password'}" minlength="8" maxlength="128" required></label>` : ''}<button type="submit">${t('continue')}</button></form><p><a href="/auth/register">${t('createAccount')}</a> · <a href="/auth/login">${t('signIn')}</a> · <a href="/auth/forgot-password">${t('forgotPassword')}</a></p>`;
  bindForm('#auth', async data => {
    const payload = Object.fromEntries(data);
    if (reset) payload.token = new URLSearchParams(location.search).get('token');
    await api(`/auth/${kind}`, 'POST', payload);
    if (kind === 'login') location.href = '/my-learning';
    else if (kind === 'register') notify(t('registerSuccess'));
    else if (reset) {
      app.innerHTML = `<h1>${t('passwordUpdatedTitle')}</h1><a href="/auth/login">${t('signIn')}</a>`;
    } else notify(t('forgotPasswordSuccess'));
  });
}
async function detail(slug) {
  const c = await api(`/courses/${encodeURIComponent(slug)}`);
  app.innerHTML = `<a href="/courses">${t('backToCourses')}</a><h1>${e(c.title)}</h1><p>${e(c.summary)}</p>${c.enrollment ? `<p class="badge">${t('enrolledBadge')}</p>` : me ? `<button id="enroll">${t('enrollFree')}</button>` : `<p><a href="/auth/login">${t('signIn')}</a>${t('toEnrollSuffix')}</p>`}${c.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(l => `<li><a href="/lessons/${e(l.id)}">${e(l.title)}</a>${l.is_preview ? t('previewOpen') : ''}</li>`).join('')}</ol></section>`).join('')}`;
  button('#enroll', async () => {
    await api(`/courses/${c.id}/enroll`, 'POST');
    await detail(slug);
  });
}
async function lesson(id) {
  const l = await api(`/lessons/${encodeURIComponent(id)}`);
  app.innerHTML = `<a href="/courses/${e(l.course_id)}">${t('backToCourse')}</a><article class="lesson"><h1>${e(l.title)}</h1><div class="lesson-body">${e(l.body)}</div></article>${me ? `<button id="complete">${l.progress?.completed_at ? t('lessonCompleted') : t('markComplete')}</button>` : `<p>${t('signInToTrackProgress')}</p>`}`;
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
  app.innerHTML = `<h1>${t('myLearningTitle')}</h1>${courses.length ? courses.map(c => `<article class="card"><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${t('lessonsProgress', { completed: c.completed_lessons, required: c.required_lessons })}${c.state === 'revoked' ? t('revokedAccess') : ''}.</p><progress value="${c.completed_lessons}" max="${Math.max(1, c.required_lessons)}" aria-label="${t('courseProgressAria')}"></progress></article>`).join('') : `<p>${t('nextLearningPrefix')}<a href="/courses">${t('coursesCatalog')}</a>.</p>`}`;
}
function addLesson(module, lesson = {}) {
  const field = document.createElement('fieldset');
  field.className = 'lesson-editor';
  field.innerHTML = `<legend>${t('lessonLegend')}</legend><label>${t('lessonTitleLabel')}<input class="lesson-title" required maxlength="200" value="${e(lesson.title)}"></label><label>${t('lessonContentLabel')}<textarea class="lesson-content" required maxlength="100000">${e(lesson.body)}</textarea></label><label><input class="lesson-required" type="checkbox" ${lesson.is_required !== 0 ? 'checked' : ''}>${t('requiredLabel')}</label><label><input class="lesson-preview" type="checkbox" ${lesson.is_preview ? 'checked' : ''}>${t('previewLabel')}</label><button type="button" class="remove secondary">${t('removeLesson')}</button>`;
  field.querySelector('.remove').onclick = () => field.remove();
  module.querySelector('.lessons').append(field);
}
function addModule(data = {}) {
  const field = document.createElement('fieldset');
  field.className = 'module-editor';
  field.innerHTML = `<legend>${t('moduleLegend')}</legend><label>${t('moduleTitleLabel')}<input class="module-title" required maxlength="200" value="${e(data.title)}"></label><div class="lessons"></div><div class="actions"><button type="button" class="add-lesson secondary">${t('addLesson')}</button><button type="button" class="remove secondary">${t('removeModule')}</button></div>`;
  field.querySelector('.add-lesson').onclick = () => addLesson(field);
  field.querySelector('.remove').onclick = () => field.remove();
  document.querySelector('#modules').append(field);
  for (const lesson of data.lessons || [{}]) addLesson(field, lesson);
}
async function admin() {
  if (!me || !['admin', 'author'].includes(me.role)) throw new Error(t('adminAccessRestricted'));
  const courses = await api('/admin/courses');
  app.innerHTML = `<h1>${t('adminPublishTitle')}</h1><p>${t('adminPublishDesc')}</p><div id="admin-list">${courses.map(c => `<article class="card"><h2>${e(c.title)}</h2><p>${e(c.status)}</p><div class="actions"><button data-edit="${c.id}">${t('edit')}</button>${me.role === 'admin' ? `<button data-publish="${c.id}">${t('publish')}</button><button data-archive="${c.id}" class="secondary">${t('archive')}</button>` : ''}<a href="/courses/${e(c.slug)}">${t('view')}</a></div></article>`).join('')}</div><h2 id="editor-title">${t('newCourseTitle')}</h2><form id="editor"><label>${t('title')}<input name="title" required minlength="3" maxlength="255"></label><label>${t('courseSlugLabel')}<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="100" placeholder="${t('courseSlugPlaceholder')}"></label><label>${t('summary')}<textarea name="summary" required minlength="10" maxlength="1000"></textarea></label><label>${t('access')}<select name="accessMode" aria-label="${t('access')}"><option value="OPEN_FREE">${t('accessOpenOption')}</option><option value="ENROLLED_FREE">${t('accessEnrolledOption')}</option></select></label><div id="modules"></div><div class="actions"><button type="button" id="add-module" class="secondary">${t('addModule')}</button><button type="submit">${t('saveDraft')}</button></div></form>`;
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
    notify(t('draftSaved'));
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
        document.querySelector('#editor-title').textContent = t('editCourseTitle');
        form.scrollIntoView();
      }
    } catch (error) {
      notify(error);
    }
  });
}
async function main() {
  applyLocale();
  try {
    me = await api('/auth/me');
  } catch {
    me = null;
  }
  if (me) {
    document.querySelector('#account').innerHTML =
      `${['admin', 'author'].includes(me.role) ? `<a href="/admin">${t('administer')}</a> · ` : ''}<button id="logout" class="secondary">${t('signOut')}</button>`;
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
languageSelect.addEventListener('change', () => {
  locale = languageSelect.value;
  storeLocale(locale);
  main().catch(notify);
});
main().catch(error => {
  app.innerHTML = `<h1>${t('pageNotFoundTitle')}</h1><p><a href="/courses">${t('backToCoursesLink')}</a> · <a href="/auth/login">${t('signIn')}</a></p>`;
  notify(error);
});
