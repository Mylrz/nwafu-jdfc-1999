import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { playerProfileSubmissions } from "../../../../../../db/schema";
import { getAdminContext } from "../../../../../../lib/admin";
import { safeStoredContentType, type SupportedUploadType } from "../../../../../../lib/file-validation";

export const dynamic = "force-dynamic";

type MediaObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type MediaBucket = { get: (key: string) => Promise<MediaObject | null> };
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const satisfies readonly SupportedUploadType[];

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin) return Response.json({ error: "无管理权限" }, { status: 403 });
  const { id } = await context.params;
  const [submission] = await admin.db.select().from(playerProfileSubmissions).where(eq(playerProfileSubmissions.id, Number(id))).limit(1);
  if (!submission?.photoKey) return Response.json({ error: "没有提交照片" }, { status: 404 });

  const media = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  const object = await media?.get(submission.photoKey);
  if (!object) return Response.json({ error: "照片不存在" }, { status: 404 });
  const contentType = safeStoredContentType(
    [object.httpMetadata?.contentType, submission.photoContentType],
    imageTypes,
    "image/jpeg",
  );

  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(submission.photoFileName || "player-photo")}`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
