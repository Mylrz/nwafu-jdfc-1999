import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { submissions } from "../../../db/schema";
import { type SupportedUploadType, validateUploadFile } from "../../../lib/file-validation";
import { enforcePublicFormRateLimit, rejectOversizedContentLength } from "../../../lib/public-form-security";

export const dynamic = "force-dynamic";

type MediaBucket = {
  put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) => Promise<unknown>;
  delete?: (key: string) => Promise<unknown>;
};

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] as const satisfies readonly SupportedUploadType[];
const maxFileSize = 15 * 1024 * 1024;
const maxRequestSize = maxFileSize + 512 * 1024;

export async function POST(request: Request) {
  const oversized = rejectOversizedContentLength(
    request,
    maxRequestSize,
    "提交内容过大，文件需小于 15MB。",
  );
  if (oversized) return oversized;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "投稿格式无效，请刷新后重试。" }, { status: 400 });
  }
  if (String(form.get("website") ?? "")) return Response.json({ ok: true }, { status: 201 });

  const submitterName = String(form.get("submitterName") ?? "").trim().slice(0, 30);
  const contact = String(form.get("contact") ?? "").trim().slice(0, 80);
  const title = String(form.get("title") ?? "").trim().slice(0, 80);
  const season = String(form.get("season") ?? "").trim().slice(0, 20);
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  const consent = String(form.get("consent") ?? "") === "on";
  const file = form.get("file");

  if (!submitterName || !title || !(file instanceof File) || !consent) {
    return Response.json({ error: "请填写姓名、资料标题、选择文件并确认公开展示授权。" }, { status: 400 });
  }
  if (file.size > maxFileSize) {
    return Response.json({ error: "仅支持 JPG、PNG、WebP、HEIC 或 PDF，文件需小于 15MB。" }, { status: 413 });
  }
  const rateLimited = await enforcePublicFormRateLimit(request, "submissions");
  if (rateLimited) return rateLimited;
  const validatedFile = await validateUploadFile(file, allowedTypes).catch(() => null);
  if (!validatedFile?.ok) {
    return Response.json({ error: "文件内容与文件类型不一致，请重新选择 JPG、PNG、WebP、HEIC 或 PDF 文件。" }, { status: 400 });
  }

  const media = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  if (!media) return Response.json({ error: "文件存储暂不可用。" }, { status: 503 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90) || "archive-file";
  const fileKey = `submissions/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  try {
    await media.put(fileKey, validatedFile.bytes, {
      httpMetadata: { contentType: validatedFile.contentType },
      customMetadata: { submitterName, title, season },
    });

    const user = await getChatGPTUser();
    const [submission] = await getDb()
      .insert(submissions)
      .values({
        submitterName,
        contact,
        title,
        season,
        note,
        fileKey,
        fileName: file.name.slice(0, 120),
        contentType: validatedFile.contentType,
        fileSize: file.size,
        authorUserId: user?.userId ?? null,
        consentVersion: "archive-contribution-2026-08-15",
        consentedAt: new Date().toISOString(),
      })
      .returning({ id: submissions.id });

    return Response.json({ submission, notice: "资料已收到，审核整理后会进入球队档案。" }, { status: 201 });
  } catch {
    await media.delete?.(fileKey).catch(() => undefined);
    return Response.json({ error: "资料保存失败，请稍后重试。" }, { status: 500 });
  }
}
