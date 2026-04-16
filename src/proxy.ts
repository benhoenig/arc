import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match root and all pathnames except for
  // - paths starting with /api, /trpc, /_next, /_vercel
  // - files containing a dot (e.g. favicon.ico, /images/*)
  // `/` is listed explicitly because the negative-lookahead matcher alone
  // doesn't catch the empty suffix on Next 16 + Turbopack.
  matcher: ['/', '/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
