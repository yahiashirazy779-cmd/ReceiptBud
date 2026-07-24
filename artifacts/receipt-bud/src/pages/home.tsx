import React, { useMemo } from "react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/currency";
import { BudMascot } from "@/components/ui/bud-mascot";
import {
  Camera,
  Receipt,
  Target,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Bell,
  Settings,
  Lightbulb,
  Zap,
  CalendarDays,
} from "lucide-react";
import { useGetDashboardSummary, useGetMyProfile, useListReceipts } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, parseISO, startOfWeek, isAfter } from "date-fns";
import { cn } from "@/lib/utils";

type Subscription = {
  id: number; name: string; icon: string | null; price: number;
  currency: string; renewalDate: string; billingCycle: string; status: string;
};

const DAILY_TIPS = [
  "Track every small purchase — they add up faster than you think!",
  "Review your subscriptions monthly and cancel ones you rarely use.",
  "The 24-hour rule: wait a day before any unplanned purchase over $50.",
  "Cooking at home 3 extra times a week can save $200+ per month.",
  "Set a weekly budget check-in every Sunday to stay on track.",
  "Round up purchases to the nearest dollar and save the difference.",
  "Your future self will thank you for every dollar saved today.",
];

const MOTIVATIONAL = [
  "Ready to track today's expenses?",
  "Every tracked receipt is a step toward financial clarity.",
  "Small habits, big savings. Keep going!",
  "You're building great money habits. 💪",
  "Stay consistent — your budget will thank you!",
];

