import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { players } from "../../../../../db/schema";
import { safeStoredContentType, type SupportedUploadType } from "../../../../../lib/file-validation";

export const dynamic = "force-dynamic";

type MediaObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type MediaBucket = { get: (key: string) => Promise<MediaObject | null> };
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const satisfies readonly SupportedUploadType[];

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [player] = await getDb().select({
    photoKey: players.photoKey,
    photoContentType: players.photoContentType,
  }).from(players).where(and(eq(players.id, Number(id)), eq(players.status, "published"))).limit(1);

  if (!player?.photoKey) return Response.json({ error: "暂无球员照片" }, { status: 404 });
  const media = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  const object = await media?.get(player.photoKey);
  if (!object) return Response.json({ error: "照片不存在" }, { status: 404 });
  const contentType = safeStoredContentType(
    [object.httpMetadata?.contentType, player.photoContentType],
    imageTypes,
    "image/jpeg",
  );

  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
