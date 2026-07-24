import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { UpdateMyProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

// Get or create user profile (JIT provisioning)
async function getOrCreateProfile(userId: string, clerkName?: string, clerkEmail?: string) {
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, userId));
  if (existing) return existing;

  const [created] = await db.insert(userProfilesTable).values({
    id: userId,
    name: clerkName ?? "",
    email: clerkEmail ?? "",
  }).returning();
  return created;
}

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const profile = await getOrCreateProfile(userId);
  res.json({ ...profile, totalXp: profile.totalXp ?? 0, level: profile.level ?? 1 });
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, any> = {};
  if (parsed.data.name != null) updateData.name = parsed.data.name;
  if (parsed.data.currency != null) updateData.currency = parsed.data.currency;
  if (parsed.data.language != null) updateData.language = parsed.data.language;
  if (parsed.data.theme != null) updateData.theme = parsed.data.theme;
  if (parsed.data.notificationsEnabled != null) updateData.notificationsEnabled = parsed.data.notificationsEnabled;

  // Ensure profile exists first
  await getOrCreateProfile(userId);

  const [profile] = await db.update(userProfilesTable)
    .set(updateData)
    .where(eq(userProfilesTable.id, userId))
    .returning();

  res.json(profile);
});

export default router;
