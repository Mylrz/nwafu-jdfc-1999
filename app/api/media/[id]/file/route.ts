import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { mediaAssets } from "../../../../../db/schema";
import { PUBLIC_IMAGE_TYPES } from "../../../../../lib/archive";

export const dynamic = "force-dynamic";

const publicExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "媒体编号无效" }, { status: 400 });

  let media: typeof mediaAssets.$inferSelect | undefined;
  try {
    [media] = await getDb().select().from(mediaAssets)
      .where(and(
        eq(mediaAssets.id, id),
        eq(mediaAssets.status, "published"),
        eq(mediaAssets.rightsStatus, "cleared"),
      )).limit(1);
  } catch {
    return Response.json({ error: "图片不存在" }, { status: 404 });
  }
  if (!media || !PUBLIC_IMAGE_TYPES.has(media.contentType)) {
    return Response.json({ error: "图片不存在" }, { status: 404 });
  }

  const object = await env.MEDIA?.get(media.fileKey);
  if (!object) return Response.json({ error: "图片不存在" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "content-type": media.contentType,
      "content-length": String(media.fileSize),
      "content-disposition": `inline; filename="jdfc-media-${id}.${publicExtensions[media.contentType] ?? "image"}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
