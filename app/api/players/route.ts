import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { players, playerSeasonRecords } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 40) ?? "";
  const season = url.searchParams.get("season")?.trim().slice(0, 10) ?? "";
  const candidateFilters = [eq(players.status, "published")];
  if (season && season !== "all") candidateFilters.push(eq(playerSeasonRecords.season, season));
  if (query) {
    const pattern = `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
    candidateFilters.push(or(like(players.name, pattern), like(playerSeasonRecords.jerseyNumber, pattern))!);
  }

  try {
    const db = getDb();
    const [candidateRows, seasonRows] = await Promise.all([
      db.selectDistinct({ id: players.id })
        .from(players)
        .leftJoin(playerSeasonRecords, eq(playerSeasonRecords.playerId, players.id))
        .where(and(...candidateFilters))
        .orderBy(desc(players.id))
        .limit(1000),
      db.selectDistinct({ season: playerSeasonRecords.season })
        .from(playerSeasonRecords)
        .innerJoin(players, eq(players.id, playerSeasonRecords.playerId))
        .where(eq(players.status, "published"))
        .orderBy(desc(playerSeasonRecords.season))
        .limit(100),
    ]);

    const candidateIds = candidateRows.map((row) => row.id);
    if (!candidateIds.length) {
      return Response.json(
        { players: [], seasons: seasonRows.map((row) => row.season) },
        { headers: { "cache-control": "no-store" } },
      );
    }

    // First identify matching players, then load every season belonging to
    // those players. This keeps a 2025 filter from truncating their history.
    const rows = await db
      .select({
        id: players.id,
        season: players.season,
        name: players.name,
        jerseyNumber: players.jerseyNumber,
        position: players.position,
        role: players.role,
        major: players.major,
        classYear: players.classYear,
        note: players.note,
        // Preserve the public API shape without revealing the private R2 key.
        photoKey: sql<string>`CASE WHEN ${players.photoKey} <> '' THEN 'available' ELSE '' END`,
        seasonRecordId: playerSeasonRecords.id,
        recordSeason: playerSeasonRecords.season,
        recordJerseyNumber: playerSeasonRecords.jerseyNumber,
        recordPosition: playerSeasonRecords.position,
        recordRole: playerSeasonRecords.role,
      })
      .from(players)
      .leftJoin(playerSeasonRecords, eq(playerSeasonRecords.playerId, players.id))
      .where(and(eq(players.status, "published"), inArray(players.id, candidateIds)))
      .orderBy(desc(playerSeasonRecords.season), desc(players.id))
      .limit(2000);

    const grouped = new Map<number, Omit<(typeof rows)[number], "seasonRecordId" | "recordSeason" | "recordJerseyNumber" | "recordPosition" | "recordRole"> & {
      seasonRecords: Array<{ id: number; season: string; jerseyNumber: string; position: string; role: string }>;
    }>();
    for (const row of rows) {
      const { seasonRecordId, recordSeason, recordJerseyNumber, recordPosition, recordRole, ...player } = row;
      const current = grouped.get(player.id) ?? { ...player, seasonRecords: [] };
      if (seasonRecordId && recordSeason !== null) current.seasonRecords.push({
        id: seasonRecordId,
        season: recordSeason,
        jerseyNumber: recordJerseyNumber ?? "",
        position: recordPosition ?? "",
        role: recordRole ?? "队员",
      });
      grouped.set(player.id, current);
    }
    return Response.json({ players: [...grouped.values()], seasons: seasonRows.map((row) => row.season) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: "球员档案暂时无法读取，请稍后重试。", code: "PLAYER_ARCHIVE_UNAVAILABLE" },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
    );
  }
}
