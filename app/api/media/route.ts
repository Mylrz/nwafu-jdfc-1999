import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mediaAssets } from "../../../db/schema";
import { cleanText, isArchiveSquad } from "../../../lib/archive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const season = cleanText(url.searchParams.get("season"), 20);
  const squad = cleanText(url.searchParams.get("squad"), 30);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200) : 100;
  if (squad && !isArchiveSquad(squad)) return Response.json({ error: "队别无效" }, { status: 400 });

  const filters = [
    eq(mediaAssets.status, "published"),
    eq(mediaAssets.rightsStatus, "cleared"),
  ];
  if (season) filters.push(eq(mediaAssets.season, season));
  if (squad) filters.push(eq(mediaAssets.squad, squad));

  try {
    const rows = await getDb().select({
      id: mediaAssets.id,
      title: mediaAssets.title,
      caption: mediaAssets.caption,
      season: mediaAssets.season,
      squad: mediaAssets.squad,
      credit: mediaAssets.credit,
      source: mediaAssets.source,
      publishedAt: mediaAssets.publishedAt,
      updatedAt: mediaAssets.updatedAt,
    }).from(mediaAssets)
      .where(and(...filters))
      .orderBy(desc(mediaAssets.publishedAt), desc(mediaAssets.id))
      .limit(limit);

    return Response.json({
      media: rows.map((row) => ({ ...row, imageUrl: `/api/media/${row.id}/file` })),
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: "公共影像档案暂时无法读取。", code: "MEDIA_ARCHIVE_UNAVAILABLE" },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
    );
  }
}
