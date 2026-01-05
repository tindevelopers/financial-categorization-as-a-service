import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('=== TEST LOG: GET request received ===')
  console.error('=== TEST ERROR LOG: This is a test error ===')
  console.warn('=== TEST WARN LOG: This is a test warning ===')
  
  return NextResponse.json({ 
    success: true,
    message: 'Check your server terminal for logs',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  
  console.log('=== TEST LOG: POST request received ===')
  console.log('Request body:', JSON.stringify(body, null, 2))
  console.error('=== TEST ERROR LOG: POST error test ===')
  
  return NextResponse.json({ 
    success: true,
    message: 'Logs should appear in server terminal',
    received: body,
    timestamp: new Date().toISOString()
  })
}


