'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import SpreadsheetUpload from '@/components/categorization/SpreadsheetUpload'
import { Heading, Text } from '@/components/catalyst'
import Link from 'next/link'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'

export default function BankStatementsUploadPage() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const {
          data: { user },
        } = await supabase.auth.getUser()


        if (!user) {
          router.push('/signin')
        }
      } catch (error: any) {
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

