import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { submissions } from "../../../../../../db/schema";
import { getAdminContext } from "../../../../../../lib/admin";
import { safeStoredContentType, supportedUploadTypes } from "../../../../../../lib/file-validation";

export const dynamic = "force-dynamic";

type MediaObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type MediaBucket = { get: (key: string) => Promise<MediaObject | null> };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin) return Response.json({ error: "无管理权限" }, { status: 403 });
  const { id } = await context.params;
  const [submission] = await admin.db.select().from(submissions).where(eq(submissions.id, Number(id))).limit(1);
  if (!submission) return Response.json({ error: "资料不存在" }, { status: 404 });

  const media = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  const object = await media?.get(submission.fileKey);
  if (!object) return Response.json({ error: "文件不存在" }, { status: 404 });
  const contentType = safeStoredContentType(
    [object.httpMetadata?.contentType, submission.contentType],
    supportedUploadTypes,
  );
  const disposition = contentType === "application/pdf" || contentType === "application/octet-stream"
    ? "attachment"
    : "inline";

  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(submission.fileName)}`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
