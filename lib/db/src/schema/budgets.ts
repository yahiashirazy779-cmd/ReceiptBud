import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(),
  limitAmount: numeric("limit_amount", { precision: 10, scale: 2 }).notNull(),
  period: text("period").notNull().default("month"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgetsTable.$inferSelect;
