"use server";

import { stripe } from "@/core/billing";
import { createAdminClient, createClient } from "@/core/database";
import { getCurrentTenant } from "@/core/multi-tenancy";
import { requirePermission } from "@/core/permissions";
import type Stripe from "stripe";

/**
 * Get all payment methods for the current tenant
 */
export async function getPaymentMethods(): Promise<{
  success: boolean;
  paymentMethods?: any[];
  error?: string;
}> {
  try {
    await requirePermission("billing.read");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    const { data: paymentMethods, error } = await adminClient
      .from("stripe_payment_methods")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, paymentMethods: paymentMethods || [] };
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch payment methods",
    };
  }
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get customer
    const { data: customer } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Get payment method from database
    const { data: paymentMethod } = await adminClient
      .from("stripe_payment_methods")
      .select("stripe_payment_method_id")
      .eq("id", paymentMethodId)
      .eq("tenant_id", tenantId)
      .single();

    if (!paymentMethod) {
      return { success: false, error: "Payment method not found" };
    }

    // Update default payment method in Stripe
    await stripe.customers.update(customer.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethod.stripe_payment_method_id,
      },
    });

    // Update in database - set all to false first
    await adminClient
      .from("stripe_payment_methods")
      .update({ is_default: false })
      .eq("tenant_id", tenantId);

    // Then set the selected one to true
    await adminClient
      .from("stripe_payment_methods")
      .update({ is_default: true })
      .eq("id", paymentMethodId);

    return { success: true };
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default payment method",
    };
  }
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(paymentMethodId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get payment method from database
    const { data: paymentMethod } = await adminClient
      .from("stripe_payment_methods")
      .select("stripe_payment_method_id")
      .eq("id", paymentMethodId)
      .eq("tenant_id", tenantId)
      .single();

    if (!paymentMethod) {
      return { success: false, error: "Payment method not found" };
    }

    // Detach payment method in Stripe
    await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);

    // Delete from database
    await adminClient
      .from("stripe_payment_methods")
      .delete()
      .eq("id", paymentMethodId);

    return { success: true };
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete payment method",
    };
  }
}

/**
 * Create a setup intent for adding a new payment method
 */
export async function createSetupIntent(): Promise<{
  success: boolean;
  clientSecret?: string;
  error?: string;
}> {
  try {
    await requirePermission("billing.write");

    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return { success: false, error: "No tenant context found" };
    }

    const adminClient = createAdminClient();

    // Get customer
    const { data: customer } = await adminClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("tenant_id", tenantId)
      .single();

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.stripe_customer_id,
      payment_method_types: ["card"],
      metadata: {
        tenant_id: tenantId,
      },
    });

    return { success: true, clientSecret: setupIntent.client_secret || undefined };
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create setup intent",
    };
  }
}
