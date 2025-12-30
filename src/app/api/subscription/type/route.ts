import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionType,
  updateSubscriptionType,
  getAvailableAuthMethods,
  type SubscriptionType,
} from "@/app/actions/subscription";

/**
 * GET /api/subscription/type
 * Retrieve subscription type for current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const result = await getSubscriptionType();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch subscription type" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      subscriptionType: result.subscriptionType,
    });
  } catch (error) {
    console.error("Error in GET /api/subscription/type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subscription/type
 * Update subscription type for current tenant
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionType, skipVerification } = body;

    if (!subscriptionType) {
      return NextResponse.json(
        { error: "subscriptionType is required" },
        { status: 400 }
      );
    }

    const validTypes: SubscriptionType[] = ["individual", "company", "enterprise"];
    if (!validTypes.includes(subscriptionType)) {
      return NextResponse.json(
        { error: `subscriptionType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await updateSubscriptionType(subscriptionType, {
      skipVerification: skipVerification === true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update subscription type" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      subscriptionType: result.subscriptionType,
    });
  } catch (error) {
    console.error("Error in PUT /api/subscription/type:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

