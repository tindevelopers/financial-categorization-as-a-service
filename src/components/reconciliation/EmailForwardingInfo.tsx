'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Button, Text } from '@/components/catalyst'
import { XMarkIcon, EnvelopeIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'

interface EmailForwardingInfoProps {
  isOpen: boolean
  onClose: () => void
}

interface ForwardingAddress {
  id: string
  email_address: string
  emails_received: number
  last_email_at?: string
}

interface EmailStats {
  total: number
  completed: number
  failed: number
  pending: number
}

export function EmailForwardingInfo({ isOpen, onClose }: EmailForwardingInfoProps) {
  const [address, setAddress] = useState<ForwardingAddress | null>(null)
  const [stats, setStats] = useState<EmailStats>({ total: 0, completed: 0, failed: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadEmailAddress()
    }
  }, [isOpen])

  const loadEmailAddress = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/email/forwarding-address')
      if (response.ok) {
        const data = await response.json()
        setAddress(data.active_address)
        setStats(data.statistics)
      }
    } catch (error) {
      console.error('Failed to load email address:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAddress = async () => {
    try {
      setGenerating(true)
      const response = await fetch('/api/email/forwarding-address', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setAddress(data.address)
      }
    } catch (error) {
      console.error('Failed to generate address:', error)
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address.email_address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="h-6 w-6 text-blue-500" />
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Email Forwarding
              </DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : address ? (
              <>
                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Unique Email Address
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">
                      {address.email_address}
                    </div>
                    <Button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Forward receipts and invoices to this address. They'll be automatically uploaded
                    and matched with your transactions.
                  </Text>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    How to use:
                  </h4>
                  <ol className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    <li>1. Forward receipt emails to your unique address above</li>
                    <li>2. We'll automatically extract PDF and image attachments</li>
                    <li>3. OCR will extract vendor, amount, and tax details</li>
                    <li>4. Documents are auto-matched with your transactions</li>
                  </ol>
                </div>

                {/* Statistics */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Statistics
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.total}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Emails</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.completed}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Processed</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {stats.pending}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {stats.failed}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    <p>Emails received: {address.emails_received}</p>
                    <p>Last email: {formatDate(address.last_email_at)}</p>
                  </div>
                </div>
              </>
            ) : (
              /* No Address Yet */
              <div className="text-center py-12">
                <EnvelopeIcon className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Email Address Yet
                </h3>
                <Text className="mb-6 max-w-md mx-auto">
                  Generate a unique email address to start forwarding receipts and invoices
                  directly into your reconciliation workflow.
                </Text>
                <Button color="blue" onClick={generateAddress} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate Email Address'}
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
            <Button plain onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

