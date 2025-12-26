/**
 * Financial Statement Generator
 * 
 * Generates financial statements (P&L, Balance Sheet, Cash Flow, Trial Balance)
 * from categorized transactions and company profile data
 */

export interface ProfitAndLossStatement {
  period_start: Date;
  period_end: Date;
  revenue: {
    total: number;
    items: Array<{
      account_code: string;
      account_name: string;
      amount: number;
    }>;
  };
  expenses: {
    total: number;
    items: Array<{
      account_code: string;
      account_name: string;
      amount: number;
    }>;
  };
  net_income: number;
  currency: string;
}

export interface BalanceSheet {
  as_of_date: Date;
  assets: {
    current: {
      total: number;
      items: Array<{
        account_code: string;
        account_name: string;
        amount: number;
      }>;
    };
    fixed: {
      total: number;
      items: Array<{
        account_code: string;
        account_name: string;
        amount: number;
      }>;
    };
    total: number;
  };
  liabilities: {
    current: {
      total: number;
      items: Array<{
        account_code: string;
        account_name: string;
        amount: number;
      }>;
    };
    long_term: {
      total: number;
      items: Array<{
        account_code: string;
        account_name: string;
        amount: number;
      }>;
    };
    total: number;
  };
  equity: {
    total: number;
    items: Array<{
      account_code: string;
      account_name: string;
      amount: number;
    }>;
  };
  total_liabilities_and_equity: number;
  currency: string;
}

export interface CashFlowStatement {
  period_start: Date;
  period_end: Date;
  operating_activities: {
    net_income: number;
    adjustments: Array<{
      description: string;
      amount: number;
    }>;
    changes_in_working_capital: number;
    total: number;
  };
  investing_activities: {
    total: number;
    items: Array<{
      description: string;
      amount: number;
    }>;
  };
  financing_activities: {
    total: number;
    items: Array<{
      description: string;
      amount: number;
    }>;
  };
  net_change_in_cash: number;
  beginning_cash: number;
  ending_cash: number;
  currency: string;
}

