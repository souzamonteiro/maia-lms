import { icon } from './icons.js';
import { mountStudio, studioDirty } from './studio.js';
import { mountHomeEditor, homeDirty } from './home-editor.js';
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
  const result =
    response.status === 204
      ? null
      : response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : { error: t(response.status === 429 ? 'RATE_LIMITED' : 'genericError') };
  if (!response.ok) {
    const error = new Error(
      result.code
        ? t(result.code)
        : response.status === 422
          ? t('invalidInput')
          : result.error || t('genericError'),
    );
    error.code = result.code;
    error.status = response.status;
    throw error;
  }
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
function attachmentCards(items = []) {
  return items.length
    ? `<section class="attachments"><h2>${t('attachments')}</h2>${items.map(a => `<article class="card"><h3><a href="/api/v1/attachments/${e(a.id)}/download">${e(a.title)}</a></h3><p class="plain-content">${e(a.description)}</p><small>${e(a.filename)} · ${new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(a.size / 1024)}</small></article>`).join('')}</section>`
    : '';
}
async function detail(slug) {
  const c = await api(`/courses/${encodeURIComponent(slug)}`);
  app.innerHTML = `<a href="/courses">${t('backToCourses')}</a><h1>${e(c.title)}</h1><p>${e(c.summary)}</p>${c.enrollment ? `<p class="badge">${t('enrolledBadge')}</p>` : me ? `<button id="enroll">${t('enrollFree')}</button>` : `<p><a href="/auth/login">${t('signIn')}</a>${t('toEnrollSuffix')}</p>`}${attachmentCards(c.attachments)}${c.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(l => `<li><a href="/lessons/${e(l.id)}">${e(l.title)}</a>${l.is_preview ? t('previewOpen') : ''}</li>`).join('')}</ol></section>`).join('')}`;
  button('#enroll', async () => {
    await api(`/courses/${c.id}/enroll`, 'POST');
    await detail(slug);
  });
}
async function lesson(id) {
  const l = await api(`/lessons/${encodeURIComponent(id)}`);
  app.innerHTML = `<a href="/courses/${e(l.course_id)}">${t('backToCourse')}</a><article class="lesson"><h1>${e(l.title)}</h1><div class="lesson-body prose">${l.video_id ? `<video id="lesson-video" controls playsinline preload="metadata" poster="/api/v1/lessons/${e(id)}/poster" src="/api/v1/lessons/${e(id)}/video"></video><label>${t('playbackSpeed')}<select id="playback-speed"><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label><p id="video-error" role="status"></p>` : ''}${l.body_html}</div>${attachmentCards(l.attachments)}</article>${me ? `<button id="complete">${l.progress?.completed_at ? t('lessonCompleted') : t('markComplete')}</button>` : `<p>${t('signInToTrackProgress')}</p>`}`;
  const video = document.querySelector('#lesson-video');
  if (video) {
    video.addEventListener('loadedmetadata', () => {
      if (l.progress?.position_seconds && l.progress.position_seconds < video.duration)
        video.currentTime = l.progress.position_seconds;
    });
    video.addEventListener('error', () => {
      document.querySelector('#video-error').textContent = t('videoPlaybackError');
    });
    document.querySelector('#playback-speed').onchange = event => {
      video.playbackRate = Number(event.target.value);
    };
    let lastSave = 0,
      saving = false;
    const savePosition = async () => {
      if (!l.can_track_progress || saving || !Number.isFinite(video.currentTime)) return;
      saving = true;
      lastSave = Date.now();
      try {
        await api(`/lessons/${id}/progress`, 'PUT', {
          positionSeconds: Math.floor(video.currentTime),
        });
      } catch {
        /* Public preview viewers may have no enrollment. */
      } finally {
        saving = false;
      }
    };
    video.addEventListener('timeupdate', () => {
      if (Date.now() - lastSave > 15000) void savePosition();
    });
    video.addEventListener('pause', () => {
      void savePosition();
    });
  }
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
async function admin() {
  if (!me || !['admin', 'author'].includes(me.role)) throw new Error(t('adminAccessRestricted'));
  const context = { app, api, t, e, notify, me };
  if (location.pathname === '/admin/home') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountHomeEditor(context);
  } else await mountStudio(context);
}
async function home() {
  const selection = await api('/home');
  const hero = selection.hero[0];
  app.innerHTML = `<section class="hero"><p class="eyebrow">Maia Learn</p><h1>${hero ? e(hero.title) : t('heroTitle')}</h1><p>${hero ? e(hero.summary) : t('heroText')}</p>${hero ? `<a class="button" href="/courses/${e(hero.slug)}">${t('viewCourse')}</a>` : ''}</section>${['featured', 'recommended'].map(slot => (selection[slot].length ? `<section><h2>${t(slot === 'featured' ? 'homeFeatured' : 'homeRecommended')}</h2>${cards(selection[slot])}</section>` : '')).join('')}<a class="button" href="/courses">${t('allCourses')}</a>`;
}
window.addEventListener('beforeunload', event => {
  if (
    (location.pathname === '/admin' && studioDirty()) ||
    (location.pathname === '/admin/home' && homeDirty())
  ) {
    event.preventDefault();
    event.returnValue = '';
  }
});
async function main() {
  applyLocale();
  try {
    me = await api('/auth/me');
  } catch {
    me = null;
  }
  if (me) {
    document.querySelector('#account').innerHTML =
      `${['admin', 'author'].includes(me.role) ? `<a href="/admin">${t('administer')}</a>` : ''}<button id="logout" class="secondary">${icon('signOut')}${t('signOut')}</button>`;
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
  else if (!parts.length) await home();
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
