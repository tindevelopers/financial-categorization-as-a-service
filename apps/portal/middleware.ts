import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Portal Middleware
 * 
 * Handles authentication and company setup flow redirects:
 * - Redirects unauthenticated users to /signin (except public pages)
 * - Redirects authenticated users without company setup to /dashboard/setup
 * - Redirects authenticated users with setup to /dashboard
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;

  // Public pages that don't require authentication
  const publicPages = [
    '/signin',
    '/signup',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
    '/upload', // Existing upload page (non-breaking)
    '/review', // Existing review page (non-breaking)
    '/invoices/upload', // Existing invoice upload (non-breaking)
  ];

  const isPublicPage = publicPages.some((page) => pathname.startsWith(page));

  // Only set up Supabase client if environment variables are configured
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: Record<string, unknown>) {
            request.cookies.set({
              name,
              value: "",
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value: "",
              ...options,
            });
          },
        },
      }
    );

    // Get user session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users to signin (except public pages)
    if (!user && !isPublicPage && pathname !== '/') {
      const redirectUrl = new URL('/signin', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect authenticated users from signin/signup to dashboard
    if (user && (pathname === '/signin' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Redirect root to dashboard if authenticated
    if (user && pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Check company setup status for dashboard pages
    if (user && pathname.startsWith('/dashboard') && pathname !== '/dashboard/setup') {
      // Check if user has completed company setup
      const { data: companies } = await supabase
        .from('company_profiles')
        .select('id, setup_completed')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // If no company or setup not completed, redirect to setup
      if (!companies || companies.length === 0 || !companies[0].setup_completed) {
        return NextResponse.redirect(new URL('/dashboard/setup', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

