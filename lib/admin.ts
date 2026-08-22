import { eq } from "drizzle-orm";
import { getChatGPTUser, requireChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { admins } from "../db/schema";

export async function bootstrapAdmin() {
  const user = await requireChatGPTUser("/admin");
  const db = getDb();

  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, user.userId))
    .limit(1);

  return { user, isAdmin: Boolean(admin) };
}

export async function getAdminContext() {
  const user = await getChatGPTUser();
  if (!user) return null;

  const db = getDb();
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, user.userId))
    .limit(1);

  return admin ? { user, db } : null;
}
