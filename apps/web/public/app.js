import { mountEmailVerification } from './email-verification.js';
import { attachPlaybackPositionSaver } from './playback-position.js';
import { mountCategoryEditor, categoriesDirty } from './category-editor.js';
import { mountAdminUsers } from './admin-users.js';
import { mountAdminEnrollments } from './admin-enrollments.js';
import { coursePresentation } from './course-presentation.js';
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
if (location.pathname === '/auth/verify-email') {
  const emailLocale = new URLSearchParams(location.search).get('lang');
  if (['en', 'pt-BR', 'es'].includes(emailLocale)) locale = emailLocale;
}
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
    error.issues = result.issues;
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
function coverImage(c) {
  return c.cover_file_id
    ? `<img class="course-cover" loading="lazy" src="/api/v1/courses/${e(c.id)}/cover?revisionId=${e(c.revision_id || c.published_revision_id)}" alt="${e(c.cover_alt)}">`
    : '';
}
function cards(courses) {
  return courses.length
    ? `<div class="grid">${courses.map(c => `<article class="card">${coverImage(c)}<span class="badge">${c.access_mode === 'OPEN_FREE' ? t('accessOpen') : t('accessEnrolled')}</span><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${e(c.summary)}</p></article>`).join('')}</div>`
    : `<p>${t('noCoursesPublished')}</p>`;
}
async function catalog() {
  const params = new URLSearchParams(location.search);
  const categories = await api('/categories');
  // Preserve edits made while language switching waits for the taxonomy response.
  const existingForm = app.querySelector('#search');
  const filters = existingForm ? new URLSearchParams(new FormData(existingForm)) : params;
  const selectedCategory = filters.get('category') || '';
  const categoryOptions = [['', t('allCategories')], ...categories.map(c => [c.slug, c.name])];
  if (selectedCategory && !categories.some(c => c.slug === selectedCategory))
    categoryOptions.push([selectedCategory, selectedCategory]);
  const options = (values, selected) =>
    values
      .map(
        ([value, label]) =>
          `<option value="${e(value)}" ${selected === value ? 'selected' : ''}>${e(label)}</option>`,
      )
      .join('');
  app.innerHTML = `<h1>${t('exploreCourses')}</h1><form id="search" action="/courses" method="get"><label>${t('category')}<select name="category">${options(categoryOptions, selectedCategory)}</select></label><label>${t('searchCoursesLabel')}<input name="q" type="search" maxlength="200" value="${e(filters.get('q') || '')}"></label><label>${t('courseLanguage')}<select name="locale">${options(
    [
      ['', t('allLanguages')],
      ['en', 'English'],
      ['pt-BR', 'Português'],
      ['es', 'Español'],
    ],
    filters.get('locale') || '',
  )}</select></label><label>${t('courseLevel')}<select name="level">${options(
    [
      ['', t('allLevels')],
      ['beginner', t('levelBeginner')],
      ['intermediate', t('levelIntermediate')],
      ['advanced', t('levelAdvanced')],
    ],
    filters.get('level') || '',
  )}</select></label><label>${t('access')}<select name="accessMode">${options(
    [
      ['', t('allAccess')],
      ['OPEN_FREE', t('accessOpen')],
      ['ENROLLED_FREE', t('accessEnrolled')],
    ],
    filters.get('accessMode') || '',
  )}</select></label><label>${t('catalogSort')}<select name="sort">${options(
    [
      ['newest', t('sortNewest')],
      ['title', t('sortTitle')],
    ],
    filters.get('sort') || 'newest',
  )}</select></label><button type="submit">${t('search')}</button><a href="/courses">${t('clearFilters')}</a></form><div id="catalog" aria-live="polite">${t('loadingCourses')}</div>`;
  const root = document.querySelector('#catalog');
  params.set('format', 'page');
  params.set('pageSize', '12');
  try {
    const result = await api(`/courses?${params}`);
    if (!root.isConnected) return;
    const pageLink = page => {
      const query = new URLSearchParams(location.search);
      query.delete('format');
      query.delete('pageSize');
      query.set('page', String(page));
      return `/courses?${query}`;
    };
    root.innerHTML = `<p>${t('catalogResults')}: ${new Intl.NumberFormat(locale).format(result.total)}</p>${result.items.length ? cards(result.items) : `<p>${t('catalogEmpty')}</p>`}<nav class="actions" aria-label="${t('catalogPages')}">${result.page > 1 ? `<a href="${e(pageLink(result.page - 1))}">${t('previousPage')}</a>` : ''}<span>${t('catalogPage')} ${result.page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))}</span>${result.page * result.pageSize < result.total ? `<a href="${e(pageLink(result.page + 1))}">${t('nextPage')}</a>` : ''}</nav>`;
  } catch (error) {
    if (root.isConnected) root.textContent = t('catalogLoadError');
    notify(error);
  }
}
async function auth(kind) {
    if (kind === 'login' && new URLSearchParams(location.search).has('passwordChanged'))
      notify(t('passwordChangeSuccess'));
  // Keep credentials only in the current DOM; never persist them to browser storage.
  const previous = app.querySelector('#auth');
  const values = previous ? new FormData(previous) : null;
  const titles = {
    login: t('authTitleLogin'),
    register: t('authTitleRegister'),
    'forgot-password': t('authTitleForgotPassword'),
    'reset-password': t('authTitleResetPassword'),
  };
  const reset = kind === 'reset-password';
  app.innerHTML = `<h1>${titles[kind]}</h1><form id="auth" class="auth">${!reset ? `<label>${t('email')}<input name="email" type="email" autocomplete="email" required maxlength="255"></label>` : ''}${kind !== 'forgot-password' ? `<label>${t('password')}<input name="password" type="password" autocomplete="${kind === 'login' ? 'current-password' : 'new-password'}" minlength="8" maxlength="128" required></label>` : ''}<button type="submit">${t('continue')}</button></form><p><a href="/auth/register">${t('createAccount')}</a> · <a href="/auth/login">${t('signIn')}</a> · <a href="/auth/forgot-password">${t('forgotPassword')}</a></p>`;
  if (values) {
    for (const name of ['email', 'password']) {
      const field = app.querySelector(`#auth [name=${name}]`);
      if (field) field.value = values.get(name) || '';
    }
  }
  bindForm('#auth', async data => {
    const payload = Object.fromEntries(data);
    if (kind === 'register') payload.locale = locale;
    if (reset) payload.token = new URLSearchParams(location.search).get('token');
    await api(`/auth/${kind}`, 'POST', payload);
    if (kind === 'login') location.href = '/my-learning';
    else if (kind === 'register') {
      notify(t('registerSuccess'));
      const resend = document.createElement('button');
      resend.type = 'button';
      resend.className = 'secondary';
      resend.textContent = t('resendVerification');
      resend.addEventListener('click', async () => {
        resend.disabled = true;
        try {
          await api('/auth/resend-verification', 'POST', { email: payload.email });
          message.textContent = t('resendVerificationAccepted');
          resend.remove();
        } catch (error) {
          notify(error);
          resend.disabled = false;
        }
      });
      message.append(document.createElement('br'), resend);
    }
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
  app.innerHTML = `<a href="/courses">${t('backToCourses')}</a><h1>${e(c.title)}</h1>${coverImage(c)}<p>${e(c.summary)}</p>${coursePresentation(c, { t, e })}${c.enrollment ? `<p class="badge">${t('enrolledBadge')}</p>` : me ? `<button id="enroll">${t('enrollFree')}</button>` : `<p><a href="/auth/login">${t('signIn')}</a>${t('toEnrollSuffix')}</p>`}${attachmentCards(c.attachments)}${c.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(l => `<li><a href="/lessons/${e(l.id)}">${e(l.title)}</a>${l.is_preview ? t('previewOpen') : ''}</li>`).join('')}</ol></section>`).join('')}`;
  button('#enroll', async () => {
    await api(`/courses/${c.id}/enroll`, 'POST');
    await detail(slug);
  });
}
async function lesson(id) {
  const l = await api(`/lessons/${encodeURIComponent(id)}`);
  const outline = `<nav class="lesson-outline" aria-label="${t('courseOutline')}">${l.navigation.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(item => `<li><a href="/lessons/${e(item.id)}"${item.id === id ? ' aria-current="page"' : ''}>${e(item.title)}</a></li>`).join('')}</ol></section>`).join('')}</nav>`;
  const lessonNavigation = `<nav class="lesson-navigation" aria-label="${t('lessonNavigation')}">${l.navigation.previous_lesson_id ? `<a rel="prev" href="/lessons/${e(l.navigation.previous_lesson_id)}">${t('previousLesson')}</a>` : '<span></span>'}${l.navigation.next_lesson_id ? `<a rel="next" href="/lessons/${e(l.navigation.next_lesson_id)}">${t('nextLesson')}</a>` : '<span></span>'}</nav>`;
  app.innerHTML = `<a href="/courses/${e(l.course_id)}">${t('backToCourse')}</a>${outline}<article class="lesson"><h1>${e(l.title)}</h1><div class="lesson-body prose">${l.video_id ? `<video id="lesson-video" controls playsinline preload="metadata" poster="/api/v1/lessons/${e(id)}/poster" src="/api/v1/lessons/${e(id)}/video">${(l.captions || []).map(c => `<track kind="captions" srclang="${e(c.language)}" label="${e(c.label)}" src="/api/v1/lessons/${e(id)}/captions/${e(c.language)}">`).join('')}</video><label>${t('playbackSpeed')}<select id="playback-speed"><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label><p id="video-error" role="status"></p>` : ''}${l.body_html}</div>${attachmentCards(l.attachments)}${(l.captions || []).map(c => `<details><summary>${t('transcript')} — ${e(c.label)}</summary><div class="plain-content">${e(c.transcript)}</div></details>`).join('')}</article>${lessonNavigation}${me ? `<button id="complete">${l.progress?.completed_at ? t('lessonCompleted') : t('markComplete')}</button>` : `<p>${t('signInToTrackProgress')}</p>`}`;
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
    attachPlaybackPositionSaver(video, {
      canSave: () => l.can_track_progress,
      initialPosition: l.progress?.position_seconds ?? null,
      save: position =>
        api(`/lessons/${id}/progress`, 'PUT', {
          positionSeconds: position,
        }),
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
  app.innerHTML = `<h1>${t('myLearningTitle')}</h1>${courses.length ? courses.map(c => `<article class="card"><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${t('lessonsProgress', { completed: c.completed_lessons, required: c.required_lessons })}${c.state === 'revoked' ? t('revokedAccess') : ''}.</p><progress value="${c.completed_lessons}" max="${Math.max(1, c.required_lessons)}" aria-label="${t('courseProgressAria')}"></progress>${c.state !== 'revoked' && c.continue_lesson_id ? `<p><a class="button" href="/lessons/${e(c.continue_lesson_id)}">${t('continueCourse')}</a></p>` : ''}</article>`).join('') : `<p>${t('nextLearningPrefix')}<a href="/courses">${t('coursesCatalog')}</a>.</p>`}<section class="account-security"><h2>${t('accountSecurity')}</h2><form id="change-password"><label>${t('currentPassword')}<input name="currentPassword" type="password" autocomplete="current-password" required minlength="8" maxlength="128"></label><label>${t('newPassword')}<input name="newPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><label>${t('confirmPassword')}<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit">${t('changePassword')}</button></form></section>`;
    app.insertAdjacentHTML(
      'beforeend',
      `<section class="account-profile"><h2>${t('accountProfile')}</h2><form id="account-profile"><label>${t('displayName')}<input name="displayName" value="${e(me.display_name ?? '')}" maxlength="100" required></label><button type="submit">${t('saveProfile')}</button></form></section>`,
    );
    if (['author', 'admin'].includes(me.role)) {
      const profile = await api('/auth/instructor-profile');
      app.insertAdjacentHTML(
        'beforeend',
        `<section class="account-profile"><h2>${t('instructorProfile')}</h2><p>${t('instructorProfilePrivacy')}</p><form id="instructor-profile"><label>${t('instructorProfileAddress')}<input name="slug" value="${e(profile?.slug ?? '')}" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minlength="3" maxlength="80" required></label><label>${t('instructorProfileName')}<input name="displayName" value="${e(profile?.display_name ?? me.display_name ?? '')}" maxlength="100" required></label><label>${t('instructorProfileBio')}<textarea name="bio" maxlength="5000">${e(profile?.bio ?? '')}</textarea></label><label>${t('instructorProfileWebsite')}<input name="websiteUrl" type="url" maxlength="500" value="${e(profile?.website_url ?? '')}"></label><label><input name="isPublic" type="checkbox" ${profile?.is_public ? 'checked' : ''}>${t('instructorProfilePublish')}</label><button type="submit">${t('saveProfile')}</button></form>${profile?.is_public ? `<p><a href="/instructors/${e(profile.slug)}">${t('viewInstructorProfile')}</a></p>` : ''}</section>`,
      );
      bindForm('#instructor-profile', async data => {
        const saved = await api('/auth/instructor-profile', 'PUT', {
          slug: data.get('slug'),
          displayName: data.get('displayName'),
          bio: data.get('bio'),
          websiteUrl: data.get('websiteUrl'),
          isPublic: data.get('isPublic') === 'on',
        });
        notify(t('instructorProfileSaved'));
        if (saved.is_public)
          document.querySelector('#instructor-profile')?.insertAdjacentHTML(
            'afterend',
            `<p><a href="/instructors/${e(saved.slug)}">${t('viewInstructorProfile')}</a></p>`,
          );
      });
    }
  bindForm('#change-password', async data => {
    const payload = Object.fromEntries(data);
    if (payload.newPassword !== payload.confirmPassword) throw new Error(t('passwordsDoNotMatch'));
    await api('/auth/change-password', 'POST', {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });
    location.href = '/auth/login?passwordChanged=1';
  });
  bindForm('#account-profile', async data => {
    const result = await api('/auth/profile', 'PUT', Object.fromEntries(data));
    me.display_name = result.displayName;
    notify(t('profileSaved'));
  });
}
async function admin() {
  if (!me || !['admin', 'author'].includes(me.role)) throw new Error(t('adminAccessRestricted'));
  const context = { app, api, t, e, notify, me };
  if (location.pathname === '/admin/categories') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountCategoryEditor(context);
  } else if (location.pathname === '/admin/users') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountAdminUsers(context);
  } else if (location.pathname === '/admin/enrollments') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountAdminEnrollments(context);
  } else if (location.pathname === '/admin/home') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountHomeEditor(context);
  } else await mountStudio(context);
}
async function home() {
  const selection = await api('/home');
  const hero = selection.hero[0];
  app.innerHTML = `<section class="hero"><p class="eyebrow">Maia Learn</p><h1>${hero ? e(hero.title) : t('heroTitle')}</h1>${hero ? coverImage(hero) : ''}<p>${hero ? e(hero.summary) : t('heroText')}</p>${hero ? `<a class="button" href="/courses/${e(hero.slug)}">${t('viewCourse')}</a>` : ''}</section>${['featured', 'recommended'].map(slot => (selection[slot].length ? `<section><h2>${t(slot === 'featured' ? 'homeFeatured' : 'homeRecommended')}</h2>${cards(selection[slot])}</section>` : '')).join('')}<a class="button" href="/courses">${t('allCourses')}</a>`;
}
async function instructor(slug) {
  const profile = await api(`/instructors/${encodeURIComponent(slug)}`);
  app.innerHTML = `<a href="/courses">${t('backToCourses')}</a><h1>${e(profile.display_name)}</h1>${profile.bio ? `<div class="plain-content">${e(profile.bio)}</div>` : ''}${profile.website_url ? `<p><a href="${e(profile.website_url)}" target="_blank" rel="noopener noreferrer">${t('instructorProfileWebsiteLink')}</a></p>` : ''}<section><h2>${t('instructorCourses')}</h2>${cards(profile.courses)}</section>`;
}
window.addEventListener('beforeunload', event => {
  if (
    (location.pathname === '/admin' && studioDirty()) ||
    (location.pathname === '/admin/home' && homeDirty()) ||
    (location.pathname === '/admin/categories' && categoriesDirty())
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
    if (['en', 'pt-BR', 'es'].includes(me.locale)) {
      locale = me.locale;
      storeLocale(locale);
      applyLocale();
    }
    document.querySelector('#account').innerHTML =
      `${['admin', 'author'].includes(me.role) ? `<a href="/admin">${t('administer')}</a>` : ''}${me.role === 'admin' ? `<a href="/admin/users">${t('adminUsersTitle')}</a><a href="/admin/enrollments">${t('adminEnrollmentsTitle')}</a>` : ''}<button id="logout" class="secondary">${icon('signOut')}${t('signOut')}</button>`;
    button('#logout', async () => {
      await api('/auth/logout', 'POST');
      location.href = '/';
    });
  }
  const parts = location.pathname.split('/').filter(Boolean);
  if (location.pathname === '/auth/verify-email') mountEmailVerification({ app, api, t });
  else if (parts[0] === 'auth') await auth(parts[1]);
  else if (parts[0] === 'courses' && parts[1]) await detail(parts[1]);
  else if (parts[0] === 'instructors' && parts[1]) await instructor(parts[1]);
  else if (parts[0] === 'lessons') await lesson(parts[1]);
  else if (parts[0] === 'my-learning') await learning();
  else if (parts[0] === 'admin') await admin();
  else if (!parts.length) await home();
  else await catalog();
}
languageSelect.addEventListener('change', async () => {
  const nextLocale = languageSelect.value;
  const previousLocale = locale;
  const passwordForm = document.querySelector('#change-password');
  const passwordValues = passwordForm ? new FormData(passwordForm) : null;
  languageSelect.disabled = true;
  try {
    if (me) await api('/auth/locale', 'PUT', { locale: nextLocale });
    locale = nextLocale;
    storeLocale(locale);
    await main();
    if (passwordValues) {
      for (const name of ['currentPassword', 'newPassword', 'confirmPassword']) {
        const field = app.querySelector(`#change-password [name=${name}]`);
        if (field) field.value = passwordValues.get(name) || '';
      }
    }
  } catch (error) {
    languageSelect.value = previousLocale;
    notify(error);
  } finally {
    languageSelect.disabled = false;
  }
});
main().catch(error => {
  app.innerHTML = `<h1>${t('pageNotFoundTitle')}</h1><p><a href="/courses">${t('backToCoursesLink')}</a> · <a href="/auth/login">${t('signIn')}</a></p>`;
  notify(error);
});
