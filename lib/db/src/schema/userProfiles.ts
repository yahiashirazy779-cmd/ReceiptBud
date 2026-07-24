import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  id: text("id").primaryKey(), // Clerk user ID
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  currency: text("currency").notNull().default("USD"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("light"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
