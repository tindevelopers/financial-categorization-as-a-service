'use client'

import { useEffect } from 'react'

/**
 * Global fetch interceptor to debug "Failed to fetch" errors
 * This component wraps all fetch calls to capture errors
 */
export function FetchInterceptor() {
  useEffect(() => {
    // Store original fetch
    const originalFetch = window.fetch

    // Intercept all fetch calls
    window.fetch = async function(...args: Parameters<typeof fetch>) {
      const [url, options] = args
      const urlString = typeof url === 'string' ? url : url.toString()
      const method = options?.method || 'GET'
      
      // #region agent log
      const logData = {
        sessionId: 'debug-session',
        runId: 'fetch-debug',
        hypothesisId: 'H2',
        location: 'apps/portal/components/debug/FetchInterceptor.tsx',
        message: 'fetch intercepted',
        data: {
          url: urlString,
          method,
          hasOptions: !!options,
          headers: options?.headers ? Object.keys(options.headers) : [],
        },
        timestamp: Date.now(),
      }
      try {
        originalFetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
        }).catch(() => {})
      } catch {}
      // #endregion

      try {
        const startTime = Date.now()
        const response = await originalFetch.apply(this, args)
        const elapsedMs = Date.now() - startTime

        // #region agent log
        const responseLogData = {
          sessionId: 'debug-session',
          runId: 'fetch-debug',
          hypothesisId: 'H2',
          location: 'apps/portal/components/debug/FetchInterceptor.tsx',
          message: 'fetch response',
          data: {
            url: urlString,
            method,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            elapsedMs,
          },
          timestamp: Date.now(),
        }
        try {
          originalFetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseLogData),
          }).catch(() => {})
        } catch {}
        // #endregion

        return response
      } catch (error: any) {
        // #region agent log
        const errorLogData = {
          sessionId: 'debug-session',
          runId: 'fetch-debug',
          hypothesisId: 'H2',
          location: 'apps/portal/components/debug/FetchInterceptor.tsx',
          message: 'fetch error',
          data: {
            url: urlString,
            method,
            error: error?.message || String(error),
            errorType: error?.constructor?.name,
            errorName: error?.name,
            isNetworkError: error?.message?.includes('Failed to fetch') || 
                           error?.message?.includes('NetworkError') ||
                           error?.name === 'TypeError',
            stack: error?.stack?.substring(0, 300),
          },
          timestamp: Date.now(),
        }
        try {
          originalFetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorLogData),
          }).catch(() => {})
        } catch {}
        // #endregion

        throw error
      }
    }

    // Global error handler for unhandled fetch errors
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('Failed to fetch') || 
          event.error?.name === 'TypeError') {
        // #region agent log
        const unhandledErrorData = {
          sessionId: 'debug-session',
          runId: 'fetch-debug',
          hypothesisId: 'H2',
          location: 'apps/portal/components/debug/FetchInterceptor.tsx',
          message: 'unhandled fetch error',
          data: {
            error: event.error?.message || String(event.error),
            errorType: event.error?.constructor?.name,
            errorName: event.error?.name,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack?.substring(0, 300),
          },
          timestamp: Date.now(),
        }
        try {
          originalFetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(unhandledErrorData),
          }).catch(() => {})
        } catch {}
        // #endregion
      }
    }

    window.addEventListener('error', handleError)

    // Cleanup
    return () => {
      window.fetch = originalFetch
      window.removeEventListener('error', handleError)
    }
  }, [])

  return null
}
