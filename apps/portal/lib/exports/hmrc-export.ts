/**
 * HMRC Export Service
 * 
 * Formats data for HMRC filing:
 * - VAT returns
 * - Self-assessment (SA100)
 * - Corporation tax
 */

export interface VATReturn {
  period_start: Date;
  period_end: Date;
  vat_number: string;
  vat_due_on_sales: number;
  vat_due_on_acquisitions: number;
  total_vat_due: number;
  vat_reclaimed_on_purchases: number;
  net_vat_due: number;
  total_sales_excluding_vat: number;
  total_purchases_excluding_vat: number;
  total_supplies_made_at_standard_rate: number;
  total_supplies_made_at_reduced_rate: number;
  total_supplies_made_at_zero_rate: number;
}

export interface SelfAssessmentData {
  tax_year: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  tax_due: number;
  income_by_category: Array<{
    category: string;
    amount: number;
  }>;
  expenses_by_category: Array<{
    category: string;
    amount: number;
  }>;
}

export interface CorporationTaxData {
  accounting_period_start: Date;
  accounting_period_end: Date;
  company_number: string;
  turnover: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expenses: number;
  operating_profit: number;
  tax_due: number;
}

/**
 * Export VAT return data for HMRC
 */
export async function exportVATReturn(
  transactions: Array<{
    date: string | Date;
    amount: number;
    category?: string;
    is_debit: boolean;
    vat_amount?: number;
    vat_rate?: number;
  }>,
  vatNumber: string,
  periodStart: Date,
  periodEnd: Date,
  vatScheme: 'standard' | 'flat_rate' | 'cash_accounting' = 'standard',
  flatRatePercentage?: number
): Promise<VATReturn> {
  let vatDueOnSales = 0;
  let vatReclaimedOnPurchases = 0;
  let totalSalesExcludingVAT = 0;
  let totalPurchasesExcludingVAT = 0;
  let totalSuppliesStandardRate = 0;
  let totalSuppliesReducedRate = 0;
  let totalSuppliesZeroRate = 0;

  transactions.forEach(tx => {
    const amount = Math.abs(tx.amount);
    const vatAmount = tx.vat_amount || (tx.vat_rate ? amount * (tx.vat_rate / 100) : 0);
    const netAmount = amount - vatAmount;

    if (!tx.is_debit) {
      // Sales/Income
      totalSalesExcludingVAT += netAmount;
      vatDueOnSales += vatAmount;
      
      // Categorize by VAT rate (simplified - would need actual VAT rate data)
      if (tx.vat_rate === 20 || !tx.vat_rate) {
        totalSuppliesStandardRate += netAmount;
      } else if (tx.vat_rate === 5) {
        totalSuppliesReducedRate += netAmount;
      } else {
        totalSuppliesZeroRate += netAmount;
      }
    } else {
      // Purchases/Expenses
      totalPurchasesExcludingVAT += netAmount;
      vatReclaimedOnPurchases += vatAmount;
    }
  });

  // Apply flat rate scheme if applicable
  if (vatScheme === 'flat_rate' && flatRatePercentage) {
    const flatRateVAT = totalSalesExcludingVAT * (flatRatePercentage / 100);
    vatDueOnSales = flatRateVAT;
    vatReclaimedOnPurchases = 0; // Flat rate scheme doesn't allow reclaiming VAT on purchases
  }

  const totalVATDue = vatDueOnSales;
  const netVATDue = totalVATDue - vatReclaimedOnPurchases;

  return {
    period_start: periodStart,
    period_end: periodEnd,
    vat_number: vatNumber,
    vat_due_on_sales: vatDueOnSales,
    vat_due_on_acquisitions: 0, // Would need import data
    total_vat_due: totalVATDue,
    vat_reclaimed_on_purchases: vatReclaimedOnPurchases,
    net_vat_due: netVATDue,
    total_sales_excluding_vat: totalSalesExcludingVAT,
    total_purchases_excluding_vat: totalPurchasesExcludingVAT,
    total_supplies_made_at_standard_rate: totalSuppliesStandardRate,
    total_supplies_made_at_reduced_rate: totalSuppliesReducedRate,
    total_supplies_made_at_zero_rate: totalSuppliesZeroRate,
  };
}

/**
 * Export VAT return as CSV for HMRC submission
 */
