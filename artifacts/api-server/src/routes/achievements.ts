import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, receiptsTable, budgetsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const ACHIEVEMENT_DEFINITIONS = [
  { id: "first_receipt", title: "First Receipt", description: "Scan your first receipt", icon: "receipt", xp: 100, level: 1 },
  { id: "ten_receipts", title: "Receipt Collector", description: "Scan 10 receipts", icon: "layers", xp: 250, level: 2 },
  { id: "fifty_receipts", title: "Receipt Pro", description: "Scan 50 receipts", icon: "trophy", xp: 500, level: 3 },
  { id: "hundred_receipts", title: "Receipt Master", description: "Scan 100 receipts", icon: "star", xp: 1000, level: 4 },
  { id: "first_budget", title: "Budget Maker", description: "Create your first budget", icon: "piggy-bank", xp: 150, level: 1 },
  { id: "under_budget", title: "Budget Hero", description: "Stay under budget for a month", icon: "shield-check", xp: 300, level: 2 },
  { id: "favorite_five", title: "Favorites Fan", description: "Mark 5 receipts as favorite", icon: "heart", xp: 100, level: 1 },
  { id: "all_categories", title: "Category Explorer", description: "Spend in 5 different categories", icon: "grid", xp: 200, level: 2 },
  { id: "chat_buddy", title: "Bud's Friend", description: "Send your first message to Bud", icon: "message-circle", xp: 100, level: 1 },
  { id: "streak_7", title: "7-Day Streak", description: "Use the app 7 days in a row", icon: "zap", xp: 350, level: 2 },
  { id: "big_saver", title: "Big Saver", description: "Have $100 budget remaining", icon: "coins", xp: 400, level: 3 },
];

router.get("/achievements", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;

  const receipts = await db.select().from(receiptsTable).where(eq(receiptsTable.userId, userId));
  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  const receiptCount = receipts.length;
  const favoriteCount = receipts.filter(r => r.isFavorite).length;
  const categories = new Set(receipts.map(r => r.category));

  const unlockedSet: Record<string, Date> = {};
  const now = new Date();

  if (receiptCount >= 1) unlockedSet["first_receipt"] = now;
  if (receiptCount >= 10) unlockedSet["ten_receipts"] = now;
  if (receiptCount >= 50) unlockedSet["fifty_receipts"] = now;
  if (receiptCount >= 100) unlockedSet["hundred_receipts"] = now;
  if (budgets.length >= 1) unlockedSet["first_budget"] = now;
  if (favoriteCount >= 5) unlockedSet["favorite_five"] = now;
  if (categories.size >= 5) unlockedSet["all_categories"] = now;

  const result = ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    unlocked: !!unlockedSet[def.id],
    unlockedAt: unlockedSet[def.id] ? unlockedSet[def.id].toISOString() : null,
  }));

  res.json(result);
});

export default router;
