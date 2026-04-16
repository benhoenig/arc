import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - paths starting with /api, /trpc, /_next, /_vercel
  // - files containing a dot (e.g. favicon.ico, /images/*)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
