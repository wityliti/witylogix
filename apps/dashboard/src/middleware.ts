import { NextRequest, NextResponse } from 'next/server';
import {
  defaultLocale,
  getLocaleFromRequest,
} from './i18n/config';

/**
 * Public routes that don't require authentication
 */
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/magic-link'];

/**
 * Helper to decode JWT payload (without verification - validation happens on backend)
 */
function decodeJWT(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    return decoded;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  // exp is in seconds, Date.now() is in milliseconds
  const expiryTime = decoded.exp * 1000;
  const now = Date.now();

  // Consider token expired if expiry is within 30 seconds
  return expiryTime < (now + 30 * 1000);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const acceptLanguage = request.headers.get('accept-language');

  // Determine locale
  const locale = getLocaleFromRequest(cookieLocale, acceptLanguage || undefined) || defaultLocale;

  const response = NextResponse.next();

  // Set locale cookie for client-side access
  response.cookies.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
  });

  // Get auth token from cookies
  const authToken = request.cookies.get('auth-token')?.value;

  // Check if route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check if route is under dashboard (protected)
  const isDashboardRoute = pathname.startsWith('/(dashboard)') ||
                           pathname.match(/^\/(dashboard|orders|drivers|deliveries|settings|integrations|admin|profile|analytics|support|customers|onboarding)/);

  // For dashboard routes, require valid auth token
  if (isDashboardRoute) {
    if (!authToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if token is expired
    if (isTokenExpired(authToken)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('reason', 'expired');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect to dashboard if accessing public auth routes while authenticated
  if (isPublicRoute && authToken && !isTokenExpired(authToken)) {
    return NextResponse.redirect(new URL('/', request.url));
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
