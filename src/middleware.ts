import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { resolveTenant } from "@/lib/tenant/resolver";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
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
        remove(name: string, options: any) {
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

  // Refresh session if expired - this is critical for Server Components
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Log auth status for debugging
  if (authError) {
    console.log("[middleware] Auth error:", authError.message);
  }

  // Resolve tenant from multiple sources (subdomain, URL param, header, session)
  const tenantResult = await resolveTenant({
    hostname: request.headers.get("host") || undefined,
    url: request.url,
    headers: request.headers,
  });

  // Set tenant_id in request headers for downstream use
  if (tenantResult.tenantId) {
    request.headers.set("x-tenant-id", tenantResult.tenantId);
    response.headers.set("x-tenant-id", tenantResult.tenantId);
  }

  // If user is authenticated but no tenant from resolution, try session
  if (user && !tenantResult.tenantId) {
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    if (userData?.tenant_id) {
      request.headers.set("x-tenant-id", userData.tenant_id);
      response.headers.set("x-tenant-id", userData.tenant_id);
    } else if ((userData?.roles as any)?.name === "Platform Admin") {
      // Platform Admin - set a special header
      request.headers.set("x-user-type", "platform-admin");
      response.headers.set("x-user-type", "platform-admin");
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

