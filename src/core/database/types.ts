export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          domain: string;
          status: "active" | "pending" | "suspended";
          plan: string;
          region: string;
          avatar_url: string | null;
          features: string[];
          branding: Record<string, unknown> | null;
          theme_settings: Record<string, unknown> | null;
          email_settings: Record<string, unknown> | null;
          custom_css: string | null;
          custom_domains: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain: string;
          status?: "active" | "pending" | "suspended";
          plan: string;
          region: string;
          avatar_url?: string | null;
          features?: string[];
          branding?: Record<string, unknown> | null;
          theme_settings?: Record<string, unknown> | null;
          email_settings?: Record<string, unknown> | null;
          custom_css?: string | null;
          custom_domains?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string;
          status?: "active" | "pending" | "suspended";
          plan?: string;
          region?: string;
          avatar_url?: string | null;
          features?: string[];
          branding?: Record<string, unknown> | null;
          theme_settings?: Record<string, unknown> | null;
          email_settings?: Record<string, unknown> | null;
          custom_css?: string | null;
          custom_domains?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string;
          coverage: string;
          max_seats: number;
          current_seats: number;
          permissions: string[];
          gradient: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          coverage: string;
          max_seats: number;
          current_seats?: number;
          permissions: string[];
          gradient: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          coverage?: string;
          max_seats?: number;
          current_seats?: number;
          permissions?: string[];
          gradient?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role_id: string | null;
          tenant_id: string | null;
          plan: string;
          status: "active" | "pending" | "suspended";
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role_id?: string | null;
          tenant_id?: string | null;
          plan: string;
          status?: "active" | "pending" | "suspended";
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role_id?: string | null;
          tenant_id?: string | null;
          plan?: string;
          status?: "active" | "pending" | "suspended";
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "users_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      workspaces: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          description: string | null;
          avatar_url: string | null;
          settings: Record<string, unknown>;
          status: "active" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          slug: string;
          description?: string | null;
          avatar_url?: string | null;
          settings?: Record<string, unknown>;
          status?: "active" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          avatar_url?: string | null;
          settings?: Record<string, unknown>;
          status?: "active" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      workspace_users: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role_id: string | null;
          permissions: string[];
          joined_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role_id?: string | null;
          permissions?: string[];
          joined_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role_id?: string | null;
          permissions?: string[];
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_users_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_users_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          }
        ];
      };
      user_tenant_roles: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          role_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          role_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          role_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_tenant_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_tenant_roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_tenant_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_customers: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          stripe_customer_id: string;
          email: string;
          name: string | null;
          phone: string | null;
          address: Record<string, unknown> | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          stripe_customer_id: string;
          email: string;
          name?: string | null;
          phone?: string | null;
          address?: Record<string, unknown> | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string | null;
          stripe_customer_id?: string;
          email?: string;
          name?: string | null;
          phone?: string | null;
          address?: Record<string, unknown> | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_customers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stripe_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          stripe_product_id: string;
          status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete" | "incomplete_expired" | "paused";
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          trial_start: string | null;
          trial_end: string | null;
          plan_name: string;
          plan_price: number;
          billing_cycle: "monthly" | "annual";
          currency: string;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          stripe_product_id: string;
          status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete" | "incomplete_expired" | "paused";
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          trial_start?: string | null;
          trial_end?: string | null;
          plan_name: string;
          plan_price: number;
          billing_cycle: "monthly" | "annual";
          currency?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          stripe_price_id?: string;
          stripe_product_id?: string;
          status?: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete" | "incomplete_expired" | "paused";
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          trial_start?: string | null;
          trial_end?: string | null;
          plan_name?: string;
          plan_price?: number;
          billing_cycle?: "monthly" | "annual";
          currency?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_subscriptions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_payment_methods: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_payment_method_id: string;
          type: "card" | "bank_account" | "us_bank_account" | "sepa_debit";
          is_default: boolean;
          card_brand: string | null;
          card_last4: string | null;
          card_exp_month: number | null;
          card_exp_year: number | null;
          billing_details: Record<string, unknown>;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_payment_method_id: string;
          type: "card" | "bank_account" | "us_bank_account" | "sepa_debit";
          is_default?: boolean;
          card_brand?: string | null;
          card_last4?: string | null;
          card_exp_month?: number | null;
          card_exp_year?: number | null;
          billing_details?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string;
          stripe_payment_method_id?: string;
          type?: "card" | "bank_account" | "us_bank_account" | "sepa_debit";
          is_default?: boolean;
          card_brand?: string | null;
          card_last4?: string | null;
          card_exp_month?: number | null;
          card_exp_year?: number | null;
          billing_details?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_payment_methods_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_invoices: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string | null;
          stripe_invoice_id: string;
          invoice_number: string | null;
          status: "draft" | "open" | "paid" | "uncollectible" | "void";
          amount_due: number;
          amount_paid: number;
          subtotal: number;
          total: number;
          tax: number;
          currency: string;
          due_date: string | null;
          paid_at: string | null;
          invoice_pdf: string | null;
          invoice_hosted_url: string | null;
          line_items: unknown[];
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id?: string | null;
          stripe_invoice_id: string;
          invoice_number?: string | null;
          status: "draft" | "open" | "paid" | "uncollectible" | "void";
          amount_due: number;
          amount_paid?: number;
          subtotal: number;
          total: number;
          tax?: number;
          currency?: string;
          due_date?: string | null;
          paid_at?: string | null;
          invoice_pdf?: string | null;
          invoice_hosted_url?: string | null;
          line_items?: unknown[];
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string | null;
          stripe_invoice_id?: string;
          invoice_number?: string | null;
          status?: "draft" | "open" | "paid" | "uncollectible" | "void";
          amount_due?: number;
          amount_paid?: number;
          subtotal?: number;
          total?: number;
          tax?: number;
          currency?: string;
          due_date?: string | null;
          paid_at?: string | null;
          invoice_pdf?: string | null;
          invoice_hosted_url?: string | null;
          line_items?: unknown[];
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_invoices_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_payment_intents: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string;
          amount: number;
          currency: string;
          status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
          payment_method_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id: string;
          amount: number;
          currency?: string;
          status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
          payment_method_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string;
          amount?: number;
          currency?: string;
          status?: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
          payment_method_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_payment_intents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          livemode: boolean;
          processed: boolean;
          processed_at: string | null;
          event_data: Record<string, unknown>;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          livemode?: boolean;
          processed?: boolean;
          processed_at?: string | null;
          event_data: Record<string, unknown>;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          event_type?: string;
          livemode?: boolean;
          processed?: boolean;
          processed_at?: string | null;
          event_data?: Record<string, unknown>;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stripe_products: {
        Row: {
          id: string;
          stripe_product_id: string;
          name: string;
          description: string | null;
          active: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stripe_product_id: string;
          name: string;
          description?: string | null;
          active?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stripe_product_id?: string;
          name?: string;
          description?: string | null;
          active?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_prices: {
        Row: {
          id: string;
          stripe_price_id: string;
          stripe_product_id: string;
          active: boolean;
          currency: string;
          unit_amount: number;
          billing_cycle: "monthly" | "annual";
          interval_count: number;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stripe_price_id: string;
          stripe_product_id: string;
          active?: boolean;
          currency?: string;
          unit_amount: number;
          billing_cycle: "monthly" | "annual";
          interval_count?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stripe_price_id?: string;
          stripe_product_id?: string;
          active?: boolean;
          currency?: string;
          unit_amount?: number;
          billing_cycle?: "monthly" | "annual";
          interval_count?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_prices_stripe_product_id_fkey";
            columns: ["stripe_product_id"];
            isOneToOne: false;
            referencedRelation: "stripe_products";
            referencedColumns: ["stripe_product_id"];
          }
        ];
      };
      stripe_connect_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_account_id: string;
          account_type: "standard" | "express" | "custom";
          charges_enabled: boolean;
          payouts_enabled: boolean;
          details_submitted: boolean;
          country: string;
          default_currency: string;
          email: string | null;
          business_name: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_account_id: string;
          account_type: "standard" | "express" | "custom";
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
          details_submitted?: boolean;
          country: string;
          default_currency: string;
          email?: string | null;
          business_name?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_account_id?: string;
          account_type?: "standard" | "express" | "custom";
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
          details_submitted?: boolean;
          country?: string;
          default_currency?: string;
          email?: string | null;
          business_name?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_connect_accounts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string | null;
          workspace_id: string | null;
          action: string;
          resource: string;
          permission: string;
          allowed: boolean;
          reason: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id?: string | null;
          workspace_id?: string | null;
          action: string;
          resource: string;
          permission: string;
          allowed?: boolean;
          reason?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string | null;
          workspace_id?: string | null;
          action?: string;
          resource?: string;
          permission?: string;
          allowed?: boolean;
          reason?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
