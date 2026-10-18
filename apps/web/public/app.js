import { mountEmailVerification } from './email-verification.js';
import { attachPlaybackPositionSaver } from './playback-position.js';
import { mountCategoryEditor, categoriesDirty } from './category-editor.js';
import { mountAdminUsers } from './admin-users.js';
import { mountAdminOrders } from './admin-orders.js';
import { mountAdminMedia } from './admin-media.js';
import { mountAdminEnrollments } from './admin-enrollments.js';
import { mountAdminCertificates } from './admin-certificates.js';
import { coursePresentation } from './course-presentation.js';
import { icon } from './icons.js';
import { attachHlsPlayer } from './hls-player.js';
import { mountStudio, studioDirty } from './studio.js';
import { mountHomeEditor, homeDirty } from './home-editor.js';
import { applyTranslations, detectLocale, formatNumber, storeLocale, translate } from './i18n.js';
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
let pendingMfaChallenge = null;
let activePlayerCleanups = [];

function clearActivePlayers() {
  for (const cleanup of activePlayerCleanups) cleanup();
  activePlayerCleanups = [];
}

async function mountHlsPlayers(root = app) {
  clearActivePlayers();
  const videos = [...root.querySelectorAll('video[data-hls-url][data-mp4-url]')];
  activePlayerCleanups = await Promise.all(videos.map(video => attachHlsPlayer(video, {
    hlsUrl: video.dataset.hlsUrl,
    mp4Url: video.dataset.mp4Url,
    quality: video.parentElement.querySelector('.video-quality'),
    status: video.parentElement.querySelector('.video-status'),
    t,
  })));
}
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
function renderMfaChallenge(challengeToken) {
  app.innerHTML = `<h1>${t('mfaChallengeTitle')}</h1><p>${t('mfaChallengeHelp')}</p><form id="mfa-challenge" class="auth"><label>${t('mfaCodeLabel')}<input name="code" autocomplete="one-time-code" inputmode="text" minlength="6" maxlength="40" required></label><button type="submit">${t('mfaVerifyAction')}</button></form><button type="button" class="secondary" id="mfa-restart-login">${t('signIn')}</button>`;
  bindForm('#mfa-challenge', async data => {
    await api('/auth/login/mfa', 'POST', { challengeToken, code: data.get('code') });
    pendingMfaChallenge = null;
    location.href = '/my-learning';
  });
  button('#mfa-restart-login', () => {
    pendingMfaChallenge = null;
    auth('login');
  });
}
async function mountAdminMfa(host) {
  const render = (status, recoveryCodes = null, setup = null) => {
    host.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = t('mfaSettingsTitle');
    host.append(heading);

    if (recoveryCodes) {
      const description = document.createElement('p');
      description.textContent = t('mfaRecoveryCodesHelp');
      const list = document.createElement('pre');
      list.textContent = recoveryCodes.join('\n');
      const saved = document.createElement('button');
      saved.type = 'button';
      saved.textContent = t('mfaRecoveryCodesSaved');
      saved.addEventListener('click', () => render(status));
      host.append(description, list, saved);
      return;
    }

    if (setup) {
      const description = document.createElement('p');
      description.textContent = t('mfaSetupHelp');
      const keyLabel = document.createElement('p');
      keyLabel.textContent = `${t('mfaSetupKey')}: ${setup.secret}`;
      const uriLabel = document.createElement('p');
      uriLabel.textContent = `${t('mfaSetupUri')}: ${setup.uri}`;
      const form = document.createElement('form');
      form.innerHTML = `<label>${e(t('mfaConfirmCode'))}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button type="submit">${e(t('mfaEnableAction'))}</button>`;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = form.querySelector('button[type=submit]');
        submit.disabled = true;
        try {
          const result = await api('/auth/mfa/enable', 'POST', { code: new FormData(form).get('code') });
          render({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length }, result.recoveryCodes);
        } catch (error) {
          notify(error);
          submit.disabled = false;
        }
      });
      host.append(description, keyLabel, uriLabel, form);
      return;
    }

    const description = document.createElement('p');
    description.textContent = status.enabled ? t('mfaEnabled') : t('mfaNotEnabled');
    host.append(description);
    if (!status.enabled) {
      const setupButton = document.createElement('button');
      setupButton.type = 'button';
      setupButton.textContent = t('mfaSetupAction');
      setupButton.addEventListener('click', async () => {
        setupButton.disabled = true;
        try {
          render(status, null, await api('/auth/mfa/setup', 'POST'));
        } catch (error) {
          notify(error);
          setupButton.disabled = false;
        }
      });
      host.append(setupButton);
      return;
    }

    const remaining = document.createElement('p');
    remaining.textContent = t('mfaRecoveryCount', { count: status.recoveryCodesRemaining });
    const form = document.createElement('form');
    form.innerHTML = `<label>${e(t('mfaDisablePassword'))}<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="128"></label><label>${e(t('mfaDisableCode'))}<input name="code" autocomplete="one-time-code" required maxlength="40"></label><button type="submit" class="secondary">${e(t('mfaDisableAction'))}</button>`;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      try {
        await api('/auth/mfa/disable', 'POST', Object.fromEntries(new FormData(form)));
        location.href = '/auth/login?mfaDisabled=1';
      } catch (error) {
        notify(error);
        submit.disabled = false;
      }
    });
    host.append(remaining, form);
  };

  render(await api('/auth/mfa/status'));
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
    ? `<div class="grid">${courses.map(c => `<article class="card">${coverImage(c)}<span class="badge">${c.access_mode === 'OPEN_FREE' ? t('accessOpen') : c.access_mode === 'PAID' ? t('coursePriceValue', { value: new Intl.NumberFormat(locale, { style: 'currency', currency: c.price_currency }).format(c.price_amount_minor / 100) }) : t('accessEnrolled')}</span><h2><a href="/courses/${e(c.slug)}">${e(c.title)}</a></h2><p>${e(c.summary)}</p></article>`).join('')}</div>`
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
  params.set('displayLocale', locale);
  try {
    const result = await api(`/courses?${params}`);
    if (!root.isConnected) return;
    const pageLink = page => {
      const query = new URLSearchParams(location.search);
      query.delete('format');
      query.delete('pageSize');
      query.set('page', String(page));
      query.set('displayLocale', locale);
      return `/courses?${query}`;
    };
    const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
    root.innerHTML = `<p>${t('catalogResults')}: ${formatNumber(locale, result.total)}</p>${result.items.length ? cards(result.items) : `<p>${t('catalogEmpty')}</p>`}<nav class="actions" aria-label="${t('catalogPages')}">${result.page > 1 ? `<a href="${e(pageLink(result.page - 1))}">${t('previousPage')}</a>` : ''}<span>${t('catalogPage')} ${formatNumber(locale, result.page)} / ${formatNumber(locale, pageCount)}</span>${result.page * result.pageSize < result.total ? `<a href="${e(pageLink(result.page + 1))}">${t('nextPage')}</a>` : ''}</nav>`;
  } catch (error) {
    if (root.isConnected) root.textContent = t('catalogLoadError');
    notify(error);
  }
}
async function auth(kind) {
  if (kind === 'login' && pendingMfaChallenge) {
    renderMfaChallenge(pendingMfaChallenge);
    return;
  }
    if (kind === 'login' && new URLSearchParams(location.search).has('passwordChanged'))
      notify(t('passwordChangeSuccess'));
  if (kind === 'login' && new URLSearchParams(location.search).has('mfaDisabled'))
    notify(t('mfaDisabledNotice'));
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
    const result = await api(`/auth/${kind}`, 'POST', payload);
    if (kind === 'login' && result?.mfaRequired) {
      pendingMfaChallenge = result.challengeToken;
      renderMfaChallenge(pendingMfaChallenge);
    }
    else if (kind === 'login') location.href = '/my-learning';
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
  clearActivePlayers();
  const c = await api(`/courses/${encodeURIComponent(slug)}?displayLocale=${encodeURIComponent(locale)}`);
  app.innerHTML = `<a href="/courses">${t('backToCourses')}</a><h1>${e(c.title)}</h1>${coverImage(c)}<p>${e(c.summary)}</p>${coursePresentation(c, { t, e, locale })}${c.enrollment ? `<p class="badge">${t('enrolledBadge')}</p>` : me ? `<button id="enroll">${t('enrollFree')}</button>` : `<p><a href="/auth/login">${t('signIn')}</a>${t('toEnrollSuffix')}</p>`}${attachmentCards(c.attachments)}${c.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(l => `<li><a href="/lessons/${e(l.id)}">${e(l.title)}</a>${l.is_preview ? t('previewOpen') : ''}</li>`).join('')}</ol></section>`).join('')}`;
  await mountHlsPlayers(app);
  if (c.access_mode === 'PAID' && !c.enrollment) {
    const purchase = app.querySelector('#enroll');
    if (purchase) purchase.textContent = t('buyCourse');
    const signInPrompt = app.querySelector('a[href="/auth/login"]')?.parentElement;
    if (!me && signInPrompt) signInPrompt.lastChild.textContent = t('toBuySuffix');
  }
  button('#enroll', async () => {
    if (c.access_mode === 'PAID') {
      const key = `maia-lms:checkout:${c.id}`;
      let idempotencyKey = sessionStorage.getItem(key);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(key, idempotencyKey);
      }
      const checkout = await api('/orders', 'POST', { courseId: c.id, idempotencyKey });
      sessionStorage.removeItem(key);
      if (checkout.checkoutUrl) location.assign(checkout.checkoutUrl);
      else location.href = '/my-orders';
      return;
    }
    await api(`/courses/${c.id}/enroll`, 'POST');
    await detail(slug);
  });
}
async function myOrders() {
  if (!me) {
    location.href = '/auth/login';
    return;
  }
  const { items } = await api('/me/orders');
  const statusKeys = {
    CREATED: 'orderStatusCreated',
    CHECKOUT_PENDING: 'orderStatusPending',
    PAID: 'orderStatusPaid',
    EXPIRED: 'orderStatusExpired',
    CANCELED: 'orderStatusCanceled',
    PARTIALLY_REFUNDED: 'orderStatusPartiallyRefunded',
    REFUNDED: 'orderStatusRefunded',
    CHARGEBACK: 'orderStatusChargeback',
  };
  app.innerHTML = `<h1>${t('myOrdersTitle')}</h1>${items.length ? items.map(order => `<article class="card order-entry"><h2>${e(order.course_title_snapshot)}</h2><p role="status">${t(statusKeys[order.state] || 'orderStatusPending')} · ${e(new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency }).format(order.price_snapshot / 100))}</p>${order.access_terms_snapshot ? `<p class="plain-content">${e(order.access_terms_snapshot)}</p>` : ''}${order.state === 'CHECKOUT_PENDING' && order.checkout_url ? `<a class="button" href="${e(order.checkout_url)}">${t('continueCheckout')}</a>` : ''}${['CHECKOUT_PENDING','PAID'].includes(order.state) ? `<button type="button" class="secondary" data-refresh-order="${e(order.id)}">${t('refreshOrderStatus')}</button>` : ''}</article>`).join('') : `<p>${t('ordersEmpty')}</p>`}`;
  app.querySelectorAll('[data-refresh-order]').forEach(refresh => {
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      try {
        await api(`/me/orders/${encodeURIComponent(refresh.dataset.refreshOrder)}/refresh`, 'POST');
        await myOrders();
      } catch (error) {
        notify(error);
        refresh.disabled = false;
      }
    });
  });
}
async function fakeCheckout(paymentId) {
  const checkout = await api(`/dev/fake-checkout/${encodeURIComponent(paymentId)}`);
  const amount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: checkout.currency,
  }).format(checkout.price_snapshot / 100);
  app.innerHTML = `<section class="fake-checkout"><h1>${t('fakeCheckoutTitle')}</h1><h2>${e(checkout.course_title_snapshot)}</h2><p>${e(t('fakeCheckoutDescription', { course: checkout.course_title_snapshot }))}</p><p><strong>${e(amount)}</strong></p><p role="status">${t(`orderStatus${checkout.state === 'PAID' ? 'Paid' : 'Pending'}`)}</p><div class="actions"><button id="fake-approve">${t('fakeApprove')}</button><button id="fake-cancel" class="secondary">${t('fakeCancel')}</button></div></section>`;
  const decide = async decision => {
    const result = await api(`/dev/fake-checkout/${encodeURIComponent(paymentId)}`, 'POST', { decision });
    location.assign(result.returnUrl);
  };
  button('#fake-approve', () => decide('approve'));
  button('#fake-cancel', () => decide('cancel'));
}
async function lesson(id) {
  clearActivePlayers();
  const l = await api(`/lessons/${encodeURIComponent(id)}`);
  const outline = `<nav class="lesson-outline" aria-label="${t('courseOutline')}">${l.navigation.modules.map(m => `<section><h2>${e(m.title)}</h2><ol>${m.lessons.map(item => `<li><a href="/lessons/${e(item.id)}"${item.id === id ? ' aria-current="page"' : ''}>${e(item.title)}</a></li>`).join('')}</ol></section>`).join('')}</nav>`;
  const lessonNavigation = `<nav class="lesson-navigation" aria-label="${t('lessonNavigation')}">${l.navigation.previous_lesson_id ? `<a rel="prev" href="/lessons/${e(l.navigation.previous_lesson_id)}">${t('previousLesson')}</a>` : '<span></span>'}${l.navigation.next_lesson_id ? `<a rel="next" href="/lessons/${e(l.navigation.next_lesson_id)}">${t('nextLesson')}</a>` : '<span></span>'}</nav>`;
  const quizPanel = l.quiz_id && l.can_track_progress
    ? `<section class="lesson-quiz" id="lesson-quiz"><h2>${t('quizTitle')}</h2><p>${t('quizPrivacy')}</p><p id="quiz-status" role="status" aria-live="polite"></p><div id="quiz-content"><button type="button" id="quiz-start">${t('quizStart')}</button></div><section id="quiz-results" aria-live="polite"></section></section>`
    : '';
  app.innerHTML = `<a href="/courses/${e(l.course_id)}">${t('backToCourse')}</a>${outline}<article class="lesson"><h1>${e(l.title)}</h1><div class="lesson-body prose">${l.video_id ? `<div class="lesson-video-player"><video id="lesson-video" controls playsinline preload="metadata" poster="/api/v1/lessons/${e(id)}/poster" src="/api/v1/lessons/${e(id)}/video" data-mp4-url="/api/v1/lessons/${e(id)}/video" data-hls-url="/api/v1/lessons/${e(id)}/hls/master.m3u8">${(l.captions || []).map(c => `<track kind="captions" srclang="${e(c.language)}" label="${e(c.label)}" src="/api/v1/lessons/${e(id)}/captions/${e(c.language)}">`).join('')}</video><label class="video-quality-control" hidden>${t('videoQuality')}<select class="video-quality" aria-label="${t('videoQuality')}"><option value="-1">${t('videoQualityAuto')}</option></select></label><p class="video-status" role="status" aria-live="polite"></p></div><label>${t('playbackSpeed')}<select id="playback-speed"><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label><p id="video-error" role="status"></p>` : ''}${l.body_html}</div>${attachmentCards(l.attachments)}${(l.captions || []).map(c => `<details><summary>${t('transcript')} — ${e(c.label)}</summary><div class="plain-content">${e(c.transcript)}</div></details>`).join('')}</article>${quizPanel}${lessonNavigation}${me ? `<button id="complete">${l.progress?.completed_at ? t('lessonCompleted') : t('markComplete')}</button>` : `<p>${t('signInToTrackProgress')}</p>`}`;
  await mountHlsPlayers(app);
  if (quizPanel) {
    const content = document.querySelector('#quiz-content');
    const status = document.querySelector('#quiz-status');
    const results = document.querySelector('#quiz-results');
    const loadResults = async () => {
      const history = await api(`/quizzes/${l.quiz_id}/results`);
      results.innerHTML = history.items.length
        ? `<h3>${t('quizResultHistory')}</h3><ol>${history.items.map((item, index) => `<li>${t('quizResultAttempt', { number: history.items.length - index })}: ${item.expired ? t('quizAttemptExpired') : `${item.pass ? t('quizPassed') : t('quizFailed')} · ${t('quizScore', { score: item.score, total: item.total_points })}`}${item.submitted_at ? ` · ${e(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.submitted_at)))}` : ''}${feedbackMarkup(item.answers)}</li>`).join('')}</ol>`
        : '';
    };
    const feedbackMarkup = answers => answers?.length
      ? `<details class="quiz-feedback"><summary>${t('quizReviewAnswers')}</summary><ol>${answers.map(answer => `<li><p>${e(answer.prompt)} · ${t('quizQuestionScore', { score: answer.awarded_points, total: answer.possible_points })}</p><ul>${answer.choices.map(choice => `<li>${e(choice.text)}${choice.selected ? ` · ${t('quizYourAnswer')}` : ''}${choice.correct ? ` · ${t('quizCorrectAnswer')}` : ''}</li>`).join('')}</ul>${answer.explanation ? `<p class="plain-content"><strong>${t('quizExplanation')}:</strong> ${e(answer.explanation)}</p>` : ''}</li>`).join('')}</ol></details>`
      : '';
    const showResult = (attempt, totalPoints) => {
      status.textContent = attempt.pass ? t('quizPassed') : t('quizFailed');
      content.innerHTML = `<p>${t('quizScore', { score: attempt.score ?? 0, total: totalPoints })}</p><p>${t('quizAttemptsRemaining', { count: attempt.remaining_attempts })}</p>${feedbackMarkup(attempt.answers)}${attempt.remaining_attempts > 0 ? `<button type="button" id="quiz-start-next">${t('quizTryAgain')}</button>` : ''}`;
      document.querySelector('#quiz-start-next')?.addEventListener('click', () => startAttempt().catch(notify));
    };
    const renderAttempt = attempt => {
      const totalPoints = attempt.questions.reduce((sum, question) => sum + question.points, 0);
      if (attempt.submitted_at) {
        showResult(attempt, totalPoints);
        return;
      }
      status.textContent = attempt.deadline_at
        ? t('quizDeadline', { deadline: new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(attempt.deadline_at)) })
        : t('quizAttemptInProgress');
      content.innerHTML = `<form id="quiz-answer-form">${attempt.questions.map((question, index) => `<fieldset><legend>${index + 1}. ${e(question.prompt)} (${e(question.points)} ${t('quizPoints')})</legend>${question.choices.map(choice => `<label class="quiz-choice"><input type="checkbox" name="${e(question.id)}" value="${e(choice.key)}" ${question.selected_keys.includes(choice.key) ? 'checked' : ''}>${e(choice.text)}</label>`).join('')}</fieldset>`).join('')}<button type="submit">${t('quizSubmit')}</button></form>`;
      const answerForm = content.querySelector('#quiz-answer-form');
      const collectAnswers = () => attempt.questions.map(question => ({
        questionId: question.id,
        selectedKeys: [...answerForm.querySelectorAll('input:checked')]
          .filter(input => input.name === question.id)
          .map(input => input.value),
      }));
      let answerSave = Promise.resolve();
      answerForm.addEventListener('change', () => {
        const answers = collectAnswers();
        status.textContent = t('quizSavingAnswers');
        answerSave = answerSave
          .catch(() => {})
          .then(() => api(`/attempts/${attempt.id}/answers`, 'PUT', { answers }))
          .then(() => { status.textContent = t('quizAnswersSaved'); })
          .catch(error => { notify(error); status.textContent = t('quizAnswerSaveFailed'); });
      });
      answerForm.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = event.currentTarget.querySelector('button[type=submit]');
        submit.disabled = true;
        answerForm.querySelectorAll('input').forEach(input => { input.disabled = true; });
        try {
          await answerSave;
          const answers = collectAnswers();
          const result = await api(`/attempts/${attempt.id}/submit`, 'PUT', { answers });
          showResult({ ...result, remaining_attempts: attempt.remaining_attempts }, totalPoints);
          await loadResults();
        } catch (error) {
          notify(error);
          answerForm.querySelectorAll('input').forEach(input => { input.disabled = false; });
          if (error.code === 'QUIZ_DEADLINE_EXPIRED') {
            content.innerHTML = `<p role="alert">${e(error.message)}</p><button type="button" id="quiz-start-next">${t('quizStart')}</button>`;
            document.querySelector('#quiz-start-next').addEventListener('click', () => startAttempt().catch(notify));
            await loadResults();
          } else submit.disabled = false;
        }
      });
    };
    const startAttempt = async () => {
      const button = content.querySelector('button');
      if (button) button.disabled = true;
      status.textContent = t('quizStarting');
      try {
        const attempt = await api(`/quizzes/${l.quiz_id}/attempts`, 'POST');
        renderAttempt(attempt);
      } catch (error) {
        status.textContent = error.message;
        if (error.code === 'QUIZ_ATTEMPTS_EXHAUSTED') await loadResults();
        content.innerHTML = error.code === 'QUIZ_ATTEMPTS_EXHAUSTED'
          ? `<p role="status">${t('quizNoAttempts')}</p>`
          : `<button type="button" id="quiz-start">${t('quizRetryStart')}</button>`;
        document.querySelector('#quiz-start')?.addEventListener('click', () => startAttempt().catch(notify));
      }
    };
    loadResults().catch(notify);
    content.querySelector('#quiz-start').addEventListener('click', () => startAttempt().catch(notify));
  }
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
  const courses = await api(`/me/enrollments?displayLocale=${encodeURIComponent(locale)}`);
  const certificates = await api('/me/certificates');
  app.innerHTML = `<h1>${t('myLearningTitle')}</h1>${courses.length ? courses.map(c => `<article class="card"><h2>${c.course_withdrawn_at ? e(c.title) : `<a href="/courses/${e(c.slug)}">${e(c.title)}</a>`}</h2><p>${t('lessonsProgress', { completed: c.completed_lessons, required: c.required_lessons })}${c.completed_at ? ` · ${t('courseCompleted')}` : ''}${c.state === 'revoked' ? t('revokedAccess') : ''}${c.course_withdrawn_at ? ` · ${t('courseWithdrawnFromLearning')}` : ''}.</p><progress value="${c.completed_lessons}" max="${Math.max(1, c.required_lessons)}" aria-label="${t('courseProgressAria')}"></progress>${c.state !== 'revoked' && !c.course_withdrawn_at && !c.completed_at && c.continue_lesson_id ? `<p><a class="button" href="/lessons/${e(c.continue_lesson_id)}">${t('continueCourse')}</a></p>` : ''}</article>`).join('') : `<p>${t('nextLearningPrefix')}<a href="/courses">${t('coursesCatalog')}</a>.</p>`}<section class="learner-certificates"><h2>${t('myCertificatesTitle')}</h2>${certificates.length ? certificates.map(certificate => `<article class="card certificate-entry"><div><h3>${e(certificate.courseTitle)}</h3><p>${t(certificate.status === 'revoked' ? 'certificateStatusRevoked' : 'certificateStatusValid')} · ${t(`certificatePdf${certificate.pdfStatus}`)}</p><p>${t('certificateIssuedAt')}: <time datetime="${e(certificate.issuedAt)}">${e(new Date(certificate.issuedAt).toLocaleDateString(locale))}</time></p></div><div class="actions"><a href="${e(certificate.verificationPath)}">${t('certificateViewVerification')}</a>${certificate.downloadPath ? `<a class="button" href="${e(certificate.downloadPath)}">${t('certificateDownloadPdf')}</a>` : ''}</div></article>`).join('') : `<p>${t('myCertificatesEmpty')}</p>`}</section><section class="account-security"><h2>${t('accountSecurity')}</h2><form id="change-password"><label>${t('currentPassword')}<input name="currentPassword" type="password" autocomplete="current-password" required minlength="8" maxlength="128"></label><label>${t('newPassword')}<input name="newPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><label>${t('confirmPassword')}<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit">${t('changePassword')}</button></form></section>`;
  if (!me.verified_at) {
    const notice = document.createElement('section');
    const policy = document.createElement('p');
    policy.textContent = t('emailUnverifiedPolicy');
    const resend = document.createElement('button');
    resend.type = 'button';
    resend.className = 'secondary';
    resend.textContent = t('resendVerification');
    resend.addEventListener('click', async () => {
      resend.disabled = true;
      try {
        await api('/auth/resend-verification', 'POST', { email: me.email });
        policy.textContent = t('resendVerificationAccepted');
      } catch (error) {
        notify(error);
        resend.disabled = false;
      }
    });
    notice.append(policy, resend);
    app.insertBefore(notice, app.firstChild.nextSibling);
  }
  if (me.role === 'admin') {
    const host = document.createElement('section');
    host.className = 'account-profile admin-mfa-settings';
    app.querySelector('.account-security').append(host);
    try {
      await mountAdminMfa(host);
    } catch (error) {
      host.textContent = error.message || t('genericError');
    }
  }
    app.insertAdjacentHTML(
      'beforeend',
      `<section class="account-profile"><h2>${t('accountProfile')}</h2><form id="account-profile"><label>${t('displayName')}<input name="displayName" value="${e(me.display_name ?? '')}" maxlength="100" required></label><button type="submit">${t('saveProfile')}</button></form><h3>${t('emailChangeTitle')}</h3><p>${e(me.email)}</p><form id="change-email"><label>${t('emailChangeAddress')}<input name="email" type="email" maxlength="254" required></label><label>${t('emailChangePassword')}<input name="currentPassword" type="password" autocomplete="current-password" maxlength="128" required></label><button type="submit" class="secondary">${t('emailChangeAction')}</button></form></section>`,
    );
    bindForm('#change-email', async data => {
      await api('/auth/change-email', 'POST', Object.fromEntries(data));
      notify(t('emailChangeRequested'));
    });
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
  const context = { app, api, t, e, notify, me, locale };
  if (location.pathname === '/admin/categories') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountCategoryEditor(context);
  } else if (location.pathname === '/admin/users') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountAdminUsers(context);
  } else if (location.pathname === '/admin/orders') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountAdminOrders(context);
  } else if (location.pathname === '/admin/media') {
    await mountAdminMedia(context);
  } else if (location.pathname === '/admin/enrollments') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountAdminEnrollments(context);
  } else if (location.pathname === '/admin/certificates') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountAdminCertificates(context);
  } else if (location.pathname === '/admin/home') {
    if (me.role !== 'admin') throw new Error(t('adminAccessRestricted'));
    await mountHomeEditor(context);
  } else await mountStudio(context);
}
async function home() {
  const selection = await api(`/home?displayLocale=${encodeURIComponent(locale)}`);
  const hero = selection.hero[0];
  app.innerHTML = `<section class="hero"><p class="eyebrow">Maia Learn</p><h1>${hero ? e(hero.title) : t('heroTitle')}</h1>${hero ? coverImage(hero) : ''}<p>${hero ? e(hero.summary) : t('heroText')}</p>${hero ? `<a class="button" href="/courses/${e(hero.slug)}">${t('viewCourse')}</a>` : ''}</section>${['featured', 'recommended'].map(slot => (selection[slot].length ? `<section><h2>${t(slot === 'featured' ? 'homeFeatured' : 'homeRecommended')}</h2>${cards(selection[slot])}</section>` : '')).join('')}<a class="button" href="/courses">${t('allCourses')}</a>`;
}
async function instructor(slug) {
  const profile = await api(`/instructors/${encodeURIComponent(slug)}?displayLocale=${encodeURIComponent(locale)}`);
  app.innerHTML = `<a href="/courses">${t('backToCourses')}</a><h1>${e(profile.display_name)}</h1>${profile.bio ? `<div class="plain-content">${e(profile.bio)}</div>` : ''}${profile.website_url ? `<p><a href="${e(profile.website_url)}" target="_blank" rel="noopener noreferrer">${t('instructorProfileWebsiteLink')}</a></p>` : ''}<section><h2>${t('instructorCourses')}</h2>${cards(profile.courses)}</section>`;
}
async function certificateVerification(code) {
  app.innerHTML = `<section class="certificate-verification"><p class="eyebrow">${t('certificateVerificationEyebrow')}</p><h1>${t('certificateVerificationTitle')}</h1><p>${t('certificateVerificationIntro')}</p><div role="status" aria-live="polite">${t('loadingCourses')}</div></section>`;
  try {
    const certificate = await api(`/certificates/verify/${encodeURIComponent(code)}`);
    const valid = certificate.status === 'valid';
    app.innerHTML = `<section class="certificate-verification"><p class="eyebrow">${t('certificateVerificationEyebrow')}</p><h1>${t('certificateVerificationTitle')}</h1><p class="certificate-status ${valid ? 'is-valid' : 'is-revoked'}" role="status"><span aria-hidden="true">${valid ? '✓' : '!'}</span>${t(valid ? 'certificateStatusValid' : 'certificateStatusRevoked')}</p><dl class="certificate-facts"><div><dt>${t('certificateLearnerName')}</dt><dd>${e(certificate.learnerName)}</dd></div><div><dt>${t('certificateCourseTitle')}</dt><dd>${e(certificate.courseTitle)}</dd></div><div><dt>${t('certificateWorkload')}</dt><dd>${e(t('certificateWorkloadValue', { minutes: certificate.workloadMinutes }))}</dd></div><div><dt>${t('certificateIssuer')}</dt><dd>${e(certificate.issuerName)}</dd></div><div><dt>${t('certificateIssuedAt')}</dt><dd><time datetime="${e(certificate.issuedAt)}">${e(new Date(certificate.issuedAt).toLocaleString(locale))}</time></dd></div></dl></section>`;
  } catch (error) {
    app.innerHTML = `<section class="certificate-verification"><p class="eyebrow">${t('certificateVerificationEyebrow')}</p><h1>${t('certificateVerificationTitle')}</h1><p class="certificate-status is-revoked" role="status">${error.status === 404 ? t('certificateNotFound') : e(error.message)}</p></section>`;
  }
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
      `${['admin', 'author'].includes(me.role) ? `<a href="/admin">${t('administer')}</a><a href="/admin/media">${t('adminMediaTitle')}</a>` : ''}<a href="/my-orders">${t('myOrdersTitle')}</a>${me.role === 'admin' ? `<a href="/admin/orders">${t('adminOrdersTitle')}</a><a href="/admin/users">${t('adminUsersTitle')}</a><a href="/admin/enrollments">${t('adminEnrollmentsTitle')}</a><a href="/admin/certificates">${t('adminCertificatesTitle')}</a>` : ''}<button id="logout" class="secondary">${icon('signOut')}${t('signOut')}</button>`;
    button('#logout', async () => {
      await api('/auth/logout', 'POST');
      location.href = '/';
    });
  }
  const parts = location.pathname.split('/').filter(Boolean);
  if (location.pathname === '/auth/verify-email' || location.pathname === '/auth/confirm-email-change')
    mountEmailVerification({ app, api, t });
  else if (parts[0] === 'dev' && parts[1] === 'fake-checkout' && parts[2])
    await fakeCheckout(parts[2]);
  else if (parts[0] === 'auth') await auth(parts[1]);
  else if (parts[0] === 'courses' && parts[1]) await detail(parts[1]);
  else if (parts[0] === 'certificates' && parts[1] === 'verify' && parts[2])
    await certificateVerification(parts[2]);
  else if (parts[0] === 'instructors' && parts[1]) await instructor(parts[1]);
  else if (parts[0] === 'lessons') await lesson(parts[1]);
  else if (parts[0] === 'my-learning') await learning();
  else if (parts[0] === 'my-orders') await myOrders();
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
