import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth', '/api', '/_next', '/favicon.ico'];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (!isPublic && !sessionCookie) {
    const signIn = new URL('/auth/sign-in', request.url);
    signIn.searchParams.set('from', pathname);
    return NextResponse.redirect(signIn);
  }

  if (pathname.startsWith('/auth') && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard/overview', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
