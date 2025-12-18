-- Migration: Add Performance Indexes
-- This migration adds indexes for common query patterns to improve performance

-- Indexes for tenants table
CREATE INDEX IF NOT EXISTS idx_tenants_mode ON tenants(mode);
CREATE INDEX IF NOT EXISTS idx_tenants_status_mode ON tenants(status, mode);

-- Indexes for workspaces (organizations) table
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_type ON workspaces(organization_type);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_type ON workspaces(tenant_id, organization_type);
CREATE INDEX IF NOT EXISTS idx_workspaces_status_tenant ON workspaces(status, tenant_id);

-- Indexes for users table (common queries)
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_users_status_tenant ON users(status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email_tenant ON users(email, tenant_id);

-- Indexes for workspace_users table
CREATE INDEX IF NOT EXISTS idx_workspace_users_user_workspace ON workspace_users(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_role ON workspace_users(workspace_id, role_id);

-- Indexes for CRM tables (if they exist)
-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_tenant_name ON companies(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_created ON companies(tenant_id, created_at DESC);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON contacts(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_company ON contacts(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON contacts(tenant_id, created_at DESC);

-- Deals
CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON deals(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_created ON deals(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_company ON deals(tenant_id, company_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_created ON tasks(tenant_id, created_at DESC);

-- Composite indexes for common filter combinations
-- Note: companies and contacts tables don't have a status column
-- The tenant_id + created_at indexes are already created above, so no duplicates needed here

-- Indexes for activity logs (if exists)
-- Note: activities table uses specific foreign keys (contact_id, company_id, deal_id, etc.) instead of entity_type/entity_id
CREATE INDEX IF NOT EXISTS idx_activities_tenant_created ON activities(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_type ON activities(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id) WHERE deal_id IS NOT NULL;

-- Performance optimization: Analyze tables after index creation
ANALYZE tenants;
ANALYZE workspaces;
ANALYZE users;
ANALYZE workspace_users;
ANALYZE companies;
ANALYZE contacts;
ANALYZE deals;
ANALYZE tasks;
