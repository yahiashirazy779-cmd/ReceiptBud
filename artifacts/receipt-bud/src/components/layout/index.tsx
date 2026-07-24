import React from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Camera,
  Receipt,
  PieChart,
  Target,
  MessageSquare,
  Trophy,
  Settings,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BudMascot } from "@/components/ui/bud-mascot";
import { useUser } from "@clerk/react";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: Receipt },
  { href: "/scan", label: "Scan", icon: Camera, primary: true },
  { href: "/subscriptions", label: "Subs", icon: RefreshCw },
  { href: "/budgets", label: "Budgets", icon: Target },
];

const SIDEBAR_EXTRA_ITEMS = [
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/chat", label: "Chat with Bud", icon: MessageSquare },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
        <div className="p-6 flex items-center gap-3">
          <BudMascot size={40} floating={false} emotion="happy" />
          <span className="font-bold text-xl bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            ReceiptBud
          </span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 mt-2 px-2">
            Main Menu
          </div>
          {NAV_ITEMS.map(item => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                )}>
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive && "fill-emerald-100 dark:fill-emerald-900/50")} />
                  {item.label === "Subs" ? "Subscriptions" : item.label}
                </div>
              </Link>
            );
          })}

          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 mt-8 px-2">
            More
          </div>
          {SIDEBAR_EXTRA_ITEMS.map(item => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                )}>
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive && "fill-emerald-100 dark:fill-emerald-900/50")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Link href="/settings" className="block">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 shrink-0 bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                  {(user?.fullName || user?.primaryEmailAddress?.emailAddress || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {user?.fullName || "User"}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content Area — pb accounts for bottom nav + iPhone safe area */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto overscroll-contain pb-nav md:pb-0">
        {children}
      </main>

      {/* ── PRIORITY 8: Mobile Bottom Nav with Safe Area ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-end justify-around z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around w-full h-[68px]">
          {NAV_ITEMS.map(item => {
            const isActive = location === item.href;

            if (item.primary) {
              return (
                <div key={item.href} className="flex-1 flex items-center justify-center -translate-y-4">
                  <Link href={item.href} className="block">
                    <div className={cn(
                      "flex items-center justify-center w-[56px] h-[56px] rounded-[18px] shadow-lg shadow-emerald-500/30 transition-all active:scale-90",
                      isActive ? "bg-emerald-700" : "bg-emerald-500"
                    )}>
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                  </Link>
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href} className="flex-1 block">
                <div className={cn(
                  "flex flex-col items-center justify-center h-[68px] gap-1 transition-all active:scale-90 px-1",
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                )}>
                  <item.icon className={cn("w-[22px] h-[22px] shrink-0", isActive && "fill-emerald-100 dark:fill-emerald-900/50")} />
                  <span className={cn(
                    "text-[10px] font-semibold leading-none truncate max-w-full px-1",
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                  )}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
