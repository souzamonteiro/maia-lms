export function attachPlaybackPositionSaver(
  video,
  { canSave, save, initialPosition = null, intervalMs = 15000, now = () => Date.now() },
) {
  let lastSaveAt = 0;
  let lastSavedPosition = initialPosition;
  let saving = false;
  let inFlightPosition = null;
  let pendingPosition = null;

  const savePosition = async (force = false) => {
    if (!canSave() || !Number.isFinite(video.currentTime)) return;
    const position = Math.floor(video.currentTime);
    if (saving) {
      if (force && position !== inFlightPosition) pendingPosition = position;
      return;
    }
    if (!force && now() - lastSaveAt <= intervalMs) return;
    if (position === lastSavedPosition) return;

    saving = true;
    inFlightPosition = position;
    lastSaveAt = now();
    try {
      await save(position);
      lastSavedPosition = position;
    } catch {
      // A later timeupdate or pause retries the unsaved position.
    } finally {
      saving = false;
      inFlightPosition = null;
      if (pendingPosition !== null) {
        pendingPosition = null;
        if (Math.floor(video.currentTime) !== lastSavedPosition) await savePosition(true);
      }
    }
  };
  const onTimeUpdate = () => {
    if (now() - lastSaveAt > intervalMs) void savePosition();
  };
  const onPause = () => void savePosition(true);

  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('pause', onPause);

  return () => {
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('pause', onPause);
  };
}