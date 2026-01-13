'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  SidebarLayout,
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarFooter,
  SidebarSection,
  SidebarItem,
  SidebarLabel,
  Navbar,
  NavbarSection,
  NavbarSpacer,
} from '@/components/catalyst'
import { CompanySwitcher } from '@/components/navigation/CompanySwitcher'
import { UserMenu } from '@/components/navigation/UserMenu'
import { SidebarUserMenu } from '@/components/navigation/SidebarUserMenu'
import {
  HomeIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  FolderOpenIcon,
  DocumentChartBarIcon,
  ArrowUpTrayIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  DocumentCheckIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { createClient } from '@/lib/database/client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isEnterpriseAdmin, setIsEnterpriseAdmin] = useState(false)

  useEffect(() => {
    async function checkEnterpriseAdmin() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id, roles:role_id(name)')
          .eq('id', user.id)
          .single()

        const roleName = (userData?.roles as any)?.name
        let subscriptionType: string | null = null

        // Fetch subscription_type separately if tenant_id exists
        if (userData?.tenant_id) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('subscription_type')
            .eq('id', userData.tenant_id)
            .single()
          subscriptionType = tenantData?.subscription_type || null
        }
        const isEnterpriseTenant = subscriptionType === 'enterprise' && !!userData?.tenant_id
        const allowedEnterpriseRoles = ['Organization Admin', 'Enterprise Admin']
        setIsEnterpriseAdmin(isEnterpriseTenant && allowedEnterpriseRoles.includes(roleName))
      } catch (error) {
        console.error('Error checking admin status:', error)
      }
    }
    checkEnterpriseAdmin()
  }, [])

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSection>
            <CompanySwitcher />
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <UserMenu />
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <span className="text-lg font-bold text-white">£</span>
              </div>
              <div>
                <SidebarLabel className="font-semibold">FinCat</SidebarLabel>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  UK Tax Platform
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/dashboard" current={pathname === '/dashboard'}>
                <HomeIcon />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/reconciliation"
                current={pathname.startsWith('/dashboard/reconciliation')}
              >
                <ArrowsRightLeftIcon />
                <SidebarLabel>Reconciliation</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/statements"
                current={pathname === '/dashboard/statements'}
              >
                <BanknotesIcon />
                <SidebarLabel>Statements</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/uploads/receipts"
                current={pathname === '/dashboard/uploads/receipts'}
              >
                <DocumentTextIcon />
                <SidebarLabel>Invoices &amp; Receipts</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/uploads"
                current={pathname === '/dashboard/uploads'}
              >
                <FolderOpenIcon />
                <SidebarLabel>All Uploads</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/review"
                current={pathname.startsWith('/dashboard/review')}
              >
                <DocumentCheckIcon />
                <SidebarLabel>Review Jobs</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/reports"
                current={pathname.startsWith('/dashboard/reports')}
              >
                <DocumentChartBarIcon />
                <SidebarLabel>Reports</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/exports"
                current={pathname.startsWith('/dashboard/exports')}
              >
                <ArrowUpTrayIcon />
                <SidebarLabel>Exports</SidebarLabel>
              </SidebarItem>

              {/* Settings group (non-clickable header) */}
              <div className="mt-4 px-3 text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                Settings
              </div>
              <SidebarItem
                href="/dashboard/settings"
                current={pathname === '/dashboard/settings'}
                className="ml-6"
              >
                <Cog6ToothIcon />
                <SidebarLabel>Overview</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/dashboard/settings/bank-accounts"
                current={pathname.startsWith('/dashboard/settings/bank-accounts')}
                className="ml-6"
              >
                <BanknotesIcon />
                <SidebarLabel>Bank Accounts</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/dashboard/settings/spreadsheets"
                current={pathname.startsWith('/dashboard/settings/spreadsheets')}
                className="ml-6"
              >
                <DocumentTextIcon />
                <SidebarLabel>Spreadsheets</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/dashboard/setup"
                current={pathname === '/dashboard/setup'}
                className="ml-6"
              >
                <BuildingOfficeIcon />
                <SidebarLabel>Company Setup</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            <SidebarSection className="max-lg:hidden">
              <SidebarItem
                href="/dashboard/chat"
                current={pathname === '/dashboard/chat'}
              >
                <ChatBubbleLeftRightIcon />
                <SidebarLabel>AI Assistant</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            {isEnterpriseAdmin && (
              <SidebarSection>
                <SidebarItem
                  href="/dashboard/enterprise-admin/enterprise-oauth"
                  current={pathname.startsWith('/dashboard/enterprise-admin')}
                >
                  <ShieldCheckIcon />
                  <SidebarLabel>Enterprise Admin</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
            )}
          </SidebarBody>

          <SidebarFooter>
            <SidebarUserMenu />
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  )
}
