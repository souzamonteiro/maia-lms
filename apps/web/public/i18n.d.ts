export function translate(locale: string, key: string, values?: Record<string, string | number>): string;
export const supportedLocales: string[];
export function missingTranslationKeys(locale: string): string[];
export function translationPlaceholderMismatches(locale: string): string[];
export function formatNumber(locale: string, value: number | string, options?: Intl.NumberFormatOptions): string | null;
export function formatCurrency(locale: string, value: number | string, currency: string): string | null;
export function formatDate(locale: string, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string | null;
export function detectLocale(): string;
export function storeLocale(locale: string): void;
