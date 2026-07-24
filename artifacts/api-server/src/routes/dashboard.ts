import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, receiptsTable, budgetsTable } from "@workspace/db";
import { GetDashboardSummaryQueryParams, GetSpendingByCategoryQueryParams, GetSpendingOverTimeQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function getPeriodDates(period = "month") {
  const now = new Date();
  let start: Date;
  if (period === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  } else if (period === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start: start.toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
}

// Dashboard summary
router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "month") : "month";
  const { start, end } = getPeriodDates(period);

  const receipts = await db.select().from(receiptsTable).where(
    and(eq(receiptsTable.userId, userId), gte(receiptsTable.date, start), lte(receiptsTable.date, end))
  );

  const totalSpending = receipts.reduce((s, r) => s + parseFloat(r.total), 0);
  const receiptCount = receipts.length;
  const largestExpense = receipts.reduce((max, r) => Math.max(max, parseFloat(r.total)), 0);
  const averageReceipt = receiptCount > 0 ? totalSpending / receiptCount : 0;

  // Top category
  const categoryTotals: Record<string, number> = {};
  for (const r of receipts) {
    categoryTotals[r.category] = (categoryTotals[r.category] ?? 0) + parseFloat(r.total);
  }
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Other";

  // Most visited store
  const storeCounts: Record<string, number> = {};
  for (const r of receipts) {
    storeCounts[r.storeName] = (storeCounts[r.storeName] ?? 0) + 1;
  }
  const mostVisitedStore = Object.entries(storeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  // Budget remaining
  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));
  const totalBudget = budgets.reduce((s, b) => s + parseFloat(b.limitAmount), 0);
  const budgetRemaining = Math.max(totalBudget - totalSpending, 0);
  const savings = budgetRemaining;

  res.json({
    totalSpending,
    receiptCount,
    largestExpense,
    averageReceipt,
    topCategory,
    budgetRemaining,
    savings,
    mostVisitedStore,
  });
});

// Spending by category
router.get("/dashboard/spending-by-category", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = GetSpendingByCategoryQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "month") : "month";
  const { start, end } = getPeriodDates(period);

  const receipts = await db.select().from(receiptsTable).where(
    and(eq(receiptsTable.userId, userId), gte(receiptsTable.date, start), lte(receiptsTable.date, end))
  );

  const categoryData: Record<string, { amount: number; count: number }> = {};
  for (const r of receipts) {
    if (!categoryData[r.category]) categoryData[r.category] = { amount: 0, count: 0 };
    categoryData[r.category].amount += parseFloat(r.total);
    categoryData[r.category].count += 1;
  }

  const total = Object.values(categoryData).reduce((s, c) => s + c.amount, 0);

  const result = Object.entries(categoryData)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  res.json(result);
});

// Spending over time
router.get("/dashboard/spending-over-time", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = GetSpendingOverTimeQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "month") : "month";
  const { start, end } = getPeriodDates(period);

  const receipts = await db.select().from(receiptsTable)
    .where(and(eq(receiptsTable.userId, userId), gte(receiptsTable.date, start), lte(receiptsTable.date, end)))
    .orderBy(receiptsTable.date);

  // Group by day/week/month label
  const grouped: Record<string, number> = {};
  for (const r of receipts) {
    let label: string;
    if (period === "week") {
      label = r.date; // daily
    } else if (period === "year") {
      label = r.date.slice(0, 7); // YYYY-MM
    } else {
      label = r.date; // daily for month view
    }
    grouped[label] = (grouped[label] ?? 0) + parseFloat(r.total);
  }

  const result = Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, amount]) => ({ label, amount }));

  res.json(result);
});

export default router;
