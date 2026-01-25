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

    // Precompute mismatched Supabase cookie names to clear (local dev only).
    // Important: middleware may recreate `response` later (e.g. in Supabase cookie adapters),
    // so we store this list and re-apply clears whenever `response` is rebuilt.
    let mismatchedSbCookieNamesToClear: string[] = [];
    let mismatchMeta: {
      supabaseHost: string | null;
      supabaseProjectRef: string | null;
      mismatchedRefs: string[];
    } = { supabaseHost: null, supabaseProjectRef: null, mismatchedRefs: [] };

    {
      let supabaseHost: string | null = null;
      let supabaseProjectRef: string | null = null;
      try {
        const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
        supabaseHost = u.host;
        supabaseProjectRef = u.host.split(".")[0] || null;
      } catch {
        // ignore
      }

      const isLocalSupabase =
        !!supabaseHost &&
        (supabaseHost.startsWith("127.0.0.1:") ||
          supabaseHost.startsWith("localhost:") ||
          supabaseHost.endsWith(".local"));

      const cookieNames = request.cookies.getAll().map((c) => c.name);
      
      if (isLocalSupabase && supabaseProjectRef) {
        // Clear cookies from other local Supabase instances
        const cookieProjectRefs = Array.from(
          new Set(
            cookieNames
              .filter((n) => n.startsWith("sb-"))
              .map((n) => {
                const m = n.match(/^sb-([^-]+)-/);
                return m?.[1] || null;
              })
              .filter(Boolean) as string[]
          )
        );

        const mismatchedRefs = cookieProjectRefs.filter((r) => r !== supabaseProjectRef);
        mismatchedSbCookieNamesToClear = cookieNames.filter((n) =>
          mismatchedRefs.some((r) => n.startsWith(`sb-${r}-`))
        );
        mismatchMeta = { supabaseHost, supabaseProjectRef, mismatchedRefs };
      } else if (!isLocalSupabase && supabaseHost) {
        // Using remote Supabase - clear any localhost cookies (from previous local dev)
        mismatchedSbCookieNamesToClear = cookieNames.filter((n) => 
          n.startsWith("sb-127-") || 
          n.startsWith("sb-localhost-") ||
          (n.startsWith("sb-") && n.includes("127.0.0.1"))
        );
        if (mismatchedSbCookieNamesToClear.length > 0) {
          mismatchMeta = { 
            supabaseHost, 
            supabaseProjectRef, 
            mismatchedRefs: ['127', 'localhost'] 
          };
        }
      }
    }

    const applyMismatchedSupabaseCookieClears = (resp: NextResponse) => {
      if (mismatchedSbCookieNamesToClear.length === 0) return;
      for (const name of mismatchedSbCookieNamesToClear) {
        resp.cookies.set({
          name,
          value: "",
          maxAge: 0,
          path: "/",
        });
      }
    };

    // Apply immediately for this middleware response.
    applyMismatchedSupabaseCookieClears(response);


    if (mismatchedSbCookieNamesToClear.length > 0) {
      // Cookies cleared silently
    }

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
                applyMismatchedSupabaseCookieClears(response);
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
                applyMismatchedSupabaseCookieClears(response);
                response.cookies.set({
                  name,
                  value: "",
                  ...options,
                });
              },
            },
          }
        );

        // Get user with error handling for corrupted session data
        // Use getUser() instead of getSession() for security - it authenticates with the server
        // getUser() automatically refreshes tokens if needed, so we don't need to call refreshSession()
        // During PRERENDER or with corrupted cookies, these operations may fail
        let user = null;
        
        // #region agent log
        const sbCookieNames = request.cookies.getAll().filter((c) => c.name.startsWith('sb-')).map((c) => ({ name: c.name, valueLength: c.value?.length || 0, valuePreview: c.value?.substring(0, 50) || '' }));
        fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'upload-flow',hypothesisId:'H1',location:'apps/portal/middleware.ts:getUser',message:'middleware user check start',data:{pathname,hasCookies:sbCookieNames.length>0,cookieCount:sbCookieNames.length,cookieNames:sbCookieNames.map(c=>c.name)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        try {
          // Use getUser() which authenticates with the server and automatically refreshes tokens
          // This is more secure than getSession() which reads from cookies without verification
          const userResult = await supabase.auth.getUser();
          user = userResult.data?.user ?? null;
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'upload-flow',hypothesisId:'H1',location:'apps/portal/middleware.ts:getUser',message:'user retrieved successfully',data:{hasUser:!!user,userId:user?.id?.substring(0,8)||null,pathname},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        } catch (userError: any) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'upload-flow',hypothesisId:'H1',location:'apps/portal/middleware.ts:getUser',message:'user error caught',data:{errorMessage:userError?.message||null,errorType:userError?.constructor?.name||null,isCorruptionError:userError?.message?.includes('Cannot create property')||userError?.message?.includes('on string')||false,isRefreshTokenError:userError?.code==='refresh_token_already_used'||userError?.message?.includes('Already Used')||false,pathname},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          // Handle errors getting user - treat as unauthenticated
          // Handle "refresh_token_already_used" errors gracefully
          // This can happen if multiple requests try to refresh simultaneously
          if (userError?.code === 'refresh_token_already_used' || 
              userError?.message?.includes('Already Used')) {
            // Token was already refreshed by another request - continue without user
            // The next request will succeed
          } else if (userError?.message?.includes('Cannot create property') || 
              userError?.message?.includes('on string')) {
            // Corrupted session data - clear cookies
            try {
              const cookieNames = request.cookies.getAll().map((c) => c.name);
              cookieNames.filter((n) => n.startsWith('sb-')).forEach((name) => {
                response.cookies.set({ name, value: '', maxAge: 0 });
              });
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'upload-flow',hypothesisId:'H1',location:'apps/portal/middleware.ts:getUser',message:'cleared corrupted cookies from getUser error',data:{clearedCount:cookieNames.filter((n) => n.startsWith('sb-')).length},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            } catch {
              // Ignore cookie clearing errors
            }
          }
          // Continue without user - user will be treated as unauthenticated
        }


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

            const tenantId = userData?.tenant_id ?? null;

            const roleName = (userData?.roles as any)?.name;
            const isPlatformAdmin = roleName === 'Platform Admin' && !userData?.tenant_id;

            // Platform Admins bypass company setup check
            if (!isPlatformAdmin) {
              // Load tenant subscription type to detect enterprise
              let tenantSubscription: string | null = null;
              if (tenantId) {
                try {
                  const { data: tenantRow } = await supabase
                    .from('tenants')
                    .select('subscription_type')
                    .eq('id', tenantId)
                    .maybeSingle();
                  tenantSubscription = tenantRow?.subscription_type ?? null;
                } catch (tenantErr) {
                  console.error('Error fetching tenant subscription_type:', tenantErr);
                }
              }

              const isEnterpriseTenant = tenantSubscription === 'enterprise';

              // Check if user has completed company setup
              // Also filter by tenant_id if user has one to ensure we get the right company profile
              let companyQuery = supabase
                .from('company_profiles')
                .select('id, setup_completed, tenant_id, setup_step, company_name')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

              if (tenantId) {
                companyQuery = companyQuery.eq('tenant_id', tenantId);
              }

              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'setup-loop',hypothesisId:'H1',location:'apps/portal/middleware.ts:companyQuery',message:'before company query',data:{userId:user.id?.substring(0,8)||null,tenantId,pathname,isEnterpriseTenant},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
              console.log('[setup-loop] companyQuery.start', JSON.stringify({ userId: user.id?.substring(0,8) || null, tenantId, pathname, isEnterpriseTenant }));

              const { data: companies, error } = await companyQuery;
              maybeLogEnterprise("companySetup.check", {
                userTenantId: tenantId,
                hasError: !!error,
                error: (error as any)?.message,
                companiesCount: companies?.length ?? 0,
                setupCompleted: (companies as any)?.[0]?.setup_completed,
                companyTenantId: (companies as any)?.[0]?.tenant_id,
                firstCompanyId: (companies as any)?.[0]?.id,
                firstCompanyName: (companies as any)?.[0]?.company_name,
              });
              console.log('[setup-loop] companyQuery.result', JSON.stringify({
                userId: user.id?.substring(0,8) || null,
                tenantId,
                companiesCount: companies?.length ?? 0,
                firstCompanyId: (companies as any)?.[0]?.id,
                firstCompanyTenant: (companies as any)?.[0]?.tenant_id,
                firstCompanySetup: (companies as any)?.[0]?.setup_completed,
                error: (error as any)?.message || null,
              }));
              
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
                companyTenantId: (companies as any)?.[0]?.tenant_id,
                userTenantId: tenantId,
                companyId: (companies as any)?.[0]?.id,
              });
              
              let finalHasCompany = hasCompany;
              let finalIsSetupCompleted = isSetupCompleted;

              // Fallback: if no company found with tenant filter, try without tenant filter and repair tenant_id
              if (!finalHasCompany && tenantId) {
                try {
                  const { data: fallbackCompanies, error: fallbackError } = await supabase
                    .from('company_profiles')
                    .select('id, setup_completed, tenant_id, setup_step, company_name')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  console.log('[setup-loop] companyQuery.fallback', JSON.stringify({
                    userId: user.id?.substring(0,8) || null,
                    tenantId,
                    fallbackCount: fallbackCompanies?.length ?? 0,
                    fallbackTenant: (fallbackCompanies as any)?.[0]?.tenant_id,
                    fallbackSetup: (fallbackCompanies as any)?.[0]?.setup_completed,
                    error: (fallbackError as any)?.message || null,
                  }));

                  if (fallbackCompanies && fallbackCompanies.length > 0) {
                    const fb = fallbackCompanies[0];
                    const needsTenantRepair = !fb.tenant_id && tenantId;
                    if (needsTenantRepair) {
                      try {
                        await supabase
                          .from('company_profiles')
                          .update({
                            tenant_id: tenantId,
                            setup_completed: true,
                            setup_step: fb.setup_step ?? 5,
                          })
                          .eq('id', fb.id)
                          .eq('user_id', user.id);
                        console.log('[setup-loop] companyQuery.repairTenant', JSON.stringify({
                          userId: user.id?.substring(0,8) || null,
                          companyId: fb.id,
                          tenantId,
                        }));
                        finalHasCompany = true;
                        finalIsSetupCompleted = true;
                      } catch (repairErr) {
                        console.error('Company tenant repair failed:', repairErr);
                      }
                    } else {
                      finalHasCompany = true;
                      finalIsSetupCompleted = fb.setup_completed === true;
                    }
                  }
                } catch (fallbackCatchErr) {
                  console.error('Fallback company query failed:', fallbackCatchErr);
                }
              }

              // Enterprise tenants: auto-create/complete company profile to avoid setup loop
              if (isEnterpriseTenant && (!hasCompany || !isSetupCompleted)) {
                let rechecked: { id: string; setup_completed: boolean } | null = null;
                try {
                  if (hasCompany && companies?.[0]?.id) {
                    // Update existing profile to mark completed
                    await supabase
                      .from('company_profiles')
                      .update({
                        setup_completed: true,
                        setup_step: (companies as any)?.[0]?.setup_step ?? 5,
                      })
                      .eq('id', companies[0].id)
                      .eq('user_id', user.id);
                  } else {
                    // Create minimal profile for enterprise tenant
                    await supabase
                      .from('company_profiles')
                      .insert({
                        user_id: user.id,
                        tenant_id: tenantId,
                        company_name: user.email || 'Enterprise Company',
                        company_type: 'limited_company',
                        default_currency: 'GBP',
                        setup_completed: true,
                        setup_step: 5,
                      });
                  }

                  // Re-fetch to verify completion
                  const { data: recheckCompanies } = await supabase
                    .from('company_profiles')
                    .select('id, setup_completed')
                    .eq('user_id', user.id)
                    .eq('tenant_id', tenantId ?? undefined)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (recheckCompanies && recheckCompanies.length > 0) {
                    rechecked = recheckCompanies[0] as any;
                  }

                  const recheckCompleted = rechecked?.setup_completed === true;
                  if (recheckCompleted) {
                    finalHasCompany = true;
                    finalIsSetupCompleted = true;
                    maybeLogEnterprise("companySetup.autocomplete.enterprise", {
                      tenantId,
                      companyId: rechecked?.id,
                    });
                  }
                } catch (enterpriseErr) {
                  console.error('Enterprise auto-complete failed:', enterpriseErr);
                }
              }

              if (!finalHasCompany || !finalIsSetupCompleted) {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'setup-loop',hypothesisId:'H2',location:'apps/portal/middleware.ts:redirectSetup',message:'redirecting to setup',data:{pathname,tenantId,hasCompany:finalHasCompany,isSetupCompleted:finalIsSetupCompleted,companyId:(companies as any)?.[0]?.id,companyTenantId:(companies as any)?.[0]?.tenant_id,isEnterpriseTenant},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                console.log('[setup-loop] redirect.toSetup', JSON.stringify({
                  pathname,
                  tenantId,
                  hasCompany: finalHasCompany,
                  isSetupCompleted: finalIsSetupCompleted,
                  companyId: (companies as any)?.[0]?.id,
                  companyTenantId: (companies as any)?.[0]?.tenant_id,
                  isEnterpriseTenant,
                }));
                maybeLogEnterprise("redirect.toDashboardSetup", {
                  reason: !finalHasCompany ? "no_companies" : !finalIsSetupCompleted ? "setup_not_completed" : "unknown",
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

    // Ensure clears are present even if `response` was rebuilt later.
    applyMismatchedSupabaseCookieClears(response);
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

