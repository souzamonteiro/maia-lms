import { z } from 'zod';
// Deliberately constrained WebVTT: plain cues, optional identifiers, no CSS/regions/markup.
export function parseCaptions(source: string): string[] {
  const blocks = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n[ \t]*\n/);
  if (blocks.shift() !== 'WEBVTT' || !blocks.length) throw new Error('Invalid WebVTT header');
  const stamp = '(?:\\d{2,}:)?[0-5]\\d:[0-5]\\d\\.\\d{3}';
  const timing = new RegExp(`^(${stamp}) --> (${stamp})$`);
  const seconds = (s: string) => s.split(':').reduce((n, v) => n * 60 + Number(v), 0);
  let previous = -1;
  return blocks.map(block => {
    const lines = block.split('\n');
    if (/^(NOTE(?:[ \t]|$)|STYLE$|REGION$)/.test(lines[0]))
      throw new Error('Unsupported WebVTT block');
    if (!lines[0].includes('-->')) lines.shift();
    const match = timing.exec(lines.shift() ?? '');
    if (
      !match ||
      !lines.length ||
      !Number.isFinite(seconds(match[1])) ||
      !Number.isFinite(seconds(match[2])) ||
      seconds(match[1]) < previous ||
      seconds(match[2]) <= seconds(match[1])
    )
      throw new Error('Invalid cue');
    previous = seconds(match[1]);
    const text = lines.join('\n');
    if (
      text.includes('<') ||
      text.includes('-->') ||
      [...text].some(c => c.charCodeAt(0) < 32 && !['\n', '\t'].includes(c))
    )
      throw new Error('Plain captions required');
    return text;
  });
}
export const captionsSchema = z
  .array(
    z.object({
      language: z.enum(['en', 'pt-BR', 'es']),
      label: z.string().min(1).max(80),
      vtt: z
        .string()
        .max(100000)
        .refine(value => Buffer.byteLength(value, 'utf8') <= 100000, 'Caption exceeds 100 KB')
        .refine(value => {
          try {
            parseCaptions(value);
            return true;
          } catch {
            return false;
          }
        }, 'Use plain WebVTT cues with valid increasing timestamps'),
    }),
  )
  .max(3)
  .refine(
    rows => new Set(rows.map(r => r.language)).size === rows.length,
    'Duplicate caption language',
  )
  .default([]);
