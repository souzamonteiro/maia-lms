import { icon } from './icons.js';
let state;
export const homeDirty = () => Boolean(state?.dirty);
export async function mountHomeEditor({ app, api, t, e, notify, me }) {
  if (!state || state.userId !== me.id || !state.dirty)
    state = { ...(await api('/admin/home')), userId: me.id, dirty: false };
  const courses = await api('/admin/courses');
  const available = courses.filter(c => c.status === 'PUBLISHED' && c.published_revision_id);
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('editHome')}</h1><p>${t('homeEditorHelp')}</p><form id="home-editor"><div id="placements"></div><div class="actions"><button type="button" id="add-placement" class="secondary">${icon('add')}${t('addPlacement')}</button><button type="submit">${icon('saveDraft')}${t('saveHome')}</button></div><p role="status" id="home-status"></p></form>`;
  const localDate = value => {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const read = () => {
    state.dirty = true;
    state.items = [...document.querySelectorAll('.placement')].map(field => ({
      courseId: field.querySelector('.placement-course').value,
      slot: field.querySelector('.placement-slot').value,
      priority: Number(field.querySelector('.placement-order').value),
      startsAt: field.querySelector('.placement-start').value
        ? new Date(field.querySelector('.placement-start').value).toISOString()
        : null,
      endsAt: field.querySelector('.placement-end').value
        ? new Date(field.querySelector('.placement-end').value).toISOString()
        : null,
    }));
  };
  const add = item => {
    const field = document.createElement('fieldset');
    field.className = 'placement';
    field.innerHTML = `<legend>${t('placement')}</legend><label>${t('course')}<select class="placement-course" required><option value="">${t('chooseCourse')}</option>${available.map(c => `<option value="${c.id}">${e(c.title)}</option>`).join('')}${item?.courseId && !available.some(c => c.id === item.courseId) ? `<option value="${e(item.courseId)}">${t('unavailableCourse')}</option>` : ''}</select></label><label>${t('homeSection')}<select class="placement-slot"><option value="hero">${t('homeHero')}</option><option value="featured">${t('homeFeatured')}</option><option value="recommended">${t('homeRecommended')}</option></select></label><label>${t('order')}<input class="placement-order" type="number" min="0" max="1000" required value="${item?.priority ?? 0}"></label><label>${t('startsAt')}<input class="placement-start" type="datetime-local" required value="${localDate(item?.startsAt || new Date().toISOString())}"></label><label>${t('endsAt')}<input class="placement-end" type="datetime-local" value="${localDate(item?.endsAt)}"></label><button type="button" class="remove secondary">${icon('remove')}${t('removePlacement')}</button>`;
    field.querySelector('.placement-course').value = item?.courseId || '';
    field.querySelector('.placement-slot').value = item?.slot || 'featured';
    field.querySelector('.remove').onclick = () => {
      field.remove();
      read();
    };
    document.querySelector('#placements').append(field);
  };
  for (const item of state.items) add(item);
  document.querySelector('#add-placement').onclick = () => {
    add();
    read();
  };
  const form = document.querySelector('#home-editor');
  form.oninput = read;
  form.onchange = read;
  form.onsubmit = async event => {
    event.preventDefault();
    read();
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const sent = JSON.stringify(state.items);
      const result = await api('/admin/home', 'PUT', {
        expectedVersion: state.version,
        items: state.items,
      });
      state.version = result.version;
      state.dirty = JSON.stringify(state.items) !== sent;
      document.querySelector('#home-status').textContent = t('homeSaved');
    } catch (error) {
      notify(error);
    } finally {
      button.disabled = false;
    }
  };
}
