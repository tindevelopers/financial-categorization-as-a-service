import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET: Get all categories used by the user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get unique categories from user's transactions via jobs
    // First get all job IDs for this user
    const { data: jobs, error: jobsError } = await supabase
      .from("categorization_jobs")
      .select("id")
      .eq("user_id", user.id);

    if (jobsError || !jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        categories: [],
        subcategories: {},
      });
    }

    const jobIds = jobs.map(j => j.id);

    // Get unique categories from transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from("categorized_transactions")
      .select("category, subcategory")
      .not("category", "is", null)
      .in("job_id", jobIds);

    if (transactionsError) {
      console.error("Error fetching categories:", transactionsError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    // Extract unique categories and subcategories
    const categorySet = new Set<string>();
    const subcategoryMap = new Map<string, Set<string>>();

    transactions?.forEach((tx) => {
      if (tx.category) {
        categorySet.add(tx.category);
        if (tx.subcategory) {
          if (!subcategoryMap.has(tx.category)) {
            subcategoryMap.set(tx.category, new Set());
          }
          subcategoryMap.get(tx.category)!.add(tx.subcategory);
        }
      }
    });

    // Convert to arrays
    const categories = Array.from(categorySet).sort();
    const subcategories: Record<string, string[]> = {};
    subcategoryMap.forEach((subs, cat) => {
      subcategories[cat] = Array.from(subs).sort();
    });

    return NextResponse.json({
      success: true,
      categories,
      subcategories,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

