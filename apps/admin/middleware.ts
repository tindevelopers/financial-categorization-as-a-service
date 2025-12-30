import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGlobalAdminRole } from "@tinadmin/core/shared";

/**
 * Admin Middleware
 *
 * Enforces that only global admins (Platform/System/Super) can use the full admin console.
 * Non-admin users are redirected back to the consumer portal domain.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;
  const portalDomain = process.env.NEXT_PUBLIC_PORTAL_DOMAIN || process.env.PORTAL_DOMAIN || null;

  const isApiRoute = pathname.startsWith("/api/");
  const publicPages = ["/signin"];
  const isPublicPage = publicPages.some((p) => pathname.startsWith(p));

  // If Supabase env isn't configured, fail open.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Refresh session (best-effort)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.auth.refreshSession();
  }

  const { data: { user } } = await supabase.auth.getUser();

  // Unauthenticated → sign in (HTML routes only)
  if (!user && !isPublicPage && !isApiRoute) {
    const redirectUrl = new URL("/signin", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated, enforce global-admin role gate for non-API routes.
  if (user && !isApiRoute) {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id, roles:role_id(name)")
        .eq("id", user.id)
        .single();

      const roleName = (userData?.roles as any)?.name as string | undefined;
      const isGlobalAdmin = isGlobalAdminRole(roleName) && !userData?.tenant_id;

      // Logged-in non-global user should not be in admin console
      if (!isGlobalAdmin && portalDomain) {
        const target = new URL(`https://${portalDomain}/signin`);
        target.searchParams.set("redirect", "/dashboard");
        return NextResponse.redirect(target);
      }

      // Logged-in global admin visiting /signin → go to dashboard
      if (isGlobalAdmin && pathname === "/signin") {
        return NextResponse.redirect(new URL("/saas/dashboard", request.url));
      }
    } catch (e) {
      // Fail open to avoid bricking admin during incidents
      console.error("Admin middleware role check error:", e);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};


