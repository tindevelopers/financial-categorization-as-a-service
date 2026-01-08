"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon, DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/database/client";
import ViewSwitcher, {
  getStoredViewPreference,
  type ViewType,
} from "@/components/invoice/ViewSwitcher";
import InvoiceCardView from "@/components/invoice/InvoiceCardView";
import InvoiceSplitView from "@/components/invoice/InvoiceSplitView";
import InvoiceTableView from "@/components/invoice/InvoiceTableView";
import BankStatementTableView from "@/components/categorization/BankStatementTableView";
import BankStatementCardView from "@/components/categorization/BankStatementCardView";
import BankStatementSplitView from "@/components/categorization/BankStatementSplitView";
import SyncStatusIndicator from "@/components/categorization/SyncStatusIndicator";
import SyncButton from "@/components/categorization/SyncButton";

interface Document {
  id: string;
  original_filename: string;
  supabase_path: string | null;
  storage_tier: string;
  mime_type: string | null;
  vendor_name?: string | null;
  invoice_number?: string | null;
  po_number?: string | null;
  order_number?: string | null;
  document_date?: string | null;
  delivery_date?: string | null;
  paid_date?: string | null;
  total_amount?: number | null;
  tax_amount?: number | null;
  subtotal_amount?: number | null;
  fee_amount?: number | null;
  shipping_amount?: number | null;
  currency?: string | null;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total: number;
  }> | null;
  payment_method?: string | null;
  notes?: string | null;
  field_confidence?: Record<string, number> | null;
  extraction_methods?: Record<string, string> | null;
}

interface Transaction {
  id: string;
  original_description: string;
  amount: number;
  date: string;
  category: string | null;
  subcategory: string | null;
  confidence_score: number;
  user_confirmed: boolean;
  user_notes: string | null;
  invoice_number: string | null;
  document_id: string | null;
  document?: Document | null;
  group_transaction_ids?: string[];
  sync_status?: "pending" | "synced" | "failed" | null;
  last_synced_at?: string | null;
  sync_error?: string | null;
  payee_name?: string | null;
  payer_name?: string | null;
  paid_in_amount?: number | null;
  paid_out_amount?: number | null;
  payment_description_reference?: string | null;
}

interface TransactionReviewProps {
  jobId: string;
}