export function exportVATReturnCSV(vatReturn: VATReturn): string {
  const rows = [
    ['VAT Return', ''],
    ['VAT Number', vatReturn.vat_number],
    ['Period Start', vatReturn.period_start.toISOString().split('T')[0]],
    ['Period End', vatReturn.period_end.toISOString().split('T')[0]],
    [''],
    ['Box 1 - VAT due on sales', vatReturn.vat_due_on_sales.toFixed(2)],
    ['Box 2 - VAT due on acquisitions', vatReturn.vat_due_on_acquisitions.toFixed(2)],
    ['Box 3 - Total VAT due', vatReturn.total_vat_due.toFixed(2)],
    ['Box 4 - VAT reclaimed on purchases', vatReturn.vat_reclaimed_on_purchases.toFixed(2)],
    ['Box 5 - Net VAT due', vatReturn.net_vat_due.toFixed(2)],
    [''],
    ['Box 6 - Total sales excluding VAT', vatReturn.total_sales_excluding_vat.toFixed(2)],
    ['Box 7 - Total purchases excluding VAT', vatReturn.total_purchases_excluding_vat.toFixed(2)],
    ['Box 8 - Supplies at standard rate', vatReturn.total_supplies_made_at_standard_rate.toFixed(2)],
    ['Box 9 - Supplies at reduced rate', vatReturn.total_supplies_made_at_reduced_rate.toFixed(2)],
    ['Box 10 - Supplies at zero rate', vatReturn.total_supplies_made_at_zero_rate.toFixed(2)],
  ];

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

/**
 * Export self-assessment data for HMRC
 */
export async function exportSelfAssessment(
  transactions: Array<{
    date: string | Date;
    amount: number;
    category?: string;
    is_debit: boolean;
  }>,
  taxYear: string
): Promise<SelfAssessmentData> {
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  let totalIncome = 0;
  let totalExpenses = 0;

  transactions.forEach(tx => {
    const amount = Math.abs(tx.amount);
    const category = tx.category || 'Uncategorized';

    if (!tx.is_debit) {
      // Income
      const existing = incomeMap.get(category) || 0;
      incomeMap.set(category, existing + amount);
      totalIncome += amount;
    } else {
      // Expenses
      const existing = expenseMap.get(category) || 0;
      expenseMap.set(category, existing + amount);
      totalExpenses += amount;
    }
  });

  const netProfit = totalIncome - totalExpenses;
  
  // Calculate tax (simplified - would need actual tax calculation)
  // UK basic rate: 20% on profits up to £50,270, higher rate: 40% above
  let taxDue = 0;
  if (netProfit > 0) {
    if (netProfit <= 50270) {
      taxDue = netProfit * 0.20;
    } else {
      taxDue = 50270 * 0.20 + (netProfit - 50270) * 0.40;
    }
  }

  return {
    tax_year: taxYear,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    tax_due: taxDue,
    income_by_category: Array.from(incomeMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    })),
    expenses_by_category: Array.from(expenseMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    })),
  };
}

/**
 * Export self-assessment as CSV
 */
export function exportSelfAssessmentCSV(data: SelfAssessmentData): string {
  const rows = [
    ['Self-Assessment Tax Return', ''],
    ['Tax Year', data.tax_year],
    [''],
    ['Income', ''],
    ...data.income_by_category.map(item => [item.category, item.amount.toFixed(2)]),
    ['Total Income', data.total_income.toFixed(2)],
    [''],
    ['Expenses', ''],
    ...data.expenses_by_category.map(item => [item.category, item.amount.toFixed(2)]),
    ['Total Expenses', data.total_expenses.toFixed(2)],
    [''],
    ['Net Profit', data.net_profit.toFixed(2)],
    ['Tax Due', data.tax_due.toFixed(2)],
  ];

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

/**
 * Export corporation tax data
 */
export async function exportCorporationTax(
  transactions: Array<{
    date: string | Date;
    amount: number;
    category?: string;
    is_debit: boolean;
  }>,
  companyNumber: string,
  accountingPeriodStart: Date,
  accountingPeriodEnd: Date
): Promise<CorporationTaxData> {
  let turnover = 0;
  let costOfSales = 0;
  let operatingExpenses = 0;

  transactions.forEach(tx => {
    const amount = Math.abs(tx.amount);
    const category = (tx.category || '').toLowerCase();

    if (!tx.is_debit) {
      // Income/Revenue
      turnover += amount;
    } else {
      // Expenses
      if (category.includes('cost') || category.includes('goods') || category.includes('inventory')) {
        costOfSales += amount;
      } else {
        operatingExpenses += amount;
      }
    }
  });

  const grossProfit = turnover - costOfSales;
  const operatingProfit = grossProfit - operatingExpenses;
  
  // UK corporation tax rate: 19% (2023-24) or 25% for profits over £250,000
  let taxDue = 0;
  if (operatingProfit > 0) {
    if (operatingProfit <= 50000) {
      taxDue = operatingProfit * 0.19; // Small profits rate
    } else if (operatingProfit <= 250000) {
      taxDue = operatingProfit * 0.19; // Main rate
    } else {
      taxDue = operatingProfit * 0.25; // Higher rate
    }
  }

  return {
    accounting_period_start: accountingPeriodStart,
    accounting_period_end: accountingPeriodEnd,
    company_number: companyNumber,
    turnover,
    cost_of_sales: costOfSales,
    gross_profit: grossProfit,
    operating_expenses: operatingExpenses,
    operating_profit: operatingProfit,
    tax_due: taxDue,
  };
}

/**
 * Export corporation tax as CSV
 */
export function exportCorporationTaxCSV(data: CorporationTaxData): string {
  const rows = [
    ['Corporation Tax Return', ''],
    ['Company Number', data.company_number],
    ['Accounting Period Start', data.accounting_period_start.toISOString().split('T')[0]],
    ['Accounting Period End', data.accounting_period_end.toISOString().split('T')[0]],
    [''],
    ['Turnover', data.turnover.toFixed(2)],
    ['Cost of Sales', data.cost_of_sales.toFixed(2)],
    ['Gross Profit', data.gross_profit.toFixed(2)],
    ['Operating Expenses', data.operating_expenses.toFixed(2)],
    ['Operating Profit', data.operating_profit.toFixed(2)],
    ['Corporation Tax Due', data.tax_due.toFixed(2)],
  ];

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

