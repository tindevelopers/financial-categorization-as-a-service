import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/server'

/**
 * Debug endpoint to test logging and return recent activity
 * This helps verify that console.log statements are working
 */
export async function GET(request: NextRequest) {
  const testLogs: string[] = []
  
  // Test various log levels
  console.log('[DEBUG] GET /api/debug-logs - Testing console.log')
  console.error('[DEBUG] GET /api/debug-logs - Testing console.error')
  console.warn('[DEBUG] GET /api/debug-logs - Testing console.warn')
  
  testLogs.push('✅ Log statements executed')
  testLogs.push(`Timestamp: ${new Date().toISOString()}`)
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      testLogs.push('⚠️ No authenticated user')
      console.log('[DEBUG] No authenticated user')
    } else {
      testLogs.push(`✅ Authenticated user: ${user.email}`)
      console.log(`[DEBUG] Authenticated user: ${user.email} (${user.id})`)
      
      // Test database query logging
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email, full_name, tenant_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (userError) {
        testLogs.push(`❌ User query error: ${userError.message}`)
        console.error('[DEBUG] User query error:', userError)
      } else if (userData) {
        testLogs.push(`✅ User record found: ${userData.email}`)
        console.log('[DEBUG] User record:', userData)
      } else {
        testLogs.push('⚠️ User record not found in database')
        console.warn('[DEBUG] User record not found')
      }
    }
  } catch (error) {
    testLogs.push(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    console.error('[DEBUG] Error in debug endpoint:', error)
  }
  
  return NextResponse.json({
    success: true,
    message: 'Debug logs executed. Check your server terminal for output.',
    logs: testLogs,
    instructions: [
      '1. Look at the terminal where you ran "npm run dev"',
      '2. You should see log statements prefixed with [DEBUG]',
      '3. If you don\'t see logs, the server may be running in background mode',
      '4. Try running the dev server in a visible terminal window'
    ],
    timestamp: new Date().toISOString()
  })
}


