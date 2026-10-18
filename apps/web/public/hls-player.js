let libraryPromise;

function loadHlsLibrary() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/static/vendor/hls/hls.min.js';
    script.async = true;
    script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS library unavailable'));
    script.onerror = () => reject(new Error('HLS library failed to load'));
    document.head.append(script);
  });
  return libraryPromise;
}

export async function attachHlsPlayer(video, { hlsUrl, mp4Url, quality, status, t }) {
  let hls;
  let sourceMode = 'initial';
  let disposed = false;
  let mediaRecoveries = 0;
  const qualityControl = quality?.closest('.video-quality-control');
  const hideQuality = () => {
    if (quality) quality.hidden = true;
    if (qualityControl) qualityControl.hidden = true;
  };
  const showStatus = key => {
    if (!disposed && status) status.textContent = key ? t(key) : '';
  };
  const setMp4Fallback = () => {
    if (disposed || sourceMode === 'mp4') return;
    sourceMode = 'mp4';
    hls?.destroy();
    hls = undefined;
    hideQuality();
    showStatus('videoPlaybackFallback');
    video.src = mp4Url;
    video.load();
  };
  const onWaiting = () => showStatus('videoPlaybackLoading');
  const onCanPlay = () => showStatus('');
  const onVideoError = () => {
    if (sourceMode !== 'mp4') setMp4Fallback();
    else showStatus('videoPlaybackError');
  };

  video.addEventListener('waiting', onWaiting);
  video.addEventListener('canplay', onCanPlay);
  video.addEventListener('error', onVideoError);

  try {
    const Hls = await loadHlsLibrary();
    if (disposed) return () => {};
    if (Hls.isSupported()) {
      sourceMode = 'hls.js';
      hls = new Hls({
        enableWorker: true,
        xhrSetup: xhr => { xhr.withCredentials = true; },
      });
      const renderLevels = () => {
        if (!quality || !hls || disposed) return;
        const levels = hls.levels;
        quality.innerHTML = `<option value="-1">${t('videoQualityAuto')}</option>${levels
          .map((level, index) => `<option value="${index}">${t('videoQualityValue', { height: level.height || '?' })}</option>`)
          .join('')}`;
        quality.hidden = false;
        if (qualityControl) qualityControl.hidden = levels.length < 2;
        quality.onchange = () => {
          if (hls) hls.currentLevel = Number(quality.value);
        };
        quality.value = String(hls.currentLevel);
      };
      const syncLevel = (_event, data) => {
        if (quality && hls && !disposed) quality.value = String(data.level);
      };
      hls.on(Hls.Events.MANIFEST_PARSED, renderLevels);
      hls.on(Hls.Events.LEVEL_SWITCHED, syncLevel);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || disposed) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
          mediaRecoveries++;
          hls?.recoverMediaError();
        } else setMp4Fallback();
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      sourceMode = 'native-hls';
      hideQuality();
      video.src = hlsUrl;
      video.load();
    } else {
      setMp4Fallback();
    }
  } catch {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      sourceMode = 'native-hls';
      hideQuality();
      video.src = hlsUrl;
      video.load();
    } else setMp4Fallback();
  }

  return () => {
    disposed = true;
    hls?.destroy();
    video.removeEventListener('waiting', onWaiting);
    video.removeEventListener('canplay', onCanPlay);
    video.removeEventListener('error', onVideoError);
    video.pause();
    if (quality) quality.onchange = null;
  };
}