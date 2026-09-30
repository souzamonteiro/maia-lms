import { icon } from './icons.js';
let state;
export const categoriesDirty = () => Boolean(state?.dirty);
export async function mountCategoryEditor(ctx) {
  const { app, api, t, e, notify, me } = ctx;
  if (!state || state.userId !== me.id) state = { userId: me.id, dirty: false, value: {} };
  const items = await api('/admin/categories');
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('manageCategories')}</h1><p>${t('categoriesHelp')}</p><div id="category-list"></div><h2>${t(state.value.id ? 'editCategory' : 'newCategory')}</h2><form id="category-editor"><fieldset><label>${t('categoryName')}<input name="name" required maxlength="100" value="${e(state.value.name || '')}"></label><label>${t('categorySlug')}<input name="slug" required minlength="3" maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${e(state.value.slug || '')}"></label><label>${t('categoryDescription')}<textarea name="description" maxlength="1000">${e(state.value.description || '')}</textarea></label><div class="actions"><button type="submit">${icon('saveDraft')}${t('saveCategory')}</button><button type="button" id="new-category" class="secondary">${icon('add')}${t('newCategory')}</button></div></fieldset></form>`;
  const form = app.querySelector('#category-editor');
  form.oninput = () => {
    Object.assign(state.value, Object.fromEntries(new FormData(form)));
    state.dirty = true;
  };
  const replace = value => {
    if (state.dirty && !confirm(t('discardChanges'))) return;
    state = { userId: me.id, value, dirty: false };
    mountCategoryEditor(ctx).catch(notify);
  };
  app.querySelector('#new-category').onclick = () => replace({});
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `<h2>${e(item.name)}</h2><p class="plain-content">${e(item.description)}</p><small>${e(item.slug)}</small><div class="actions"><button class="edit secondary">${icon('edit')}${t('editCategory')}</button><button class="remove secondary" ${item.references_count ? 'disabled' : ''}>${icon('remove')}${t('deleteCategory')}</button></div>${item.references_count ? `<p>${t('CATEGORY_IN_USE')}</p>` : ''}`;
    card.querySelector('.edit').onclick = () => replace({ ...item });
    card.querySelector('.remove').onclick = async () => {
      if (!confirm(t('confirmDeleteCategory'))) return;
      try {
        await api(`/admin/categories/${item.id}`, 'DELETE', { expectedVersion: item.version });
        if (state.value.id === item.id) state = { userId: me.id, value: {}, dirty: false };
        await mountCategoryEditor(ctx);
      } catch (error) {
        notify(error);
      }
    };
    app.querySelector('#category-list').append(card);
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const sent = { ...state.value, ...Object.fromEntries(new FormData(form)) };
    form.querySelector('fieldset').disabled = true;
    try {
      const result = await api(
        sent.id ? `/admin/categories/${sent.id}` : '/admin/categories',
        sent.id ? 'PUT' : 'POST',
        { ...sent, expectedVersion: sent.version },
      );
      state = { userId: me.id, value: result, dirty: false };
      await mountCategoryEditor(ctx);
      notify(t('categorySaved'));
    } catch (error) {
      notify(error);
    } finally {
      form.querySelector('fieldset').disabled = false;
    }
  };
}
