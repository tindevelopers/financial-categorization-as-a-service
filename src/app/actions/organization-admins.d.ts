import type { Database } from "@/core/database";
type OrganizationAdmin = Database["public"]["Tables"]["users"]["Row"] & {
    roles?: {
        id: string;
        name: string;
        description: string;
        permissions: string[];
    } | null;
    tenants?: {
        id: string;
        name: string;
        domain: string;
        status: string;
    } | null;
};
/**
 * Get all Organization Admins (Organization Admins) across all tenants
 * Only accessible by Platform Admins
 * Server action version
 */
export declare function getAllOrganizationAdmins(): Promise<OrganizationAdmin[]>;
/**
 * Check if current user is Platform Admin (server action)
 */
export declare function isPlatformAdmin(): Promise<boolean>;
export {};
//# sourceMappingURL=organization-admins.d.ts.map