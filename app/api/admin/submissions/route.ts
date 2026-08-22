import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { submissions } from "../../../../db/schema";
import { getAdminContext } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const rows = await context.db.select().from(submissions).orderBy(desc(submissions.createdAt)).limit(200);
  return Response.json({ submissions: rows });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = (await request.json()) as { id?: number; status?: string };
  if (!payload.id || !["pending", "rejected", "archived"].includes(payload.status ?? "")) {
    return Response.json({ error: "参数无效" }, { status: 400 });
  }

  const updated = await env.DB.prepare(`
    UPDATE submissions SET status = ?
    WHERE id = ?
      AND NOT EXISTS (
        SELECT 1 FROM media_assets WHERE submission_id = submissions.id
      )
    RETURNING id
  `).bind(payload.status, payload.id).first<{ id: number }>();

  if (!updated) {
    const [existing] = await context.db.select({ id: submissions.id }).from(submissions)
      .where(eq(submissions.id, payload.id)).limit(1);
    if (!existing) return Response.json({ error: "资料投稿不存在" }, { status: 404 });
    return Response.json({ error: "这份投稿已建立媒体档案，请在“档案发布”中管理公开、下线或撤销授权" }, { status: 409 });
  }
  return Response.json({ ok: true });
}
