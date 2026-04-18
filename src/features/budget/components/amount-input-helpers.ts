// Helpers for comma-formatted numeric inputs used on the budget page.
// Input fields are type="text" (not number) so we can show commas while
// editing. Raw storage stays as a plain decimal string; commas only ever
// appear in the rendered value.

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

// Keep only digits and a single period. Used on every keystroke to scrub
// stray commas, letters, extra dots, etc.
export function cleanNumericInput(raw: string): string {
  const onlyNumerics = raw.replace(/[^\d.]/g, '');
  const firstDot = onlyNumerics.indexOf('.');
  if (firstDot === -1) {
    return onlyNumerics;
  }
  return onlyNumerics.slice(0, firstDot + 1) + onlyNumerics.slice(firstDot + 1).replace(/\./g, '');
}

// Format a plain numeric string with comma separators, preserving a
// trailing "." or ".5" etc. while the user is mid-type.
export function formatWithCommas(value: string): string {
  if (value === '' || value === '.') {
    return value;
  }
  const [intPart, decPart] = value.split('.');
  const intNum = Number(intPart);
  if (Number.isNaN(intNum)) {
    return value;
  }
  const formattedInt = numberFormat.format(intNum);
  return decPart === undefined ? formattedInt : `${formattedInt}.${decPart}`;
}

// Parse a possibly-comma-formatted string to a number. Returns NaN for junk.
export function parseAmount(value: string): number {
  const cleaned = cleanNumericInput(value);
  if (cleaned === '' || cleaned === '.') {
    return 0;
  }
  return Number(cleaned);
}