export default function Home() {
  const { user: clerkUser } = useUser();
  const { data: profile } = useGetMyProfile();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ period: "month" });
  const { data: recentReceipts, isLoading: loadingReceipts } = useListReceipts({ sortBy: "date", sortOrder: "desc" });
  const { data: allSubsRaw } = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () =>
      fetch("/api/subscriptions", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(d => (Array.isArray(d) ? d : [])),
  });
  const allSubs: Subscription[] = Array.isArray(allSubsRaw) ? allSubsRaw : [];

  const firstName = profile?.name?.split(" ")[0] || clerkUser?.firstName || "there";
  const avatarUrl = clerkUser?.imageUrl;

  const upcomingSubs = useMemo(() =>
    allSubs
      .filter(s => s.status === "active"
        && differenceInDays(parseISO(s.renewalDate), new Date()) <= 7
        && differenceInDays(parseISO(s.renewalDate), new Date()) >= 0)
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate))
      .slice(0, 3),
    [allSubs]
  );

  const dayTip = DAILY_TIPS[new Date().getDay()];
  const motivational = MOTIVATIONAL[new Date().getDay() % MOTIVATIONAL.length];

  // Spending derived stats
  const profileCurrency = profile?.currency || "USD";
  const totalSpent = summary?.totalSpending ?? 0;
  const budgetRemaining = summary?.budgetRemaining ?? 0;
  const receiptCount = summary?.receiptCount ?? 0;
  const budgetTotal = totalSpent + Math.max(budgetRemaining, 0);
  const budgetPct = budgetTotal > 0 ? Math.min((totalSpent / budgetTotal) * 100, 100) : 0;
  const hasBudget = budgetTotal > 0;

  const largestExpense = useMemo(() => {
    if (!recentReceipts || recentReceipts.length === 0) return 0;
    return Math.max(...recentReceipts.map(r => r.total));
  }, [recentReceipts]);

  const weeklyTotal = useMemo(() => {
    if (!recentReceipts) return 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return recentReceipts
      .filter(r => isAfter(new Date(r.date), weekStart))
      .reduce((sum, r) => sum + r.total, 0);
  }, [recentReceipts]);

  const weeklyCount = useMemo(() => {
    if (!recentReceipts) return 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return recentReceipts.filter(r => isAfter(new Date(r.date), weekStart)).length;
  }, [recentReceipts]);

  const avgPerReceipt = receiptCount > 0 ? totalSpent / receiptCount : 0;
  const isOverBudget = hasBudget && budgetRemaining < 0;
  const budgetColor = budgetPct >= 85 ? "bg-red-500" : budgetPct >= 60 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 pt-6 pb-8 md:px-8 md:pt-8">

      {/* ── PRIORITY 4: Premium Header ── */}
      <header className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
            Hello, {firstName}! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            {motivational}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Link href="/subscriptions">
            <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
              <Bell className="w-5 h-5" />
              {upcomingSubs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-950" />
              )}
            </button>
          </Link>
          <Link href="/settings">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <Settings className="w-5 h-5" />
            </div>
          </Link>
          <Link href="/settings">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-9 h-9 rounded-xl object-cover border-2 border-white dark:border-slate-800 shadow-sm cursor-pointer" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 font-bold text-sm cursor-pointer">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ── PRIORITY 5: Redesigned Spending Card ── */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />

        {/* Top row: amount + scan button */}
        <div className="relative z-10 flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Spent this month
            </p>
            {loadingSummary ? (
              <Skeleton className="h-10 w-36 mb-2" />
            ) : (
              <div className="flex items-end gap-2 flex-wrap">
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  {formatCurrency(totalSpent, profileCurrency)}
                </h2>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold mb-0.5",
                  isOverBudget
                    ? "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                    : "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                )}>
                  {isOverBudget ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {isOverBudget ? "Over budget" : "Looking good"}
                </span>
              </div>
            )}
          </div>

          <Link href="/scan" className="shrink-0">
            <button className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all whitespace-nowrap">
              <Camera className="w-5 h-5" />
              <span className="font-semibold text-sm hidden sm:inline">Scan Receipt</span>
            </button>
          </Link>
        </div>

        {/* Budget progress bar */}
        {hasBudget && !loadingSummary && (
          <div className="relative z-10 mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Budget used: <span className={cn("font-bold", budgetPct >= 85 ? "text-red-500" : budgetPct >= 60 ? "text-amber-500" : "text-emerald-600")}>{budgetPct.toFixed(0)}%</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {isOverBudget
                  ? <span className="text-red-500 font-semibold">{formatCurrency(Math.abs(budgetRemaining), profileCurrency)} over</span>
                  : <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(budgetRemaining, profileCurrency)} left</span>
                }
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", budgetColor)}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="relative z-10 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="text-center">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide mb-0.5">Receipts</p>
            {loadingSummary ? <Skeleton className="h-5 w-8 mx-auto" /> : (
              <p className="text-base font-bold text-slate-900 dark:text-white">{receiptCount}</p>
            )}
          </div>
          <div className="text-center border-x border-slate-100 dark:border-slate-800/60">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide mb-0.5">Avg / receipt</p>
            {loadingSummary ? <Skeleton className="h-5 w-14 mx-auto" /> : (
              <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(avgPerReceipt, profileCurrency)}</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide mb-0.5">Largest</p>
            {loadingSummary ? <Skeleton className="h-5 w-14 mx-auto" /> : (
              <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(largestExpense, profileCurrency)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── PRIORITY 7: Quick Actions (uniform height, 3 cols mobile) ── */}
      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {[
          { href: "/history", color: "bg-blue-500/10 text-blue-600", icon: Receipt, label: "History", sub: "All receipts" },
          { href: "/budgets", color: "bg-orange-500/10 text-orange-600", icon: Target, label: "Budgets", sub: "Set limits" },
          { href: "/analytics", color: "bg-purple-500/10 text-purple-600", icon: TrendingUp, label: "Analytics", sub: "Trends" },
          { href: "/chat", color: "bg-emerald-500/10 text-emerald-600", icon: MessageSquare, label: "Ask Bud", sub: "AI insights" },
          { href: "/subscriptions", color: "bg-teal-500/10 text-teal-600", icon: RefreshCw, label: "Subs", sub: "Recurring" },
        ].map(item => (
          <Link key={item.href} href={item.href} className="block">
            <div className="glass-panel p-3 sm:p-4 rounded-2xl hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group flex flex-col items-center text-center h-full min-h-[88px] justify-center gap-2">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", item.color)}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-tight">{item.label}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-0.5 hidden sm:block">{item.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── PRIORITY 9: Dashboard Widgets ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Bud's Daily Tip */}
        <div className="glass-panel rounded-2xl p-4 flex items-start gap-3">
          <div className="shrink-0">
            <BudMascot size={40} floating={false} emotion="happy" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5" /> Bud's Daily Tip
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{dayTip}</p>
          </div>
        </div>

        {/* Weekly Snapshot */}
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> This Week
          </p>
          {loadingReceipts ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ) : (
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(weeklyTotal, profileCurrency)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {weeklyCount} {weeklyCount === 1 ? "receipt" : "receipts"} this week
              </p>
              {weeklyCount > 0 && (
                <Link href="/history">
                  <button className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    View details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Last Receipt Quick View */}
      {recentReceipts && recentReceipts.length > 0 && !loadingReceipts && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Last Receipt</h3>
          <Link href={`/receipt/${recentReceipts[0].id}`} className="block">
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-4 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-500 shrink-0">
                {recentReceipts[0].storeName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{recentReceipts[0].storeName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {recentReceipts[0].category} · {format(new Date(recentReceipts[0].date), "MMM d, yyyy")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(recentReceipts[0].total, recentReceipts[0].currency || profileCurrency)}</p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 justify-end">View <ArrowRight className="w-3 h-3" /></p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Upcoming Payments ── */}
      {upcomingSubs.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-500" /> Upcoming Payments
            </h3>
            <Link href="/subscriptions">
              <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                See all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">
            {upcomingSubs.map(sub => {
              const days = differenceInDays(parseISO(sub.renewalDate), new Date());
              return (
                <Link key={sub.id} href="/subscriptions" className="block">
                  <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-base shrink-0">
                        {sub.icon || sub.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{sub.name}</p>
                        <p className="text-xs text-slate-500">{sub.billingCycle === "yearly" ? "Yearly" : "Monthly"} · {format(parseISO(sub.renewalDate), "MMM d")}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">{sub.currency} {sub.price.toFixed(2)}</p>
                      <p className={cn("text-xs font-medium", days <= 1 ? "text-red-500" : "text-amber-500")}>
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Receipts ── */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recent Receipts</h3>
        <Link href="/history">
          <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {loadingReceipts ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-14 shrink-0" />
              </div>
            ))}
          </div>
        ) : recentReceipts && recentReceipts.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {recentReceipts.slice(0, 4).map(receipt => (
              <Link key={receipt.id} href={`/receipt/${receipt.id}`} className="block">
                <div className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base font-bold text-slate-500 shrink-0">
                    {receipt.storeName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{receipt.storeName}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md whitespace-nowrap">{receipt.category}</span>
                      <span className="whitespace-nowrap">{format(new Date(receipt.date), "MMM d")}</span>
                    </div>
                  </div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white shrink-0 ml-2">
                    {formatCurrency(receipt.total, receipt.currency || profileCurrency)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Receipt className="w-8 h-8 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white">No receipts yet</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Scan your first receipt to get started</p>
            <Link href="/scan">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">
                <Camera className="w-4 h-4 mr-2" /> Scan Now
              </Button>
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
