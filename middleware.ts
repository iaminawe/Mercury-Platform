import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = await createServerSupabaseClient();

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/api/trpc'];
  const authRoutes = ['/install', '/login', '/signup'];

  const path = request.nextUrl.pathname;

  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));

  if (isProtectedRoute && !session) {
    // Redirect to install page if not authenticated
    return NextResponse.redirect(new URL('/install', request.url));
  }

  if (isAuthRoute && session) {
    // Redirect to dashboard if already authenticated
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For dashboard routes, check if the user has an active store
  if (path.startsWith('/dashboard') && session) {
    const { data: store } = await supabase
      .from('stores')
      .select('is_active')
      .eq('owner_id', session.user.id)
      .single();

    if (!store || !store.is_active) {
      // Redirect to install page if no active store
      return NextResponse.redirect(new URL('/install', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - api/webhooks (webhook endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico|public).*)',
  ],
};