const metadataFields = [
  ['title', 'title'],
  ['summary', 'summary'],
  ['learningOutcomes', 'learning_outcomes'],
  ['prerequisites', 'prerequisites'],
  ['instructorBio', 'instructor_bio'],
  ['accessTerms', 'access_terms'],
  ['certificateTerms', 'certificate_terms'],
] as const;

type LocalizedMetadata = {
  locale: string;
  [key: string]: unknown;
};

export function localizeCourseMetadata<T extends Record<string, unknown>>(
  row: T,
  requestedLocale?: string,
): Omit<T, 'translations_json' | 'translations' | 'revision_locale'> & { display_locale?: string } {
  const { translations_json: serialized, revision_locale: contentLocale, translations: provided, ...base } = row;
  const sourceLocale = typeof contentLocale === 'string'
    ? contentLocale
    : typeof row.locale === 'string' ? row.locale : undefined;
  const translations = Array.isArray(provided)
    ? provided as LocalizedMetadata[]
    : (() => {
      if (typeof serialized !== 'string') return [];
      try {
        return JSON.parse(serialized) as LocalizedMetadata[];
      } catch {
        return [];
      }
    })();
  const result = { ...base, ...(sourceLocale ? { locale: sourceLocale } : {}) } as Record<string, unknown>;
  if (!requestedLocale) return result as Omit<T, 'translations_json' | 'translations' | 'revision_locale'>;
  const selected = translations.find(translation => translation.locale === requestedLocale);
  for (const [translationField, outputField] of metadataFields) {
    const value = selected?.[translationField];
    if (typeof value === 'string' && value.trim()) result[outputField] = value;
  }
  return { ...result, display_locale: requestedLocale } as Omit<T, 'translations_json' | 'translations' | 'revision_locale'> & { display_locale: string };
}