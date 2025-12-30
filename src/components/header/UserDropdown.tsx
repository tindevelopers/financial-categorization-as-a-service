"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/app/actions/user";
import { createClient as createBrowserClient } from "@/core/database/client";
import type { Database } from "@/core/database/types";
import { useSubscriptionOptional } from "@/context/SubscriptionContext";
import { getPlanDisplayInfo, shouldShowUpgrade } from "@/config/plans";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
};

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Get subscription context (optional - won't throw if not in provider)
  const subscriptionContext = useSubscriptionOptional();

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        // Use server action to get current user (bypasses RLS properly)
        const userData = await getCurrentUser();
        
        if (userData) {
          console.log("[UserDropdown] User loaded:", {
            email: userData.email,
            full_name: userData.full_name,
            role: (userData.roles as any)?.name,
          });
          setUser(userData);
        } else {
          console.log("[UserDropdown] No user data returned (user not authenticated or not found)");
          setUser(null);
        }
      } catch (error) {
        // Better error handling for server action errors
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : JSON.stringify(error);
        
        console.error("[UserDropdown] Error loading user:", {
          message: errorMessage,
          error: error,
          type: typeof error,
        });
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Listen for auth changes
    const supabase = createBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    try {
      // Clear session from browser client
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      
      // Also call server action
      await signOut();
      
      // Redirect to sign in page
      router.push("/signin");
      router.refresh();
    } catch (error) {
      console.error("Sign out error:", error);
      // Still redirect even if there's an error
      router.push("/signin");
      router.refresh();
    }
  }

  // Plan information
  const planName = subscriptionContext?.planName;
  const status = subscriptionContext?.status;
  const isTrialing = subscriptionContext?.isTrialing;
  const planDisplayInfo = getPlanDisplayInfo(planName);
  const showUpgrade = shouldShowUpgrade(planName);

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center dropdown-toggle text-gray-700 dark:text-gray-400 dropdown-toggle"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
          <Image
            width={44}
            height={44}
            src="/images/user/owner.png"
            alt="User"
          />
        </span>

        <span className="block mr-1 font-medium text-theme-sm">
          {loading ? "Loading..." : user?.full_name || "User"}
        </span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[280px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {loading ? "Loading..." : user?.full_name || "User"}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {loading ? "Loading..." : user?.email || "No email"}
          </span>
        </div>

        {/* Plan Badge Section */}
        {subscriptionContext && !subscriptionContext.isLoading && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Link
              href="/saas/billing/dashboard"
              onClick={closeDropdown}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                planDisplayInfo
                  ? `${planDisplayInfo.bgColor} hover:opacity-80`
                  : 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`h-4 w-4 ${planDisplayInfo?.color || 'text-amber-600 dark:text-amber-400'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
                <div>
                  <span className={`text-sm font-medium ${planDisplayInfo?.color || 'text-amber-700 dark:text-amber-300'}`}>
                    {planName ? (
                      <>
                        {planName}
                        {isTrialing && ' Trial'}
                      </>
                    ) : (
                      'No Plan'
                    )}
                  </span>
                  {status && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      ({status === 'active' ? 'Active' : status === 'trialing' ? 'Trial' : status})
                    </span>
                  )}
                </div>
              </div>
              {showUpgrade && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Upgrade →
                </span>
              )}
            </Link>
          </div>
        )}

        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 3.5C7.30558 3.5 3.5 7.30558 3.5 12C3.5 14.1526 4.3002 16.1184 5.61936 17.616C6.17279 15.3096 8.24852 13.5955 10.7246 13.5955H13.2746C15.7509 13.5955 17.8268 15.31 18.38 17.6167C19.6996 16.119 20.5 14.153 20.5 12C20.5 7.30558 16.6944 3.5 12 3.5ZM17.0246 18.8566V18.8455C17.0246 16.7744 15.3457 15.0955 13.2746 15.0955H10.7246C8.65354 15.0955 6.97461 16.7744 6.97461 18.8455V18.856C8.38223 19.8895 10.1198 20.5 12 20.5C13.8798 20.5 15.6171 19.8898 17.0246 18.8566ZM2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM11.9991 7.25C10.8847 7.25 9.98126 8.15342 9.98126 9.26784C9.98126 10.3823 10.8847 11.2857 11.9991 11.2857C13.1135 11.2857 14.0169 10.3823 14.0169 9.26784C14.0169 8.15342 13.1135 7.25 11.9991 7.25ZM8.48126 9.26784C8.48126 7.32499 10.0563 5.75 11.9991 5.75C13.9419 5.75 15.5169 7.32499 15.5169 9.26784C15.5169 11.2107 13.9419 12.7857 11.9991 12.7857C10.0563 12.7857 8.48126 11.2107 8.48126 9.26784Z"
                  fill=""
                />
              </svg>
              Profile
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/saas/billing/dashboard"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.5 5.5C3.5 4.67157 4.17157 4 5 4H19C19.8284 4 20.5 4.67157 20.5 5.5V18.5C20.5 19.3284 19.8284 20 19 20H5C4.17157 20 3.5 19.3284 3.5 18.5V5.5ZM5 5.5H19V8H5V5.5ZM5 9.5V18.5H19V9.5H5ZM7 12C7 11.4477 7.44772 11 8 11H10C10.5523 11 11 11.4477 11 12C11 12.5523 10.5523 13 10 13H8C7.44772 13 7 12.5523 7 12Z"
                  fill=""
                />
              </svg>
              Billing
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M11.0175 2.75C10.3696 2.75 9.79977 3.18614 9.62875 3.81045L9.27406 5.14258C8.7126 5.36041 8.18667 5.6444 7.70429 5.98693L6.39704 5.57173C5.77863 5.37591 5.10873 5.66585 4.78481 6.22611L3.80229 7.92597C3.47839 8.48621 3.57875 9.19846 4.04661 9.64501L5.01965 10.5753C4.97345 10.9108 4.94933 11.2527 4.94933 11.6C4.94933 11.9474 4.97345 12.2893 5.01965 12.6248L4.04662 13.555C3.57875 14.0015 3.47839 14.7138 3.80229 15.274L4.78481 16.9739C5.10873 17.5342 5.77863 17.8241 6.39705 17.6283L7.70428 17.2131C8.18666 17.5556 8.71259 17.8396 9.27406 18.0574L9.62875 19.3896C9.79977 20.0139 10.3696 20.45 11.0175 20.45H12.9825C13.6305 20.45 14.2003 20.0139 14.3713 19.3896L14.7259 18.0574C15.2874 17.8396 15.8134 17.5556 16.2957 17.2131L17.603 17.6283C18.2214 17.8241 18.8913 17.5342 19.2152 16.9739L20.1977 15.274C20.5216 14.7138 20.4213 14.0015 19.9534 13.555L18.9804 12.6248C19.0266 12.2893 19.0507 11.9474 19.0507 11.6C19.0507 11.2527 19.0266 10.9108 18.9804 10.5753L19.9534 9.64501C20.4213 9.19846 20.5216 8.48621 20.1977 7.92597L19.2152 6.22611C18.8913 5.66585 18.2214 5.37591 17.603 5.57173L16.2957 5.98693C15.8134 5.6444 15.2874 5.36041 14.726 5.14258L14.3713 3.81045C14.2003 3.18614 13.6305 2.75 12.9825 2.75H11.0175ZM12 8.35C10.2051 8.35 8.75 9.80508 8.75 11.6C8.75 13.395 10.2051 14.85 12 14.85C13.7949 14.85 15.25 13.395 15.25 11.6C15.25 9.80508 13.7949 8.35 12 8.35Z"
                  fill=""
                />
              </svg>
              Settings
            </DropdownItem>
          </li>
        </ul>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 w-full text-left"
        >
          <svg
            className="fill-gray-500 group-hover:fill-gray-700 dark:group-hover:fill-gray-300"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501L14.3507 9.74501V5.49609C14.3507 5.08188 14.6865 4.74609 15.1007 4.74609L18.5007 4.74609C18.9149 4.74609 19.2507 5.08188 19.2507 5.49609L19.2507 18.497C19.2507 18.9112 18.9149 19.247 18.5007 19.247H15.1007ZM3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484L16.0007 12.7484C16.4149 12.7484 16.7507 12.4127 16.7507 11.9984C16.7507 11.5842 16.4149 11.2484 16.0007 11.2484L5.81528 11.2484L9.15585 7.90554C9.44864 7.61255 9.44847 7.13767 9.15547 6.84488C8.86248 6.55209 8.3876 6.55226 8.09481 6.84525L3.52309 11.4202C3.35673 11.5577 3.25073 11.7657 3.25073 11.9984Z"
              fill=""
            />
          </svg>
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
