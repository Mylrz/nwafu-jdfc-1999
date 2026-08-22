import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { playerProfileSubmissions, players, playerSeasonRecords, playerSubmissionSeasonRecords } from "../../../../db/schema";
import { getAdminContext } from "../../../../lib/admin";

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
    ...getTableColumns(playerProfileSubmissions),
    seasonRecordId: playerSubmissionSeasonRecords.id,
    recordSeason: playerSubmissionSeasonRecords.season,
    recordJerseyNumber: playerSubmissionSeasonRecords.jerseyNumber,
    recordPosition: playerSubmissionSeasonRecords.position,
    recordRole: playerSubmissionSeasonRecords.role,
  }).from(playerProfileSubmissions)
    .leftJoin(playerSubmissionSeasonRecords, eq(playerSubmissionSeasonRecords.submissionId, playerProfileSubmissions.id))
    .orderBy(desc(playerProfileSubmissions.createdAt), desc(playerSubmissionSeasonRecords.season)).limit(1200);
  const grouped = new Map<number, Record<string, unknown> & { seasonRecords: Array<{ id: number; season: string; jerseyNumber: string; position: string; role: string }> }>();
  for (const row of rows) {
    const { seasonRecordId, recordSeason, recordJerseyNumber, recordPosition, recordRole, ...submission } = row;
    const current = grouped.get(submission.id) ?? { ...submission, seasonRecords: [] };
    if (seasonRecordId && recordSeason !== null) current.seasonRecords.push({ id: seasonRecordId, season: recordSeason, jerseyNumber: recordJerseyNumber ?? "", position: recordPosition ?? "", role: recordRole ?? "队员" });
    grouped.set(submission.id, current);
  }
  return Response.json({ submissions: [...grouped.values()] });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });
  const payload = (await request.json()) as { id?: number; action?: string; expectedTargetUpdatedAt?: string };
  const id = Number(payload.id);
  if (!id || !["approve", "reject", "pending"].includes(payload.action ?? "")) {
    return Response.json({ error: "参数无效" }, { status: 400 });
  }

  const [submission] = await context.db.select().from(playerProfileSubmissions).where(eq(playerProfileSubmissions.id, id)).limit(1);
  if (!submission) return Response.json({ error: "提交记录不存在" }, { status: 404 });

  if (payload.action === "approve") {
    if (submission.status !== "pending") {
      return Response.json({ error: submission.status === "approved" ? "这份资料已经入库。" : "请先把这份资料恢复为待审状态。" }, { status: 409 });
    }
    const records = await context.db.select().from(playerSubmissionSeasonRecords)
      .where(eq(playerSubmissionSeasonRecords.submissionId, id)).orderBy(desc(playerSubmissionSeasonRecords.season));
    const seasonRecords = records.length ? records : [{
      id: 0, submissionId: id, season: submission.season, jerseyNumber: submission.jerseyNumber,
      position: submission.position, role: submission.role,
    }];
    const kind = submission.kind === "update" ? "update" : "create";
    let targetPlayer: typeof players.$inferSelect | undefined;
    let mergedSeasonRecords = seasonRecords.map(({ season, jerseyNumber, position, role }) => ({ season, jerseyNumber, position, role }));

    if (kind === "update") {
      if (!submission.targetPlayerId) {
        return Response.json({ error: "这份修改申请没有关联球员档案，不能审核入库。" }, { status: 409 });
      }
      [targetPlayer] = await context.db.select().from(players)
        .where(and(eq(players.id, submission.targetPlayerId), eq(players.status, "published"))).limit(1);
      if (!targetPlayer) return Response.json({ error: "关联的球员档案不存在或已归档。" }, { status: 409 });
      if (!payload.expectedTargetUpdatedAt) {
        return Response.json({ error: "缺少目标档案版本，请刷新后再审核。", code: "PLAYER_VERSION_REQUIRED" }, { status: 400 });
      }
      if (targetPlayer.updatedAt !== payload.expectedTargetUpdatedAt) {
        return Response.json({ error: "目标球员档案已被修改，请刷新差异后重新审核。", code: "PLAYER_VERSION_CONFLICT" }, { status: 409 });
      }

      const existingRecords = await context.db.select().from(playerSeasonRecords)
        .where(eq(playerSeasonRecords.playerId, targetPlayer.id));
      const bySeason = new Map(existingRecords.map((record) => [record.season, {
        season: record.season,
        jerseyNumber: record.jerseyNumber,
        position: record.position,
        role: record.role,
      }]));
      for (const record of mergedSeasonRecords) bySeason.set(record.season, record);
      mergedSeasonRecords = [...bySeason.values()].sort((a, b) => b.season.localeCompare(a.season, "zh-CN", { numeric: true }));
    }

    try {
      if (kind === "update" && targetPlayer) {
        const primary = mergedSeasonRecords[0];
        const expectedUpdatedAt = payload.expectedTargetUpdatedAt!;
        const updatedAt = nextVersion(expectedUpdatedAt);
        const d1 = context.db.$client;
        const operations = seasonRecords.map((record) => d1.prepare(`
          INSERT INTO player_season_records (player_id, season, jersey_number, position, role)
          SELECT ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM players p
            JOIN player_profile_submissions s ON s.id = ?
            WHERE p.id = ? AND p.status = 'published' AND p.updated_at = ? AND s.status = 'pending'
          )
          ON CONFLICT(player_id, season) DO UPDATE SET
            jersey_number = excluded.jersey_number,
            position = excluded.position,
            role = excluded.role
        `).bind(targetPlayer.id, record.season, record.jerseyNumber, record.position, record.role, id, targetPlayer.id, expectedUpdatedAt));
        operations.push(d1.prepare(`
          UPDATE players SET
            season = ?, name = ?, jersey_number = ?, position = ?, role = ?,
            major = ?, class_year = ?, note = ?, photo_key = ?, photo_file_name = ?,
            photo_content_type = ?, updated_at = ?
          WHERE id = ? AND status = 'published' AND updated_at = ?
            AND EXISTS (SELECT 1 FROM player_profile_submissions WHERE id = ? AND status = 'pending')
        `).bind(
          primary.season,
          submission.name,
          primary.jerseyNumber,
          primary.position,
          primary.role,
          submission.major,
          submission.classYear,
          submission.note,
          submission.photoKey || targetPlayer.photoKey,
          submission.photoFileName || targetPlayer.photoFileName,
          submission.photoContentType || targetPlayer.photoContentType,
          updatedAt,
          targetPlayer.id,
          expectedUpdatedAt,
          id,
        ));
        operations.push(d1.prepare(`
          UPDATE player_profile_submissions SET status = 'approved'
          WHERE id = ? AND status = 'pending'
            AND EXISTS (SELECT 1 FROM players WHERE id = ? AND updated_at = ?)
        `).bind(id, targetPlayer.id, updatedAt));
        const results = await d1.batch(operations);
        if (changeCount(results.at(-2)) !== 1 || changeCount(results.at(-1)) !== 1) {
          return Response.json({ error: "目标档案或审核状态已变化，请刷新后重试。", code: "PLAYER_VERSION_CONFLICT" }, { status: 409 });
        }
        return Response.json({ ok: true, updatedAt, notice: "修改申请已审核，并更新到指定球员档案。" });
      }

      const primary = mergedSeasonRecords[0];
      const d1 = context.db.$client;
      const createdAt = new Date().toISOString();
      const stagingToken = `__jdfc_stage_${crypto.randomUUID()}`;
      const operations = [d1.prepare(`
        INSERT INTO players (
          season, name, jersey_number, position, role, major, class_year, note,
          photo_key, photo_file_name, photo_content_type, status, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
        WHERE EXISTS (SELECT 1 FROM player_profile_submissions WHERE id = ? AND status = 'pending')
      `).bind(
        primary.season, submission.name, primary.jerseyNumber, primary.position, primary.role,
        submission.major, submission.classYear, stagingToken, submission.photoKey,
        submission.photoFileName, submission.photoContentType, createdAt, createdAt, id,
      )];
      for (const record of seasonRecords) {
        operations.push(d1.prepare(`
          INSERT INTO player_season_records (player_id, season, jersey_number, position, role)
          SELECT id, ?, ?, ?, ? FROM players
          WHERE status = 'pending' AND note = ?
        `).bind(record.season, record.jerseyNumber, record.position, record.role, stagingToken));
      }
      operations.push(d1.prepare(`
        UPDATE players SET status = 'published', note = ?, updated_at = ?
        WHERE status = 'pending' AND note = ?
      `).bind(submission.note, createdAt, stagingToken));
      operations.push(d1.prepare(`
        UPDATE player_profile_submissions SET status = 'approved'
        WHERE id = ? AND status = 'pending' AND changes() = 1
      `).bind(id));
      const results = await d1.batch(operations);
      if (changeCount(results[0]) !== 1 || changeCount(results.at(-2)) !== 1 || changeCount(results.at(-1)) !== 1) {
        return Response.json({ error: "这份资料已被其他管理员处理，请刷新后重试。" }, { status: 409 });
      }
      return Response.json({ ok: true, notice: "新球员资料已审核并加入档案。" });
    } catch (error) {
      console.error("Failed to approve player submission", error);
      return Response.json({ error: "审核写入失败，资料仍保留为待审，请重试。" }, { status: 500 });
    }
  }

  if (submission.status === "approved") {
    return Response.json({ error: "已入库的资料不能恢复或拒绝，以免重复创建球员。" }, { status: 409 });
  }
  if (submission.status === "processing" && payload.action !== "pending") {
    return Response.json({ error: "这份资料正在由其他管理员处理，请稍后刷新。" }, { status: 409 });
  }
  const nextStatus = payload.action === "reject" ? "rejected" : "pending";
  if (submission.status === nextStatus) return Response.json({ ok: true });
  const updated = await context.db.update(playerProfileSubmissions).set({ status: nextStatus })
    .where(and(eq(playerProfileSubmissions.id, id), eq(playerProfileSubmissions.status, submission.status)))
    .returning({ id: playerProfileSubmissions.id });
  if (!updated.length) {
    return Response.json({ error: "这份资料已被其他管理员更新，请刷新后重试。" }, { status: 409 });
  }
  return Response.json({ ok: true });
}