export interface TrialBalance {
  as_of_date: Date;
  accounts: Array<{
    account_code: string;
    account_name: string;
    account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    debit_balance: number;
    credit_balance: number;
  }>;
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

/**
 * Generate Profit & Loss Statement
 */
export async function generateProfitAndLoss(
  supabase: any,
  startDate: Date,
  endDate: Date,
  companyProfileId: string
): Promise<ProfitAndLossStatement> {
  // Get company profile for currency
  const { data: companyProfile } = await supabase
    .from("company_profiles")
    .select("default_currency")
    .eq("id", companyProfileId)
    .single();

  const currency = companyProfile?.default_currency || 'GBP';

  // Get all transactions in the period
  const { data: transactions } = await supabase
    .from("categorized_transactions")
    .select(`
      amount,
      is_debit,
      category,
      subcategory,
      date,
      job_id,
      categorization_jobs!inner(user_id)
    `)
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .eq("categorization_jobs.user_id", (await supabase.auth.getUser()).data.user?.id);

  // Get category to account mappings
  const { data: accountMappings } = await supabase
    .from("category_account_mapping")
    .select(`
      category,
      subcategory,
      account_code,
      chart_of_accounts!inner(account_name, account_type)
    `)
    .eq("company_profile_id", companyProfileId);

  // Get chart of accounts
  const { data: chartOfAccounts } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("company_profile_id", companyProfileId)
    .eq("is_active", true);

  // Map transactions to accounts
  const revenueMap = new Map<string, { account_code: string; account_name: string; amount: number }>();
  const expenseMap = new Map<string, { account_code: string; account_name: string; amount: number }>();

  transactions?.forEach((tx: any) => {
    // Find account mapping for this category
    const mapping = accountMappings?.find(
      (m: any) => m.category === tx.category && 
      (m.subcategory === tx.subcategory || (!m.subcategory && !tx.subcategory))
    );

    const accountCode = mapping?.account_code || getDefaultAccountCode(tx.category, chartOfAccounts);
    const account = chartOfAccounts?.find((a: any) => a.account_code === accountCode);

    if (!account) return;

    const amount = Math.abs(tx.amount || 0);

    if (account.account_type === 'income') {
      const existing = revenueMap.get(accountCode) || { account_code: accountCode, account_name: account.account_name, amount: 0 };
      existing.amount += amount;
      revenueMap.set(accountCode, existing);
    } else if (account.account_type === 'expense') {
      const existing = expenseMap.get(accountCode) || { account_code: accountCode, account_name: account.account_name, amount: 0 };
      existing.amount += amount;
      expenseMap.set(accountCode, existing);
    }
  });

  const revenueItems = Array.from(revenueMap.values());
  const expenseItems = Array.from(expenseMap.values());

  const totalRevenue = revenueItems.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  return {
    period_start: startDate,
    period_end: endDate,
    revenue: {
      total: totalRevenue,
      items: revenueItems,
    },
    expenses: {
      total: totalExpenses,
      items: expenseItems,
    },
    net_income: netIncome,
    currency,
  };
}

/**
 * Generate Balance Sheet
 */
export async function generateBalanceSheet(
  supabase: any,
  asOfDate: Date,
  companyProfileId: string
): Promise<BalanceSheet> {
  // Get company profile for currency
  const { data: companyProfile } = await supabase
    .from("company_profiles")
    .select("default_currency")
    .eq("id", companyProfileId)
    .single();

  const currency = companyProfile?.default_currency || 'GBP';

  // Get all transactions up to the date
  const { data: transactions } = await supabase
    .from("categorized_transactions")
    .select(`
      amount,
      is_debit,
      category,
      date,
      job_id,
      categorization_jobs!inner(user_id)
    `)
    .lte("date", asOfDate.toISOString().split("T")[0])
    .eq("categorization_jobs.user_id", (await supabase.auth.getUser()).data.user?.id);

  // Get bank account balances
  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select(`
      id,
      account_name,
      account_type,
      company_profile_id
    `)
    .eq("company_profile_id", companyProfileId)
    .eq("is_active", true);

  // Get latest statement closing balances
  const bankBalances = new Map<string, number>();
  if (bankAccounts) {
    for (const account of bankAccounts) {
      const { data: latestStatement } = await supabase
        .from("bank_statement_metadata")
        .select("closing_balance, period_end")
        .eq("bank_account_id", account.id)
        .lte("period_end", asOfDate.toISOString().split("T")[0])
        .order("period_end", { ascending: false })
        .limit(1)
        .single();

      if (latestStatement) {
        bankBalances.set(account.id, latestStatement.closing_balance || 0);
      }
    }
  }

  // Get chart of accounts
  const { data: chartOfAccounts } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("company_profile_id", companyProfileId)
    .eq("is_active", true);

  // Calculate account balances
  const accountBalances = new Map<string, { code: string; name: string; type: string; amount: number }>();

  // Initialize with chart of accounts
  chartOfAccounts?.forEach((account: any) => {
    accountBalances.set(account.account_code, {
      code: account.account_code,
      name: account.account_name,
      type: account.account_type,
      amount: 0,
    });
  });

  // Add bank account balances
  bankBalances.forEach((balance, accountId) => {
    const account = bankAccounts?.find((a: any) => a.id === accountId);
    if (account) {
      const existing = accountBalances.get("1100") || { code: "1100", name: "Bank Account", type: "asset", amount: 0 };
      existing.amount += balance;
      accountBalances.set("1100", existing);
    }
  });

  // Process transactions
  transactions?.forEach((tx: any) => {
    // Map transaction to account (simplified - would use category mappings in production)
    const accountCode = getDefaultAccountCode(tx.category, chartOfAccounts);
    const account = accountBalances.get(accountCode);
    
    if (account) {
      if (account.type === 'asset' || account.type === 'expense') {
        account.amount += tx.is_debit ? tx.amount : -tx.amount;
      } else {
        account.amount += tx.is_debit ? -tx.amount : tx.amount;
      }
      accountBalances.set(accountCode, account);
    }
  });

  // Build balance sheet structure
  const assets = {
    current: { total: 0, items: [] as Array<{ account_code: string; account_name: string; amount: number }> },
    fixed: { total: 0, items: [] as Array<{ account_code: string; account_name: string; amount: number }> },
    total: 0,
  };

  const liabilities = {
    current: { total: 0, items: [] as Array<{ account_code: string; account_name: string; amount: number }> },
    long_term: { total: 0, items: [] as Array<{ account_code: string; account_name: string; amount: number }> },
    total: 0,
  };

  const equity = {
    total: 0,
    items: [] as Array<{ account_code: string; account_name: string; amount: number }>,
  };

  accountBalances.forEach((account) => {
    const item = { account_code: account.code, account_name: account.name, amount: account.amount };

    if (account.type === 'asset') {
      if (account.code.startsWith('1')) {
        assets.current.items.push(item);
        assets.current.total += account.amount;
      } else {
        assets.fixed.items.push(item);
        assets.fixed.total += account.amount;
      }
    } else if (account.type === 'liability') {
      if (account.code.startsWith('2')) {
        liabilities.current.items.push(item);
        liabilities.current.total += account.amount;
      } else {
        liabilities.long_term.items.push(item);
        liabilities.long_term.total += account.amount;
      }
    } else if (account.type === 'equity') {
      equity.items.push(item);
      equity.total += account.amount;
    }
  });

  assets.total = assets.current.total + assets.fixed.total;
  liabilities.total = liabilities.current.total + liabilities.long_term.total;
  const totalLiabilitiesAndEquity = liabilities.total + equity.total;

  return {
    as_of_date: asOfDate,
    assets,
    liabilities,
    equity,
    total_liabilities_and_equity: totalLiabilitiesAndEquity,
    currency,
  };
}

/**
 * Generate Cash Flow Statement
 */
export async function generateCashFlowStatement(
  supabase: any,
  startDate: Date,
  endDate: Date,
  companyProfileId: string
): Promise<CashFlowStatement> {
  // Get P&L for net income
  const pnl = await generateProfitAndLoss(supabase, startDate, endDate, companyProfileId);

  // Get company profile for currency
  const { data: companyProfile } = await supabase
    .from("company_profiles")
    .select("default_currency")
    .eq("id", companyProfileId)
    .single();

  const currency = companyProfile?.default_currency || 'GBP';

  // Get bank account transactions
  const { data: transactions } = await supabase
    .from("categorized_transactions")
    .select(`
      amount,
      is_debit,
      transaction_type,
      category,
      date,
      job_id,
      categorization_jobs!inner(user_id)
    `)
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .eq("categorization_jobs.user_id", (await supabase.auth.getUser()).data.user?.id);

  // Categorize cash flows
  const operatingActivities: Array<{ description: string; amount: number }> = [];
  const investingActivities: Array<{ description: string; amount: number }> = [];
  const financingActivities: Array<{ description: string; amount: number }> = [];

  transactions?.forEach((tx: any) => {
    const amount = tx.is_debit ? -tx.amount : tx.amount;
    
    // Classify based on transaction type and category
    if (tx.transaction_type === 'transfer' || tx.category?.includes('Investment')) {
      investingActivities.push({
        description: tx.category || 'Investment',
        amount,
      });
    } else if (tx.transaction_type === 'deposit' || tx.transaction_type === 'withdrawal') {
      financingActivities.push({
        description: tx.category || 'Financing',
        amount,
      });
    } else {
      operatingActivities.push({
        description: tx.category || 'Operating',
        amount,
      });
    }
  });

  const operatingTotal = operatingActivities.reduce((sum, item) => sum + item.amount, 0);
  const investingTotal = investingActivities.reduce((sum, item) => sum + item.amount, 0);
  const financingTotal = financingActivities.reduce((sum, item) => sum + item.amount, 0);

  // Get beginning and ending cash balances
  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("company_profile_id", companyProfileId)
    .eq("is_active", true);

  let beginningCash = 0;
  let endingCash = 0;

  if (bankAccounts) {
    for (const account of bankAccounts) {
      // Beginning balance
      const { data: startStatement } = await supabase
        .from("bank_statement_metadata")
        .select("opening_balance, period_start")
        .eq("bank_account_id", account.id)
        .lte("period_start", startDate.toISOString().split("T")[0])
        .order("period_start", { ascending: false })
        .limit(1)
        .single();

      if (startStatement) {
        beginningCash += startStatement.opening_balance || 0;
      }

      // Ending balance
      const { data: endStatement } = await supabase
        .from("bank_statement_metadata")
        .select("closing_balance, period_end")
        .eq("bank_account_id", account.id)
        .lte("period_end", endDate.toISOString().split("T")[0])
        .order("period_end", { ascending: false })
        .limit(1)
        .single();

      if (endStatement) {
        endingCash += endStatement.closing_balance || 0;
      }
    }
  }

  const netChangeInCash = operatingTotal + investingTotal + financingTotal;

  return {
    period_start: startDate,
    period_end: endDate,
    operating_activities: {
      net_income: pnl.net_income,
      adjustments: [],
      changes_in_working_capital: operatingTotal - pnl.net_income,
      total: operatingTotal,
    },
    investing_activities: {
      total: investingTotal,
      items: investingActivities,
    },
    financing_activities: {
      total: financingTotal,
      items: financingActivities,
    },
    net_change_in_cash: netChangeInCash,
    beginning_cash: beginningCash,
    ending_cash: endingCash,
    currency,
  };
}

/**
 * Generate Trial Balance
 */
export async function generateTrialBalance(
  supabase: any,
  asOfDate: Date,
  companyProfileId: string
): Promise<TrialBalance> {
  // Get chart of accounts
  const { data: chartOfAccounts } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("company_profile_id", companyProfileId)
    .eq("is_active", true);

  // Get all transactions up to date
  const { data: transactions } = await supabase
    .from("categorized_transactions")
    .select(`
      amount,
      is_debit,
      category,
      date,
      job_id,
      categorization_jobs!inner(user_id)
    `)
    .lte("date", asOfDate.toISOString().split("T")[0])
    .eq("categorization_jobs.user_id", (await supabase.auth.getUser()).data.user?.id);

  // Calculate account balances
  const accountBalances = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();

  // Initialize accounts
  chartOfAccounts?.forEach((account: any) => {
    accountBalances.set(account.account_code, {
      code: account.account_code,
      name: account.account_name,
      type: account.account_type,
      debit: 0,
      credit: 0,
    });
  });

  // Process transactions
  transactions?.forEach((tx: any) => {
    const accountCode = getDefaultAccountCode(tx.category, chartOfAccounts);
    const account = accountBalances.get(accountCode);
    
    if (account) {
      if (tx.is_debit) {
        account.debit += tx.amount;
      } else {
        account.credit += tx.amount;
      }
      accountBalances.set(accountCode, account);
    }
  });

  const accounts = Array.from(accountBalances.values()).map(acc => ({
    account_code: acc.code,
    account_name: acc.name,
    account_type: acc.type as 'asset' | 'liability' | 'equity' | 'income' | 'expense',
    debit_balance: acc.debit,
    credit_balance: acc.credit,
  }));

  const totalDebits = accounts.reduce((sum, acc) => sum + acc.debit_balance, 0);
  const totalCredits = accounts.reduce((sum, acc) => sum + acc.credit_balance, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return {
    as_of_date: asOfDate,
    accounts,
    total_debits: totalDebits,
    total_credits: totalCredits,
    is_balanced: isBalanced,
  };
}

/**
 * Helper: Get default account code for a category
 */
function getDefaultAccountCode(category: string | null, chartOfAccounts: any[]): string {
  if (!category) return "8000"; // Uncategorized expense

  const categoryLower = category.toLowerCase();
  
  // Map common categories to account codes
  if (chartOfAccounts) {
    // Try to find matching account by name
    const matching = chartOfAccounts.find((acc: any) => 
      acc.account_name.toLowerCase().includes(categoryLower) ||
      categoryLower.includes(acc.account_name.toLowerCase())
    );
    if (matching) return matching.account_code;
  }

  // Default mappings
  if (categoryLower.includes("revenue") || categoryLower.includes("income") || categoryLower.includes("sales")) {
    return "4100";
  }
  if (categoryLower.includes("office") || categoryLower.includes("supplies")) {
    return "6100";
  }
  if (categoryLower.includes("travel")) {
    return "6200";
  }
  if (categoryLower.includes("software") || categoryLower.includes("subscription")) {
    return "6100";
  }

  return "8000"; // Default to uncategorized expense
}

