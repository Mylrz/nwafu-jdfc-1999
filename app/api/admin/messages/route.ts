import { desc, eq } from "drizzle-orm";
import { getAdminContext } from "../../../../lib/admin";
import { guestbookMessages } from "../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const messages = await context.db.select().from(guestbookMessages).orderBy(desc(guestbookMessages.createdAt)).limit(200);
  return Response.json({ messages });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = (await request.json()) as { id?: number; status?: string };
  if (!payload.id || !["approved", "pending", "rejected"].includes(payload.status ?? "")) {
    return Response.json({ error: "参数无效" }, { status: 400 });
  }
  const updated = await context.db.update(guestbookMessages).set({ status: payload.status! })
    .where(eq(guestbookMessages.id, payload.id)).returning({ id: guestbookMessages.id });
  if (!updated.length) return Response.json({ error: "留言不存在" }, { status: 404 });
  return Response.json({ ok: true });
}
