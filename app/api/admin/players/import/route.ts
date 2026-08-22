import { and, eq } from "drizzle-orm";
import { players, playerSeasonRecords } from "../../../../../db/schema";
import { getAdminContext } from "../../../../../lib/admin";

export const dynamic = "force-dynamic";

type RawImportRow = Record<string, unknown>;
type ImportRecord = {
  rowNumber: number;
  playerId: number | null;
  name: string;
  classYear: string;
  major: string;
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
  note: string;
};

const seasonPattern = /^(?:19|20)\d{2}(?:[-—/]\d{2,4})?$/;

function clean(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}

function normalizeRow(row: RawImportRow, index: number): { value?: ImportRecord; error?: string } {
  const playerIdText = clean(row.playerId, 20);
  const playerId = playerIdText ? Number(playerIdText) : null;
  const value: ImportRecord = {
    rowNumber: index + 2,
    playerId: playerId && Number.isInteger(playerId) && playerId > 0 ? playerId : null,
    name: clean(row.name, 30),
    classYear: clean(row.classYear, 20),
    major: clean(row.major, 50),
    season: clean(row.season, 10),
    jerseyNumber: clean(row.jerseyNumber, 8),
    position: clean(row.position, 20),
    role: clean(row.role, 20) || "队员",
    note: clean(row.note, 300),
  };
  if (playerIdText && !value.playerId) return { error: `第 ${value.rowNumber} 行：档案 ID 无效` };
  if (!value.name || !value.season) return { error: `第 ${value.rowNumber} 行：姓名和赛季必填` };
  if (!seasonPattern.test(value.season)) return { error: `第 ${value.rowNumber} 行：赛季格式应为 2025 或 2024-2025` };
  return { value };
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });

  const payload = (await request.json()) as { rows?: RawImportRow[] };
  if (!Array.isArray(payload.rows) || !payload.rows.length) {
    return Response.json({ error: "没有可导入的数据" }, { status: 400 });
  }
  if (payload.rows.length > 500) {
    return Response.json({ error: "单次最多导入 500 行，请拆分文件" }, { status: 400 });
  }

  const normalized = payload.rows.map(normalizeRow);
  const validationErrors = normalized.flatMap((row) => row.error ? [row.error] : []);
  if (validationErrors.length) {
    return Response.json({ error: "文件中仍有无效数据", errors: validationErrors }, { status: 400 });
  }
  const rows = normalized.flatMap((row) => row.value ? [row.value] : []);
  const groups = new Map<string, ImportRecord[]>();
  for (const row of rows) {
    const key = row.playerId ? `id:${row.playerId}` : `new:${row.name}|${row.classYear}|${row.major}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const results: Array<{ name: string; status: "created" | "updated" | "error"; detail: string }> = [];
  for (const group of groups.values()) {
    const first = group[0];
    const duplicateSeason = group.find((row, index) => group.findIndex((candidate) => candidate.season === row.season) !== index);
    if (duplicateSeason) {
      results.push({ name: first.name, status: "error", detail: `${duplicateSeason.season} 赛季在文件中重复` });
      continue;
    }

    try {
      let existing;
      if (first.playerId) {
        [existing] = await context.db.select().from(players).where(eq(players.id, first.playerId)).limit(1);
        if (!existing) {
          results.push({ name: first.name, status: "error", detail: `档案 ID ${first.playerId} 不存在` });
          continue;
        }
      } else if (first.classYear) {
        const matches = await context.db.select().from(players)
          .where(and(eq(players.name, first.name), eq(players.classYear, first.classYear))).limit(2);
        if (matches.length > 1) {
          results.push({ name: first.name, status: "error", detail: "存在同名同年级档案，请填写档案 ID 后重试" });
          continue;
        }
        [existing] = matches;
      }

      let playerId: number;
      if (existing) {
        playerId = existing.id;
        const latestCandidate = [
          ...(await context.db.select().from(playerSeasonRecords).where(eq(playerSeasonRecords.playerId, playerId))),
          ...group,
        ].sort((a, b) => b.season.localeCompare(a.season, "zh-CN", { numeric: true }))[0];
        if (!latestCandidate) throw new Error("Missing season record after import");
        const [firstGroupRecord, ...remainingGroupRecords] = group;
        const operations = [
          context.db.insert(playerSeasonRecords).values({
            playerId,
            season: firstGroupRecord.season,
            jerseyNumber: firstGroupRecord.jerseyNumber,
            position: firstGroupRecord.position,
            role: firstGroupRecord.role,
          }).onConflictDoUpdate({
            target: [playerSeasonRecords.playerId, playerSeasonRecords.season],
            set: { jerseyNumber: firstGroupRecord.jerseyNumber, position: firstGroupRecord.position, role: firstGroupRecord.role },
          }),
          ...remainingGroupRecords.map((record) => context.db.insert(playerSeasonRecords).values({
            playerId,
            season: record.season,
            jerseyNumber: record.jerseyNumber,
            position: record.position,
            role: record.role,
          }).onConflictDoUpdate({
            target: [playerSeasonRecords.playerId, playerSeasonRecords.season],
            set: { jerseyNumber: record.jerseyNumber, position: record.position, role: record.role },
          })),
          context.db.update(players).set({
          season: latestCandidate.season,
          jerseyNumber: latestCandidate.jerseyNumber,
          position: latestCandidate.position,
          role: latestCandidate.role,
          name: first.name || existing.name,
          classYear: first.classYear || existing.classYear,
          major: first.major || existing.major,
          note: first.note || existing.note,
          status: "published",
          updatedAt: new Date().toISOString(),
          }).where(eq(players.id, playerId)),
        ] as const;
        await context.db.batch(operations);
        results.push({ name: first.name, status: "updated", detail: `已合并 ${group.length} 条赛季记录` });
      } else {
        const latest = group.slice().sort((a, b) => b.season.localeCompare(a.season, "zh-CN", { numeric: true }))[0];
        const [created] = await context.db.insert(players).values({
          season: latest.season,
          name: first.name,
          jerseyNumber: latest.jerseyNumber,
          position: latest.position,
          role: latest.role,
          major: first.major,
          classYear: first.classYear,
          note: first.note,
          status: "pending",
        }).returning({ id: players.id });
        playerId = created.id;
        try {
          const [firstSeason, ...remainingSeasons] = group;
          const operations = [
            context.db.insert(playerSeasonRecords).values({ playerId, season: firstSeason.season, jerseyNumber: firstSeason.jerseyNumber, position: firstSeason.position, role: firstSeason.role }),
            ...remainingSeasons.map((record) => context.db.insert(playerSeasonRecords).values({ playerId, season: record.season, jerseyNumber: record.jerseyNumber, position: record.position, role: record.role })),
            context.db.update(players).set({ status: "published", updatedAt: new Date().toISOString() }).where(eq(players.id, playerId)),
          ] as const;
          await context.db.batch(operations);
        } catch (error) {
          await context.db.delete(players).where(and(eq(players.id, playerId), eq(players.status, "pending"))).catch(() => undefined);
          throw error;
        }
        results.push({ name: first.name, status: "created", detail: `已创建档案并写入 ${group.length} 个赛季` });
      }
    } catch {
      results.push({ name: first.name, status: "error", detail: "写入失败，其他球员不受影响" });
    }
  }

  const summary = {
    created: results.filter((item) => item.status === "created").length,
    updated: results.filter((item) => item.status === "updated").length,
    errors: results.filter((item) => item.status === "error").length,
  };
  return Response.json({ ok: summary.errors === 0, summary, results }, { status: summary.created + summary.updated ? 200 : 400 });
}
