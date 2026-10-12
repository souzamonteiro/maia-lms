import { expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  missingTranslationKeys,
  supportedLocales,
  translate,
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

it('formats dates using the selected interface locale and fails safely on invalid dates', () => {
  const date = '2026-01-02T12:00:00.000Z';
  for (const locale of supportedLocales) {
    expect(formatDate(locale, date)).toBe(
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date)),
    );
  }
  expect(formatDate('invalid-locale', date)).toBe(
    new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(date)),
  );
  expect(formatDate('en', 'not-a-date')).toBeNull();
});

it('formats numeric translation values and currency using the selected locale', () => {
  for (const locale of supportedLocales) {
    const value = 1234567.89;
    expect(formatNumber(locale, value)).toBe(new Intl.NumberFormat(locale).format(value));
    expect(formatCurrency(locale, value, 'EUR')).toBe(
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value),
    );
    expect(translate(locale, 'adminUsersCount', { count: value })).toBe(
      new Intl.NumberFormat(locale).format(value) + ' ' +
        (locale === 'en' ? 'users' : locale === 'pt-BR' ? 'usuários' : 'usuarios'),
    );
  }
  expect(formatNumber('en', Number.NaN)).toBeNull();
  expect(formatCurrency('en', 10, 'not-a-currency')).toBeNull();
});

it('localizes stable API error codes in every supported locale', () => {
  const apiErrorCodes = [
    'AUTH_REQUIRED', 'AUTH_SESSION_EXPIRED', 'AUTH_RATE_LIMITED',
    'API_FORBIDDEN', 'API_REQUEST_TOO_LARGE', 'API_INVALID_INPUT', 'API_INVALID_JSON',
    'API_INTERNAL_ERROR', 'API_VALIDATION_FAILED', 'API_INVALID_PARAMETERS',
    'API_INVALID_QUERY', 'API_INVALID_ORIGIN', 'API_JSON_REQUIRED', 'API_NOT_FOUND',
    'ENROLLMENT_REQUIRED', 'COVER_NOT_FOUND', 'ATTACHMENT_NOT_FOUND', 'COURSE_NOT_FOUND',
    'COURSE_DUPLICATE_EDIT_UNIT', 'COURSE_MODULE_NOT_FOUND', 'COURSE_LESSON_NOT_FOUND',
    'COURSE_NOT_ACCEPTING_ENROLLMENTS', 'PAYMENT_REQUIRED', 'ENROLLMENT_ACCESS_REVOKED',
    'LESSON_NOT_FOUND', 'INSTRUCTOR_PROFILE_NOT_FOUND', 'VIDEO_NOT_AVAILABLE',
    'CAPTION_NOT_FOUND', 'MEDIA_NOT_AVAILABLE', 'VIDEO_NOT_FOUND', 'VIDEO_ACCESS_DENIED',
    'COURSE_ACCESS_DENIED', 'UPLOAD_CHUNK_INVALID', 'UPLOAD_INCOMPLETE',
    'UPLOAD_RETRY_STATE_INVALID', 'UPLOAD_CANCEL_STATE_INVALID',
  ];
  for (const locale of supportedLocales) {
    for (const code of apiErrorCodes) {
      expect(translate(locale, code), `${locale} translation for ${code}`).not.toBe(code);
    }
  }
});