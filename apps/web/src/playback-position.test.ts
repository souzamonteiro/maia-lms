import { expect, it, vi } from 'vitest';
import { attachPlaybackPositionSaver } from '../public/playback-position.js';

it('saves the final paused position after an earlier save finishes in flight', async () => {
  const video = new EventTarget() as EventTarget & { currentTime: number };
  const positions: number[] = [];
  let releaseFirstSave: (() => void) | undefined;
  let resolveSecondSave: (() => void) | undefined;
  const secondSave = new Promise<void>(resolve => {
    resolveSecondSave = resolve;
  });
  const save = vi.fn((position: number) => {
    positions.push(position);
    if (positions.length === 1)
      return new Promise<void>(resolve => {
        releaseFirstSave = resolve;
      });
    resolveSecondSave?.();
    return Promise.resolve();
  });
  const detach = attachPlaybackPositionSaver(video, {
    canSave: () => true,
    save,
    now: () => 20000,
  });

  video.currentTime = 12;
  video.dispatchEvent(new Event('timeupdate'));
  expect(save).toHaveBeenCalledWith(12);

  video.currentTime = 27;
  video.dispatchEvent(new Event('pause'));
  expect(save).toHaveBeenCalledTimes(1);

  releaseFirstSave?.();
  await secondSave;
  expect(positions).toEqual([12, 27]);
  detach();
});

it('throttles time updates to the configured interval', async () => {
  const video = new EventTarget() as EventTarget & { currentTime: number };
  const save = vi.fn().mockResolvedValue(undefined);
  let timestamp = 20000;
  const detach = attachPlaybackPositionSaver(video, {
    canSave: () => true,
    save,
    now: () => timestamp,
  });

  video.currentTime = 10;
  video.dispatchEvent(new Event('timeupdate'));
  await Promise.resolve();
  timestamp += 10000;
  video.currentTime = 20;
  video.dispatchEvent(new Event('timeupdate'));
  await Promise.resolve();
  timestamp += 6000;
  video.currentTime = 30;
  video.dispatchEvent(new Event('timeupdate'));

  expect(save.mock.calls.map(([position]) => position)).toEqual([10, 30]);
  detach();
});

it('does not write progress for visitors', () => {
  const video = new EventTarget() as EventTarget & { currentTime: number };
  const save = vi.fn();
  const detach = attachPlaybackPositionSaver(video, {
    canSave: () => false,
    save,
    now: () => 20000,
  });

  video.currentTime = 10;
  video.dispatchEvent(new Event('timeupdate'));
  video.dispatchEvent(new Event('pause'));

  expect(save).not.toHaveBeenCalled();
  detach();
});