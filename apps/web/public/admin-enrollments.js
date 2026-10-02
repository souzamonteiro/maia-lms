export async function mountAdminEnrollments({ app, api, t, e, notify }) {
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminEnrollmentsTitle')}</h1><section><h2>${t('adminEnrollmentGrantTitle')}</h2><form id="enrollment-grant"><label>${t('adminEnrollmentEmail')}<input name="email" type="email" maxlength="254" required></label><label>${t('adminEnrollmentCourse')}<input name="courseSlug" maxlength="100" required></label><label>${t('adminEnrollmentReason')}<textarea name="reason" minlength="5" maxlength="1000" required></textarea></label><button type="submit">${t('adminEnrollmentGrantAction')}</button></form></section><section><h2>${t('adminEnrollmentListTitle')}</h2><form id="enrollment-search" class="user-filters"><label>${t('adminEnrollmentSearch')}<input name="q" type="search" maxlength="100"></label><label>${t('adminUsersStatus')}<select name="state"><option value="">${t('adminEnrollmentAllStates')}</option><option value="active">${t('adminEnrollmentActive')}</option><option value="revoked">${t('adminEnrollmentRevoked')}</option></select></label><button type="submit">${t('adminUsersSearchAction')}</button></form><p id="enrollment-summary" role="status" aria-live="polite"></p><div id="enrollment-list" aria-busy="true"></div></section>`;

  const search = app.querySelector('#enrollment-search');
  const list = app.querySelector('#enrollment-list');
  const summary = app.querySelector('#enrollment-summary');
  const dateLabel = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('valueUnavailable') : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  };

  async function load() {
    list.setAttribute('aria-busy', 'true');
    list.innerHTML = `<p>${t('adminEnrollmentsLoading')}</p>`;
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      const values = new FormData(search);
      if (values.get('q')) params.set('q', values.get('q'));
      if (values.get('state')) params.set('state', values.get('state'));
      const result = await api(`/admin/enrollments?${params}`);
      summary.textContent = t('adminEnrollmentsCount', { count: result.total });
      list.replaceChildren();
      if (!result.items.length) list.innerHTML = `<p>${t('adminEnrollmentsEmpty')}</p>`;
      for (const enrollment of result.items) {
        const item = document.createElement('article');
        item.className = 'card admin-enrollment';
        item.innerHTML = `<h3><a href="/courses/${e(enrollment.course_slug)}">${e(enrollment.course_title)}</a></h3><p>${e(enrollment.email)} · ${e(enrollment.course_slug)}</p><p>${t('adminEnrollmentProgress', { completed: enrollment.completed_lessons, required: enrollment.required_lessons })}</p><p>${t('adminUsersStatus')}: ${e(enrollment.state === 'active' ? t('adminEnrollmentActive') : t('adminEnrollmentRevoked'))} · ${t('adminEnrollmentAccess')}: ${enrollment.has_entitlement ? t('adminEnrollmentYes') : t('adminEnrollmentNo')}</p><p>${t('adminEnrollmentSince')}: ${e(dateLabel(enrollment.enrolled_at))}</p><div class="actions">${enrollment.state === 'active' ? `<button type="button" class="secondary" data-revoke>${t('adminEnrollmentRevokeAction')}</button>` : ''}<details><summary>${t('adminEnrollmentHistory')}</summary><div class="enrollment-history">${t('adminEnrollmentsLoading')}</div></details></div>`;
        item.querySelector('[data-revoke]')?.addEventListener('click', async event => {
          const reason = prompt(t('adminEnrollmentRevokePrompt'));
          if (reason === null) return;
          if (reason.trim().length < 5) {
            notify(t('adminEnrollmentReasonInvalid'));
            return;
          }
          event.currentTarget.disabled = true;
          try {
            await api(`/admin/enrollments/${enrollment.id}/revoke`, 'PATCH', { reason });
            notify(t('adminEnrollmentRevokedNotice'));
            await load();
          } catch (error) {
            notify(error);
            event.currentTarget.disabled = false;
          }
        });
        const history = item.querySelector('details');
        history.addEventListener('toggle', async () => {
          if (!history.open || history.dataset.loaded) return;
          const content = history.querySelector('.enrollment-history');
          try {
            const result = await api(`/admin/enrollments/${enrollment.id}/history`);
            content.innerHTML = result.items.length
              ? `<ol>${result.items.map(entry => {
                  let metadata = {};
                  try { metadata = JSON.parse(entry.metadata); } catch {}
                  return `<li><strong>${e(t(entry.action === 'enrollment.grant' ? 'adminEnrollmentGrantedEvent' : 'adminEnrollmentRevokedEvent'))}</strong> · ${e(dateLabel(entry.occurred_at))}<p>${e(metadata.reason || '')}</p></li>`;
                }).join('')}</ol>`
              : `<p>${t('adminEnrollmentNoHistory')}</p>`;
            history.dataset.loaded = 'true';
          } catch (error) {
            content.textContent = error.message || t('genericError');
          }
        });
        list.append(item);
      }
    } catch (error) {
      summary.textContent = '';
      list.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button" id="retry-enrollments">${t('retry')}</button>`;
      list.querySelector('#retry-enrollments').addEventListener('click', () => load().catch(notify));
    } finally {
      list.setAttribute('aria-busy', 'false');
    }
  }

  app.querySelector('#enrollment-grant').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await api('/admin/enrollments/grant', 'POST', Object.fromEntries(new FormData(form)));
      form.reset();
      notify(t('adminEnrollmentGrantedNotice'));
      await load();
    } catch (error) {
      notify(error);
    } finally {
      button.disabled = false;
    }
  });
  search.addEventListener('submit', event => {
    event.preventDefault();
    load().catch(notify);
  });
  await load();
}