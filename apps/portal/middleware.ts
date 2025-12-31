import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGlobalAdminRole } from "@tinadmin/core/shared";

/**
 * Portal Middleware
 * 
 * Handles authentication and company setup flow redirects:
 * - Redirects unauthenticated users to /signin (except public pages)
 * - Redirects authenticated users without company setup to /dashboard/setup
 * - Redirects authenticated users with setup to /dashboard
 */
export async function middleware(request: NextRequest) {
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const { pathname } = request.nextUrl;
    const adminDomain =
      process.env.NEXT_PUBLIC_ADMIN_DOMAIN ||
      process.env.ADMIN_DOMAIN ||
      null;

    // API routes should handle their own authentication and return JSON responses
    // Don't redirect API routes - let them handle auth themselves
    const isApiRoute = pathname.startsWith('/api/');

    // Public pages that don't require authentication
    const publicPages = [
      '/signin',
      '/signup',
      '/pricing',
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
      try {
        const debugEnterprise =
          process.env.DEBUG_ENTERPRISE === "1" || process.env.MIDDLEWARE_DEBUG_ENTERPRISE === "1";
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

        // Refresh session to ensure cookies are properly set
        // This is important for maintaining authentication after OAuth redirects
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        // Refresh the session if it exists
        if (session) {
          await supabase.auth.refreshSession();
        }
        
        // Get user from refreshed session
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const maybeLogEnterprise = (message: string, data?: Record<string, unknown>) => {
          if (!debugEnterprise) return;
          // We only log for "enterprise-like" contexts to avoid spamming logs.
          const email = user?.email || "";
          const isEnterpriseEmail =
            email.endsWith("@velocitypartners.info") || (!email.endsWith("@tin.info") && email.includes("@"));
          if (!isEnterpriseEmail) return;
          console.log("[portal-middleware][enterprise]", {
            message,
            pathname,
            host: request.headers.get("host"),
            url: request.url,
            userId: user?.id,
            email,
            ...data,
          });
        };

        // If this is a global admin user, always route them to the full admin console.
        // (We keep the consumer portal for tenants + enterprise admin users.)
        if (user && !isApiRoute && adminDomain) {
          try {
            const { data: userData } = await supabase
              .from("users")
              .select("tenant_id, roles:role_id(name)")
              .eq("id", user.id)
              .single();

            const roleName = (userData?.roles as any)?.name as string | undefined;
            const isGlobalAdmin = isGlobalAdminRole(roleName) && !userData?.tenant_id;

            // Prevent loops: only redirect when we're on the portal domain.
            // (In prod, admin runs on a separate Vercel project + domain.)
            if (isGlobalAdmin) {
              maybeLogEnterprise("redirect.globalAdminToAdminConsole", {
                adminDomain,
                roleName,
              });
              const target = new URL(`https://${adminDomain}/signin`);
              // Preserve the original destination as a hint (admin can decide where to land)
              target.searchParams.set("redirect", pathname);
              return NextResponse.redirect(target);
            }
          } catch (e) {
            // If role lookup fails, fail open (do not brick portal)
            console.error("Error determining global admin redirect:", e);
          }
        }

        // Redirect unauthenticated users to signin (except public pages and API routes)
        // API routes handle their own authentication and return JSON responses
        if (!user && !isPublicPage && !isApiRoute && pathname !== '/') {
          if (debugEnterprise) {
            console.log("[portal-middleware] redirect.unauthenticated", {
              pathname,
              host: request.headers.get("host"),
              url: request.url,
            });
          }
          const redirectUrl = new URL('/signin', request.url);
          redirectUrl.searchParams.set('redirect', pathname);
          return NextResponse.redirect(redirectUrl);
        }

        // Redirect authenticated users from signin/signup to dashboard
        if (user && (pathname === '/signin' || pathname === '/signup')) {
          maybeLogEnterprise("redirect.authenticatedFromAuthPageToDashboard");
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Redirect root to dashboard if authenticated
        if (user && pathname === '/') {
          maybeLogEnterprise("redirect.rootToDashboard");
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Check company setup status for dashboard pages (skip API routes)
        // Also skip for admin pages (Platform Admins don't have company profiles)
        const isAdminPage = pathname.startsWith('/dashboard/admin');
        if (user && !isApiRoute && pathname.startsWith('/dashboard') && pathname !== '/dashboard/setup' && !isAdminPage) {
          try {
            // First check if user is a Platform Admin (they don't need company setup)
            const { data: userData } = await supabase
              .from('users')
              .select('tenant_id, roles:role_id(name)')
              .eq('id', user.id)
              .single();

            const roleName = (userData?.roles as any)?.name;
            const isPlatformAdmin = roleName === 'Platform Admin' && !userData?.tenant_id;

            // Platform Admins bypass company setup check
            if (!isPlatformAdmin) {
              // Check if user has completed company setup
              // Also filter by tenant_id if user has one to ensure we get the right company profile
              const { data: companies, error } = await supabase
                .from('company_profiles')
                .select('id, setup_completed, tenant_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);
              maybeLogEnterprise("companySetup.check", {
                userTenantId: userData?.tenant_id ?? null,
                hasError: !!error,
                error: (error as any)?.message,
                companiesCount: companies?.length ?? 0,
                setupCompleted: (companies as any)?.[0]?.setup_completed,
                companyTenantId: (companies as any)?.[0]?.tenant_id,
              });
              
              // If query fails, log error but allow access (fail open)
              if (error) {
                console.error('Error checking company setup:', error);
                // Don't redirect on error - fail open to prevent blocking users
              }

              // If no company or setup not completed, redirect to setup
              // Check if setup_completed is explicitly false or null/undefined
              const hasCompany = companies && companies.length > 0;
              const isSetupCompleted = hasCompany && companies[0]?.setup_completed === true;
              maybeLogEnterprise("companySetup.result", {
                hasCompany,
                isSetupCompleted,
                setupCompletedValue: (companies as any)?.[0]?.setup_completed,
                willRedirect: !hasCompany || !isSetupCompleted,
              });
              
              if (!hasCompany || !isSetupCompleted) {
                maybeLogEnterprise("redirect.toDashboardSetup", {
                  reason: !hasCompany ? "no_companies" : !isSetupCompleted ? "setup_not_completed" : "unknown",
                });
                return NextResponse.redirect(new URL('/dashboard/setup', request.url));
              }
            }
          } catch (error) {
            // If company check fails, log error but allow access (fail open)
            console.error('Error in company setup check:', error);
          }
        }
      } catch (error) {
        // If Supabase operations fail, log error but allow request to proceed
        console.error('Middleware error:', error);
      }
    }

    return response;
  } catch (error) {
    // Catch any unexpected errors and allow request to proceed
    console.error('Unexpected middleware error:', error);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

