export type BankAccountLike = {
  name?: string | null
  sort_code?: string | null
  sortCode?: string | null
  account_number?: string | null
  accountNumber?: string | null
  bank?: string | null
}

function normalizePart(value: string | null | undefined) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

/**
 * Deterministic accountKey for mapping a bank account to a spreadsheet.
 * Current v1 format: bank:{bank}:{sort_code}:{account_number}
 */
export function deriveBankAccountKey(account: BankAccountLike): string {
  const bank = normalizePart(account.bank)
  const sortCode = normalizePart(account.sort_code || account.sortCode)
  const accountNumber = normalizePart(account.account_number || account.accountNumber)

  return `bank:${bank}:${sortCode}:${accountNumber}`
}


