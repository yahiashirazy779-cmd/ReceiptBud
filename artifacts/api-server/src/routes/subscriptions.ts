import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatSub(s: typeof subscriptionsTable.$inferSelect) {
  return { ...s, price: parseFloat(s.price) };
}

function validateBody(body: any): { error?: string; data?: any } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  if (body.name !== undefined && typeof body.name !== "string") return { error: "name must be a string" };
  if (body.price !== undefined && (typeof body.price !== "number" || body.price <= 0)) return { error: "price must be a positive number" };
  if (body.billingCycle !== undefined && !["monthly", "yearly"].includes(body.billingCycle)) return { error: "billingCycle must be monthly or yearly" };
  if (body.status !== undefined && !["active", "paused", "cancelled"].includes(body.status)) return { error: "status must be active, paused, or cancelled" };
  return { data: body };
}

// List subscriptions
router.get("/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  res.json(rows.map(formatSub));
});

// Upcoming renewals (active, within N days)
router.get("/subscriptions/upcoming", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const days = Number(req.query.days ?? 7);
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(today.getDate() + days);
  const todayStr = today.toISOString().split("T")[0];
  const limitStr = limit.toISOString().split("T")[0];

  const rows = await db.select().from(subscriptionsTable).where(
    and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active"))
  );
  const upcoming = rows
    .filter(s => s.renewalDate >= todayStr && s.renewalDate <= limitStr)
    .map(formatSub)
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  res.json(upcoming);
});

// Create subscription
router.post("/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const { error, data } = validateBody(req.body);
  if (error) { res.status(400).json({ error }); return; }
  if (!data.name || !data.price || !data.renewalDate) {
    res.status(400).json({ error: "name, price, and renewalDate are required" });
    return;
  }
  const [row] = await db.insert(subscriptionsTable).values({
    userId,
    name: data.name,
    icon: data.icon ?? null,
    billingCycle: data.billingCycle ?? "monthly",
    price: String(data.price),
    currency: data.currency ?? "USD",
    renewalDate: data.renewalDate,
    category: data.category ?? "Subscriptions",
    notes: data.notes ?? null,
    status: data.status ?? "active",
  }).returning();
  res.status(201).json(formatSub(row));
});

// Update subscription
router.patch("/subscriptions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { error, data } = validateBody(req.body);
  if (error) { res.status(400).json({ error }); return; }

  const updateData: Record<string, any> = {};
  if (data.name != null) updateData.name = data.name;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.billingCycle != null) updateData.billingCycle = data.billingCycle;
  if (data.price != null) updateData.price = String(data.price);
  if (data.currency != null) updateData.currency = data.currency;
  if (data.renewalDate != null) updateData.renewalDate = data.renewalDate;
  if (data.category != null) updateData.category = data.category;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status != null) updateData.status = data.status;

  const [row] = await db.update(subscriptionsTable)
    .set(updateData)
    .where(and(eq(subscriptionsTable.id, id), eq(subscriptionsTable.userId, userId)))
    .returning();

  if (!row) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.json(formatSub(row));
});

// Delete subscription
router.delete("/subscriptions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.delete(subscriptionsTable)
    .where(and(eq(subscriptionsTable.id, id), eq(subscriptionsTable.userId, userId)))
    .returning();

  if (!row) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.sendStatus(204);
});

export default router;
