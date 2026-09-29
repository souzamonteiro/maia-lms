import { it, expect } from 'vitest';
import { captionsSchema, parseCaptions } from './captions.js';
const vtt = 'WEBVTT\n\n00:00.000 --> 00:02.000\nOlá, mundo!';
it('accepts UTF-8, CRLF and cue IDs while extracting plain transcripts', () => {
  expect(
    parseCaptions('\uFEFFWEBVTT\r\n\r\ncue1\r\n00:00:00.000 --> 00:00:02.000\r\nOlá, mundo!'),
  ).toEqual(['Olá, mundo!']);
  expect(captionsSchema.parse([{ language: 'pt-BR', label: 'Português', vtt }])).toHaveLength(1);
});
it('rejects malformed timing, markup, styling, duplicate languages and oversized captions', () => {
  for (const value of [
    'WEBVTT',
    'not vtt',
    'WEBVTT\n\nNOTE\n00:00.000 --> 00:02.000\nNot a cue',
    vtt.replace('00:02.000', '00:00.000'),
    vtt.replace('Olá, mundo!', '<script>bad</script>'),
    vtt.replace('00:02.000', '00:99.000'),
    'WEBVTT\n\nSTYLE\n::cue { color: red; }',
  ])
    expect(() => parseCaptions(value)).toThrow();
  expect(() =>
    captionsSchema.parse([
      { language: 'en', label: 'A', vtt },
      { language: 'en', label: 'B', vtt },
    ]),
  ).toThrow();
  expect(() =>
    captionsSchema.parse([{ language: 'en', label: 'A', vtt: vtt + 'a'.repeat(100000) }]),
  ).toThrow();
});
