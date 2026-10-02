import { draftChanges } from './draft-changes.js';
import { showCoursePreview } from './course-preview.js';
import { mountStudioLayout, enableStudioDrag } from './studio-layout.js';
import { mountAttachments, readAttachments } from './attachment-editor.js';
import { mountVideoEditor } from './video-editor.js';
import { icon, iconButton } from './icons.js';
// Author studio. Draft recovery is scoped to the signed-in account.
let state;
let timer;
let pending;
let context;
let refreshLayout;
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
  refreshLayout?.();
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
    categoryIds: [...form.querySelectorAll('[name=categoryId]:checked')]
      .map(input => input.value)
      .sort(),
    level: form.elements.level.value || null,
    durationMinutes: form.elements.durationMinutes.value
      ? Number(form.elements.durationMinutes.value)
      : null,
    trailerVideoId: form.querySelector('#course-trailer').dataset.videoId || null,
    coverFileId: form.querySelector('#course-cover').dataset.fileId || null,
    attachments: readAttachments(document.querySelector('#course-attachments')),
    modules: [...form.querySelectorAll('.module-editor')].map(m => ({
      title: m.querySelector('.module-title').value,
      lessons: [...m.querySelectorAll('.lesson-editor')].map(l => ({
        title: l.querySelector('.lesson-title').value,
        body: l.querySelector('.lesson-content').value,
        videoId: l.dataset.videoId || null,
        captions: [...l.querySelectorAll('.caption-row')]
          .filter(r => r.querySelector('textarea').value.trim())
          .map(r => ({
            language: r.dataset.language,
            label: r.querySelector('input').value,
            vtt: r.querySelector('textarea').value,
          })),
        attachments: readAttachments(l.querySelector(':scope > .lesson-attachments')),
        contentFormat: l.querySelector('.lesson-format').value,
        required: l.querySelector('.lesson-required').checked,
        preview: l.querySelector('.lesson-preview').checked,
      })),
    })),
  };
  delete state.payload.categoryId;
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
  const changes = state.id ? draftChanges(state.savedPayload, state.payload) : null;
  if (changes?.length === 0) {
    state.dirty = false;
    persist();
    status('draftSaved');
    return;
  }
  status('saving');
  pending = (async () => {
    try {
      const result = await context.api(
        `/admin/courses${state.id ? `/${state.id}` : ''}`,
        state.id ? (changes ? 'PATCH' : 'PUT') : 'POST',
        {
          ...(changes ? { changes } : state.payload),
          ...(state.id
            ? { expectedRevisionId: state.revisionId }
            : { creationId: state.creationId }),
        },
      );
      state.savedPayload = JSON.parse(sent);
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
  enableStudioDrag(field, {
    t,
    onMove: () => {
      readForm();
      changed();
    },
  });
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
  const attachmentRoot = document.createElement('section');
  attachmentRoot.className = 'lesson-attachments';
  field.querySelector(':scope > .row-controls').before(attachmentRoot);
  mountAttachments(attachmentRoot, lesson.attachments || [], {
    ...context,
    courseId: state.id,
    onChange: () => {
      readForm();
      changed();
    },
  });
  const captions = document.createElement('details');
  captions.innerHTML = `<summary>${t('captions')}</summary><p>${t('captionHelp')}</p>`;
  for (const [language, label] of [
    ['en', 'English'],
    ['pt-BR', 'Português'],
    ['es', 'Español'],
  ]) {
    const track = (lesson.captions || []).find(c => c.language === language);
    const row = document.createElement('fieldset');
    row.className = 'caption-row';
    row.dataset.language = language;
    row.innerHTML = `<legend>${label}</legend><label>${t('captionLabel')}<input maxlength="80" value="${e(track?.label || label)}"></label><label>${t('captionFile')}<input type="file" accept=".vtt,text/vtt" class="caption-file"></label><label>WebVTT<textarea maxlength="100000">${e(track?.vtt || '')}</textarea></label>`;
    row.querySelector('.caption-file').onchange = async event => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 100000) {
        notify(t('captionTooLarge'));
        return;
      }
      try {
        row.querySelector('textarea').value = await file.text();
        readForm();
        changed();
      } catch (error) {
        notify(error);
      }
    };
    captions.append(row);
  }
  field.querySelector(':scope > .row-controls').before(captions);
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
        `<article class="card"><h2>${e(c.title)}</h2><p>${e(c.status)}${c.published_revision_id && c.current_revision_id !== c.published_revision_id ? ` · ${t('unpublishedChanges')}` : ''}</p><div class="actions"><button data-edit="${c.id}">${icon('edit')}${t('edit')}</button>${me.role === 'admin' ? `<button data-publish="${c.id}" data-revision="${c.current_revision_id}">${icon('publish')}${t('publish')}</button><button data-archive="${c.id}" class="secondary">${icon('archive')}${t('archive')}</button>` : c.status === 'DRAFT' ? `<button data-review="${c.id}" data-revision="${c.current_revision_id}">${icon('publish')}${t('submitForReview')}</button>` : ''}<a href="/courses/${c.id}">${t('view')}</a></div></article>`,
    )
    .join('');
}
function publicationFeedback(issues) {
  const { t, e } = context;
  const dialog = document.createElement('dialog');
  dialog.className = 'course-preview';
  dialog.setAttribute('aria-label', t('publicationProblems'));
  dialog.innerHTML = `<h2>${t('publicationProblems')}</h2><ul>${issues.map(issue => `<li>${[issue.moduleTitle, issue.lessonTitle, issue.attachmentTitle].filter(Boolean).map(e).join(' / ')}: ${e(t(issue.code))}</li>`).join('')}</ul><button type="button">${t('closePreview')}</button>`;
  const previous = document.activeElement;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclose = () => {
    dialog.remove();
    previous?.focus();
  };
  document.body.append(dialog);
  dialog.showModal();
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
      categoryIds: (c.categories || []).map(category => category.id).sort(),
      coverFileId: c.cover_file_id,
      coverAlt: c.cover_alt,
      learningOutcomes: c.learning_outcomes,
      prerequisites: c.prerequisites,
      level: c.level,
      durationMinutes: c.duration_minutes,
      instructorName: c.instructor_name,
      instructorBio: c.instructor_bio,
      accessTerms: c.access_terms,
      certificateTerms: c.certificate_terms,
      trailerVideoId: c.trailer_video_id,

      slug: c.slug,
      title: c.title,
      summary: c.summary,
      accessMode: c.access_mode,
      locale: c.locale,
      attachments: c.attachments || [],
      modules: c.modules.map(m => ({
        title: m.title,
        lessons: m.lessons.map(l => ({
          title: l.title,
          body: l.body,
          videoId: l.video_id,
          captions: JSON.parse(l.captions_json || '[]'),
          attachments: l.attachments || [],
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
  refreshLayout = null;
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
  const categories = await api('/categories');
  const categoryIds = state.payload.categoryIds || [];
  for (const id of categoryIds) {
    if (!categories.some(c => c.id === id)) categories.push({ id, name: t('CATEGORY_NOT_FOUND') });
  }
  app.innerHTML = `<h1>${t('adminPublishTitle')}</h1><p>${t('studioDescription')}</p>${me.role === 'admin' ? `<div class="actions"><a href="/admin/home">${t('editHome')}</a><a href="/admin/categories">${t('manageCategories')}</a></div>` : ''}<div id="admin-list"></div><h2 id="editor-title">${state.id ? t('editCourseTitle') : t('newCourseTitle')}</h2><div class="actions"><button type="button" id="new-course" class="secondary">${icon('add')}${t('newCourseTitle')}</button><button type="button" id="reload-course" class="secondary" ${state.id ? '' : 'hidden'}>${icon('reloadDraft')}${t('reloadDraft')}</button></div><form id="editor"><section id="course-settings"><fieldset id="course-categories"><legend>${t('categories')}</legend><p>${t('courseCategoriesHelp')}</p>${categories.map(c => `<label><input type="checkbox" name="categoryId" value="${ctx.e(c.id)}" ${categoryIds.includes(c.id) ? 'checked' : ''}> ${ctx.e(c.name)}</label>`).join('') || `<p>${t('noCategories')}</p>`}</fieldset><label>${t('title')}<input name="title" required minlength="3" maxlength="255"></label><label>${t('courseSlugLabel')}<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="100"></label><label>${t('summary')}<textarea name="summary" required minlength="10" maxlength="1000"></textarea></label><label>${t('instructorName')}<textarea name="instructorName" maxlength="200"></textarea></label><label>${t('instructorBio')}<textarea name="instructorBio" maxlength="5000"></textarea></label><label>${t('accessTerms')}<textarea name="accessTerms" maxlength="5000"></textarea></label><label>${t('certificateTerms')}<textarea name="certificateTerms" maxlength="5000"></textarea></label><p class="muted">${t('presentationTermsHelp')}</p><label>${t('learningOutcomes')}<textarea name="learningOutcomes" maxlength="5000"></textarea></label><label>${t('prerequisites')}<textarea name="prerequisites" maxlength="5000"></textarea></label><label>${t('courseLevel')}<select name="level"><option value="">${t('notSpecified')}</option><option value="beginner">${t('levelBeginner')}</option><option value="intermediate">${t('levelIntermediate')}</option><option value="advanced">${t('levelAdvanced')}</option></select></label><label>${t('courseWorkload')}<input name="durationMinutes" type="number" min="1" max="60000" step="1"></label><label>${t('access')}<select name="accessMode" aria-label="${t('access')}"><option value="OPEN_FREE">${t('accessOpenOption')}</option><option value="ENROLLED_FREE">${t('accessEnrolledOption')}</option></select></label><label>${t('courseLanguage')}<select name="locale"><option value="en">English</option><option value="pt-BR">Português</option><option value="es">Español</option></select></label><label>${t('coverAlt')}<input name="coverAlt" maxlength="300"></label><section id="course-cover"></section><p>${t('trailerHelp')}</p><section id="course-trailer"></section><section id="course-attachments"></section></section><div id="modules"></div><div class="actions"><button type="button" id="add-module" class="secondary">${icon('add')}${t('addModule')}</button><button type="button" id="preview-course">${icon('previewContent')}${t('draftPreview')}</button><button type="submit">${icon('saveDraft')}${t('saveDraft')}</button></div><p id="save-status" role="status" aria-live="polite"></p></form>`;
  const form = document.querySelector('#editor');
  for (const name of [
    'title',
    'slug',
    'summary',
    'accessMode',
    'locale',
    'coverAlt',
    'learningOutcomes',
    'prerequisites',
    'level',
    'durationMinutes',
    'instructorName',
    'instructorBio',
    'accessTerms',
    'certificateTerms',
  ])
    form.elements[name].value = state.payload[name] ?? '';
  const trailer = form.querySelector('#course-trailer');
  trailer.dataset.videoId = state.payload.trailerVideoId || '';
  mountVideoEditor(trailer, {
    ...ctx,
    courseId: state.id,
    videoId: state.payload.trailerVideoId,
    t: key =>
      t(
        {
          videoLesson: 'courseTrailer',
          selectVideo: 'selectTrailer',
          noVideo: 'noTrailer',
          videoFile: 'trailerFile',
          uploadVideo: 'uploadTrailer',
          refreshVideos: 'refreshTrailer',
          retryVideo: 'retryTrailer',
          cancelUpload: 'cancelTrailer',
        }[key] || key,
      ),
    onChange: id => {
      trailer.dataset.videoId = id || '';
      readForm();
      changed();
    },
  });
  const cover = form.querySelector('#course-cover');
  cover.dataset.fileId = state.payload.coverFileId || '';
  mountVideoEditor(cover, {
    ...ctx,
    courseId: state.id,
    videoId: state.payload.coverFileId,
    endpoint: '/admin/files',
    accept: '.png,.jpg,.jpeg',
    filterMedia: file => /\.(png|jpe?g)$/i.test(file.filename),
    t: key =>
      t(
        {
          videoLesson: 'courseCover',
          selectVideo: 'selectCover',
          noVideo: 'noCover',
          videoFile: 'courseCover',
          uploadVideo: 'uploadFile',
          videoLimits: 'fileLimits',
          saveCourseVideo: 'saveCourseFile',
          retryVideo: 'retryCover',
          refreshVideos: 'refreshCover',
          cancelUpload: 'cancelCover',
        }[key] || key,
      ),
    onChange: id => {
      cover.dataset.fileId = id || '';
      readForm();
      changed();
    },
  });
  for (const module of state.payload.modules)
    document.querySelector('#modules').append(moduleField(module));
  mountAttachments(document.querySelector('#course-attachments'), state.payload.attachments || [], {
    ...ctx,
    courseId: state.id,
    onChange: () => {
      readForm();
      changed();
    },
  });
  refreshLayout = mountStudioLayout(form, {
    t,
    view: state.studioView,
    onView: view => {
      state.studioView = view;
      if (state.dirty) persist();
    },
  });
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
  document.querySelector('#preview-course').onclick = async () => {
    try {
      await save(true);
      if (!state.id || state.dirty || state.conflict || !form.checkValidity()) return;
      await showCoursePreview({ ...ctx, id: state.id, revisionId: state.revisionId });
    } catch (error) {
      notify(error);
    }
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
      } else if (target.dataset.publish || target.dataset.archive || target.dataset.review) {
        if (state.dirty) {
          notify(t('saveBeforePublish'));
          return;
        }
        const id = target.dataset.publish || target.dataset.archive || target.dataset.review;
        if (target.dataset.publish || target.dataset.review) {
          const revision = state.id === id ? state.revisionId : target.dataset.revision;
          const check = await api(`/admin/courses/${id}/publication-check?revisionId=${revision}`);
          if (!check.ready) {
            publicationFeedback(check.issues);
            return;
          }
        }
        const action = target.dataset.review ? 'review' : target.dataset.publish ? 'publish' : 'archive';
        await api(`/admin/courses/${id}/${action}`, 'POST', {
          expectedRevisionId: state.id === id ? state.revisionId : target.dataset.revision,
        });
        await refreshList();
      }
    } catch (error) {
      if (error.status === 422 && error.issues?.some(issue => issue.code))
        publicationFeedback(error.issues);
      else notify(error);
    }
  };
  if (!state.dirty) {
    readForm();
    state.savedPayload = structuredClone(state.payload);
  }
  if (state.dirty) status(state.conflict ? 'DRAFT_CONFLICT' : 'restoredDraft');
  await refreshList();
}
