/**
 * XERO Export Service
 * 
 * Formats transactions and accounts for XERO import
 * Supports CSV and JSON formats
 */

export interface XeroTransaction {
  Date: string;
  Description: string;
  Amount: number;
  'Account Code': string;
  'Account Name': string;
  Contact?: string;
  Reference?: string;
  'Tax Rate'?: string;
  'Tax Amount'?: number;
}

export interface XeroExportOptions {
  format: 'csv' | 'json';
  includeContacts?: boolean;
  includeTax?: boolean;
}

/**
 * Export transactions to XERO format
 */
export async function exportTransactionsToXero(
  transactions: Array<{
    date: string | Date;
    description: string;
    amount: number;
    category?: string;
    subcategory?: string;
    reference_number?: string;
    transaction_type?: string;
    is_debit?: boolean;
  }>,
  accountMappings: Map<string, { code: string; name: string }>,
  options: XeroExportOptions = { format: 'csv' }
): Promise<string> {
  const xeroTransactions: XeroTransaction[] = transactions.map(tx => {
    const date = typeof tx.date === 'string' ? tx.date : tx.date.toISOString().split('T')[0];
    const account = accountMappings.get(tx.category || '') || { code: '8000', name: 'Uncategorized' };
    
    // XERO expects positive amounts for both debits and credits
    // Use Account Code to determine debit/credit
    const amount = Math.abs(tx.amount);

    const xeroTx: XeroTransaction = {
      Date: date,
      Description: tx.description,
      Amount: amount,
      'Account Code': account.code,
      'Account Name': account.name,
    };

    if (tx.reference_number) {
      xeroTx.Reference = tx.reference_number;
    }

    if (options.includeTax) {
      // Add tax fields if needed (would need VAT/tax data)
      xeroTx['Tax Rate'] = '20%'; // Default UK VAT rate
      xeroTx['Tax Amount'] = amount * 0.2;
    }

    return xeroTx;
  });

  if (options.format === 'json') {
    return JSON.stringify(xeroTransactions, null, 2);
  }

  // CSV format
  if (xeroTransactions.length === 0) {
    return '';
  }

  const headers = Object.keys(xeroTransactions[0]);
  const csvRows = [
    headers.join(','),
    ...xeroTransactions.map(tx => 
      headers.map(header => {
        const value = tx[header as keyof XeroTransaction];
        // Escape commas and quotes in CSV
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    ),
  ];

  return csvRows.join('\n');
}

/**
 * Export chart of accounts to XERO format
 */
export function exportChartOfAccountsToXero(
  accounts: Array<{
    account_code: string;
    account_name: string;
    account_type: string;
    is_active: boolean;
  }>
): string {
  const xeroAccounts = accounts
    .filter(acc => acc.is_active)
    .map(acc => ({
      'Account Code': acc.account_code,
      'Account Name': acc.account_name,
      'Account Type': mapAccountTypeToXero(acc.account_type),
      'Status': 'ACTIVE',
    }));

  if (xeroAccounts.length === 0) {
    return '';
  }

  const headers = Object.keys(xeroAccounts[0]);
  const csvRows = [
    headers.join(','),
    ...xeroAccounts.map(acc => 
      headers.map(header => {
        const value = acc[header as keyof typeof acc];
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    ),
  ];

  return csvRows.join('\n');
}

/**
 * Map account type to XERO format
 */
function mapAccountTypeToXero(accountType: string): string {
  const mapping: Record<string, string> = {
    'asset': 'ASSET',
    'liability': 'LIABILITY',
    'equity': 'EQUITY',
    'income': 'REVENUE',
    'expense': 'EXPENSE',
  };

  return mapping[accountType.toLowerCase()] || 'EXPENSE';
}

/**
 * Export contacts (vendors/customers) to XERO format
 */
export function exportContactsToXero(
  contacts: Array<{
    name: string;
    type: 'vendor' | 'customer';
    email?: string;
    phone?: string;
  }>
): string {
  const xeroContacts = contacts.map(contact => ({
    'Name': contact.name,
    'Type': contact.type === 'vendor' ? 'SUPPLIER' : 'CUSTOMER',
    'Email': contact.email || '',
    'Phone': contact.phone || '',
  }));

  if (xeroContacts.length === 0) {
    return '';
  }

  const headers = Object.keys(xeroContacts[0]);
  const csvRows = [
    headers.join(','),
    ...xeroContacts.map(contact => 
      headers.map(header => {
        const value = contact[header as keyof typeof contact];
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    ),
  ];

  return csvRows.join('\n');
}

