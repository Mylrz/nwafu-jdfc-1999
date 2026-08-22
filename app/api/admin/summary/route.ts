import { and, count, countDistinct, eq } from "drizzle-orm";
import {
  guestbookMessages,
  playerProfileSubmissions,
  players,
  playerSeasonRecords,
  submissions,
} from "../../../../db/schema";
import { getAdminContext } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

function value(row: { total: number } | undefined) {
  return row?.total ?? 0;
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });

  const [
    [publishedPlayers],
    [archivedPlayers],
    [seasonsCount],
    [pendingProfiles],
    [pendingMessages],
    [pendingFiles],
    [missingPhotos],
    [missingNumbers],
    [totalSeasonRecords],
  ] = await Promise.all([
    context.db.select({ total: count() }).from(players).where(eq(players.status, "published")),
    context.db.select({ total: count() }).from(players).where(eq(players.status, "archived")),
    context.db.select({ total: countDistinct(playerSeasonRecords.season) }).from(playerSeasonRecords)
      .innerJoin(players, eq(playerSeasonRecords.playerId, players.id)).where(eq(players.status, "published")),
    context.db.select({ total: count() }).from(playerProfileSubmissions).where(eq(playerProfileSubmissions.status, "pending")),
    context.db.select({ total: count() }).from(guestbookMessages).where(eq(guestbookMessages.status, "pending")),
    context.db.select({ total: count() }).from(submissions).where(eq(submissions.status, "pending")),
    context.db.select({ total: count() }).from(players)
      .where(and(eq(players.status, "published"), eq(players.photoKey, ""))),
    context.db.select({ total: count() }).from(playerSeasonRecords)
      .innerJoin(players, eq(playerSeasonRecords.playerId, players.id))
      .where(and(eq(players.status, "published"), eq(playerSeasonRecords.jerseyNumber, ""))),
    context.db.select({ total: count() }).from(playerSeasonRecords)
      .innerJoin(players, eq(playerSeasonRecords.playerId, players.id))
      .where(eq(players.status, "published")),
  ]);

  return Response.json({
    summary: {
      publishedPlayers: value(publishedPlayers),
      archivedPlayers: value(archivedPlayers),
      seasonsCount: value(seasonsCount),
      pendingProfiles: value(pendingProfiles),
      pendingMessages: value(pendingMessages),
      pendingFiles: value(pendingFiles),
      missingPhotos: value(missingPhotos),
      missingNumbers: value(missingNumbers),
      totalSeasonRecords: value(totalSeasonRecords),
    },
  }, { headers: { "cache-control": "no-store" } });
}
