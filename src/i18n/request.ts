import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const [common, sourcing, flips, members, budget, contractors, payments, ocr, settings, tasks] =
    await Promise.all([
      import(`../../messages/${locale}/common.json`),
      import(`../../messages/${locale}/sourcing.json`),
      import(`../../messages/${locale}/flips.json`),
      import(`../../messages/${locale}/members.json`),
      import(`../../messages/${locale}/budget.json`),
      import(`../../messages/${locale}/contractors.json`),
      import(`../../messages/${locale}/payments.json`),
      import(`../../messages/${locale}/ocr.json`),
      import(`../../messages/${locale}/settings.json`),
      import(`../../messages/${locale}/tasks.json`),
    ]);

  return {
    locale,
    messages: {
      ...common.default,
      sourcing: sourcing.default,
      flips: flips.default,
      members: members.default,
      budget: budget.default,
      contractors: contractors.default,
      payments: payments.default,
      ocr: ocr.default,
      settings: settings.default,
      tasks: tasks.default,
    },
  };
});
