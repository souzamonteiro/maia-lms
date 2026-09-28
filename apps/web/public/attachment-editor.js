import { mountVideoEditor } from './video-editor.js';
import { icon, iconButton } from './icons.js';
export function readAttachments(root) {
  if (!root) return [];
  return [...root.querySelectorAll(':scope > .attachment-list > .attachment-row')].map(row => ({
    fileId: row.dataset.fileId || '',
    title: row.querySelector('.attachment-title').value,
    description: row.querySelector('.attachment-description').value,
  }));
}
export function mountAttachments(root, items, ctx) {
  const { t, e, onChange } = ctx;
  root.innerHTML = `<h3>${t('attachments')}</h3>${!ctx.courseId ? `<p>${t('saveCourseFile')}</p>` : ''}<div class="attachment-list"></div><button type="button" class="add-attachment secondary">${icon('add')}${t('addAttachment')}</button>`;
  const list = root.querySelector('.attachment-list');
  function row(item) {
    const field = document.createElement('fieldset');
    field.className = 'attachment-row';
    field.dataset.fileId = item.fileId || '';
    field.innerHTML = `<legend>${t('attachment')}</legend><label>${t('title')}<input class="attachment-title" required maxlength="200" value="${e(item.title || '')}"></label><label>${t('attachmentDescription')}<textarea class="attachment-description" maxlength="2000">${e(item.description || '')}</textarea></label><div class="attachment-upload"></div><div class="attachment-actions actions"></div>`;
    const map = {
      videoLesson: 'attachmentFile',
      selectVideo: 'selectFile',
      noVideo: 'noFile',
      videoFile: 'attachmentFile',
      uploadVideo: 'uploadFile',
      saveCourseVideo: 'saveCourseFile',
      videoLimits: 'fileLimits',
      wrongVideoFile: 'wrongFile',
      retryVideo: 'retryFile',
    };
    mountVideoEditor(field.querySelector('.attachment-upload'), {
      ...ctx,
      t: key => t(map[key] || key),
      videoId: item.fileId,
      endpoint: '/admin/files',
      accept:
        '.pdf,.zip,.txt,.md,.csv,.json,.yaml,.yml,.xml,.toml,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.sql,.sh,.css,.html,.ipynb',
      onChange: id => {
        field.dataset.fileId = id || '';
        onChange();
      },
    });
    for (const [key, action] of [
      [
        'moveUp',
        () => {
          field.previousElementSibling?.before(field);
          onChange();
        },
      ],
      [
        'moveDown',
        () => {
          field.nextElementSibling?.after(field);
          onChange();
        },
      ],
      [
        'remove',
        () => {
          if (confirm(t('confirmRemove'))) {
            field.remove();
            onChange();
          }
        },
      ],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      iconButton(button, key, t(key === 'remove' ? 'removeAttachment' : key), true);
      button.onclick = action;
      field.querySelector('.attachment-actions').append(button);
    }
    list.append(field);
  }
  items.forEach(row);
  root.querySelector('.add-attachment').disabled = !ctx.courseId;
  root.querySelector('.add-attachment').onclick = () => {
    row({});
    onChange();
  };
}
