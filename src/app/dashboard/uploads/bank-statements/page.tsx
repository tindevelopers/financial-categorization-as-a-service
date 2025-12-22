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
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/signin')
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

