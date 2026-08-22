import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { mediaAssets, submissions } from "../../../../db/schema";
import {
  ARCHIVE_IMAGE_TYPES,
  cleanText,
  isArchiveSquad,
  isMediaAssetStatus,
  isMediaRightsStatus,
  nextArchiveVersion,
  PUBLIC_IMAGE_TYPES,
} from "../../../../lib/archive";
import { getAdminContext } from "../../../../lib/admin";
import { detectUploadType, hasEmbeddedExif } from "../../../../lib/file-validation";

export const dynamic = "force-dynamic";

function isConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
}

function changeCount(result: unknown) {
  return Number((result as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0);
}

async function readPayload(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });

  const rows = await context.db.select().from(mediaAssets)
    .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
    .limit(500);

  return Response.json({
    media: rows.map((row) => ({
      ...row,
      fileUrl: `/api/admin/media/${row.id}/file`,
      publicImageUrl: row.status === "published" && row.rightsStatus === "cleared" && PUBLIC_IMAGE_TYPES.has(row.contentType)
        ? `/api/media/${row.id}/file`
        : null,
    })),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = await readPayload(request);
  if (!payload) return Response.json({ error: "请求内容不是有效 JSON" }, { status: 400 });

  const submissionId = Number(payload.submissionId);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return Response.json({ error: "投稿编号无效" }, { status: 400 });
  }

  const [submission] = await context.db.select().from(submissions)
    .where(eq(submissions.id, submissionId)).limit(1);
  if (!submission) return Response.json({ error: "资料投稿不存在" }, { status: 404 });
  if (submission.status !== "pending") {
    return Response.json({ error: "只有待处理投稿可以建立媒体档案；请先在资料审核中恢复为待处理" }, { status: 409 });
  }
  if (!ARCHIVE_IMAGE_TYPES.has(submission.contentType)) {
    return Response.json({ error: "只有 JPG、PNG、WebP 或 HEIC 图片可以进入公开媒体档案，PDF 仍保留在资料投稿中。" }, { status: 415 });
  }

  const [existing] = await context.db.select({ id: mediaAssets.id }).from(mediaAssets)
    .where(eq(mediaAssets.submissionId, submissionId)).limit(1);
  if (existing) return Response.json({ error: "这份投稿已经建立媒体档案", mediaId: existing.id }, { status: 409 });

  const squad = cleanText(payload.squad ?? "other", 30);
  const rightsStatus = cleanText(payload.rightsStatus ?? "pending", 20);
  const status = cleanText(payload.status ?? "draft", 20);
  if (!isArchiveSquad(squad)) return Response.json({ error: "队别无效" }, { status: 400 });
  if (!isMediaRightsStatus(rightsStatus)) return Response.json({ error: "授权状态无效" }, { status: 400 });
  if (!isMediaAssetStatus(status) || status === "archived") {
    return Response.json({ error: "新媒体只能保存为草稿或直接发布" }, { status: 400 });
  }
  if (status === "published" && rightsStatus !== "cleared") {
    return Response.json({ error: "公开发布前必须确认照片授权" }, { status: 400 });
  }
  if (status === "published" && !PUBLIC_IMAGE_TYPES.has(submission.contentType)) {
    return Response.json({ error: "HEIC 需要先转换为 JPG 或 WebP 后再公开" }, { status: 415 });
  }

  let verifiedObjectSize = submission.fileSize;
  try {
    const object = await env.MEDIA?.get(submission.fileKey);
    if (!object) return Response.json({ error: "投稿原图不存在，无法建立媒体档案" }, { status: 409 });
    const objectBytes = await object.arrayBuffer();
    const detectedType = detectUploadType(objectBytes);
    if (detectedType !== submission.contentType || !ARCHIVE_IMAGE_TYPES.has(detectedType)) {
      return Response.json({ error: "投稿文件内容与图片类型不一致，不能进入公开档案" }, { status: 415 });
    }
    if (status === "published" && hasEmbeddedExif(objectBytes)) {
      return Response.json({ error: "照片仍含 EXIF/GPS 元数据，请先转存为已去除位置信息的 JPG、PNG 或 WebP 后再公开" }, { status: 415 });
    }
    verifiedObjectSize = object.size;
  } catch {
    return Response.json({ error: "暂时无法核验投稿原图，请稍后重试" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const title = cleanText(payload.title ?? submission.title, 100);
  if (!title) return Response.json({ error: "媒体标题必填" }, { status: 400 });
  const caption = cleanText(payload.caption ?? submission.note, 1200);
  const season = cleanText(payload.season ?? submission.season, 20);
  const credit = cleanText(payload.credit ?? submission.submitterName, 100);
  const source = cleanText(payload.source ?? "球队资料投稿", 160);
  const publishedAt = status === "published" ? now : null;
  const rightsReviewedBy = rightsStatus === "cleared" ? context.user.userId : null;
  const rightsReviewedAt = rightsStatus === "cleared" ? now : null;
  const rightsRevokedAt = rightsStatus === "restricted" ? now : null;

  try {
    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO media_assets (
          submission_id, title, caption, season, squad, credit, source,
          rights_status, rights_reviewed_by, rights_reviewed_at, rights_revoked_at,
          status, file_key, file_name, content_type, file_size, created_at,
          published_at, updated_at
        )
        SELECT
          id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, file_key, file_name, content_type,
          ?, ?, ?, ?
        FROM submissions
        WHERE id = ? AND status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM media_assets WHERE submission_id = submissions.id)
      `).bind(
        title, caption, season, squad, credit, source, rightsStatus,
        rightsReviewedBy, rightsReviewedAt, rightsRevokedAt, status,
        verifiedObjectSize, now, publishedAt, now, submissionId,
      ),
      env.DB.prepare(`
        UPDATE submissions SET status = 'approved'
        WHERE id = ? AND status = 'pending'
          AND EXISTS (SELECT 1 FROM media_assets WHERE submission_id = ?)
      `).bind(submissionId, submissionId),
    ]);
    if (changeCount(results[0]) !== 1 || changeCount(results[1]) !== 1) {
      return Response.json({ error: "投稿状态已经变化或媒体档案已存在，请刷新后重试" }, { status: 409 });
    }
  } catch (error) {
    if (isConstraintError(error)) {
      const [current] = await context.db.select({ id: mediaAssets.id }).from(mediaAssets)
        .where(eq(mediaAssets.submissionId, submissionId)).limit(1);
      return Response.json({ error: "这份投稿已经建立媒体档案", mediaId: current?.id }, { status: 409 });
    }
    return Response.json({ error: "媒体档案保存失败，请重试" }, { status: 500 });
  }

  const [created] = await context.db.select().from(mediaAssets)
    .where(eq(mediaAssets.submissionId, submissionId)).limit(1);
  return Response.json({ media: created }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = await readPayload(request);
  if (!payload) return Response.json({ error: "请求内容不是有效 JSON" }, { status: 400 });

  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "媒体编号无效" }, { status: 400 });
  const expectedUpdatedAt = cleanText(payload.expectedUpdatedAt, 60);
  if (!expectedUpdatedAt) {
    return Response.json({ error: "缺少档案版本，请刷新后再保存", code: "MEDIA_VERSION_REQUIRED" }, { status: 400 });
  }

  const [existing] = await context.db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!existing) return Response.json({ error: "媒体档案不存在" }, { status: 404 });

  const title = payload.title === undefined ? existing.title : cleanText(payload.title, 100);
  const squad = payload.squad === undefined ? existing.squad : cleanText(payload.squad, 30);
  const rightsStatus = payload.rightsStatus === undefined ? existing.rightsStatus : cleanText(payload.rightsStatus, 20);
  const status = payload.status === undefined ? existing.status : cleanText(payload.status, 20);
  if (!title) return Response.json({ error: "媒体标题必填" }, { status: 400 });
  if (!isArchiveSquad(squad)) return Response.json({ error: "队别无效" }, { status: 400 });
  if (!isMediaRightsStatus(rightsStatus)) return Response.json({ error: "授权状态无效" }, { status: 400 });
  if (!isMediaAssetStatus(status)) return Response.json({ error: "媒体状态无效" }, { status: 400 });
  if (status === "published" && rightsStatus !== "cleared") {
    return Response.json({ error: "公开发布前必须确认照片授权" }, { status: 400 });
  }
  if (status === "published" && !PUBLIC_IMAGE_TYPES.has(existing.contentType)) {
    return Response.json({ error: "HEIC 需要先转换为 JPG 或 WebP 后再公开" }, { status: 415 });
  }
  if (status === "published" && (
    existing.status !== "published" || existing.rightsStatus !== "cleared"
  )) {
    try {
      const object = await env.MEDIA?.get(existing.fileKey);
      if (!object) return Response.json({ error: "媒体原图不存在，无法公开" }, { status: 409 });
      const objectBytes = await object.arrayBuffer();
      if (detectUploadType(objectBytes) !== existing.contentType) {
        return Response.json({ error: "媒体文件内容与档案类型不一致，无法公开" }, { status: 415 });
      }
      if (hasEmbeddedExif(objectBytes)) {
        return Response.json({ error: "照片仍含 EXIF/GPS 元数据，请先转存为已去除位置信息的 JPG、PNG 或 WebP 后再公开" }, { status: 415 });
      }
    } catch {
      return Response.json({ error: "暂时无法核验媒体原图，请稍后重试" }, { status: 503 });
    }
  }

  const updatedAt = nextArchiveVersion(expectedUpdatedAt);
  let rightsReviewedBy = existing.rightsReviewedBy;
  let rightsReviewedAt = existing.rightsReviewedAt;
  let rightsRevokedAt = existing.rightsRevokedAt;
  if (rightsStatus === "cleared" && existing.rightsStatus !== "cleared") {
    rightsReviewedBy = context.user.userId;
    rightsReviewedAt = updatedAt;
    rightsRevokedAt = null;
  } else if (rightsStatus === "restricted" && existing.rightsStatus !== "restricted") {
    rightsRevokedAt = updatedAt;
  }
  const updated = await context.db.update(mediaAssets).set({
    title,
    caption: payload.caption === undefined ? existing.caption : cleanText(payload.caption, 1200),
    season: payload.season === undefined ? existing.season : cleanText(payload.season, 20),
    squad,
    credit: payload.credit === undefined ? existing.credit : cleanText(payload.credit, 100),
    source: payload.source === undefined ? existing.source : cleanText(payload.source, 160),
    rightsStatus,
    rightsReviewedBy,
    rightsReviewedAt,
    rightsRevokedAt,
    status,
    publishedAt: status === "published" ? (existing.publishedAt ?? updatedAt) : existing.publishedAt,
    updatedAt,
  }).where(and(eq(mediaAssets.id, id), eq(mediaAssets.updatedAt, expectedUpdatedAt))).returning();

  if (!updated.length) {
    const [current] = await context.db.select({ id: mediaAssets.id, updatedAt: mediaAssets.updatedAt })
      .from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!current) return Response.json({ error: "媒体档案不存在" }, { status: 404 });
    return Response.json({
      error: "这份媒体档案已被其他管理员修改，请刷新后重试",
      code: "MEDIA_VERSION_CONFLICT",
      currentUpdatedAt: current.updatedAt,
    }, { status: 409 });
  }

  return Response.json({ media: updated[0], updatedAt });
}
