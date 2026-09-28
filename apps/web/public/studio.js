import { mountVideoEditor } from './video-editor.js';
import { icon, iconButton } from './icons.js';
// Author studio. Draft recovery is scoped to the signed-in account.
let state;
let timer;
let pending;
let context;
const emptyLesson = () => ({
  title: '',
  body: '',
  contentFormat: 'markdown',
  required: true,
  preview: false,
});
const emptyCourse = () => ({
  slug: '',
  title: '',
  summary: '',
  accessMode: 'ENROLLED_FREE',
  locale: 'en',
  modules: [{ title: '', lessons: [emptyLesson()] }],
});
const key = id => `maia-lms:author-draft:${id}`;
export const studioDirty = () => Boolean(state?.dirty || pending);
function persist() {
  try {
    if (state.dirty) localStorage.setItem(key(state.userId), JSON.stringify(state));
    else localStorage.removeItem(key(state.userId));
    return true;
  } catch {
    status('localDraftUnavailable');
    return false;
  }
}
function status(name) {
  const node = document.querySelector('#save-status');
  if (node) node.textContent = context.t(name);
}
function changed() {
  state.dirty = true;
  const recovered = persist();
  clearTimeout(timer);
  status(recovered ? 'savedLocally' : 'localDraftUnavailable');
  if (state.id && !state.conflict)
    timer = setTimeout(() => save(false).catch(context.notify), 1600);
}
function readForm() {
  const form = document.querySelector('#editor');
  if (!form) return;
  state.payload = {
    ...Object.fromEntries(new FormData(form)),
    modules: [...form.querySelectorAll('.module-editor')].map(m => ({
      title: m.querySelector('.module-title').value,
      lessons: [...m.querySelectorAll('.lesson-editor')].map(l => ({
        title: l.querySelector('.lesson-title').value,
        body: l.querySelector('.lesson-content').value,
        videoId: l.dataset.videoId || null,
        contentFormat: l.querySelector('.lesson-format').value,
        required: l.querySelector('.lesson-required').checked,
        preview: l.querySelector('.lesson-preview').checked,
      })),
    })),
  };
}
async function save(manual) {
  clearTimeout(timer);
  if (pending) {
    await pending;
    if (state.dirty && manual) return save(true);
    return;
  }
  const form = document.querySelector('#editor');
  if (!form?.checkValidity()) {
    if (manual) form?.reportValidity();
    return;
  }
  if (state.conflict) {
    status('DRAFT_CONFLICT');
    return;
  }
  readForm();
  if (!state.payload.modules.length || state.payload.modules.some(m => !m.lessons.length)) {
    status('needLessons');
    return;
  }
  const sent = JSON.stringify(state.payload);
  status('saving');
  pending = (async () => {
    try {
      const result = await context.api(
        `/admin/courses${state.id ? `/${state.id}` : ''}`,
        state.id ? 'PUT' : 'POST',
        {
          ...state.payload,
          ...(state.id
            ? { expectedRevisionId: state.revisionId }
            : { creationId: state.creationId }),
        },
      );
      state.id = result.id;
      state.revisionId = result.current_revision_id;
      const reload = document.querySelector('#reload-course');
      if (reload) reload.hidden = false;
      const title = document.querySelector('#editor-title');
      if (title) title.textContent = context.t('editCourseTitle');
      state.dirty = JSON.stringify(state.payload) !== sent;
      persist();
      await refreshList();
      status(state.dirty ? 'savedLocally' : 'draftSaved');
    } catch (error) {
      if (error.code === 'CREATION_EXISTS') {
        const existing = await context.api(`/admin/courses/${state.creationId}`);
        state.id = existing.id;
        state.revisionId = existing.current_revision_id;
      }
      if (error.status === 409 && error.code !== 'CREATION_EXISTS') state.conflict = true;
      state.dirty = true;
      persist();
      status(state.conflict ? 'DRAFT_CONFLICT' : 'saveFailed');
      if (manual) context.notify(error);
    }
  })();
  try {
    await pending;
  } finally {
    pending = null;
  }
  if (state.dirty && !state.conflict && JSON.stringify(state.payload) !== sent) changed();
}
function move(field, direction) {
  const sibling = direction < 0 ? field.previousElementSibling : field.nextElementSibling;
  if (!sibling) return;
  if (direction < 0) sibling.before(field);
  else sibling.after(field);
  field.querySelector('input')?.focus();
  readForm();
  changed();
}
function controls(field, kind) {
  const { t } = context;
  for (const [name, direction] of [
    ['moveUp', -1],
    ['moveDown', 1],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    iconButton(button, name, t(name), true);
    button.onclick = () => move(field, direction);
    field.querySelector(':scope > .row-controls').append(button);
  }
  const duplicate = document.createElement('button');
  duplicate.type = 'button';
  duplicate.className = 'secondary';
  iconButton(duplicate, 'duplicate', t('duplicate'), true);
  duplicate.onclick = () => {
    readForm();
    const index = [...field.parentElement.children].indexOf(field);
    if (kind === 'module') {
      const copy = structuredClone(state.payload.modules[index]);
      const next = moduleField(copy);
      field.after(next);
    } else {
      const module = field.closest('.module-editor');
      const mi = [...module.parentElement.children].indexOf(module);
      const next = lessonField(structuredClone(state.payload.modules[mi].lessons[index]));
      field.after(next);
    }
    readForm();
    changed();
  };
  field.querySelector(':scope > .row-controls').append(duplicate);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary';
  iconButton(remove, 'remove', t(kind === 'module' ? 'removeModule' : 'removeLesson'), true);
  remove.onclick = () => {
    if (!confirm(t('confirmRemove'))) return;
    field.remove();
    readForm();
    changed();
  };
  field.querySelector(':scope > .row-controls').append(remove);
}
function lessonField(lesson) {
  const { t, e, api, notify } = context;
  const field = document.createElement('fieldset');
  field.className = 'lesson-editor';
  field.innerHTML = `<legend>${t('lessonLegend')}</legend><label>${t('lessonTitleLabel')}<input class="lesson-title" required maxlength="200" value="${e(lesson.title)}"></label><label>${t('contentFormat')}<select class="lesson-format"><option value="markdown">Markdown</option><option value="plain">${t('plainText')}</option></select></label><div class="markdown-toolbar actions" role="group" aria-label="${t('formatting')}"></div><label>${t('lessonContentLabel')}<textarea class="lesson-content" maxlength="100000">${e(lesson.body)}</textarea></label><p class="muted">${t('markdownHelp')}</p><button type="button" class="preview-button secondary">${icon('previewContent')}${t('previewContent')}</button><div class="content-preview prose" aria-live="polite" hidden></div><label><input class="lesson-required" type="checkbox" ${lesson.required ? 'checked' : ''}>${t('requiredLabel')}</label><label><input class="lesson-preview" type="checkbox" ${lesson.preview ? 'checked' : ''}>${t('previewLabel')}</label><div class="row-controls actions"></div>`;
  const area = field.querySelector('textarea'),
    format = field.querySelector('.lesson-format');
  format.value = lesson.contentFormat;
  field.dataset.videoId = lesson.videoId || '';
  const videoRoot = document.createElement('section');
  videoRoot.className = 'video-editor';
  field.querySelector('.row-controls').before(videoRoot);
  mountVideoEditor(videoRoot, {
    ...context,
    courseId: state.id,
    videoId: lesson.videoId,
    onChange: id => {
      field.dataset.videoId = id || '';
      readForm();
      changed();
    },
  });
  const tools = [
    ['heading', '## ', ''],
    ['bold', '**', '**'],
    ['italic', '*', '*'],
    ['list', '\n- ', ''],
    ['numberedList', '\n1. ', ''],
    ['quote', '\n> ', ''],
    ['code', '\n```\n', '\n```\n'],
    ['link', '[', '](https://example.com)'],
    ['image', '![', '](/static/image.png)'],
    ['table', '\n| A | B |\n| --- | --- |\n| ', ' | |\n'],
  ];
  for (const [name, start, end] of tools) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    iconButton(button, name, t(name), true);
    button.onclick = () => {
      if (format.value !== 'markdown') {
        notify(t('chooseMarkdown'));
        return;
      }
      const from = area.selectionStart,
        to = area.selectionEnd;
      const text = area.value.slice(from, to) || t(name);
      area.setRangeText(start + text + end, from, to, 'select');
      area.focus();
      area.dispatchEvent(new Event('input', { bubbles: true }));
    };
    field.querySelector('.markdown-toolbar').append(button);
  }
  field.querySelector('.preview-button').onclick = async () => {
    const button = field.querySelector('.preview-button');
    button.disabled = true;
    try {
      const result = await api('/admin/content/preview', 'POST', {
        body: area.value,
        contentFormat: format.value,
      });
      const preview = field.querySelector('.content-preview');
      preview.innerHTML = result.html;
      preview.hidden = false;
    } catch (error) {
      notify(error);
    } finally {
      button.disabled = false;
    }
  };
  controls(field, 'lesson');
  return field;
}
function moduleField(module) {
  const { t, e } = context;
  const field = document.createElement('fieldset');
  field.className = 'module-editor';
  field.innerHTML = `<legend>${t('moduleLegend')}</legend><label>${t('moduleTitleLabel')}<input class="module-title" required maxlength="200" value="${e(module.title)}"></label><div class="lessons"></div><button type="button" class="add-lesson secondary">${icon('add')}${t('addLesson')}</button><div class="row-controls actions"></div>`;
  for (const lesson of module.lessons) field.querySelector('.lessons').append(lessonField(lesson));
  field.querySelector('.add-lesson').onclick = () => {
    field.querySelector('.lessons').append(lessonField(emptyLesson()));
    readForm();
    changed();
  };
  controls(field, 'module');
  return field;
}
async function refreshList() {
  const { api, t, e, me } = context;
  const courses = await api('/admin/courses');
  const list = document.querySelector('#admin-list');
  if (!list) return;
  list.innerHTML = courses
    .map(
      c =>
        `<article class="card"><h2>${e(c.title)}</h2><p>${e(c.status)}${c.published_revision_id && c.current_revision_id !== c.published_revision_id ? ` · ${t('unpublishedChanges')}` : ''}</p><div class="actions"><button data-edit="${c.id}">${icon('edit')}${t('edit')}</button>${me.role === 'admin' ? `<button data-publish="${c.id}" data-revision="${c.current_revision_id}">${icon('publish')}${t('publish')}</button><button data-archive="${c.id}" class="secondary">${icon('archive')}${t('archive')}</button>` : ''}<a href="/courses/${c.id}">${t('view')}</a></div></article>`,
    )
    .join('');
}
function blank() {
  return {
    userId: context.me.id,
    id: null,
    creationId: crypto.randomUUID(),
    revisionId: null,
    payload: emptyCourse(),
    dirty: false,
    conflict: false,
  };
}
function fromCourse(c) {
  return {
    userId: context.me.id,
    id: c.id,
    revisionId: c.current_revision_id,
    dirty: false,
    conflict: false,
    payload: {
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      accessMode: c.access_mode,
      locale: c.locale,
      modules: c.modules.map(m => ({
        title: m.title,
        lessons: m.lessons.map(l => ({
          title: l.title,
          body: l.body,
          videoId: l.video_id,
          contentFormat: l.content_format,
          required: Boolean(l.is_required),
          preview: Boolean(l.is_preview),
        })),
      })),
    },
  };
}
export async function mountStudio(ctx) {
  clearTimeout(timer);
  if (pending) await pending;
  context = ctx;
  const { app, t, me, notify, api } = ctx;
  if (!state || state.userId !== me.id) {
    state = blank();
    try {
      const cached = JSON.parse(localStorage.getItem(key(me.id)) || 'null');
      if (cached?.userId === me.id && cached.payload?.modules && cached.dirty) state = cached;
    } catch {
      /* Invalid local data is ignored. */
    }
  }
  app.innerHTML = `<h1>${t('adminPublishTitle')}</h1><p>${t('studioDescription')}</p>${me.role === 'admin' ? `<a href="/admin/home">${t('editHome')}</a>` : ''}<div id="admin-list"></div><h2 id="editor-title">${state.id ? t('editCourseTitle') : t('newCourseTitle')}</h2><div class="actions"><button type="button" id="new-course" class="secondary">${icon('add')}${t('newCourseTitle')}</button><button type="button" id="reload-course" class="secondary" ${state.id ? '' : 'hidden'}>${icon('reloadDraft')}${t('reloadDraft')}</button></div><form id="editor"><label>${t('title')}<input name="title" required minlength="3" maxlength="255"></label><label>${t('courseSlugLabel')}<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="100"></label><label>${t('summary')}<textarea name="summary" required minlength="10" maxlength="1000"></textarea></label><label>${t('access')}<select name="accessMode" aria-label="${t('access')}"><option value="OPEN_FREE">${t('accessOpenOption')}</option><option value="ENROLLED_FREE">${t('accessEnrolledOption')}</option></select></label><label>${t('courseLanguage')}<select name="locale"><option value="en">English</option><option value="pt-BR">Português</option><option value="es">Español</option></select></label><div id="modules"></div><div class="actions"><button type="button" id="add-module" class="secondary">${icon('add')}${t('addModule')}</button><button type="submit">${icon('saveDraft')}${t('saveDraft')}</button></div><p id="save-status" role="status" aria-live="polite"></p></form>`;
  const form = document.querySelector('#editor');
  for (const name of ['title', 'slug', 'summary', 'accessMode', 'locale'])
    form.elements[name].value = state.payload[name];
  for (const module of state.payload.modules)
    document.querySelector('#modules').append(moduleField(module));
  form.oninput = () => {
    readForm();
    changed();
  };
  form.onchange = () => {
    const previous = JSON.stringify(state.payload);
    readForm();
    if (JSON.stringify(state.payload) !== previous) changed();
  };
  form.onsubmit = event => {
    event.preventDefault();
    save(true).catch(notify);
  };
  document.querySelector('#add-module').onclick = () => {
    document.querySelector('#modules').append(moduleField({ title: '', lessons: [emptyLesson()] }));
    readForm();
    changed();
  };
  document.querySelector('#new-course').onclick = async () => {
    if (pending) await pending;
    if (state.dirty && !confirm(t('discardChanges'))) return;
    state.dirty = false;
    persist();
    state = blank();
    await mountStudio(ctx);
  };
  const reload = document.querySelector('#reload-course');
  if (reload)
    reload.onclick = async () => {
      if (!confirm(t('discardChanges'))) return;
      try {
        if (pending) await pending;
        const fresh = await api(`/admin/courses/${state.id}`);
        state = fromCourse(fresh);
        persist();
        await mountStudio(ctx);
      } catch (error) {
        notify(error);
      }
    };
  document.querySelector('#admin-list').onclick = async event => {
    const target = event.target.closest('button');
    if (!target) return;
    try {
      if (pending) await pending;
      if (target.dataset.edit) {
        if (state.dirty && !confirm(t('discardChanges'))) return;
        const fresh = await api(`/admin/courses/${target.dataset.edit}`);
        state = fromCourse(fresh);
        persist();
        await mountStudio(ctx);
        document.querySelector('#editor').scrollIntoView();
      } else if (target.dataset.publish || target.dataset.archive) {
        if (state.dirty) {
          notify(t('saveBeforePublish'));
          return;
        }
        const id = target.dataset.publish || target.dataset.archive;
        await api(
          `/admin/courses/${id}/${target.dataset.publish ? 'publish' : 'archive'}`,
          'POST',
          { expectedRevisionId: state.id === id ? state.revisionId : target.dataset.revision },
        );
        await refreshList();
      }
    } catch (error) {
      notify(error);
    }
  };
  if (state.dirty) status(state.conflict ? 'DRAFT_CONFLICT' : 'restoredDraft');
  await refreshList();
}
