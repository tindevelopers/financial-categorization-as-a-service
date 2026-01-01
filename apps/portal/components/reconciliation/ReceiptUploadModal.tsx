'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Button, Text } from '@/components/catalyst'
import {
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

interface ReceiptUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (documentIds: string[]) => void
}

interface FileUploadStatus {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  documentId?: string
  error?: string
  progress?: number
}

export function ReceiptUploadModal({ isOpen, onClose, onUploadComplete }: ReceiptUploadModalProps) {
  const [files, setFiles] = useState<FileUploadStatus[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file =>
        file.type === 'application/pdf' ||
        file.type.startsWith('image/')
    )

    addFiles(droppedFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }

  const addFiles = (newFiles: File[]) => {
    const fileStatuses: FileUploadStatus[] = newFiles.map(file => ({
      file,
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...fileStatuses])
  }

  const uploadFile = async (fileStatus: FileUploadStatus, index: number) => {
    // Update status to uploading
    setFiles(prev =>
      prev.map((f, i) => (i === index ? { ...f, status: 'uploading', progress: 0 } : f))
    )

    try {
      const formData = new FormData()
      formData.append('file', fileStatus.file)
      formData.append('fileType', 'receipt')

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      // Be defensive: backend might return non-JSON on unexpected errors.
      const text = await response.text()
      const result = text ? JSON.parse(text) : { success: false, error: 'Empty response from server' }

      if (result.success) {
        setFiles(prev =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: 'success', documentId: result.documentId, progress: 100 }
              : f
          )
        )
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error: any) {
      setFiles(prev =>
        prev.map((f, i) =>
          i === index ? { ...f, status: 'error', error: error.message } : f
        )
      )
    }
  }

  const handleUploadAll = async () => {
    const pendingFiles = files.map((f, i) => ({ fileStatus: f, index: i })).filter(({ fileStatus }) => fileStatus.status === 'pending')

    for (const { fileStatus, index } of pendingFiles) {
      await uploadFile(fileStatus, index)
    }

    // Get successful document IDs
    const successfulIds = files
      .filter(f => f.status === 'success' && f.documentId)
      .map(f => f.documentId!)

    if (successfulIds.length > 0) {
      onUploadComplete(successfulIds)
    }
  }

  const handleClose = () => {
    setFiles([])
    onClose()
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const allUploaded = files.length > 0 && files.every(f => f.status === 'success' || f.status === 'error')
  const hasSuccessful = files.some(f => f.status === 'success')

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Upload Receipts
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-colors
                ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
              `}
            >
              <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <Text className="mb-2">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                PDF, JPG, PNG up to 50MB
              </Text>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((fileStatus, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {fileStatus.status === 'success' && (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                      {fileStatus.status === 'error' && (
                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                      )}
                      {fileStatus.status === 'uploading' && (
                        <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                      {fileStatus.status === 'pending' && (
                        <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {fileStatus.file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {fileStatus.error && (
                          <p className="text-xs text-red-500 mt-1">{fileStatus.error}</p>
                        )}
                      </div>
                    </div>

                    {fileStatus.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </Text>
            <div className="flex gap-3">
              <Button plain onClick={handleClose}>
                Cancel
              </Button>
              {allUploaded && hasSuccessful ? (
                <Button color="blue" onClick={handleClose}>
                  Done
                </Button>
              ) : (
                <Button
                  color="blue"
                  onClick={handleUploadAll}
                  disabled={files.length === 0 || files.every(f => f.status !== 'pending')}
                >
                  Upload {files.filter(f => f.status === 'pending').length} file(s)
                </Button>
              )}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

