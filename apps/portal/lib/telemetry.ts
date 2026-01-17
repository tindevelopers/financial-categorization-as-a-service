/**
 * Telemetry and logging utility for Cursor debug logs
 * Writes structured logs to .cursor/debug.log
 */

const DEBUG_LOG_ENDPOINT = 'http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e';
const DEBUG_LOG_FILE = '.cursor/debug.log';

interface LogEntry {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, any>;
  timestamp: number;
}

/**
 * Write log entry to Cursor debug log
 */
export function logToCursor(entry: LogEntry): void {
  // Try to write to HTTP endpoint (for Cursor agent)
  if (typeof fetch !== 'undefined') {
    fetch(DEBUG_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Ignore fetch errors (endpoint may not be available)
    });
  }

  // Also write to file system (for server-side)
  if (typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(process.cwd(), DEBUG_LOG_FILE);
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logPath, logLine, { flag: 'a' });
    } catch (err) {
      // Ignore file write errors
    }
  }
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  event: 'signin_start' | 'signin_success' | 'signin_error' | 'signout' | 'session_check' | 'session_expired',
  data?: Record<string, any>
): void {
  logToCursor({
    sessionId: 'auth-session',
    runId: 'login-flow',
    hypothesisId: 'AUTH',
    location: 'apps/portal/lib/telemetry.ts:logAuthEvent',
    message: `auth.${event}`,
    data: {
      event,
      ...data,
    },
    timestamp: Date.now(),
  });
}

/**
 * Log API request/response
 */
export function logApiCall(
  method: string,
  path: string,
  status?: number,
  error?: any,
  data?: Record<string, any>
): void {
  logToCursor({
    sessionId: 'api-session',
    runId: 'api-calls',
    hypothesisId: 'API',
    location: `apps/portal/api/${path}`,
    message: error ? 'api.error' : 'api.success',
    data: {
      method,
      path,
      status,
      error: error?.message || error,
      errorType: error?.constructor?.name,
      ...data,
    },
    timestamp: Date.now(),
  });
}

/**
 * Log database operations
 */
export function logDbOperation(
  operation: 'select' | 'insert' | 'update' | 'delete',
  table: string,
  success: boolean,
  error?: any,
  data?: Record<string, any>
): void {
  logToCursor({
    sessionId: 'db-session',
    runId: 'db-operations',
    hypothesisId: 'DB',
    location: `apps/portal/lib/database:${operation}`,
    message: success ? 'db.success' : 'db.error',
    data: {
      operation,
      table,
      success,
      error: error?.message || error,
      errorCode: error?.code,
      ...data,
    },
    timestamp: Date.now(),
  });
}
