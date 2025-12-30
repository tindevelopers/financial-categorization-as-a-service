'use client'

import { usePathname } from 'next/navigation'
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
import { ChatContextProvider } from '@/context/ChatContext'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { FloatingChatBubble } from '@/components/chat'
import {
  HomeIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  FolderOpenIcon,
  DocumentChartBarIcon,
  ArrowUpTrayIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Don't show floating bubble on the chat page (it has its own full interface)
  const showFloatingBubble = pathname !== '/dashboard/chat'

  return (
    <SubscriptionProvider>
    <ChatContextProvider>
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
                href="/dashboard/setup"
                current={pathname === '/dashboard/setup'}
              >
                <BuildingOfficeIcon />
                <SidebarLabel>Company Setup</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/transactions"
                current={pathname.startsWith('/dashboard/transactions')}
              >
                <ArrowsRightLeftIcon />
                <SidebarLabel>Transactions</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/reconciliation"
                current={pathname.startsWith('/dashboard/reconciliation')}
              >
                <ArrowsRightLeftIcon />
                <SidebarLabel>Reconciliation</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/uploads"
                current={pathname.startsWith('/dashboard/uploads')}
              >
                <FolderOpenIcon />
                <SidebarLabel>Uploads</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/review"
                current={pathname.startsWith('/dashboard/review')}
              >
                <ClipboardDocumentCheckIcon />
                <SidebarLabel>Review Jobs</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/analytics"
                current={pathname.startsWith('/dashboard/analytics')}
              >
                <ChartBarIcon />
                <SidebarLabel>Analytics</SidebarLabel>
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
            </SidebarSection>

            <SidebarSection className="max-lg:hidden">
              <SidebarItem
                href="/dashboard/chat"
                current={pathname === '/dashboard/chat'}
              >
                <ChatBubbleLeftRightIcon />
                <SidebarLabel>AI Assistant</SidebarLabel>
              </SidebarItem>

              <SidebarItem
                href="/dashboard/settings"
                current={pathname.startsWith('/dashboard/settings')}
              >
                <Cog6ToothIcon />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter>
            <SidebarUserMenu />
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
      
      {/* Floating AI Chat Bubble */}
      {showFloatingBubble && <FloatingChatBubble position="bottom-right" />}
    </SidebarLayout>
    </ChatContextProvider>
    </SubscriptionProvider>
  )
}

