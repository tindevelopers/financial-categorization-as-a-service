import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

type Direction = "money_in" | "money_out" | "both";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const direction = (searchParams.get("direction") as Direction) || "both";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const q = (searchParams.get("q") || "").toLowerCase();
    const companyProfileId = searchParams.get("companyProfileId");

    let txQuery = supabase
      .from("categorized_transactions")
      .select(
        `
        id,
        date,
        amount,
        is_debit,
        paid_in_amount,
        paid_out_amount,
        payee_name,
        payer_name,
        original_description,
        job:categorization_jobs!inner(user_id, bank_account_id)
      `
      )
      .eq("job.user_id", user.id)
      .order("date", { ascending: false });

    if (startDate) {
      txQuery = txQuery.gte("date", startDate);
    }
    if (endDate) {
      txQuery = txQuery.lte("date", endDate);
    }

    const { data: transactions, error } = await txQuery;
    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch transactions", details: error.message },
        { status: 500 }
      );
    }

    // Optional company filter using bank_account_id -> bank_accounts.company_profile_id
    let companyScopedTx = transactions || [];
    if (companyProfileId) {
      const bankAccountIds = Array.from(
        new Set(
          (transactions || [])
            .map((tx: any) => tx?.job?.bank_account_id)
            .filter(Boolean)
        )
      );
      if (bankAccountIds.length > 0) {
        const { data: accounts } = await supabase
          .from("bank_accounts")
          .select("id, company_profile_id")
          .in("id", bankAccountIds);
        const accountCompanyMap = new Map(
          (accounts || []).map((a: any) => [a.id, a.company_profile_id])
        );
        companyScopedTx = (transactions || []).filter((tx: any) => {
          const acctId = tx?.job?.bank_account_id;
          return acctId && accountCompanyMap.get(acctId) === companyProfileId;
        });
      } else {
        companyScopedTx = [];
      }
    }

    type Bucket = {
      name: string;
      total_money_in: number;
      total_money_out: number;
      count: number;
      first_date: string | null;
      last_date: string | null;
    };

    const buckets = new Map<string, Bucket>();

    for (const tx of companyScopedTx) {
      const paidIn =
        tx.paid_in_amount ?? (tx.is_debit === false ? Number(tx.amount || 0) : 0);
      const paidOut =
        tx.paid_out_amount ?? (tx.is_debit ? Number(tx.amount || 0) : 0);
      const isOut = Math.abs(paidOut) > 0;
      const isIn = Math.abs(paidIn) > 0;

      // Direction filter
      if (direction === "money_out" && !isOut) continue;
      if (direction === "money_in" && !isIn) continue;

      const counterparty = isOut
        ? tx.payee_name || tx.payer_name || tx.original_description || "Unknown"
        : tx.payer_name || tx.payee_name || tx.original_description || "Unknown";

      if (q && !counterparty.toLowerCase().includes(q)) {
        continue;
      }

      if (!counterparty) continue;

      const bucket = buckets.get(counterparty) || {
        name: counterparty,
        total_money_in: 0,
        total_money_out: 0,
        count: 0,
        first_date: null,
        last_date: null,
      };

      bucket.total_money_in += isIn ? paidIn : 0;
      bucket.total_money_out += isOut ? Math.abs(paidOut) : 0;
      bucket.count += 1;

      if (tx.date) {
        const dateStr = tx.date;
        if (!bucket.first_date || dateStr < bucket.first_date) bucket.first_date = dateStr;
        if (!bucket.last_date || dateStr > bucket.last_date) bucket.last_date = dateStr;
      }

      buckets.set(counterparty, bucket);
    }

    const results = Array.from(buckets.values()).sort(
      (a, b) =>
        b.total_money_out + b.total_money_in - (a.total_money_out + a.total_money_in)
    );

    return NextResponse.json({
      success: true,
      items: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

