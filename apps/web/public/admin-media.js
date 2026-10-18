const mediaStates = ['UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED'];

export async function mountAdminMedia({ app, api, t, e, notify, locale }) {
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminMediaTitle')}</h1><form id="media-filters" class="user-filters"><label>${t('adminMediaSearch')}<input name="q" type="search" maxlength="100"></label><label>${t('adminMediaCourse')}<select name="courseId"><option value="">${t('adminMediaAllCourses')}</option></select></label><label>${t('adminMediaKind')}<select name="kind"><option value="">${t('adminMediaAllKinds')}</option><option value="video">${t('adminMediaKindVideo')}</option><option value="attachment">${t('adminMediaKindAttachment')}</option></select></label><label>${t('adminMediaStatus')}<select name="status"><option value="">${t('adminMediaAllStatuses')}</option>${mediaStates.map(state => `<option value="${state}">${t(`video${state}`)}</option>`).join('')}</select></label><button type="submit">${t('adminUsersSearchAction')}</button></form><p id="media-summary" role="status" aria-live="polite"></p><div id="media-list" aria-busy="true"></div><nav id="media-pagination" aria-label="${t('adminMediaPagination')}"></nav>`;
  const form = app.querySelector('#media-filters');
  const summary = app.querySelector('#media-summary');
  const list = app.querySelector('#media-list');
  const pagination = app.querySelector('#media-pagination');
  const pageSize = 50;
  let offset = 0;
  try {
    const courses = await api('/admin/courses');
    const select = form.elements.courseId;
    for (const course of courses) {
      const option = document.createElement('option');
      option.value = course.id;
      option.textContent = course.title || course.slug;
      select.append(option);
    }
  } catch (error) {
    notify(error);
  }

  async function load() {
    list.setAttribute('aria-busy', 'true');
    list.textContent = t('adminMediaLoading');
    try {
      const filters = new FormData(form);
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      for (const field of ['q', 'courseId', 'kind', 'status']) {
        const value = String(filters.get(field) || '');
        if (value) params.set(field, value);
      }
      const result = await api(`/admin/media?${params}`);
      summary.textContent = t('adminMediaCount', { count: result.total });
      list.replaceChildren();
      if (!result.items.length) list.innerHTML = `<p>${t('adminMediaEmpty')}</p>`;
      for (const media of result.items) {
        const item = document.createElement('article');
        item.className = 'card media-library-item';
        const size = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
          .format(media.size / 1024);
        const uses = media.attachment_references + media.lesson_references + media.course_references;
        item.innerHTML = `<h2>${e(media.filename)}</h2><p>${e(media.course_title || media.course_slug)} · ${e(media.course_slug)}</p><p>${e(t(media.media_kind === 'video' ? 'adminMediaKindVideo' : 'adminMediaKindAttachment'))} · ${e(t(`video${media.status}`))} · ${e(t('adminMediaSizeValue', { value: size }))}</p><p>${e(t('adminMediaReferences', { count: uses }))} · <code>${e(media.id)}</code></p>${media.status === 'PROCESSING' ? `<progress max="100" value="${Number(media.processing_progress) || 0}" aria-label="${t('videoProcessingProgress', { percent: media.processing_progress })}"></progress>` : ''}${media.error ? `<p role="status">${e(t(media.error))}</p>` : ''}<p><a href="/courses/${e(media.course_id)}">${t('adminMediaOpenCourse')}</a></p>`;
        list.append(item);
      }
      pagination.replaceChildren();
      if (result.total > pageSize) {
        const previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'secondary';
        previous.textContent = t('adminMediaPrevious');
        previous.disabled = offset === 0;
        previous.onclick = () => {
          offset = Math.max(0, offset - pageSize);
          load().catch(notify);
        };
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'secondary';
        next.textContent = t('adminMediaNext');
        next.disabled = offset + pageSize >= result.total;
        next.onclick = () => {
          offset += pageSize;
          load().catch(notify);
        };
        pagination.append(previous, next);
      }
    } catch (error) {
      summary.textContent = '';
      list.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button" id="retry-media">${t('retry')}</button>`;
      list.querySelector('#retry-media').addEventListener('click', () => load().catch(notify));
    } finally {
      list.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    offset = 0;
    load().catch(notify);
  });
  await load();
}