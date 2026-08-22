import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { playerProfileSubmissions, players, playerSubmissionSeasonRecords } from "../../../db/schema";
import { type SupportedUploadType, validateUploadFile } from "../../../lib/file-validation";
import { parseSeasonRecords } from "../../../lib/player-seasons";
import { enforcePublicFormRateLimit, rejectOversizedContentLength } from "../../../lib/public-form-security";

export const dynamic = "force-dynamic";

type MediaBucket = {
  put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) => Promise<unknown>;
  delete?: (key: string) => Promise<unknown>;
};

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const satisfies readonly SupportedUploadType[];
const maxPhotoSize = 8 * 1024 * 1024;
const maxRequestSize = maxPhotoSize + 512 * 1024;

export async function POST(request: Request) {
  const oversized = rejectOversizedContentLength(
    request,
    maxRequestSize,
    "提交内容过大，照片需小于 8MB。",
  );
  if (oversized) return oversized;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "资料格式无效，请刷新后重试。" }, { status: 400 });
  }
  if (String(form.get("website") ?? "")) return Response.json({ ok: true }, { status: 201 });

  const name = String(form.get("name") ?? "").trim().slice(0, 30);
  const kind = String(form.get("kind") ?? "create").trim();
  const rawTargetPlayerId = String(form.get("targetPlayerId") ?? "").trim();
  const targetPlayerId = /^\d+$/.test(rawTargetPlayerId) ? Number(rawTargetPlayerId) : null;
  const seasonRecords = parseSeasonRecords(form.get("seasonRecords"));
  const latestSeason = seasonRecords[0];
  const major = String(form.get("major") ?? "").trim().slice(0, 50);
  const classYear = String(form.get("classYear") ?? "").trim().slice(0, 20);
  const contact = String(form.get("contact") ?? "").trim().slice(0, 80);
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  const consent = String(form.get("consent") ?? "") === "on";
  const photo = form.get("photo");

  if (kind !== "create" && kind !== "update") {
    return Response.json({ error: "提交类型无效。" }, { status: 400 });
  }
  if (kind === "update" && (!targetPlayerId || !Number.isSafeInteger(targetPlayerId))) {
    return Response.json({ error: "修改资料时必须选择要修改的球员档案。" }, { status: 400 });
  }
  if (!seasonRecords.length || !name || !contact || !consent) {
    return Response.json({ error: "请至少填写一个效力赛季、姓名、联系方式并确认资料授权。" }, { status: 400 });
  }

  const db = getDb();
  if (kind === "update") {
    const [target] = await db.select({ id: players.id }).from(players)
      .where(and(eq(players.id, targetPlayerId!), eq(players.status, "published"))).limit(1);
    if (!target) return Response.json({ error: "要修改的球员档案不存在或已归档。" }, { status: 404 });
  }
  const rateLimited = await enforcePublicFormRateLimit(request, "player-submissions");
  if (rateLimited) return rateLimited;

  let photoKey = "";
  let photoFileName = "";
  let photoContentType = "";
  let photoFileSize = 0;

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > maxPhotoSize) {
      return Response.json({ error: "照片仅支持 JPG、PNG、WebP 或 HEIC，且需小于 8MB。" }, { status: 413 });
    }
    const validatedPhoto = await validateUploadFile(photo, allowedTypes).catch(() => null);
    if (!validatedPhoto?.ok) {
      return Response.json({ error: "照片内容与文件类型不一致，请重新选择 JPG、PNG、WebP 或 HEIC 文件。" }, { status: 400 });
    }
    const media = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
    if (!media) return Response.json({ error: "照片存储暂不可用。" }, { status: 503 });

    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90) || "player-photo";
    photoKey = `player-profiles/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    try {
      await media.put(photoKey, validatedPhoto.bytes, {
        httpMetadata: { contentType: validatedPhoto.contentType },
        customMetadata: { name, season: latestSeason.season },
      });
    } catch {
      return Response.json({ error: "照片暂时无法上传，请稍后重试。" }, { status: 503 });
    }
    photoFileName = photo.name.slice(0, 120);
    photoContentType = validatedPhoto.contentType;
    photoFileSize = photo.size;
  }

  let stagedSubmissionId: number | null = null;
  try {
    const user = await getChatGPTUser();
    const [submission] = await db.insert(playerProfileSubmissions).values({
      kind,
      targetPlayerId: kind === "update" ? targetPlayerId : null,
      season: latestSeason.season,
      name,
      jerseyNumber: latestSeason.jerseyNumber,
      position: latestSeason.position,
      role: latestSeason.role,
      major,
      classYear,
      contact,
      note,
      photoKey,
      photoFileName,
      photoContentType,
      photoFileSize,
      authorUserId: user?.userId ?? null,
      consentVersion: "player-profile-2026-08-15",
      consentedAt: new Date().toISOString(),
    }).returning({ id: playerProfileSubmissions.id });
    stagedSubmissionId = submission.id;

    await db.insert(playerSubmissionSeasonRecords).values(seasonRecords.map((record) => ({
      submissionId: submission.id,
      ...record,
    })));

    return Response.json({
      submission,
      notice: kind === "update"
        ? "修改申请已提交。管理员确认后会更新对应球员档案。"
        : "资料已提交。管理员确认后会加入历届球员档案。",
    }, { status: 201 });
  } catch {
    if (stagedSubmissionId) {
      await db.delete(playerProfileSubmissions).where(eq(playerProfileSubmissions.id, stagedSubmissionId)).catch(() => undefined);
    }
    if (photoKey) {
      const media = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
      await media?.delete?.(photoKey).catch(() => undefined);
    }
    return Response.json({ error: "资料保存失败，请稍后重试。" }, { status: 500 });
  }
}
