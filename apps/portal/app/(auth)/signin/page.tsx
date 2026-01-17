"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/database/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Client-side telemetry logger
function logAuthEvent(event: string, data?: Record<string, any>) {
  try {
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'auth-session',
        runId: 'login-flow',
        hypothesisId: 'AUTH',
        location: 'apps/portal/app/(auth)/signin/page.tsx',
        message: `auth.${event}`,
        data: { event, ...data },
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Ignore fetch errors
    });
  } catch {
    // Ignore errors
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    logAuthEvent('page_load');
    try {
      const client = createClient();
      setSupabase(client);
      logAuthEvent('client_initialized', { success: true });
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to initialize Supabase client';
      setError(errorMsg);
      logAuthEvent('client_init_error', { error: errorMsg, errorType: err.constructor?.name });
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    logAuthEvent('signin_start', { 
      email: email.substring(0, 5) + '***', // Partial email for privacy
      hasSupabaseClient: !!supabase 
    });

    if (!supabase) {
      const errorMsg = 'Supabase client not initialized';
      setError(errorMsg);
      setLoading(false);
      logAuthEvent('signin_error', { error: errorMsg, errorType: 'ClientNotInitialized' });
      return;
    }

    try {
      const startTime = Date.now();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      const elapsedMs = Date.now() - startTime;

      if (error) {
        logAuthEvent('signin_error', {
          error: error.message,
          errorCode: error.status,
          elapsedMs,
          emailPrefix: email.substring(0, 5) + '***',
        });
        setError(error.message);
        return;
      }

      logAuthEvent('signin_success', {
        userId: data.user?.id?.substring(0, 8) || null,
        emailPrefix: email.substring(0, 5) + '***',
        hasSession: !!data.session,
        elapsedMs,
      });

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      const errorMsg = err.message || "An error occurred";
      logAuthEvent('signin_exception', {
        error: errorMsg,
        errorType: err.constructor?.name,
        stack: err.stack?.substring(0, 200),
      });
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {mounted ? (
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 rounded-t-md h-10" />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 rounded-b-md h-10" />
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !mounted}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
