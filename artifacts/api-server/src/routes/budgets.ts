import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, budgetsTable, receiptsTable } from "@workspace/db";
import {
  CreateBudgetBody,
  UpdateBudgetParams,
  UpdateBudgetBody,
  DeleteBudgetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function getPeriodDates(period: string) {
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

// List budgets with spent amounts
router.get("/budgets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  // Calculate spent for each budget based on receipts
  const budgetsWithSpent = await Promise.all(
    budgets.map(async (budget) => {
      const { start, end } = getPeriodDates(budget.period);
      const receipts = await db.select().from(receiptsTable).where(
        and(
          eq(receiptsTable.userId, userId),
          eq(receiptsTable.category, budget.category),
          gte(receiptsTable.date, start),
          lte(receiptsTable.date, end),
        )
      );
      const spent = receipts.reduce((sum, r) => sum + parseFloat(r.total), 0);
      return {
        ...budget,
        limitAmount: parseFloat(budget.limitAmount),
        spent,
      };
    })
  );

  res.json(budgetsWithSpent);
});

// Create budget
router.post("/budgets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [budget] = await db.insert(budgetsTable).values({
    userId,
    category: parsed.data.category,
    limitAmount: String(parsed.data.limitAmount),
    period: parsed.data.period,
  }).returning();

  res.status(201).json({ ...budget, limitAmount: parseFloat(budget.limitAmount), spent: 0 });
});

// Update budget
router.patch("/budgets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = UpdateBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, any> = {};
  if (parsed.data.category != null) updateData.category = parsed.data.category;
  if (parsed.data.limitAmount != null) updateData.limitAmount = String(parsed.data.limitAmount);
  if (parsed.data.period != null) updateData.period = parsed.data.period;

  const [budget] = await db.update(budgetsTable)
    .set(updateData)
    .where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.userId, userId)))
    .returning();

  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }

  res.json({ ...budget, limitAmount: parseFloat(budget.limitAmount), spent: 0 });
});

// Delete budget
router.delete("/budgets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const params = DeleteBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [budget] = await db.delete(budgetsTable)
    .where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.userId, userId)))
    .returning();

  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
