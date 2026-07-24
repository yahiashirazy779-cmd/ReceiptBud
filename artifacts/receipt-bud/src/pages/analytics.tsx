import { useGetDashboardSummary, useGetSpendingByCategory, useGetMyProfile } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowDown, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export default function Analytics() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ period: 'month' });
  const { data: categories, isLoading: loadingCategories } = useGetSpendingByCategory({ period: 'month' });
  const { data: profile } = useGetMyProfile();
  const profileCurrency = profile?.currency || "USD";

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analytics</h1>
        <p className="text-slate-500">Deep dive into your spending habits.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-6 rounded-3xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-4">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Total Spent</p>
          {loadingSummary ? <Skeleton className="h-8 w-24" /> : (
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary?.totalSpending ?? 0, profileCurrency)}</h3>
          )}
        </div>
        
        <div className="glass-card p-6 rounded-3xl">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 mb-4">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Average Receipt</p>
          {loadingSummary ? <Skeleton className="h-8 w-24" /> : (
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary?.averageReceipt ?? 0, profileCurrency)}</h3>
          )}
        </div>

        <div className="glass-card p-6 rounded-3xl">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 mb-4">
            <ArrowDown className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Largest Expense</p>
          {loadingSummary ? <Skeleton className="h-8 w-24" /> : (
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary?.largestExpense ?? 0, profileCurrency)}</h3>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Breakdown */}
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Spending by Category</h3>
          <div className="h-72 w-full">
            {loadingCategories ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="w-48 h-48 rounded-full" />
              </div>
            ) : categories && categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {categories.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => formatCurrency(value, profileCurrency)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Top Categories List */}
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Top Categories</h3>
          <div className="space-y-4">
            {loadingCategories ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-12 rounded-xl" />)
            ) : categories && categories.length > 0 ? (
              categories.map((cat: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{cat.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-white">{formatCurrency(cat.amount, profileCurrency)}</div>
                    <div className="text-xs text-slate-500">{cat.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 py-8 text-center">No categories tracked yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
