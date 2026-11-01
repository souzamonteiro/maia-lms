import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const appCss = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
const focusColor = appCss.match(/:focus-visible\s*\{[^}]*outline:\s*\d+px solid (#[\da-f]{6})/i)?.[1];
const paperColor = appCss.match(/:root\s*\{[^}]*--paper:\s*(#[\da-f]{6})/i)?.[1];
const errorMessage = appCss.match(/#message:not\(:empty\)\s*\{([^}]*)\}/i)?.[1];
const errorBorderColor = errorMessage?.match(/border:\s*1px solid (#[\da-f]{6})/i)?.[1];
const errorBackgroundColor = errorMessage?.match(/background:\s*(#[\da-f]{6})/i)?.[1];
const formControl = appCss.match(/input,\s*select,\s*textarea\s*\{([^}]*)\}/i)?.[1];
const formControlBorderColor = formControl?.match(/border:\s*1px solid (#[\da-f]{6})/i)?.[1];
const disabledButton = appCss.match(/button:disabled\s*\{([^}]*)\}/i)?.[1];
const disabledBackgroundColor = disabledButton?.match(/background:\s*(#[\da-f]{6})/i)?.[1];
const disabledForeground = disabledButton?.match(/color:\s*var\(--ink\)/i) ? '#132a34' : undefined;
const fieldset = appCss.match(/fieldset\s*\{([^}]*)\}/i)?.[1];
const fieldsetBorderColor = fieldset?.match(/border:\s*1px solid (#[\da-f]{6})/i)?.[1];
const dragging = appCss.match(/\.dragging\s*\{([^}]*)\}/i)?.[1];
const dragOutlineColor = dragging?.match(/outline:\s*3px dashed var\(--green\)/i) ? '#14644b' : undefined;

if (
  !focusColor
  || !paperColor
  || !errorBorderColor
  || !errorBackgroundColor
  || !formControlBorderColor
  || !disabledButton
  || !disabledBackgroundColor
  || !disabledForeground
  || !fieldsetBorderColor
  || !dragging
  || !dragOutlineColor
) {
  throw new Error('Could not read the tested colors from app.css');
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

it('keeps the form error border at least 3:1 against its background', () => {
  expect(contrastRatio(errorBorderColor, errorBackgroundColor)).toBeGreaterThanOrEqual(3);
});

it.each([paperColor, '#ffffff'])('keeps form control borders at least 3:1 on %s', background => {
  expect(contrastRatio(formControlBorderColor, background)).toBeGreaterThanOrEqual(3);
});

it('keeps disabled button text at least 4.5:1 without opacity reduction', () => {
  expect(disabledButton).not.toMatch(/opacity\s*:/i);
  expect(contrastRatio(disabledForeground, disabledBackgroundColor)).toBeGreaterThanOrEqual(4.5);
});

it.each(['#ffffff', paperColor, '#f8faf7'])('keeps fieldset boundaries at least 3:1 on %s', background => {
  expect(contrastRatio(fieldsetBorderColor, background)).toBeGreaterThanOrEqual(3);
});

it.each(['#ffffff', '#f8faf7'])('keeps dragged editor content visible on %s', background => {
  expect(dragging).not.toMatch(/opacity\s*:/i);
  expect(contrastRatio(dragOutlineColor, background)).toBeGreaterThanOrEqual(3);
});
