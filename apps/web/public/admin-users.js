export async function mountAdminUsers({ app, api, t, e, notify }) {
  const state = { q: '', role: '', status: '', limit: 25, offset: 0 };
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminUsersTitle')}</h1><form id="user-filters" class="user-filters"><label>${t('adminUsersSearch')}<input name="q" type="search" maxlength="100" autocomplete="off"></label><label>${t('adminUsersRole')}<select name="role"><option value="">${t('adminUsersAllRoles')}</option><option value="learner">${t('roleLearner')}</option><option value="author">${t('roleAuthor')}</option><option value="admin">${t('roleAdmin')}</option><option value="worker">${t('roleWorker')}</option></select></label><label>${t('adminUsersStatus')}<select name="status"><option value="">${t('adminUsersAllStatuses')}</option><option value="active">${t('accountActive')}</option><option value="suspended">${t('accountSuspended')}</option></select></label><button type="submit">${t('adminUsersSearchAction')}</button></form><p id="users-summary" role="status" aria-live="polite"></p><div id="users-list" aria-busy="true"></div><nav id="users-pages" aria-label="${t('adminUsersPagination')}"></nav>`;

  const filterForm = app.querySelector('#user-filters');
  const list = app.querySelector('#users-list');
  const summary = app.querySelector('#users-summary');
  const pages = app.querySelector('#users-pages');
  for (const control of filterForm.elements) {
    if (control.name && state[control.name] !== undefined) control.value = state[control.name];
  }

  const roleLabel = role => t(`role${role[0].toUpperCase()}${role.slice(1)}`);
  const dateLabel = value => {
    if (!value) return t('valueUnavailable');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('valueUnavailable') : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  };

  async function load() {
    list.setAttribute('aria-busy', 'true');
    list.innerHTML = `<p>${t('adminUsersLoading')}</p>`;
    pages.replaceChildren();
    try {
      const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
      if (state.q) params.set('q', state.q);
      if (state.role) params.set('role', state.role);
      if (state.status) params.set('status', state.status);
      const result = await api(`/admin/users?${params}`);
      summary.textContent = t('adminUsersCount', { count: result.total });
      list.replaceChildren();
      if (!result.items.length) {
        list.innerHTML = `<p>${t('adminUsersEmpty')}</p>`;
      }
      for (const user of result.items) {
        const item = document.createElement('article');
        item.className = 'card user-list-item';
        item.innerHTML = `<h2>${e(user.display_name || user.email)}</h2><p>${e(user.email)}</p><dl><dt>${t('adminUsersRole')}</dt><dd>${e(roleLabel(user.role))}</dd><dt>${t('adminUsersStatus')}</dt><dd>${e(user.status === 'active' ? t('accountActive') : t('accountSuspended'))}</dd><dt>${t('adminUsersLocale')}</dt><dd>${e(user.locale || t('valueUnavailable'))}</dd><dt>${t('adminUsersVerified')}</dt><dd>${e(user.verified_at ? dateLabel(user.verified_at) : t('adminUsersNotVerified'))}</dd><dt>${t('adminUsersCreated')}</dt><dd>${e(dateLabel(user.created_at))}</dd></dl><div class="actions"><form class="user-role-form"><label>${t('adminUsersChangeRole')}<select name="role"><option value="learner" ${user.role === 'learner' ? 'selected' : ''}>${t('roleLearner')}</option><option value="author" ${user.role === 'author' ? 'selected' : ''}>${t('roleAuthor')}</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>${t('roleAdmin')}</option></select></label><button type="submit" class="secondary">${t('adminUsersSaveRole')}</button></form><button type="button" class="${user.status === 'active' ? 'secondary' : ''}" data-user-id="${e(user.id)}" data-next-status="${user.status === 'active' ? 'suspended' : 'active'}">${user.status === 'active' ? t('adminUsersSuspend') : t('adminUsersReactivate')}</button></div>`;
        const roleForm = item.querySelector('.user-role-form');
        roleForm.addEventListener('submit', async event => {
          event.preventDefault();
          const role = new FormData(roleForm).get('role');
          if (role === user.role) return;
          if (!confirm(t('adminUsersConfirmRoleChange', { role: roleLabel(role) }))) return;
          const submit = roleForm.querySelector('button[type=submit]');
          submit.disabled = true;
          try {
            await api(`/admin/users/${user.id}/role`, 'PATCH', { role });
            await load();
            notify(t('adminUsersRoleChanged'));
          } catch (error) {
            notify(error);
          } finally {
            submit.disabled = false;
          }
        });
        item.querySelector('[data-user-id]').addEventListener('click', async event => {
          const button = event.currentTarget;
          const nextStatus = button.dataset.nextStatus;
          const confirmation = nextStatus === 'suspended' ? t('adminUsersConfirmSuspend') : t('adminUsersConfirmReactivate');
          if (!confirm(confirmation)) return;
          button.disabled = true;
          try {
            await api(`/admin/users/${button.dataset.userId}/status`, 'PATCH', { status: nextStatus });
            await load();
            notify(t(nextStatus === 'suspended' ? 'adminUsersSuspended' : 'adminUsersReactivated'));
          } catch (error) {
            notify(error);
          } finally {
            button.disabled = false;
          }
        });
        list.append(item);
      }
      const currentPage = Math.floor(state.offset / state.limit) + 1;
      const pageCount = Math.max(1, Math.ceil(result.total / state.limit));
      pages.innerHTML = `<div class="actions"><button type="button" class="secondary" data-page="previous" ${state.offset === 0 ? 'disabled' : ''}>${t('previousPage')}</button><span>${t('adminUsersPage', { page: currentPage, pages: pageCount })}</span><button type="button" class="secondary" data-page="next" ${state.offset + state.limit >= result.total ? 'disabled' : ''}>${t('nextPage')}</button></div>`;
      pages.querySelector('[data-page="previous"]').addEventListener('click', () => {
        state.offset = Math.max(0, state.offset - state.limit);
        load().catch(notify);
      });
      pages.querySelector('[data-page="next"]').addEventListener('click', () => {
        state.offset += state.limit;
        load().catch(notify);
      });
    } catch (error) {
      summary.textContent = '';
      list.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button" id="retry-users">${t('retry')}</button>`;
      list.querySelector('#retry-users').addEventListener('click', () => load().catch(notify));
    } finally {
      list.setAttribute('aria-busy', 'false');
    }
  }

  filterForm.addEventListener('submit', event => {
    event.preventDefault();
    Object.assign(state, Object.fromEntries(new FormData(filterForm)));
    state.offset = 0;
    load().catch(notify);
  });
  await load();
}
