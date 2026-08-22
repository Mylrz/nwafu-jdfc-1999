import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { players, playerSeasonRecords } from "../../../../db/schema";
import { getAdminContext } from "../../../../lib/admin";
import { sanitizeSeasonRecords } from "../../../../lib/player-seasons";

export const dynamic = "force-dynamic";

type D1BatchResult = { meta?: { changes?: number } };

function changeCount(result: unknown) {
  return (result as D1BatchResult | undefined)?.meta?.changes ?? 0;
}

function nextVersion(expectedUpdatedAt: string) {
  const expectedTime = Date.parse(expectedUpdatedAt);
  return new Date(Number.isFinite(expectedTime) ? Math.max(Date.now(), expectedTime + 1) : Date.now()).toISOString();
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const rows = await context.db.select({
    ...getTableColumns(players),
    seasonRecordId: playerSeasonRecords.id,
    recordSeason: playerSeasonRecords.season,
    recordJerseyNumber: playerSeasonRecords.jerseyNumber,
    recordPosition: playerSeasonRecords.position,
    recordRole: playerSeasonRecords.role,
  }).from(players).leftJoin(playerSeasonRecords, eq(playerSeasonRecords.playerId, players.id))
    .orderBy(desc(playerSeasonRecords.season), desc(players.id)).limit(2000);
  const grouped = new Map<number, Record<string, unknown> & { seasonRecords: Array<{ id: number; season: string; jerseyNumber: string; position: string; role: string }> }>();
  for (const row of rows) {
    const { seasonRecordId, recordSeason, recordJerseyNumber, recordPosition, recordRole, ...player } = row;
    const current = grouped.get(player.id) ?? { ...player, seasonRecords: [] };
    if (seasonRecordId && recordSeason !== null) current.seasonRecords.push({ id: seasonRecordId, season: recordSeason, jerseyNumber: recordJerseyNumber ?? "", position: recordPosition ?? "", role: recordRole ?? "队员" });
    grouped.set(player.id, current);
  }
  return Response.json({ players: [...grouped.values()] });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = (await request.json()) as Record<string, unknown>;
  const seasonRecords = sanitizeSeasonRecords(payload.seasonRecords ?? [{ season: payload.season, jerseyNumber: payload.jerseyNumber, position: payload.position, role: payload.role }]);
  const primary = seasonRecords[0];
  const name = String(payload.name ?? "").trim().slice(0, 30);
  if (!primary || !name) return Response.json({ error: "姓名和至少一个赛季必填" }, { status: 400 });
  const [player] = await context.db.insert(players).values({
    season: primary.season,
    name,
    jerseyNumber: primary.jerseyNumber,
    position: primary.position,
    role: primary.role,
    major: String(payload.major ?? "").trim().slice(0, 50),
    classYear: String(payload.classYear ?? "").trim().slice(0, 20),
    note: String(payload.note ?? "").trim().slice(0, 300),
    status: "pending",
  }).returning();
  try {
    const [firstRecord, ...remainingRecords] = seasonRecords;
    const operations = [
      context.db.insert(playerSeasonRecords).values({ playerId: player.id, ...firstRecord }),
      ...remainingRecords.map((record) => context.db.insert(playerSeasonRecords).values({ playerId: player.id, ...record })),
      context.db.update(players).set({ status: "published", updatedAt: new Date().toISOString() }).where(eq(players.id, player.id)),
    ] as const;
    await context.db.batch(operations);
  } catch {
    await context.db.delete(players).where(and(eq(players.id, player.id), eq(players.status, "pending"))).catch(() => undefined);
    return Response.json({ error: "档案保存失败，请重试" }, { status: 500 });
  }
  return Response.json({ player }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = (await request.json()) as Record<string, unknown>;
  const id = Number(payload.id);
  if (!id) return Response.json({ error: "球员编号无效" }, { status: 400 });
  if (payload.action === "restore") {
    const expectedUpdatedAt = String(payload.expectedUpdatedAt ?? "").trim();
    if (!expectedUpdatedAt) {
      return Response.json({ error: "缺少档案版本，请刷新后再恢复。", code: "PLAYER_VERSION_REQUIRED" }, { status: 400 });
    }
    const updatedAt = nextVersion(expectedUpdatedAt);
    const restored = await context.db.update(players).set({
      status: "published",
      updatedAt,
    }).where(and(eq(players.id, id), eq(players.status, "archived"), eq(players.updatedAt, expectedUpdatedAt)))
      .returning({ id: players.id });
    if (!restored.length) {
      const [current] = await context.db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
      if (!current) return Response.json({ error: "球员档案不存在" }, { status: 404 });
      return Response.json({ error: "档案状态或版本已变化，请刷新后重试。", code: "PLAYER_VERSION_CONFLICT" }, { status: 409 });
    }
    return Response.json({ ok: true, updatedAt, notice: "球员档案已恢复公开。" });
  }
  const seasonRecords = sanitizeSeasonRecords(payload.seasonRecords ?? [{ season: payload.season, jerseyNumber: payload.jerseyNumber, position: payload.position, role: payload.role }]);
  const primary = seasonRecords[0];
  if (!primary) return Response.json({ error: "至少保留一个赛季记录" }, { status: 400 });
  const expectedUpdatedAt = String(payload.expectedUpdatedAt ?? "").trim();
  if (!expectedUpdatedAt) {
    return Response.json({ error: "缺少档案版本，请刷新后再保存。", code: "PLAYER_VERSION_REQUIRED" }, { status: 400 });
  }
  const nextUpdatedAt = nextVersion(expectedUpdatedAt);
  const keepSeasons = seasonRecords.map((record) => record.season);
  const d1 = context.db.$client;
  const operations = seasonRecords.map((record) => d1.prepare(`
    INSERT INTO player_season_records (player_id, season, jersey_number, position, role)
    SELECT ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM players WHERE id = ? AND updated_at = ?)
    ON CONFLICT(player_id, season) DO UPDATE SET
      jersey_number = excluded.jersey_number,
      position = excluded.position,
      role = excluded.role
  `).bind(id, record.season, record.jerseyNumber, record.position, record.role, id, expectedUpdatedAt));
  operations.push(d1.prepare(`
    DELETE FROM player_season_records
    WHERE player_id = ?
      AND season NOT IN (${keepSeasons.map(() => "?").join(", ")})
      AND EXISTS (SELECT 1 FROM players WHERE id = ? AND updated_at = ?)
  `).bind(id, ...keepSeasons, id, expectedUpdatedAt));
  operations.push(d1.prepare(`
    UPDATE players SET
      season = ?, name = ?, jersey_number = ?, position = ?, role = ?,
      major = ?, class_year = ?, note = ?, updated_at = ?
    WHERE id = ? AND updated_at = ?
  `).bind(
    primary.season,
    String(payload.name ?? "").trim().slice(0, 30),
    primary.jerseyNumber,
    primary.position,
    primary.role,
    String(payload.major ?? "").trim().slice(0, 50),
    String(payload.classYear ?? "").trim().slice(0, 20),
    String(payload.note ?? "").trim().slice(0, 300),
    nextUpdatedAt,
    id,
    expectedUpdatedAt,
  ));
  try {
    const results = await d1.batch(operations);
    if (changeCount(results.at(-1)) !== 1) {
      const [current] = await context.db.select({ id: players.id, updatedAt: players.updatedAt })
        .from(players).where(eq(players.id, id)).limit(1);
      if (!current) return Response.json({ error: "球员档案不存在" }, { status: 404 });
      return Response.json({
        error: "这份档案已被其他管理员修改，请刷新后重新编辑。",
        code: "PLAYER_VERSION_CONFLICT",
        currentUpdatedAt: current.updatedAt,
      }, { status: 409 });
    }
  } catch {
    return Response.json({ error: "档案保存失败，请刷新后重试。" }, { status: 500 });
  }
  return Response.json({ ok: true, updatedAt: nextUpdatedAt });
}

export async function DELETE(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "球员编号无效" }, { status: 400 });
  const expectedUpdatedAt = url.searchParams.get("expectedUpdatedAt")?.trim() ?? "";
  if (!expectedUpdatedAt) {
    return Response.json({ error: "缺少档案版本，请刷新后再归档。", code: "PLAYER_VERSION_REQUIRED" }, { status: 400 });
  }
  if (url.searchParams.get("permanent") === "true") {
    const confirmName = url.searchParams.get("confirmName")?.trim() ?? "";
    if (!confirmName) {
      return Response.json({ error: "永久删除前必须输入球员姓名确认。", code: "PLAYER_DELETE_CONFIRMATION_REQUIRED" }, { status: 400 });
    }
    const deleted = await context.db.delete(players)
      .where(and(
        eq(players.id, id),
        eq(players.name, confirmName),
        eq(players.photoKey, ""),
        eq(players.updatedAt, expectedUpdatedAt),
      ))
      .returning({ id: players.id });
    if (!deleted.length) {
      const [current] = await context.db.select({
        id: players.id,
        name: players.name,
        photoKey: players.photoKey,
      }).from(players).where(eq(players.id, id)).limit(1);
      if (!current) return Response.json({ error: "球员档案不存在" }, { status: 404 });
      if (current.photoKey) {
        return Response.json({ error: "该档案仍有关联照片，请先处理照片后再永久删除。", code: "PLAYER_PHOTO_REQUIRES_REVIEW" }, { status: 409 });
      }
      if (current.name !== confirmName) {
        return Response.json({ error: "确认姓名与当前档案不一致。", code: "PLAYER_DELETE_CONFIRMATION_MISMATCH" }, { status: 409 });
      }
      return Response.json({ error: "档案版本已变化，请刷新后重试。", code: "PLAYER_VERSION_CONFLICT" }, { status: 409 });
    }
    return Response.json({ ok: true, notice: "球员档案及赛季记录已永久删除。" });
  }
  const updatedAt = nextVersion(expectedUpdatedAt);
  const archived = await context.db.update(players).set({
    status: "archived",
    updatedAt,
  }).where(and(eq(players.id, id), eq(players.status, "published"), eq(players.updatedAt, expectedUpdatedAt)))
    .returning({ id: players.id });
  if (!archived.length) {
    const [current] = await context.db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
    if (!current) return Response.json({ error: "球员档案不存在" }, { status: 404 });
    return Response.json({ error: "档案状态或版本已变化，请刷新后重试。", code: "PLAYER_VERSION_CONFLICT" }, { status: 409 });
  }
  return Response.json({ ok: true, updatedAt, notice: "球员档案已移入归档，可随时恢复。" });
}