export default function TransactionReview({ jobId }: TransactionReviewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [installingSync, setInstallingSync] = useState(false);
  const [installSyncMessage, setInstallSyncMessage] = useState<string | null>(null);
  
  // Track if any child view is in editing mode to pause polling
  const [isEditing, setIsEditing] = useState(false);
  
  // Initialize view from stored preference (safe for SSR)
  const [currentView, setCurrentView] = useState<ViewType>("table");
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
  
  // Export destination info
  const [exportInfo, setExportInfo] = useState<{
    destination: "job" | "bank_account" | "company" | "new";
    spreadsheetUrl: string | null;
    spreadsheetName: string | null;
    bankAccountName: string | null;
    willSync: boolean;
    message: string;
  } | null>(null);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<{
    status: "synced" | "pending" | "failed" | null;
    lastSyncedAt: string | null;
    pendingCount: number;
  }>({
    status: null,
    lastSyncedAt: null,
    pendingCount: 0,
  });
  const [hasSpreadsheet, setHasSpreadsheet] = useState(false);

  // Load stored preference on client-side
  useEffect(() => {
    setCurrentView(getStoredViewPreference());
  }, []);

  // Load access token for bearer fallback (helps when cookies are not sent in some environments)
  useEffect(() => {
    try {
      const supabase = createClient();
      // Use getUser() first to verify authentication, then get session
      supabase.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (user) {
            // User is authenticated, get session for access token
            return supabase.auth.getSession();
          }
          return { data: { session: null }, error: null };
        })
        .then(({ data }) => {
          const token = data.session?.access_token || null;
          setAccessToken(token);
        })
        .catch(() => {
          // ignore
        });
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
    }
  }, []);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  }, [accessToken]);

  // Use ref to track isEditing so polling interval doesn't need to re-create on every edit state change
  const isEditingRef = React.useRef(isEditing);
  React.useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Initial load and polling
  useEffect(() => {
    loadTransactions();
    // Poll for updates if job is still processing, but pause while editing
    const interval = setInterval(() => {
      if (!isEditingRef.current) {
      loadTransactions();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    // Load document URLs for all transactions with documents
    const loadDocumentUrls = async () => {
      const transactionsWithDocs = transactions.filter(
        (tx) => tx.document_id && !documentUrls[tx.document_id]
      );

      if (transactionsWithDocs.length === 0) return;

      const newUrls: Record<string, string> = {};
      const newLoadingUrls = new Set(loadingUrls);

      for (const tx of transactionsWithDocs) {
        if (!tx.document_id || documentUrls[tx.document_id]) continue;

        newLoadingUrls.add(tx.document_id);
        try {
          const response = await fetch(`/api/documents/${tx.document_id}/download`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            if (data.downloadUrl) {
              newUrls[tx.document_id] = data.downloadUrl;
            }
          }
        } catch (e) {
          console.error("Failed to load document URL:", e);
        }
        newLoadingUrls.delete(tx.document_id);
      }

      if (Object.keys(newUrls).length > 0) {
        setDocumentUrls((prev) => ({ ...prev, ...newUrls }));
      }
      setLoadingUrls(newLoadingUrls);
    };

    loadDocumentUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Check if transactions are bank statement transactions (no documents) or invoice transactions (with documents)
  const hasDocuments = useMemo(() => {
    return transactions.some((tx) => tx.document_id && tx.document);
  }, [transactions]);
  
  const isBankStatementJob = useMemo(() => {
    return transactions.length > 0 && !hasDocuments;
  }, [transactions, hasDocuments]);

  const getCounterpartyLabel = (tx: Transaction): string | null => {
    // Outgoing (debit) -> Payee, Incoming (credit) -> Payer. If sign is ambiguous, prefer payee then payer.
    const isDebit = typeof tx.amount === "number" ? tx.amount < 0 : false;
    const payee = tx.payee_name?.trim();
    const payer = tx.payer_name?.trim();
    if (isDebit && payee) return `Payee: ${payee}`;
    if (!isDebit && payer) return `Payer: ${payer}`;
    if (payee) return `Payee: ${payee}`;
    if (payer) return `Payer: ${payer}`;
    return null;
  };

  const getDisplayDescription = (tx: Transaction): string => {
    const counterparty = getCounterpartyLabel(tx);
    const base = tx.original_description || "";
    return counterparty ? `${counterparty} — ${base}` : base;
  };

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;

    return transactions.filter((tx) => {
      const parts: Array<string> = [];
      parts.push(tx.id);
      parts.push(tx.original_description || "");
      parts.push(tx.category || "");
      parts.push(tx.subcategory || "");
      parts.push(tx.invoice_number || "");
      parts.push(tx.sync_status || "");
      parts.push(tx.user_notes || "");
      parts.push(String(tx.amount ?? ""));
      parts.push(tx.date || "");
      parts.push(tx.payee_name || "");
      parts.push(tx.payer_name || "");
      const cp = getCounterpartyLabel(tx);
      if (cp) parts.push(cp);

      // Useful when users paste a displayed date (e.g. 31/12/2025)
      try {
        parts.push(new Date(tx.date).toLocaleDateString());
      } catch {
        // ignore
      }

      if (tx.document) {
        parts.push(tx.document.vendor_name || "");
        parts.push(tx.document.original_filename || "");
        parts.push(tx.document.invoice_number || "");
        parts.push(tx.document.order_number || "");
        parts.push(tx.document.po_number || "");
        parts.push(tx.document.notes || "");
      }

      return parts.join(" ").toLowerCase().includes(q);
    });
  }, [transactions, searchQuery]);

  const confirmedCount = useMemo(() => {
    return transactions.filter((t) => t.user_confirmed).length;
  }, [transactions]);

  const totalAmount = useMemo(() => {
    return transactions.reduce((sum, t) => {
      const docTotal = typeof t.document?.total_amount === "number" ? t.document.total_amount : null;
      const amt = docTotal !== null ? docTotal : Math.abs(Number(t.amount) || 0);
      return sum + amt;
    }, 0);
  }, [transactions]);

  const loadSyncStatus = async (txs?: Transaction[]) => {
    try {
      const transactionsToCheck = txs || transactions;
      
      // Check if job has spreadsheet linked
      const jobResponse = await fetch(`/api/categorization/jobs/${jobId}/export-info`);
      if (jobResponse.ok) {
        const jobData = await jobResponse.json();
        setHasSpreadsheet(!!jobData.spreadsheetId);
        
        if (jobData.spreadsheetId && transactionsToCheck.length > 0) {
          // Count pending syncs (check all transactions in group_transaction_ids)
          // For grouped transactions, check if any underlying transaction is pending
          let pendingCount = 0;
          const allTransactionIds = new Set<string>();
          
          transactionsToCheck.forEach((tx) => {
            if (tx.group_transaction_ids) {
              tx.group_transaction_ids.forEach((id) => allTransactionIds.add(id));
            } else {
              allTransactionIds.add(tx.id);
            }
          });

          // We need to check the raw transactions, but for now use the grouped ones
          // In a real implementation, you'd fetch all individual transactions
          pendingCount = transactionsToCheck.filter(
            (tx) => tx.sync_status === "pending" || !tx.sync_status
          ).length;
          
          // Get most recent sync time
          const syncedTransactions = transactionsToCheck.filter(
            (tx) => tx.sync_status === "synced" && tx.last_synced_at
          );
          const lastSyncedAt = syncedTransactions.length > 0
            ? syncedTransactions.sort(
                (a, b) =>
                  new Date(b.last_synced_at!).getTime() -
                  new Date(a.last_synced_at!).getTime()
              )[0].last_synced_at ?? null
            : null;

          // Determine overall status
          let status: "synced" | "pending" | "failed" | null = null;
          if (pendingCount > 0) {
            status = "pending";
          } else if (syncedTransactions.length > 0) {
            status = "synced";
          } else if (transactionsToCheck.some((tx) => tx.sync_status === "failed")) {
            status = "failed";
          }

          setSyncStatus({
            status,
            lastSyncedAt,
            pendingCount,
          });
        } else {
          setSyncStatus({
            status: null,
            lastSyncedAt: null,
            pendingCount: 0,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load sync status:", err);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/transactions`, {
        credentials: "include",
        headers: {
          ...authHeaders,
        },
      });
      if (!response.ok) {
        // Try to extract error message from response
        let errorMessage = "Failed to load transactions";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      const rawTransactions: Transaction[] = data.transactions || [];

      // Group by document_id so one uploaded invoice shows once (instead of 1 row per line item transaction)
      const grouped = new Map<string, Transaction>();
      for (const tx of rawTransactions) {
        if (!tx.document_id) {
          // Keep any orphan/placeholder transactions visible
          grouped.set(tx.id, { ...tx, group_transaction_ids: [tx.id] });
          continue;
        }
        const existing = grouped.get(tx.document_id);
        if (!existing) {
          const initialSum = Math.abs(Number(tx.amount) || 0);
          grouped.set(tx.document_id, {
            ...tx,
            // Show invoice once, but keep the list of underlying tx ids
            group_transaction_ids: [tx.id],
            // Amount on the grouped row is the sum of line-item tx amounts (used for display + summary)
            amount: initialSum,
          });
        } else {
          existing.group_transaction_ids = [
            ...(existing.group_transaction_ids || []),
            tx.id,
          ];
          // Consider the invoice confirmed only if all underlying tx are confirmed
          existing.user_confirmed = Boolean(existing.user_confirmed && tx.user_confirmed);
          // Keep the grouped row amount as the sum of underlying tx amounts
          existing.amount = (Number(existing.amount) || 0) + Math.abs(Number(tx.amount) || 0);
        }
      }

      const newTransactions = Array.from(grouped.values());

      // Only update if we have transactions or if we're still loading
      setTransactions(newTransactions);
      setLoading(false);
      
      // Load sync status after transactions are loaded
      await loadSyncStatus(newTransactions);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleConfirm = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${transactionId}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...authHeaders,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to confirm" }));
        throw new Error(errorData.error || "Failed to confirm");
      }
      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = async (transactionId: string, updates: Partial<Document>) => {
    const transaction = transactions.find((tx) => tx.id === transactionId);
    if (!transaction?.document_id) {
      throw new Error("Transaction or document not found");
    }

    try {
      // Separate category updates (goes to transaction) from document updates
      const { category, ...documentUpdates } = updates as any;
      
      // Update document fields
      if (Object.keys(documentUpdates).length > 0) {
        const response = await fetch(`/api/documents/${transaction.document_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(documentUpdates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update invoice");
        }
      }
      
      // Update transaction category if changed
      if (category !== undefined) {
        const txResponse = await fetch(`/api/categorization/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ category }),
        });

        if (!txResponse.ok) {
          const errorData = await txResponse.json();
          throw new Error(errorData.error || "Failed to update category");
        }
      }

      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleDelete = async (transactionId: string, documentId: string) => {
    try {
      // Delete the transaction first
      // Delete ALL line-item transactions for this invoice (document_id) within this job.
      const txResponse = await fetch(`/api/categorization/jobs/${jobId}/transactions?documentId=${encodeURIComponent(documentId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...authHeaders,
        },
      });
      
      if (!txResponse.ok) {        throw new Error("Failed to delete transaction");
      }
      // Then delete the document
      const docResponse = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!docResponse.ok) {        console.warn("Failed to delete document, transaction was deleted");
      }
      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleViewDocument = (documentId: string) => {
    const url = documentUrls[documentId];
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleExportToGoogleSheets = async () => {
    try {
      setExporting(true);
      const response = await fetch(
        `/api/categorization/jobs/${jobId}/export/google-sheets`,
        {
        method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to export");
      }
      
      const data = await response.json();
      
      if (data.sheetUrl) {
        window.open(data.sheetUrl, "_blank");
        alert("Google Sheet created successfully! Opening in new tab...");
      } else if (data.csvAvailable) {
        alert("Google Sheets export requires additional configuration. Please contact support.");
      }
    } catch (err: any) {
      setError(err.message);
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Processing your transactions...</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          This may take a few moments
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        {error.includes('No tenant associated') && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Please complete your company setup to continue. You may need to refresh the page after completing setup.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              setError(null);
              loadTransactions();
            }}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
          >
            Try again
          </button>
          {error.includes('No tenant associated') && (
            <a
              href="/dashboard/setup"
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
            >
              Go to Setup
            </a>
          )}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          No transactions found for this review job.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          If you just uploaded, give it a moment and refresh. Processing may still be in progress.
        </p>
      </div>
    );
  }

  const handleEditCategory = async (transactionId: string, category: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update category");
      }

      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditNotes = async (transactionId: string, notes: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_notes: notes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update notes");
      }

      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInitializeSheetSync = async () => {
    if (installingSync) return;
    setInstallingSync(true);
    setInstallSyncMessage(null);
    try {
      // Find the spreadsheet this job will export to / is linked to
      const infoResp = await fetch(`/api/categorization/jobs/${jobId}/export-info`, {
        credentials: "include",
        headers: { ...authHeaders },
      });
      const info = await infoResp.json().catch(() => null);
      const spreadsheetId = info?.spreadsheetId as string | null | undefined;
      const spreadsheetName = info?.spreadsheetName as string | null | undefined;

      if (!infoResp.ok || !spreadsheetId) {
        setInstallSyncMessage(
          "No spreadsheet is linked yet. Export to Google Sheets first (or link a default spreadsheet in Settings), then try Initialize Sync."
        );
        return;
      }

      const installResp = await fetch(`/api/integrations/google-sheets/install-appscript`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify({
          spreadsheetId,
          spreadsheetName,
        }),
      });
      const installData = await installResp.json().catch(() => null);

      if (!installResp.ok) {
        if (installData?.error_code === "INSUFFICIENT_SCOPES") {
          setInstallSyncMessage(
            "Permissions missing. Please reconnect Google Sheets (Switch Account / Connect), approve the new permissions, then try Initialize Sync again."
          );
          return;
        }
        setInstallSyncMessage(installData?.error || `Initialize Sync failed (HTTP ${installResp.status})`);
        return;
      }

      setInstallSyncMessage(installData?.message || "Initialized.");
    } catch (e: any) {
      setInstallSyncMessage(e?.message || "Initialize Sync failed.");
    } finally {
      setInstallingSync(false);
    }
  };

  const renderView = () => {
    // For bank statement jobs (transactions without documents), use dedicated views
    if (isBankStatementJob) {
      const bankProps = {
        transactions: filteredTransactions,
        onConfirm: handleConfirm,
        onEditCategory: handleEditCategory,
        onEditNotes: handleEditNotes,
        onEditingChange: setIsEditing,
        formatDescription: getDisplayDescription,
      };

      switch (currentView) {
        case "card":
          return <BankStatementCardView {...bankProps} />;
        case "split":
          return <BankStatementSplitView {...bankProps} />;
        case "table":
        default:
          return <BankStatementTableView {...bankProps} />;
      }
    }

    // For invoice jobs (transactions with documents), use invoice views
    const commonProps = {
      transactions: filteredTransactions,
      documentUrls,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onConfirm: handleConfirm,
      onViewDocument: handleViewDocument,
      onEditingChange: setIsEditing,
    };

    switch (currentView) {
      case "card":
        return <InvoiceCardView {...commonProps} />;
      case "split":
        return <InvoiceSplitView {...commonProps} />;
      case "table":
      default:
        return <InvoiceTableView {...commonProps} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {transactions.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Confirmed</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {confirmedCount} / {transactions.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totalAmount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Sync Status and Actions */}
      {hasSpreadsheet && (
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <SyncStatusIndicator
            status={syncStatus.status}
            lastSyncedAt={syncStatus.lastSyncedAt}
            pendingCount={syncStatus.pendingCount}
          />
          <SyncButton
            jobId={jobId}
            pendingCount={syncStatus.pendingCount}
            onSyncComplete={() => {
              loadTransactions();
            }}
            disabled={exporting}
          />
        </div>
      )}

      {/* View Switcher and Export */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
          <div className="flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions…"
              className="w-72 max-w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
              >
                Clear
              </button>
            ) : null}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredTransactions.length} / {transactions.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleInitializeSheetSync}
              disabled={installingSync}
              className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Install the Apps Script that stamps row edit timestamps so accountant edits sync back to FinCat"
            >
              <ArrowPathIcon className={`h-5 w-5 ${installingSync ? "animate-spin" : ""}`} />
              {installingSync ? "Initializing..." : "Initialize Sync"}
            </button>
            {installSyncMessage && (
              <span className="text-xs text-gray-500 dark:text-gray-400 text-right max-w-[420px]">
                {installSyncMessage}
              </span>
            )}
          </div>

          <button
            onClick={handleExportToGoogleSheets}
            disabled={exporting || transactions.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {exporting ? "Exporting..." : "Export to Google Sheets"}
          </button>
        </div>
      </div>

      {/* Selected View */}
      {renderView()}
    </div>
  );
}
