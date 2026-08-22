import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const admins = sqliteTable("admins", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const players = sqliteTable(
  "players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    season: text("season").notNull(),
    name: text("name").notNull(),
    jerseyNumber: text("jersey_number").notNull().default(""),
    position: text("position").notNull().default(""),
    role: text("role").notNull().default("队员"),
    major: text("major").notNull().default(""),
    classYear: text("class_year").notNull().default(""),
    note: text("note").notNull().default(""),
    photoKey: text("photo_key").notNull().default(""),
    photoFileName: text("photo_file_name").notNull().default(""),
    photoContentType: text("photo_content_type").notNull().default(""),
    status: text("status").notNull().default("published"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_players_status_season").on(table.status, table.season),
    index("idx_players_name").on(table.name),
    index("idx_players_jersey_number").on(table.jerseyNumber),
  ],
);

export const playerSeasonRecords = sqliteTable(
  "player_season_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    season: text("season").notNull(),
    jerseyNumber: text("jersey_number").notNull().default(""),
    position: text("position").notNull().default(""),
    role: text("role").notNull().default("队员"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_player_season_records_player_season").on(table.playerId, table.season),
    index("idx_player_season_records_season").on(table.season),
    index("idx_player_season_records_jersey_number").on(table.jerseyNumber),
  ],
);

export const playerProfileSubmissions = sqliteTable(
  "player_profile_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull().default("create"),
    targetPlayerId: integer("target_player_id").references(() => players.id, { onDelete: "set null" }),
    season: text("season").notNull(),
    name: text("name").notNull(),
    jerseyNumber: text("jersey_number").notNull().default(""),
    position: text("position").notNull().default(""),
    role: text("role").notNull().default("队员"),
    major: text("major").notNull().default(""),
    classYear: text("class_year").notNull().default(""),
    contact: text("contact").notNull().default(""),
    note: text("note").notNull().default(""),
    photoKey: text("photo_key").notNull().default(""),
    photoFileName: text("photo_file_name").notNull().default(""),
    photoContentType: text("photo_content_type").notNull().default(""),
    photoFileSize: integer("photo_file_size").notNull().default(0),
    authorUserId: text("author_user_id"),
    consentVersion: text("consent_version"),
    consentedAt: text("consented_at"),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_player_profile_submissions_status_created_at").on(table.status, table.createdAt),
    index("idx_player_profile_submissions_name").on(table.name),
    index("idx_player_profile_submissions_target_player_id").on(table.targetPlayerId),
  ],
);

export const playerSubmissionSeasonRecords = sqliteTable(
  "player_submission_season_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id").notNull().references(() => playerProfileSubmissions.id, { onDelete: "cascade" }),
    season: text("season").notNull(),
    jerseyNumber: text("jersey_number").notNull().default(""),
    position: text("position").notNull().default(""),
    role: text("role").notNull().default("队员"),
  },
  (table) => [
    uniqueIndex("idx_player_submission_seasons_submission_season").on(table.submissionId, table.season),
    index("idx_player_submission_seasons_season").on(table.season),
  ],
);

export const guestbookMessages = sqliteTable(
  "guestbook_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    years: text("years").notNull().default(""),
    role: text("role").notNull().default("老队员"),
    content: text("content").notNull(),
    authorUserId: text("author_user_id"),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_guestbook_status_created_at").on(table.status, table.createdAt),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submitterName: text("submitter_name").notNull(),
    contact: text("contact").notNull().default(""),
    title: text("title").notNull(),
    season: text("season").notNull().default(""),
    note: text("note").notNull().default(""),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    authorUserId: text("author_user_id"),
    consentVersion: text("consent_version"),
    consentedAt: text("consented_at"),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_submissions_status_created_at").on(table.status, table.createdAt),
  ],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    caption: text("caption").notNull().default(""),
    season: text("season").notNull().default(""),
    squad: text("squad").notNull().default("other"),
    credit: text("credit").notNull().default(""),
    source: text("source").notNull().default(""),
    rightsStatus: text("rights_status").notNull().default("pending"),
    rightsReviewedBy: text("rights_reviewed_by"),
    rightsReviewedAt: text("rights_reviewed_at"),
    rightsRevokedAt: text("rights_revoked_at"),
    status: text("status").notNull().default("draft"),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_media_assets_submission_id").on(table.submissionId),
    index("idx_media_assets_status_published_at").on(table.status, table.publishedAt),
    index("idx_media_assets_season_squad_status").on(table.season, table.squad, table.status),
  ],
);

export const seasonArchives = sqliteTable(
  "season_archives",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    season: text("season").notNull(),
    squad: text("squad").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    story: text("story").notNull().default(""),
    status: text("status").notNull().default("draft"),
    coverMediaId: integer("cover_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_season_archives_season_squad").on(table.season, table.squad),
    uniqueIndex("idx_season_archives_slug").on(table.slug),
    index("idx_season_archives_status_season").on(table.status, table.season),
  ],
);

export const publicFormRateLimits = sqliteTable(
  "public_form_rate_limits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    form: text("form").notNull(),
    fingerprint: text("fingerprint").notNull(),
    windowStart: text("window_start").notNull(),
    count: integer("count").notNull().default(1),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_public_form_rate_limits_window").on(table.form, table.fingerprint, table.windowStart),
    index("idx_public_form_rate_limits_updated_at").on(table.updatedAt),
  ],
);
