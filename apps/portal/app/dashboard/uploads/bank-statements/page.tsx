'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/database/client'
import SpreadsheetUpload from '@/components/consumer/SpreadsheetUpload'
import { Heading, Text } from '@/components/catalyst'
import Link from 'next/link'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'

export default function BankStatementsUploadPage() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-statements/page.tsx:16',message:'checkAuth started',data:{hasSupabaseUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL,hasSupabaseKey:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        const supabase = createClient()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-statements/page.tsx:22',message:'Supabase client created',data:{clientCreated:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const {
          data: { user },
        } = await supabase.auth.getUser()

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-statements/page.tsx:29',message:'Auth check result',data:{hasUser:!!user,userId:user?.id || null},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion

        if (!user) {
          router.push('/signin')
        }
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bank-statements/page.tsx:38',message:'checkAuth exception',data:{errorMessage:error?.message || 'unknown',errorType:error?.constructor?.name || 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error('Auth check error:', error)
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/uploads"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to Uploads
      </Link>

      {/* Upload Component */}
      <SpreadsheetUpload />
    </div>
  )
}

