'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Heading, Text, Button, Input, Label, Field } from '@/components/catalyst'
import { 
  ArrowLeftIcon, 
  CheckCircleIcon,
  PencilIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

interface LineItem {
  description: string
  quantity?: number
  unit_price?: number
  total: number
}

interface InvoiceData {
  id: string
  original_filename: string
  vendor_name?: string
  document_date?: string
  document_number?: string
  order_number?: string
  total_amount?: number
  subtotal_amount?: number
  tax_amount?: number
  fee_amount?: number
  tax_rate?: number
  currency?: string
  line_items?: LineItem[]
  ocr_status: string
  ocr_confidence?: number
  ocr_needs_review?: boolean
  extracted_text?: string
  file_type?: string
  supabase_path?: string
  storage_tier?: string
}

export default function InvoiceReviewPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedData, setEditedData] = useState<Partial<InvoiceData>>({})
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)

  useEffect(() => {
    loadInvoiceData()
  }, [invoiceId])

  const loadInvoiceData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${invoiceId}`)
      if (!response.ok) throw new Error('Failed to load invoice')
      
      const data = await response.json()
      setInvoice(data.document)
      setEditedData(data.document)
      setDocumentUrl(data.document.downloadUrl || null)
    } catch (error) {
      console.error('Error loading invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/documents/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_name: editedData.vendor_name,
          document_date: editedData.document_date,
          document_number: editedData.document_number,
          total_amount: editedData.total_amount,
          subtotal_amount: editedData.subtotal_amount,
          tax_amount: editedData.tax_amount,
          tax_rate: editedData.tax_rate,
          line_items: editedData.line_items,
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      
      await loadInvoiceData()
      setEditing(false)
    } catch (error) {
      console.error('Error saving invoice:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—'
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: invoice?.currency || 'GBP',
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="space-y-8">
        <Heading>Invoice Not Found</Heading>
        <Text>The invoice you're looking for doesn't exist.</Text>
        <Link href="/dashboard/uploads/receipts">
          <Button outline>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/uploads/receipts">
            <Button outline>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <Heading>Review Invoice</Heading>
            <Text className="text-gray-500">{invoice.original_filename}</Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button
                outline
                onClick={() => setEditing(true)}
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Link href="/dashboard/statements">
                <Button color="blue">
                  <ArrowsRightLeftIcon className="h-4 w-4 mr-2" />
                  Go to Statements
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Button
                outline
                onClick={() => {
                  setEditing(false)
                  setEditedData(invoice)
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* OCR Status Warning */}
      {invoice.ocr_needs_review && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Review Needed
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Some data may need manual verification. Please review the extracted information below.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Preview */}
        {documentUrl && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5" />
              Document Preview
            </h3>
            <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
              {invoice.file_type === 'application/pdf' || invoice.original_filename.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={documentUrl}
                  className="w-full h-full"
                  title="Invoice Preview"
                />
              ) : (
                <img
                  src={documentUrl}
                  alt="Invoice"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Open in new tab →
            </a>
          </div>
        )}

        {/* Extracted Data */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Basic Information
            </h3>
            
            <div className="space-y-4">
              {/* Vendor Name */}
              <Field>
                <Label>Vendor / Supplier</Label>
                {editing ? (
                  <Input
                    value={editedData.vendor_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, vendor_name: e.target.value })}
                    placeholder="Enter vendor name"
                  />
                ) : (
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {invoice.vendor_name || '—'}
                  </p>
                )}
              </Field>

              {/* Invoice Number */}
              <Field>
                <Label>Invoice Number</Label>
                {editing ? (
                  <Input
                    value={editedData.document_number || ''}
                    onChange={(e) => setEditedData({ ...editedData, document_number: e.target.value })}
                    placeholder="Enter invoice number"
                  />
                ) : (
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {invoice.document_number || '—'}
                  </p>
                )}
              </Field>

              {/* Date */}
              <Field>
                <Label>Invoice Date</Label>
                {editing ? (
                  <Input
                    type="date"
                    value={editedData.document_date || ''}
                    onChange={(e) => setEditedData({ ...editedData, document_date: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {formatDate(invoice.document_date)}
                  </p>
                )}
              </Field>
            </div>
          </div>

          {/* Financial Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Financial Details
            </h3>
            
            <div className="space-y-4">
              {/* Subtotal */}
              <Field className="flex justify-between items-center">
                <Label>Subtotal (excl. VAT)</Label>
                {editing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.subtotal_amount || ''}
                    onChange={(e) => setEditedData({ ...editedData, subtotal_amount: parseFloat(e.target.value) || 0 })}
                    className="w-32"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(invoice.subtotal_amount)}
                  </p>
                )}
              </Field>

              {/* VAT */}
              <Field className="flex justify-between items-center">
                <Label>VAT ({invoice.tax_rate || 20}%)</Label>
                {editing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.tax_amount || ''}
                    onChange={(e) => setEditedData({ ...editedData, tax_amount: parseFloat(e.target.value) || 0 })}
                    className="w-32"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(invoice.tax_amount)}
                  </p>
                )}
              </Field>

              {/* Fees */}
              {(invoice.fee_amount || editing) && (
                <Field className="flex justify-between items-center">
                  <Label>Fees / Charges</Label>
                  {editing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editedData.fee_amount || ''}
                      onChange={(e) => setEditedData({ ...editedData, fee_amount: parseFloat(e.target.value) || 0 })}
                      className="w-32"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(invoice.fee_amount)}
                    </p>
                  )}
                </Field>
              )}

              {/* Total */}
              <Field className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <Label className="text-lg">Total</Label>
                {editing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.total_amount || ''}
                    onChange={(e) => setEditedData({ ...editedData, total_amount: parseFloat(e.target.value) || 0 })}
                    className="w-32 text-lg font-semibold"
                  />
                ) : (
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(invoice.total_amount)}
                  </p>
                )}
              </Field>
            </div>
          </div>

          {/* Line Items */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Line Items ({invoice.line_items.length})
              </h3>
              
              <div className="space-y-3">
                {invoice.line_items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.description}
                      </p>
                      {item.quantity && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Qty: {item.quantity} {item.unit_price && `× ${formatCurrency(item.unit_price)}`}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white ml-4">
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR Confidence */}
          {invoice.ocr_confidence !== undefined && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                OCR Confidence
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        invoice.ocr_confidence >= 0.8
                          ? 'bg-green-500'
                          : invoice.ocr_confidence >= 0.5
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${invoice.ocr_confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round(invoice.ocr_confidence * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
