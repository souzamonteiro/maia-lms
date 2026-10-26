let state;

export async function mountAdminPrivacy({ app, api, t, e, notify, locale, me }) {
  if (state?.userId !== me.id)
    state = { userId: me.id, offset: 0, filters: { q: '', status: '' }, notes: new Map() };
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminPrivacyTitle')}</h1><p>${t('adminPrivacyExplanation')}</p><form id="privacy-search" class="user-filters"><label>${t('adminPrivacySearch')}<input name="q" type="search" maxlength="100"></label><label>${t('adminUsersStatus')}<select name="status"><option value="">${t('adminPrivacyAll')}</option>${['OPEN', 'IN_REVIEW', 'CLOSED'].map(status => `<option value="${status}">${t(`privacyStatus${status}`)}</option>`).join('')}</select></label><button type="submit">${t('adminUsersSearchAction')}</button></form><p id="privacy-summary" role="status"></p><div id="privacy-list" aria-busy="true"></div><div class="actions"><button type="button" id="privacy-prev">${t('adminPrivacyPrevious')}</button><button type="button" id="privacy-next">${t('adminPrivacyNext')}</button></div>`;
  const search = app.querySelector('#privacy-search');
  const list = app.querySelector('#privacy-list');
  const previous = app.querySelector('#privacy-prev');
  const next = app.querySelector('#privacy-next');
  const summary = app.querySelector('#privacy-summary');
  summary.tabIndex = -1;
  search.elements.q.value = state.filters.q;
  search.elements.status.value = state.filters.status;
  let generation = 0;
  const date = value => e(new Date(value).toLocaleString(locale));

  async function load({ focusResults = false, focusRequestId } = {}) {
    const current = ++generation;
    previous.disabled = true;
    next.disabled = true;
    list.setAttribute('aria-busy', 'true');
    list.textContent = t('adminPrivacyLoading');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(state.offset) });
      if (state.filters.q) params.set('q', state.filters.q);
      if (state.filters.status) params.set('status', state.filters.status);
      const result = await api(`/admin/privacy/requests?${params}`);
      if (current !== generation) return;
      app.querySelector('#privacy-summary').textContent = t('adminPrivacyCount', { count: result.total });
      list.replaceChildren();
      if (!result.items.length) list.textContent = t('adminPrivacyEmpty');
      for (const request of result.items) {
        const card = document.createElement('article');
        card.className = 'card privacy-request';
        card.innerHTML = `<h2>${e(request.email)}</h2><p>${e(request.id)}</p><p>${t('privacyRequestReceived')} · ${t(`privacyStatus${request.status}`)} · ${date(request.created_at)}</p><details><summary>${t('adminPrivacyHistory')}</summary><div class="privacy-history"></div></details>${request.status !== 'CLOSED' ? `<form class="privacy-review"><label>${t('adminPrivacyNote')}<textarea name="note" minlength="5" maxlength="1000" required></textarea></label><button type="submit">${t('adminPrivacyReview')}</button></form>` : ''}`;
        const heading = card.querySelector('h2');
        heading.tabIndex = -1;
        const history = card.querySelector('details');
        const content = card.querySelector('.privacy-history');
        content.setAttribute('aria-live', 'polite');
        let historyLoading = false;
        async function loadHistory(focusAfterRetry = false) {
          if (historyLoading) return;
          historyLoading = true;
          content.setAttribute('aria-busy', 'true');
          content.textContent = t('adminPrivacyLoading');
          try {
            const result = await api(`/admin/privacy/requests/${request.id}/history`);
            content.innerHTML = result.items.length
              ? `<ol>${result.items.map(entry => `<li>${date(entry.occurred_at)} · ${e(entry.actor_id)}<p>${e(JSON.parse(entry.metadata).note)}</p></li>`).join('')}</ol>`
              : `<p>${t('adminPrivacyNoHistory')}</p>`;
            history.dataset.loaded = 'true';
            if (focusAfterRetry) history.querySelector('summary').focus();
          } catch (error) {
            content.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button">${t('retry')}</button>`;
            content.querySelector('button').addEventListener('click', () => {
              void loadHistory(true);
            });
            if (focusAfterRetry) content.querySelector('button').focus();
          } finally {
            historyLoading = false;
            content.setAttribute('aria-busy', 'false');
          }
        }
        history.addEventListener('toggle', () => {
          if (history.open && !history.dataset.loaded) void loadHistory();
        });
        const reviewForm = card.querySelector('form');
        if (reviewForm) {
          reviewForm.elements.note.value = state.notes.get(request.id) ?? '';
          reviewForm.elements.note.addEventListener('input', event => {
            state.notes.set(request.id, event.currentTarget.value);
          });
        }
        reviewForm?.addEventListener('submit', async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('button');
          const note = new FormData(form).get('note');
          submit.disabled = true;
          try {
            await api(`/admin/privacy/requests/${request.id}/review`, 'POST',
              { note });
            if (state.notes.get(request.id) === note) state.notes.delete(request.id);
            notify(t('adminPrivacySaved'));
            await load({ focusResults: true, focusRequestId: request.id });
          } catch (error) {
            notify(error);
          } finally {
            submit.disabled = false;
          }
        });
        list.append(card);
        if (focusRequestId === request.id) heading.dataset.reviewFocus = 'true';
      }
      previous.disabled = state.offset === 0;
      next.disabled = state.offset + result.limit >= result.total;
      if (focusResults)
        (list.querySelector('[data-review-focus]') ?? summary).focus();
    } catch (error) {
      if (current !== generation) return;
      app.querySelector('#privacy-summary').textContent = '';
      list.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button">${t('retry')}</button>`;
      const retry = list.querySelector('button');
      retry.addEventListener('click', () => { void load({ focusResults: true }); });
      if (focusResults) retry.focus();
    } finally {
      if (current === generation) list.setAttribute('aria-busy', 'false');
    }
  }
  search.addEventListener('submit', event => {
    event.preventDefault();
    state.filters = Object.fromEntries(new FormData(search));
    state.offset = 0;
    void load({ focusResults: true });
  });
  previous.addEventListener('click', () => { state.offset = Math.max(0, state.offset - 25); void load({ focusResults: true }); });
  next.addEventListener('click', () => { state.offset += 25; void load({ focusResults: true }); });
  await load();
}
