import { and, desc, eq } from "drizzle-orm";
import { mediaAssets, seasonArchives } from "../../../../db/schema";
import {
  ARCHIVE_IMAGE_TYPES,
  cleanSlug,
  cleanText,
  isArchiveSquad,
  isSeasonArchiveStatus,
  isValidSlug,
  nextArchiveVersion,
  PUBLIC_IMAGE_TYPES,
} from "../../../../lib/archive";
import { getAdminContext } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

function parseCoverMediaId(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : "invalid";
}

function isConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
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
  const rows = await context.db.select().from(seasonArchives)
    .orderBy(desc(seasonArchives.season), desc(seasonArchives.id)).limit(300);
  return Response.json({
    seasons: rows.map((row) => ({
      ...row,
      coverFileUrl: row.coverMediaId ? `/api/admin/media/${row.coverMediaId}/file` : null,
    })),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = await readPayload(request);
  if (!payload) return Response.json({ error: "请求内容不是有效 JSON" }, { status: 400 });

  const season = cleanText(payload.season, 20);
  const squad = cleanText(payload.squad, 30);
  const slug = cleanSlug(payload.slug);
  const title = cleanText(payload.title, 100);
  const status = cleanText(payload.status ?? "draft", 20);
  const coverMediaId = parseCoverMediaId(payload.coverMediaId);
  if (!season || !title) return Response.json({ error: "赛季和标题必填" }, { status: 400 });
  if (!isArchiveSquad(squad)) return Response.json({ error: "队别无效" }, { status: 400 });
  if (!isValidSlug(slug)) return Response.json({ error: "链接标识只能使用小写字母、数字和连字符" }, { status: 400 });
  if (!isSeasonArchiveStatus(status) || status === "archived") {
    return Response.json({ error: "新赛季只能保存为草稿或直接发布" }, { status: 400 });
  }
  if (coverMediaId === "invalid") return Response.json({ error: "封面媒体编号无效" }, { status: 400 });

  if (coverMediaId) {
    const [cover] = await context.db.select({
      contentType: mediaAssets.contentType,
      status: mediaAssets.status,
      rightsStatus: mediaAssets.rightsStatus,
    })
      .from(mediaAssets).where(eq(mediaAssets.id, coverMediaId)).limit(1);
    if (!cover || !ARCHIVE_IMAGE_TYPES.has(cover.contentType)) {
      return Response.json({ error: "封面图片不存在" }, { status: 400 });
    }
    if (status === "published" && (
      cover.status !== "published" ||
      cover.rightsStatus !== "cleared" ||
      !PUBLIC_IMAGE_TYPES.has(cover.contentType)
    )) {
      return Response.json({ error: "公开赛季的封面必须是已授权并公开的媒体档案" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  try {
    const [created] = await context.db.insert(seasonArchives).values({
      season,
      squad,
      slug,
      title,
      summary: cleanText(payload.summary, 500),
      story: cleanText(payload.story, 8000),
      status,
      coverMediaId,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return Response.json({ season: created }, { status: 201 });
  } catch (error) {
    if (isConstraintError(error)) {
      return Response.json({ error: "同一赛季队别或链接标识已经存在" }, { status: 409 });
    }
    return Response.json({ error: "赛季档案保存失败，请重试" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = await readPayload(request);
  if (!payload) return Response.json({ error: "请求内容不是有效 JSON" }, { status: 400 });

  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "赛季编号无效" }, { status: 400 });
  const expectedUpdatedAt = cleanText(payload.expectedUpdatedAt, 60);
  if (!expectedUpdatedAt) {
    return Response.json({ error: "缺少档案版本，请刷新后再保存", code: "SEASON_VERSION_REQUIRED" }, { status: 400 });
  }

  const [existing] = await context.db.select().from(seasonArchives).where(eq(seasonArchives.id, id)).limit(1);
  if (!existing) return Response.json({ error: "赛季档案不存在" }, { status: 404 });

  const season = payload.season === undefined ? existing.season : cleanText(payload.season, 20);
  const squad = payload.squad === undefined ? existing.squad : cleanText(payload.squad, 30);
  const slug = payload.slug === undefined ? existing.slug : cleanSlug(payload.slug);
  const title = payload.title === undefined ? existing.title : cleanText(payload.title, 100);
  const status = payload.status === undefined ? existing.status : cleanText(payload.status, 20);
  const coverMediaId = payload.coverMediaId === undefined ? existing.coverMediaId : parseCoverMediaId(payload.coverMediaId);
  if (!season || !title) return Response.json({ error: "赛季和标题必填" }, { status: 400 });
  if (!isArchiveSquad(squad)) return Response.json({ error: "队别无效" }, { status: 400 });
  if (!isValidSlug(slug)) return Response.json({ error: "链接标识只能使用小写字母、数字和连字符" }, { status: 400 });
  if (!isSeasonArchiveStatus(status)) return Response.json({ error: "赛季状态无效" }, { status: 400 });
  if (coverMediaId === "invalid") return Response.json({ error: "封面媒体编号无效" }, { status: 400 });

  if (coverMediaId) {
    const [cover] = await context.db.select({
      contentType: mediaAssets.contentType,
      status: mediaAssets.status,
      rightsStatus: mediaAssets.rightsStatus,
    })
      .from(mediaAssets).where(eq(mediaAssets.id, coverMediaId)).limit(1);
    if (!cover || !ARCHIVE_IMAGE_TYPES.has(cover.contentType)) {
      return Response.json({ error: "封面图片不存在" }, { status: 400 });
    }
    if (status === "published" && (
      cover.status !== "published" ||
      cover.rightsStatus !== "cleared" ||
      !PUBLIC_IMAGE_TYPES.has(cover.contentType)
    )) {
      return Response.json({ error: "公开赛季的封面必须是已授权并公开的媒体档案" }, { status: 400 });
    }
  }

  const updatedAt = nextArchiveVersion(expectedUpdatedAt);
  try {
    const updated = await context.db.update(seasonArchives).set({
      season,
      squad,
      slug,
      title,
      summary: payload.summary === undefined ? existing.summary : cleanText(payload.summary, 500),
      story: payload.story === undefined ? existing.story : cleanText(payload.story, 8000),
      status,
      coverMediaId,
      updatedAt,
    }).where(and(eq(seasonArchives.id, id), eq(seasonArchives.updatedAt, expectedUpdatedAt))).returning();

    if (!updated.length) {
      const [current] = await context.db.select({ id: seasonArchives.id, updatedAt: seasonArchives.updatedAt })
        .from(seasonArchives).where(eq(seasonArchives.id, id)).limit(1);
      if (!current) return Response.json({ error: "赛季档案不存在" }, { status: 404 });
      return Response.json({
        error: "这份赛季档案已被其他管理员修改，请刷新后重试",
        code: "SEASON_VERSION_CONFLICT",
        currentUpdatedAt: current.updatedAt,
      }, { status: 409 });
    }
    return Response.json({ season: updated[0], updatedAt });
  } catch (error) {
    if (isConstraintError(error)) {
      return Response.json({ error: "同一赛季队别或链接标识已经存在" }, { status: 409 });
    }
    return Response.json({ error: "赛季档案保存失败，请重试" }, { status: 500 });
  }
}
