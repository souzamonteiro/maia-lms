import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const appCss = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
const focusColor = appCss.match(/:focus-visible\s*\{[^}]*outline:\s*\d+px solid (#[\da-f]{6})/i)?.[1];
const paperColor = appCss.match(/:root\s*\{[^}]*--paper:\s*(#[\da-f]{6})/i)?.[1];

if (!focusColor || !paperColor) {
  throw new Error('Could not read the focus or paper color from app.css');
}

function luminance(color: string): number {
  const channels = color.slice(1).match(/../g)?.map(channel => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid CSS color: ${color}`);
  const [red, green, blue] = channels.map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Invalid CSS color: ${color}`);
  }
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  if (lighter === undefined || darker === undefined) throw new Error('Could not compare CSS colors');
  return (lighter + 0.05) / (darker + 0.05);
}

it.each([paperColor, '#ffffff'])('keeps the keyboard focus indicator at least 3:1 on %s', background => {
  expect(contrastRatio(focusColor, background)).toBeGreaterThanOrEqual(3);
});
