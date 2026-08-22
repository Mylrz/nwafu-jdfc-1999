import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mediaAssets, seasonArchives } from "../../../db/schema";
import { cleanSlug, cleanText, isArchiveSquad } from "../../../lib/archive";
import { knownSeasonArchives } from "../../../lib/public-content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const season = cleanText(url.searchParams.get("season"), 20);
  const squad = cleanText(url.searchParams.get("squad"), 30);
  const slug = cleanSlug(url.searchParams.get("slug"));
  if (squad && !isArchiveSquad(squad)) return Response.json({ error: "队别无效" }, { status: 400 });

  const filters = [eq(seasonArchives.status, "published")];
  if (season) filters.push(eq(seasonArchives.season, season));
  if (squad) filters.push(eq(seasonArchives.squad, squad));
  if (slug) filters.push(eq(seasonArchives.slug, slug));

  const foundations = knownSeasonArchives.filter((item) => (
    (!season || item.season === season)
    && (!squad || item.squad === squad)
    && (!slug || item.slug === slug)
  )).slice().sort((left, right) => right.season.localeCompare(left.season, "zh-CN", { numeric: true }) || right.id - left.id);

  try {
    const rows = await getDb().select({
      id: seasonArchives.id,
      season: seasonArchives.season,
      squad: seasonArchives.squad,
      slug: seasonArchives.slug,
      title: seasonArchives.title,
      summary: seasonArchives.summary,
      story: seasonArchives.story,
      coverMediaId: seasonArchives.coverMediaId,
      coverPublishedId: mediaAssets.id,
      createdAt: seasonArchives.createdAt,
      updatedAt: seasonArchives.updatedAt,
    }).from(seasonArchives)
      .leftJoin(mediaAssets, and(
        eq(seasonArchives.coverMediaId, mediaAssets.id),
        eq(mediaAssets.status, "published"),
        eq(mediaAssets.rightsStatus, "cleared"),
      ))
      .where(and(...filters))
      .orderBy(desc(seasonArchives.season), desc(seasonArchives.id))
      .limit(200);

    const publishedRows = rows.map(({ coverPublishedId, ...row }) => ({
        ...row,
        coverMediaId: coverPublishedId ? row.coverMediaId : null,
        coverImageUrl: coverPublishedId ? `/api/media/${coverPublishedId}/file` : null,
        foundation: false,
      }));
    const publishedSlugs = new Set(publishedRows.map((row) => row.slug));
    const seasons = [...publishedRows, ...foundations.filter((item) => !publishedSlugs.has(item.slug))]
      .sort((left, right) => right.season.localeCompare(left.season, "zh-CN", { numeric: true }) || right.id - left.id);

    return Response.json({ seasons }, { headers: { "cache-control": "no-store" } });
  } catch {
    if (foundations.length) {
      return Response.json({ seasons: foundations }, { headers: { "cache-control": "no-store" } });
    }
    return Response.json(
      { error: "赛季档案暂时无法读取。", code: "SEASON_ARCHIVE_UNAVAILABLE" },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
    );
  }
}
