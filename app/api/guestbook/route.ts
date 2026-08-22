import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { guestbookMessages } from "../../../db/schema";
import { enforcePublicFormRateLimit, rejectOversizedContentLength } from "../../../lib/public-form-security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const messages = await getDb()
      .select({
        id: guestbookMessages.id,
        name: guestbookMessages.name,
        years: guestbookMessages.years,
        role: guestbookMessages.role,
        content: guestbookMessages.content,
        createdAt: guestbookMessages.createdAt,
      })
      .from(guestbookMessages)
      .where(eq(guestbookMessages.status, "approved"))
      .orderBy(desc(guestbookMessages.createdAt), desc(guestbookMessages.id))
      .limit(60);

    return Response.json({ messages }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: "留言墙暂时无法读取，请稍后重试。", code: "GUESTBOOK_UNAVAILABLE" },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
    );
  }
}

export async function POST(request: Request) {
  const oversized = rejectOversizedContentLength(
    request,
    16 * 1024,
    "留言内容过大，请精简后重试。",
  );
  if (oversized) return oversized;
  let payload: {
    name?: string;
    years?: string;
    role?: string;
    content?: string;
    website?: string;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "留言格式无效，请刷新后重试。" }, { status: 400 });
  }

  if (payload.website) return Response.json({ ok: true }, { status: 201 });

  const name = payload.name?.trim().slice(0, 30) ?? "";
  const years = payload.years?.trim().slice(0, 30) ?? "";
  const role = payload.role?.trim().slice(0, 30) || "老队员";
  const content = payload.content?.trim().slice(0, 500) ?? "";
  if (!name || content.length < 4) {
    return Response.json({ error: "请填写姓名和至少 4 个字的留言。" }, { status: 400 });
  }
  const rateLimited = await enforcePublicFormRateLimit(request, "guestbook");
  if (rateLimited) return rateLimited;

  const user = await getChatGPTUser();
  const [message] = await getDb()
    .insert(guestbookMessages)
    .values({ name, years, role, content, authorUserId: user?.userId ?? null })
    .returning({ id: guestbookMessages.id });

  return Response.json({ message, notice: "留言已提交，审核后会展示在这里。" }, { status: 201 });
}
