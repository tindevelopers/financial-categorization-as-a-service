import { NextRequest, NextResponse } from 'next/server'

/**
 * Backward-compatible shim: delegate to the modern /api/integrations/google-sheets/list
 * so token handling (encryption + tenant-aware credentials) is consistent.
 */
export async function GET(request: NextRequest) {
  try {
    const target = new URL('/api/integrations/google-sheets/list', request.nextUrl.origin)
    const resp = await fetch(target.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
      cache: 'no-store',
    })

    const body = await resp.json().catch(() => ({}))
    return NextResponse.json(body, { status: resp.status })
  } catch (error) {
    console.error('List-sheets shim failed:', error)
    return NextResponse.json(
      { error: 'Failed to list spreadsheets' },
      { status: 500 }
    )
  }
}

