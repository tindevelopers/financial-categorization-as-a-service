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
          created_at?: string;
          updated_at?: string;
        };
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
      };
    };
  };
}

