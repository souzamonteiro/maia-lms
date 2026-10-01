import { expect, it } from 'vitest';
import {
  missingTranslationKeys,
  supportedLocales,
  translationPlaceholderMismatches,
} from '../public/i18n.js';

it('defines every interface translation in every supported locale', () => {
  for (const locale of supportedLocales) {
    expect(missingTranslationKeys(locale), `Missing translations for ${locale}`).toEqual([]);
    expect(translationPlaceholderMismatches(locale), `Placeholder mismatch for ${locale}`).toEqual(
      [],
    );
  }
});