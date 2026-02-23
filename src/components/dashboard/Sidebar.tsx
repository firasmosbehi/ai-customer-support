"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/conversations", label: "Conversations" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/widget", label: "Widget" },
  { href: "/escalations", label: "Escalations" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
] as const;

/**
 * Main dashboard navigation sidebar.
 */
export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="w-full border-r border-slate-200 bg-white p-4 md:w-64">
      <Link href="/dashboard" className="mb-6 block text-lg font-semibold text-slate-900">
        SupportPilot
      </Link>

      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
