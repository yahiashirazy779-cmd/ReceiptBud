import { pgTable, text, serial, timestamp, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const receiptItemSchema = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
});
export type ReceiptItem = z.infer<typeof receiptItemSchema>;

export const receiptsTable = pgTable("receipts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  storeName: text("store_name").notNull(),
  date: text("date").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }),
  discount: numeric("discount", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method"),
  category: text("category").notNull().default("Other"),
  notes: text("notes"),
  imageBase64: text("image_base64"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  items: jsonb("items").notNull().$type<ReceiptItem[]>().default([]),
  currency: text("currency").notNull().default("USD"),
  aiInsight: text("ai_insight"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReceiptSchema = createInsertSchema(receiptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receiptsTable.$inferSelect;
