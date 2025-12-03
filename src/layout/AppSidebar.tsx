"use client";
import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  AiIcon,
  BoxCubeIcon,
  CalenderIcon,
  CallIcon,
  CartIcon,
  ChatIcon,
  ChevronDownIcon,
  GridIcon,
  GroupIcon,
  HorizontaLDots,
  ListIcon,
  MailIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  ShootingStarIcon,
  TableIcon,
  TaskIcon,
  UserCircleIcon,
} from "../icons";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  new?: boolean;
  subItems?: (NavItem | { name: string; path: string; pro?: boolean; new?: boolean })[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Ecommerce", path: "/" },
      { name: "Analytics", path: "/analytics" },
      { name: "Marketing", path: "/marketing" },
      { name: "CRM", path: "/crm" },
      { name: "Stocks", path: "/stocks" },
      { name: "SaaS", path: "/saas", new: true },
      { name: "Logistics", path: "/logistics", new: true },
    ],
  },
  {
    name: "AI Assistant",
    icon: <AiIcon />,
    new: true,
    subItems: [
      {
        name: "Text Generator",
        path: "/text-generator",
      },
      {
        name: "Image Generator",
        path: "/image-generator",
      },
      {
        name: "Code Generator",
        path: "/code-generator",
      },
      {
        name: "Video Generator",
        path: "/video-generator",
      },
    ],
  },
  {
    name: "Templates",
    icon: <BoxCubeIcon />,
    new: true,
    subItems: [
      {
        name: "E-commerce",
        path: "/templates/ecommerce",
      },
      {
        name: "Blog Writer",
        path: "/templates/blog-writer",
        new: true,
      },
      {
        name: "Restaurant",
        path: "/templates/restaurant",
      },
      {
        name: "Healthcare",
        path: "/templates/healthcare",
      },
      {
        name: "Finance",
        path: "/templates/finance",
      },
      {
        name: "Education",
        path: "/templates/education",
      },
    ],
  },
  {
    name: "AI Customer Care",
    icon: <CallIcon />,
    new: true,
    subItems: [
      { name: "Dashboard", path: "/templates/ai-customer-care" },
      { name: "Voice Agents", path: "/templates/ai-customer-care/agents/voice" },
      { name: "Chat Agents", path: "/templates/ai-customer-care/agents/chat" },
      { name: "Live Monitoring", path: "/templates/ai-customer-care/monitoring" },
      { name: "Call Flow Builder", path: "/templates/ai-customer-care/flows" },
      { name: "Analytics", path: "/templates/ai-customer-care/analytics" },
      { name: "Call History", path: "/templates/ai-customer-care/calls/history" },
      { name: "Knowledge Base", path: "/templates/ai-customer-care/knowledge" },
      { name: "Integrations", path: "/templates/ai-customer-care/integrations" },
      { name: "Webhooks", path: "/templates/ai-customer-care/webhooks" },
      { name: "Phone Numbers", path: "/templates/ai-customer-care/numbers" },
      { name: "Quality Assurance", path: "/templates/ai-customer-care/quality" },
      { name: "User Management", path: "/templates/ai-customer-care/users" },
      { name: "Settings", path: "/templates/ai-customer-care/settings" },
      { name: "API Playground", path: "/templates/ai-customer-care/api-playground" },
      { name: "Tenant Management", path: "/templates/ai-customer-care/tenant-settings" },
    ],
  },
  {
    name: "Blog Writer",
    icon: <MailIcon />,
    new: true,
    subItems: [
      { name: "Dashboard", path: "/templates/blog-writer" },
      { name: "Content Calendar", path: "/templates/blog-writer/calendar" },
      { name: "Drafts", path: "/templates/blog-writer/drafts" },
      { name: "Publishing", path: "/templates/blog-writer/publishing" },
      { name: "SEO Tools", path: "/templates/blog-writer/seo" },
      { name: "Analytics", path: "/templates/blog-writer/analytics" },
      { name: "Media", path: "/templates/blog-writer/media" },
      { name: "Team", path: "/templates/blog-writer/team" },
      { name: "Templates", path: "/templates/blog-writer/templates" },
      { name: "Workflows", path: "/templates/blog-writer/workflows" },
    ],
  },
  {
    name: "E-commerce",
    icon: <CartIcon />,
    new: true,
    subItems: [
      { name: "Products", path: "/products-list" },
      { name: "Add Product", path: "/add-product" },
      { name: "Billing", path: "/billing" },
      { name: "Invoices", path: "/invoices" },
      { name: "Single Invoice", path: "/single-invoice" },
      { name: "Create Invoice", path: "/create-invoice" },
      { name: "Transactions", path: "/transactions" },
      { name: "Single Transaction", path: "/single-transaction" },
    ],
  },
  {
    name: "SaaS",
    icon: <ShootingStarIcon />,
    new: true,
    subItems: [
      { name: "Dashboard", path: "/templates/saas/dashboard" },
      { name: "User Profile", path: "/templates/saas/userprofile" },
      {
        name: "Admin",
        subItems: [
          { name: "User Management", path: "/templates/saas/admin/entity/user-management" },
          { name: "Tenant Management", path: "/templates/saas/admin/entity/tenant-management" },
          { name: "Organization Management", path: "/templates/saas/admin/entity/organization-management" },
          { name: "Role Management", path: "/templates/saas/admin/entity/role-management" },
        ],
      },
      {
        name: "System Admin",
        subItems: [
          { name: "API Configuration", path: "/templates/saas/admin/system-admin/api-configuration" },
          {
            name: "Webhooks",
            subItems: [
              { name: "Management", path: "/templates/saas/webhooks/management" },
              { name: "Events", path: "/templates/saas/webhooks/events" },
              { name: "Logs", path: "/templates/saas/webhooks/logs" },
              { name: "Testing", path: "/templates/saas/webhooks/testing" },
            ],
          },
        ],
      },
      {
        name: "Subscriptions",
        subItems: [
          { name: "Plans", path: "/templates/saas/subscriptions/plans" },
          { name: "Features", path: "/templates/saas/subscriptions/features" },
          { name: "Usage Limits", path: "/templates/saas/subscriptions/usage-limits" },
          { name: "History", path: "/templates/saas/subscriptions/history" },
          { name: "Migration", path: "/templates/saas/subscriptions/migration" },
        ],
      },
      {
        name: "Invoicing",
        subItems: [
          { name: "Invoices", path: "/templates/saas/invoicing/invoices" },
          { name: "Payment History", path: "/templates/saas/invoicing/payment-history" },
          { name: "Failed Payments", path: "/templates/saas/invoicing/failed-payments" },
          { name: "Refunds", path: "/templates/saas/invoicing/refunds" },
          { name: "Tax Settings", path: "/templates/saas/invoicing/tax-settings" },
        ],
      },
      {
        name: "Usage & Metering",
        subItems: [
          { name: "Dashboard", path: "/templates/saas/usage-metering/dashboard" },
          { name: "Metered Billing", path: "/templates/saas/usage-metering/metered-billing" },
          { name: "Reports", path: "/templates/saas/usage-metering/reports" },
          { name: "Alerts", path: "/templates/saas/usage-metering/alerts" },
          { name: "Rate Limits", path: "/templates/saas/usage-metering/rate-limits" },
        ],
      },
      {
        name: "Security",
        subItems: [
          { name: "Settings", path: "/templates/saas/security/settings" },
          { name: "SSO Configuration", path: "/templates/saas/security/sso-configuration" },
          { name: "Session Management", path: "/templates/saas/security/session-management" },
          { name: "IP Restrictions", path: "/templates/saas/security/ip-restrictions" },
          { name: "Audit Logs", path: "/templates/saas/security/audit-logs" },
          { name: "Compliance", path: "/templates/saas/security/compliance" },
        ],
      },
      {
        name: "Email & Notifications",
        subItems: [
          { name: "Templates", path: "/templates/saas/email-notifications/templates" },
          { name: "Settings", path: "/templates/saas/email-notifications/settings" },
          { name: "Logs", path: "/templates/saas/email-notifications/logs" },
          { name: "Campaigns", path: "/templates/saas/email-notifications/campaigns" },
        ],
      },
      {
        name: "Support",
        subItems: [
          { name: "Tickets", path: "/templates/saas/support/tickets" },
          { name: "Categories", path: "/templates/saas/support/categories" },
          { name: "Knowledge Base", path: "/templates/saas/support/knowledge-base" },
          { name: "Settings", path: "/templates/saas/support/settings" },
        ],
      },
      {
        name: "Feature Flags",
        subItems: [
          { name: "Flags", path: "/templates/saas/feature-flags/flags" },
          { name: "Environments", path: "/templates/saas/feature-flags/environments" },
          { name: "Targeting", path: "/templates/saas/feature-flags/targeting" },
          { name: "History", path: "/templates/saas/feature-flags/history" },
        ],
      },
      {
        name: "Analytics",
        subItems: [
          { name: "Dashboard", path: "/templates/saas/analytics/dashboard" },
          { name: "Custom Reports", path: "/templates/saas/analytics/custom-reports" },
          { name: "Events", path: "/templates/saas/analytics/events" },
          { name: "Exports", path: "/templates/saas/analytics/exports" },
        ],
      },
      {
        name: "Integrations",
        subItems: [
          { name: "All Integrations", path: "/templates/saas/integrations/list" },
          { name: "CRM", path: "/templates/saas/integrations/crm" },
          { name: "Email Marketing", path: "/templates/saas/integrations/email-marketing" },
          { name: "Telephony", path: "/templates/saas/integrations/telephony" },
          { name: "Payments", path: "/templates/saas/integrations/payments" },
          { name: "Analytics", path: "/templates/saas/integrations/analytics" },
          { name: "Accounting", path: "/templates/saas/integrations/accounting" },
          { name: "E-commerce", path: "/templates/saas/integrations/ecommerce" },
          { name: "Social Media", path: "/templates/saas/integrations/social-media" },
          { name: "Customer Support", path: "/templates/saas/integrations/customer-support" },
          { name: "API Connections", path: "/templates/saas/integrations/api-connections" },
          { name: "OAuth Apps", path: "/templates/saas/integrations/oauth-apps" },
          { name: "Settings", path: "/templates/saas/integrations/settings" },
        ],
      },
      {
        name: "Data Management",
        subItems: [
          { name: "Export Jobs", path: "/templates/saas/data-management/export-jobs" },
          { name: "Import Templates", path: "/templates/saas/data-management/import-templates" },
          { name: "Data Mapping", path: "/templates/saas/data-management/data-mapping" },
          { name: "History", path: "/templates/saas/data-management/history" },
        ],
      },
      {
        name: "Custom Report Builder",
        subItems: [
          { name: "Builder", path: "/templates/saas/custom-report-builder/builder" },
          { name: "Saved Reports", path: "/templates/saas/custom-report-builder/saved-reports" },
          { name: "Templates", path: "/templates/saas/custom-report-builder/templates" },
          { name: "Data Sources", path: "/templates/saas/custom-report-builder/data-sources" },
          { name: "Sharing", path: "/templates/saas/custom-report-builder/sharing" },
        ],
      },
      {
        name: "White-Label",
        subItems: [
          { name: "Branding", path: "/templates/saas/white-label/branding" },
          { name: "Domain Settings", path: "/templates/saas/white-label/domain-settings" },
          { name: "Email Customization", path: "/templates/saas/white-label/email-customization" },
          { name: "Theme Settings", path: "/templates/saas/white-label/theme-settings" },
          { name: "Custom CSS", path: "/templates/saas/white-label/custom-css" },
        ],
      },
      {
        name: "Billing & Plans",
        subItems: [
          { name: "Billing Dashboard", path: "/billing" },
          { name: "Cancel Subscription", path: "/templates/saas/billing/cancel-subscription" },
          { name: "Upgrade to Pro", path: "/templates/saas/billing/upgrade-to-pro" },
          { name: "Update Billing Address", path: "/templates/saas/billing/update-billing-address" },
          { name: "Add New Card", path: "/templates/saas/billing/add-new-card" },
        ],
      },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    name: "Task",
    icon: <TaskIcon />,
    subItems: [
      { name: "List", path: "/task-list", pro: false },
      { name: "Kanban", path: "/task-kanban", pro: false },
    ],
  },
  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [
      { name: "Form Elements", path: "/form-elements", pro: false },
      { name: "Form Layout", path: "/form-layout", pro: false },
    ],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [
      { name: "Basic Tables", path: "/basic-tables", pro: false },
      { name: "Data Tables", path: "/data-tables", pro: false },
    ],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
    subItems: [
      { name: "File Manager", path: "/file-manager" },
      { name: "Multi-Tenant", path: "/multi-tenant", new: true },
      { name: "Pricing Tables", path: "/pricing-tables" },
      { name: "FAQ", path: "/faq" },
      { name: "API Keys", path: "/api-keys", new: true },
      { name: "Integrations", path: "/integrations", new: true },
      { name: "Blank Page", path: "/blank" },
      { name: "404 Error", path: "/error-404" },
      { name: "500 Error", path: "/error-500" },
      { name: "503 Error", path: "/error-503" },
      { name: "Coming Soon", path: "/coming-soon" },
      { name: "Maintenance", path: "/maintenance" },
      { name: "Success", path: "/success" },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart", pro: false },
      { name: "Bar Chart", path: "/bar-chart", pro: false },
      { name: "Pie Chart", path: "/pie-chart", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts" },
      { name: "Avatar", path: "/avatars" },
      { name: "Badge", path: "/badge" },
      { name: "Breadcrumb", path: "/breadcrumb" },
      { name: "Buttons", path: "/buttons" },
      { name: "Buttons Group", path: "/buttons-group" },
      { name: "Cards", path: "/cards" },
      { name: "Carousel", path: "/carousel" },
      { name: "Dropdowns", path: "/dropdowns" },
      { name: "Images", path: "/images" },
      { name: "Links", path: "/links" },
      { name: "List", path: "/list" },
      { name: "Modals", path: "/modals" },
      { name: "Notification", path: "/notifications" },
      { name: "Pagination", path: "/pagination" },
      { name: "Popovers", path: "/popovers" },
      { name: "Progressbar", path: "/progress-bar" },
      { name: "Ribbons", path: "/ribbons" },
      { name: "Spinners", path: "/spinners" },
      { name: "Tabs", path: "/tabs" },
      { name: "Tooltips", path: "/tooltips" },
      { name: "Videos", path: "/videos" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
      { name: "Sign Up", path: "/signup", pro: false },
      { name: "Reset Password", path: "/reset-password" },
      {
        name: "Two Step Verification",
        path: "/two-step-verification",
      },
    ],
  },
];

const supportItems: NavItem[] = [
  {
    icon: <ChatIcon />,
    name: "Chat",
    path: "/chat",
  },
  {
    icon: <CallIcon />,
    name: "Support",
    new: true,
    subItems: [
      { name: "Support List", path: "/support-tickets" },
      { name: "Support Reply", path: "/support-ticket-reply" },
    ],
  },
  {
    icon: <MailIcon />,
    name: "Email",
    subItems: [
      { name: "Inbox", path: "/inbox" },
      { name: "Details", path: "/inbox-details" },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "support" | "others"
  ) => (
    <ul className="flex flex-col gap-1">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              aria-expanded={
                openSubmenu?.type === menuType && openSubmenu?.index === index
              }
              aria-controls={`submenu-${menuType}-${index}`}
              className={`menu-item group  ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {nav.new && (isExpanded || isHovered || isMobileOpen) && (
                <span
                  className={`ml-auto absolute right-10 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "menu-dropdown-badge-active"
                      : "menu-dropdown-badge-inactive"
                  } menu-dropdown-badge`}
                >
                  new
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && nav.subItems && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              id={`submenu-${menuType}-${index}`}
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              role="region"
              aria-labelledby={`menu-${menuType}-${index}`}
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9" role="menu">
                {nav.subItems.map((subItem, subIndex) => {
                  // Check if subItem is a nested menu (has subItems) or a regular link
                  const isNestedMenu = 'subItems' in subItem && subItem.subItems && !('path' in subItem);
                  const isNestedOpen = openSubmenu?.type === menuType && 
                    openSubmenu?.index === index && 
                    openSubmenu?.subIndex === subIndex;

                  if (isNestedMenu) {
                    return (
                      <li key={subItem.name} role="none">
                        <button
                          onClick={() => handleSubmenuToggle(index, menuType, subIndex)}
                          className="menu-dropdown-item w-full text-left flex items-center justify-between"
                        >
                          <span>{subItem.name}</span>
                          <ChevronDownIcon
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isNestedOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isNestedOpen && (
                          <ul className="mt-1 ml-4 space-y-1" role="menu">
                            {subItem.subItems?.map((nestedItem) => {
                              if ('path' in nestedItem) {
                                return (
                                  <li key={nestedItem.name} role="none">
                                    <Link
                                      href={nestedItem.path}
                                      role="menuitem"
                                      className={`menu-dropdown-item ${
                                        isActive(nestedItem.path)
                                          ? "menu-dropdown-item-active"
                                          : "menu-dropdown-item-inactive"
                                      }`}
                                    >
                                      {nestedItem.name}
                                    </Link>
                                  </li>
                                );
                              }
                              return null;
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  }

                  // Regular submenu item with path
                  if ('path' in subItem) {
                    return (
                      <li key={subItem.name} role="none">
                        <Link
                          href={subItem.path}
                          role="menuitem"
                          className={`menu-dropdown-item ${
                            isActive(subItem.path)
                              ? "menu-dropdown-item-active"
                              : "menu-dropdown-item-inactive"
                          }`}
                        >
                          {subItem.name}
                          <span className="flex items-center gap-1 ml-auto">
                            {subItem.new && (
                              <span
                                className={`ml-auto ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-badge-active"
                                    : "menu-dropdown-badge-inactive"
                                } menu-dropdown-badge `}
                              >
                                new
                              </span>
                            )}
                            {subItem.pro && (
                              <span
                                className={`ml-auto ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-badge-pro-active"
                                    : "menu-dropdown-badge-pro-inactive"
                                } menu-dropdown-badge-pro `}
                              >
                                pro
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  }

                  return null;
                })}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "support" | "others";
    index: number;
    subIndex?: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item (including nested)
    let submenuMatched = false;
    ["main", "support", "others"].forEach((menuType) => {
      const items =
        menuType === "main"
          ? navItems
          : menuType === "support"
          ? supportItems
          : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem, subIndex) => {
            // Check if subItem has nested subItems
            if ('subItems' in subItem && subItem.subItems) {
              subItem.subItems.forEach((nestedItem) => {
                if (nestedItem.path && isActive(nestedItem.path)) {
                  setOpenSubmenu({
                    type: menuType as "main" | "support" | "others",
                    index,
                    subIndex,
                  });
                  submenuMatched = true;
                }
              });
            } else if (subItem.path && isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "support" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "main" | "support" | "others",
    subIndex?: number
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index &&
        prevOpenSubmenu.subIndex === subIndex
      ) {
        return null;
      }
      return { type: menuType, index, subIndex };
    });
  };

  return (
    <aside
      className={`fixed  flex flex-col xl:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        xl:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "xl:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto  duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Support"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(supportItems, "support")}
            </div>
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-5 text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "xl:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
