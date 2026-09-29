import { expect, it } from 'vitest';
import { formatVideoDuration } from '../public/duration.js';

it('formats probed durations without truncating hours or sub-second videos', () => {
  expect(formatVideoDuration(0.2)).toBe('0:01');
  expect(formatVideoDuration(59.2)).toBe('1:00');
  expect(formatVideoDuration(90)).toBe('1:30');
  expect(formatVideoDuration(3661)).toBe('1:01:01');
  expect(formatVideoDuration(14400)).toBe('4:00:00');
});
it('does not report an unknown or invalid duration as zero', () => {
  for (const value of [null, undefined, 0, -1, NaN, Infinity, '90']) {
    expect(formatVideoDuration(value)).toBeNull();
  }
});
