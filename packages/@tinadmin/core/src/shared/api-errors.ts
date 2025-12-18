/**
 * Standardized API Error Responses
 *
 * Provides consistent error handling and response formatting for API routes.
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "CONFLICT";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  success: false;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  success: true;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Standard error definitions
 */
export const ERRORS: Record<ErrorCode, Omit<ApiError, "details">> = {
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "Authentication required",
    statusCode: 401,
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action",
    statusCode: 403,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "The requested resource was not found",
    statusCode: 404,
  },
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    message: "Invalid request",
    statusCode: 400,
  },
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    statusCode: 400,
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
  },
  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    message: "Service temporarily unavailable",
    statusCode: 503,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many requests. Please try again later",
    statusCode: 429,
  },
  CONFLICT: {
    code: "CONFLICT",
    message: "Resource conflict",
    statusCode: 409,
  },
};

/**
 * Create an error response
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  const error = ERRORS[code];
  return {
    error: {
      code,
      message: customMessage || error.message,
      ...(details && { details }),
    },
    success: false,
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    data,
    success: true,
  };
}

/**
 * Get HTTP status code for an error
 */
export function getStatusCode(code: ErrorCode): number {
  return ERRORS[code].statusCode;
}

/**
 * Create a NextResponse-compatible error object
 * Use with: return NextResponse.json(apiError(code), { status: getStatusCode(code) })
 */
export function apiError(
  code: ErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return createErrorResponse(code, customMessage, details);
}

/**
 * Create a NextResponse-compatible success object
 * Use with: return NextResponse.json(apiSuccess(data))
 */
export function apiSuccess<T>(data: T): ApiSuccessResponse<T> {
  return createSuccessResponse(data);
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

