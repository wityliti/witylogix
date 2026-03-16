import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import {
  defaultLocale,
  getLocaleFromRequest,
  supportedLocales,
} from './i18n/config';

/**
 * Protected routes that require authentication
 */
const protectedRoutes = [
  '/orders',
  '/drivers',
  '/deliveries',
  '/settings',
  '/integrations',
  '/admin',
  '/profile',
  '/analytics',
  '/support',
];

/**
 * Public routes that don't require authentication
 */
const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];

/**
 * i18n middleware with locale detection and routing
 */
const intlMiddleware = createMiddleware({
  locales: supportedLocales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeCookie: 'NEXT_LOCALE',
});

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const acceptLanguage = request.headers.get('accept-language');

  // Determine locale
  const locale = getLocaleFromRequest(cookieLocale, acceptLanguage || undefined);

  // Create response from intl middleware
  let response = intlMiddleware(request);

  // Set locale cookie for client-side access
  response.cookies.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
  });

  // Check authentication for protected routes
  const isProtectedRoute = protectedRoutes.some((route) => {
    const pathWithoutLocale = pathname.replace(new RegExp(`^/(${supportedLocales.join('|')})`), '');
    return pathWithoutLocale.startsWith(route);
  });

  const isPublicRoute = publicRoutes.some((route) => {
    const pathWithoutLocale = pathname.replace(new RegExp(`^/(${supportedLocales.join('|')})`), '');
    return pathWithoutLocale.startsWith(route);
  });

  // Get auth token from cookies
  const authToken = request.cookies.get('auth-token')?.value;

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !authToken) {
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing login while authenticated
  if (isPublicRoute && authToken) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - robots.txt (robots file)
    // - sitemap.xml (sitemap file)
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
