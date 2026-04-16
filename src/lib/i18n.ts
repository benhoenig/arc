export const locales = ['th', 'en'] as const;
export const defaultLocale = 'th';

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Picks the user-visible name from a row that stores both Thai and English.
 * Seeded lookup tables (stages, categories, roles) follow this shape.
 */
export function getLocalizedName<T extends { nameTh: string; nameEn: string | null }>(
  item: T,
  locale: Locale,
): string {
  if (locale === 'en') {
    return item.nameEn ?? item.nameTh;
  }
  return item.nameTh;
}
