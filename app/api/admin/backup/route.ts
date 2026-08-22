import {
  admins,
  guestbookMessages,
  mediaAssets,
  playerProfileSubmissions,
  players,
  playerSeasonRecords,
  playerSubmissionSeasonRecords,
  seasonArchives,
  submissions,
} from "../../../../db/schema";
import { getAdminContext } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return Response.json({ error: "无管理权限" }, { status: 403 });

  const [
    adminRows,
    playerRows,
    playerSeasonRows,
    playerSubmissionRows,
    playerSubmissionSeasonRows,
    guestbookRows,
    archiveSubmissionRows,
    mediaAssetRows,
    seasonArchiveRows,
  ] = await Promise.all([
    context.db.select().from(admins),
    context.db.select().from(players),
    context.db.select().from(playerSeasonRecords),
    context.db.select().from(playerProfileSubmissions),
    context.db.select().from(playerSubmissionSeasonRecords),
    context.db.select().from(guestbookMessages),
    context.db.select().from(submissions),
    context.db.select().from(mediaAssets),
    context.db.select().from(seasonArchives),
  ]);

  const generatedAt = new Date().toISOString();
  const mediaObjects = [
    ...playerRows.filter((row) => row.photoKey).map((row) => ({
      sourceTable: "players",
      recordId: row.id,
      objectKey: row.photoKey,
      fileName: row.photoFileName,
      contentType: row.photoContentType,
      fileSize: null,
    })),
    ...playerSubmissionRows.filter((row) => row.photoKey).map((row) => ({
      sourceTable: "player_profile_submissions",
      recordId: row.id,
      objectKey: row.photoKey,
      fileName: row.photoFileName,
      contentType: row.photoContentType,
      fileSize: row.photoFileSize,
    })),
    ...archiveSubmissionRows.filter((row) => row.fileKey).map((row) => ({
      sourceTable: "submissions",
      recordId: row.id,
      objectKey: row.fileKey,
      fileName: row.fileName,
      contentType: row.contentType,
      fileSize: row.fileSize,
    })),
    ...mediaAssetRows.filter((row) => row.fileKey).map((row) => ({
      sourceTable: "media_assets",
      recordId: row.id,
      objectKey: row.fileKey,
      fileName: row.fileName,
      contentType: row.contentType,
      fileSize: row.fileSize,
    })),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.objectKey === item.objectKey) === index);

  const backup = {
    schemaVersion: 2,
    generatedAt,
    warning: "此备份含管理员身份、投稿联系方式等非公开资料，请妥善保管。",
    tables: {
      admins: adminRows,
      players: playerRows,
      playerSeasonRecords: playerSeasonRows,
      playerProfileSubmissions: playerSubmissionRows,
      playerSubmissionSeasonRecords: playerSubmissionSeasonRows,
      guestbookMessages: guestbookRows,
      submissions: archiveSubmissionRows,
      mediaAssets: mediaAssetRows,
      seasonArchives: seasonArchiveRows,
    },
    mediaManifest: {
      includesBinaryData: false,
      storageBinding: "MEDIA",
      note: "本 JSON 仅列出 R2 媒体对象及其元数据，不包含照片、PDF 等二进制内容；完整灾备还需单独复制对应 R2 对象。",
      objects: mediaObjects,
    },
  };

  const date = generatedAt.slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jdfc-backup-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
