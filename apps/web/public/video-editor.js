import { formatVideoDuration } from './duration.js';
import { icon } from './icons.js';
// Uploads resume from server offsets; completed chunks are checked against the selected file.
export function mountVideoEditor(
  root,
  {
    courseId,
    videoId,
    api,
    t,
    e,
    notify,
    onChange,
    endpoint = '/admin/videos',
    filterMedia = () => true,
    accept = 'video/mp4,video/webm,video/quicktime,.mkv',
  },
) {
  root.innerHTML = `<h3>${t('videoLesson')}</h3>${!courseId ? `<p>${t('saveCourseVideo')}</p>` : `<label>${t('selectVideo')}<select class="video-choice"><option value="">${t('noVideo')}</option></select></label><div class="actions"><button type="button" class="refresh-videos secondary">${icon('reloadDraft')}${t('refreshVideos')}</button><button type="button" class="retry-video secondary">${t('retryVideo')}</button></div><label>${t('videoFile')}<input type="file" class="video-file" accept="${e(accept)}"></label><div class="actions"><button type="button" class="upload-video">${icon('publish')}${t('uploadVideo')}</button><button type="button" class="pause-video secondary" disabled>${t('pauseVideo')}</button><button type="button" class="cancel-video secondary">${icon('remove')}${t('cancelUpload')}</button></div><progress class="upload-progress" max="100" value="0" aria-label="${t('uploadProgress')}"></progress><p class="video-status" role="status"></p><p class="muted">${t('videoLimits')}</p>`}`;
  if (!courseId) return;
  const choice = root.querySelector('.video-choice'),
    status = root.querySelector('.video-status'),
    progress = root.querySelector('progress');
  const duration = document.createElement('p');
  duration.className = 'video-duration';
  duration.setAttribute('role', 'status');
  duration.hidden = true;
  if (endpoint === '/admin/videos') choice.closest('label').after(duration);
  const scanError = document.createElement('p');
  scanError.className = 'media-error';
  scanError.setAttribute('role', 'status');
  status.after(scanError);
  let videos = [];
  function updateDuration() {
    duration.hidden = !videoId;
    const selected = videos.find(video => video.id === videoId);
    scanError.textContent =
      selected?.status === 'FAILED' && selected.error ? t(selected.error) : '';
    const value = selected?.status === 'READY' ? formatVideoDuration(selected.duration) : null;
    duration.textContent = value ? `${t('videoDuration')}: ${value}` : t('videoDurationPending');
  }
  let paused = false,
    busy = false;
  async function refresh() {
    const rows = await api(`${endpoint}?courseId=${courseId}`);
    videos = rows;
    choice.innerHTML =
      `<option value="">${t('noVideo')}</option>` +
      rows
        .filter(v => v.status !== 'CANCELLED' && filterMedia(v))
        .map(v => `<option value="${v.id}">${e(v.filename)} — ${t('video' + v.status)}</option>`)
        .join('');
    choice.value = videoId ?? '';
    updateDuration();
  }
  choice.onchange = () => {
    videoId = choice.value;
    updateDuration();
    onChange(videoId || null);
  };
  root.querySelector('.refresh-videos').onclick = () => refresh().catch(notify);
  root.querySelector('.retry-video').onclick = async () => {
    try {
      if (videoId) await api(`${endpoint}/${videoId}/retry`, 'POST');
      await refresh();
    } catch (error) {
      notify(error);
    }
  };
  root.querySelector('.pause-video').onclick = () => {
    paused = true;
  };
  root.querySelector('.cancel-video').onclick = async () => {
    if (busy) {
      paused = true;
      return;
    }
    try {
      if (videoId) {
        await api(`${endpoint}/${videoId}/cancel`, 'POST');
        videoId = null;
        onChange(null);
        await refresh();
      }
    } catch (error) {
      notify(error);
    }
  };
  root.querySelector('.upload-video').onclick = async () => {
    const file = root.querySelector('.video-file').files[0];
    if (!file || busy) return;
    busy = true;
    paused = false;
    root.querySelector('.upload-video').disabled = true;
    root.querySelector('.pause-video').disabled = false;
    choice.disabled = true;
    try {
      let upload = videoId ? await api(`${endpoint}/${videoId}`) : null;
      if (upload && upload.status !== 'UPLOADING') upload = null;
      if (!upload) {
        upload = await api(endpoint, 'POST', {
          courseId,
          filename: file.name,
          size: file.size,
        });
        videoId = upload.id;
        onChange(videoId);
      }
      if (upload.size && upload.size !== file.size) throw new Error(t('wrongVideoFile'));
      for (const chunk of upload.chunks ?? []) {
        const digest = await crypto.subtle.digest(
          'SHA-256',
          await file.slice(chunk.offset, chunk.offset + chunk.size).arrayBuffer(),
        );
        const hex = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join(
          '',
        );
        if (hex !== chunk.sha256) throw new Error(t('wrongVideoFile'));
      }
      let offset = upload.offset;
      while (offset < file.size && !paused && root.isConnected) {
        const response = await fetch(`/api/v1${endpoint}/${videoId}/chunks`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream', 'Upload-Offset': String(offset) },
          body: file.slice(offset, offset + 512 * 1024),
        });
        if (!response.ok) throw new Error(t('uploadInterrupted'));
        offset = (await response.json()).offset;
        progress.value = (offset / file.size) * 100;
        status.textContent = `${Math.round(progress.value)}%`;
        // Keep uploads below the shared 300 requests/minute budget.
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (offset === file.size) {
        await api(`${endpoint}/${videoId}/complete`, 'POST');
        status.textContent = t('videoQUEUED');
      } else status.textContent = t('uploadPaused');
      await refresh();
    } catch (error) {
      notify(error);
      status.textContent = t('uploadInterrupted');
    } finally {
      busy = false;
      root.querySelector('.upload-video').disabled = false;
      root.querySelector('.pause-video').disabled = true;
      choice.disabled = false;
    }
  };
  refresh().catch(notify);
}
