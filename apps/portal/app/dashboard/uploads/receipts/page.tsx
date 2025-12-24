'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/core/database/client'
import { Heading, Text, Button } from '@/components/catalyst'
import Link from 'next/link'
import { ChevronLeftIcon, DocumentIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { useDropzone } from 'react-dropzone'

export default function ReceiptsUploadPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

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

  const onDrop = async (acceptedFiles: File[]) => {
    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Upload files to storage
      const uploadPromises = acceptedFiles.map(async (file) => {
        const fileName = `${user.id}/${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        return file.name
      })

      const uploaded = await Promise.all(uploadPromises)
      setUploadedFiles((prev) => [...prev, ...uploaded])
    } catch (err: any) {
      setError(err.message || 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 10,
    disabled: uploading,
  })

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

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <Heading>Upload Receipts</Heading>
          <Text>
            Upload receipt images or PDFs to match with your bank transactions
          </Text>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Uploading files...
                </p>
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {isDragActive
                    ? 'Drop your files here'
                    : 'Drag & drop your receipts'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  or click to browse
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <DocumentIcon className="h-4 w-4" />
                  <span>Supports .jpg, .png, .gif, .pdf (max 10 files)</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              Successfully uploaded {uploadedFiles.length} file(s)
            </p>
            <ul className="text-sm text-green-600 dark:text-green-300 space-y-1">
              {uploadedFiles.map((file, index) => (
                <li key={index}>• {file}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {uploadedFiles.length === 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
              How it works
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2 list-disc list-inside">
              <li>Upload receipt images or PDFs</li>
              <li>We'll extract transaction details using OCR</li>
              <li>Match receipts with your bank transactions</li>
              <li>Keep organized records for tax purposes</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

