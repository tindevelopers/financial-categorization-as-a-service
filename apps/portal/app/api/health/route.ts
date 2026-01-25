import { NextResponse } from 'next/server'
import { logger } from '@/lib/logging'
import { logApiCall } from '@/lib/telemetry'

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    // Log to server logs
    logger.info('Health check requested', {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
    })

    // Log to telemetry (Cursor debug logs)
    logApiCall('GET', '/api/health', 200, null, {
      message: 'Health check successful',
      uptime: process.uptime(),
      nodeVersion: process.version,
    })

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      responseTime: Date.now() - startTime,
      telemetry: {
        debugLogEnabled: true,
        serverLogEnabled: true,
      },
    }

    logger.log('Health check completed', {
      responseTime: response.responseTime,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Health check failed', error)
    logApiCall('GET', '/api/health', 500, error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
