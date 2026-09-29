// Author-only simulation: never enrolls, tracks progress, or publishes the draft.
export async function showCoursePreview({ api, t, e, id, revisionId }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'course-preview';
  dialog.innerHTML = `<h2>${t('draftPreview')}</h2><p>${t('draftPreviewHelp')}</p><label>${t('previewAudience')}<select><option value="learner">${t('previewLearner')}</option><option value="visitor">${t('previewVisitor')}</option></select></label><button type="button">${t('closePreview')}</button><div class="preview-course" aria-live="polite"></div>`;
  const heading = dialog.querySelector('h2');
  heading.id = 'draft-preview-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const root = dialog.querySelector('.preview-course');
  const select = dialog.querySelector('select');
  let generation = 0;
  function materials(items = []) {
    return items.length
      ? `<section><h3>${t('attachments')}</h3>${items.map(a => `<p><a href="/api/v1/attachments/${e(a.id)}/download">${e(a.title)}</a></p><p class="plain-content">${e(a.description)}</p>`).join('')}</section>`
      : '';
  }
  async function load() {
    const request = ++generation;
    root.querySelectorAll('video').forEach(v => v.pause());
    root.textContent = t('loadingCourses');
    try {
      const course = await api(
        `/admin/courses/${id}/preview?audience=${select.value}&revisionId=${revisionId}`,
      );
      if (request !== generation || !dialog.isConnected) return;
      root.innerHTML = `<h1>${e(course.title)}</h1><p>${e(course.summary)}</p>${materials(course.attachments)}${course.modules.map(m => `<section><h2>${e(m.title)}</h2>${m.lessons.map(l => `<article><h3>${e(l.title)}</h3>${l.locked ? `<p>${t('previewLocked')}</p>` : `${l.video_id ? `<video controls playsinline preload="none" poster="/api/v1/lessons/${e(l.id)}/poster" src="/api/v1/lessons/${e(l.id)}/video">${l.captions.map(c => `<track kind="captions" srclang="${e(c.language)}" label="${e(c.label)}" src="/api/v1/lessons/${e(l.id)}/captions/${e(c.language)}">`).join('')}</video>` : ''}<div class="lesson-body prose">${l.body_html}</div>${materials(l.attachments)}${l.captions.map(c => `<details><summary>${t('transcript')} — ${e(c.label)}</summary><p class="plain-content">${e(c.transcript)}</p></details>`).join('')}`}</article>`).join('')}</section>`).join('')}`;
      root.querySelectorAll('video').forEach(video =>
        video.addEventListener(
          'error',
          () => {
            const error = document.createElement('p');
            error.textContent = t('videoPlaybackError');
            video.after(error);
          },
          { once: true },
        ),
      );
    } catch (error) {
      if (request === generation && dialog.isConnected)
        root.textContent = t(error.code || 'genericError');
    }
  }
  const previousFocus = document.activeElement;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    generation++;
    root.querySelectorAll('video').forEach(v => v.pause());
    dialog.remove();
    previousFocus?.focus();
  });
  select.onchange = load;
  document.body.append(dialog);
  dialog.showModal();
  await load();
}
