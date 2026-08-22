import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { mediaAssets } from "../../../../../../db/schema";
import { ARCHIVE_IMAGE_TYPES } from "../../../../../../lib/archive";
import { getAdminContext } from "../../../../../../lib/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin) return Response.json({ error: "无管理权限" }, { status: 403 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "媒体编号无效" }, { status: 400 });

  const [media] = await admin.db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!media) return Response.json({ error: "媒体档案不存在" }, { status: 404 });
  if (!ARCHIVE_IMAGE_TYPES.has(media.contentType)) return Response.json({ error: "文件不是可预览图片" }, { status: 415 });

  const object = await env.MEDIA?.get(media.fileKey);
  if (!object) return Response.json({ error: "图片文件不存在" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "content-type": media.contentType,
      "content-length": String(media.fileSize),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(media.fileName)}`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
