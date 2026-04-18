import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const [common, sourcing, flips, members] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/sourcing.json`),
    import(`../../messages/${locale}/flips.json`),
    import(`../../messages/${locale}/members.json`),
  ]);

  return {
    locale,
    messages: {
      ...common.default,
      sourcing: sourcing.default,
      flips: flips.default,
      members: members.default,
    },
  };
});
