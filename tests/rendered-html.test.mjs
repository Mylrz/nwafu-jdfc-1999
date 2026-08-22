import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const file = (path) => new URL(`../${path}`, import.meta.url);

test("contains the finished JDFC memorial content", async () => {
  const [page, layout, roster, carousel, galleryWall, clubHub, packageJson] = await Promise.all([
    readFile(file("app/page.tsx"), "utf8"),
    readFile(file("app/layout.tsx"), "utf8"),
    readFile(file("app/components/RosterArchive.tsx"), "utf8"),
    readFile(file("app/components/ChampionCarousel.tsx"), "utf8"),
    readFile(file("app/components/AutoGalleryWall.tsx"), "utf8"),
    readFile(file("app/components/ClubHub.tsx"), "utf8"),
    readFile(file("package.json"), "utf8"),
  ]);

  assert.match(page, /1999/);
  assert.match(page, /2025.*男子 \/ 女子五人制冠军.*five-years\.jpg/);
  assert.match(page, /六组冠军影像/);
  assert.match(page, /<RosterArchive \/>/);
  assert.match(layout, /西农机电足球队/);
  assert.match(layout, /og-v9\.png/);
  assert.match(roster, /PlayerProfileSubmission/);
  assert.match(carousel, /useEmblaCarousel/);
  assert.match(carousel, /上一组冠军影像/);
  assert.match(page, /<AutoGalleryWall items=\{gallery\} \/>/);
  assert.match(galleryWall, /LIVE GALLERY WALL/);
  assert.match(galleryWall, /\/api\/media\?limit=8/);
  assert.match(galleryWall, /暂停流动/);
  assert.match(page, /<ClubHub \/>/);
  assert.match(clubHub, /搜索整个球队档案/);
  assert.match(clubHub, /jdfc:focus-player/);
  assert.match(clubHub, /JDFC CLUB HUB/);
  assert.match(packageJson, /lucide-react/);
});

test("keeps player contributions reviewed and durable", async () => {
  const [schema, publicForm, publicApi, rosterApi, admin, adminApi, migration, seasonMigration] = await Promise.all([
    readFile(file("db/schema.ts"), "utf8"),
    readFile(file("app/components/PlayerProfileSubmission.tsx"), "utf8"),
    readFile(file("app/api/player-submissions/route.ts"), "utf8"),
    readFile(file("app/api/players/route.ts"), "utf8"),
    readFile(file("app/admin/AdminDashboard.tsx"), "utf8"),
    readFile(file("app/api/admin/player-submissions/route.ts"), "utf8"),
    readFile(file("drizzle/0001_ambitious_blockbuster.sql"), "utf8"),
    readFile(file("drizzle/0002_smart_stardust.sql"), "utf8"),
  ]);

  assert.match(schema, /playerProfileSubmissions/);
  assert.match(publicForm, /资料已提交|提交审核/);
  assert.match(publicForm, /逐年球衣记录/);
  assert.match(publicForm, /添加另一个赛季/);
  assert.match(publicApi, /player-profiles\//);
  assert.match(publicApi, /consent/);
  assert.match(publicApi, /playerSubmissionSeasonRecords/);
  assert.match(rosterApi, /seasonRecords/);
  assert.match(admin, /审核通过并入库/);
  assert.match(admin, /导出 CSV/);
  assert.match(admin, /expectedUpdatedAt/);
  assert.match(admin, /AdminOverview/);
  assert.match(admin, /ProfileDiffPanel/);
  assert.match(adminApi, /playerSeasonRecords/);
  assert.match(migration, /player_profile_submissions/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(schema, /playerSeasonRecords/);
  assert.match(seasonMigration, /INSERT OR IGNORE INTO `player_season_records`/);
  assert.match(seasonMigration, /PRAGMA optimize/);

  const previewFiles = await readdir(file("app/_sites-preview")).catch(() => []);
  assert.deepEqual(previewFiles, []);
});

test("publishes verified media through a protected archive workflow", async () => {
  const [
    page,
    publicArchive,
    seasonStories,
    adminArchive,
    schema,
    mediaApi,
    adminMediaApi,
    adminSubmissionApi,
    adminSeasonApi,
    fileValidation,
    formSecurity,
    migration,
    consentMigration,
  ] = await Promise.all([
    readFile(file("app/page.tsx"), "utf8"),
    readFile(file("app/components/PublicMediaArchive.tsx"), "utf8"),
    readFile(file("app/components/SeasonArchiveStories.tsx"), "utf8"),
    readFile(file("app/admin/ArchiveWorkspace.tsx"), "utf8"),
    readFile(file("db/schema.ts"), "utf8"),
    readFile(file("app/api/media/route.ts"), "utf8"),
    readFile(file("app/api/admin/media/route.ts"), "utf8"),
    readFile(file("app/api/admin/submissions/route.ts"), "utf8"),
    readFile(file("app/api/admin/seasons/route.ts"), "utf8"),
    readFile(file("lib/file-validation.ts"), "utf8"),
    readFile(file("lib/public-form-security.ts"), "utf8"),
    readFile(file("drizzle/0004_naive_vector.sql"), "utf8"),
    readFile(file("drizzle/0005_kind_colossus.sql"), "utf8"),
  ]);

  assert.match(page, /<PublicMediaArchive \/>/);
  assert.match(page, /<SeasonArchiveStories \/>/);
  assert.match(publicArchive, /仅展示已审核并获准公开的资料/);
  assert.match(publicArchive, /\/api\/media\?limit=200/);
  assert.match(seasonStories, /\/api\/seasons/);
  assert.match(adminArchive, /确认投稿者拥有投稿权/);
  assert.match(adminArchive, /男子五人制/);
  assert.match(schema, /mediaAssets/);
  assert.match(schema, /seasonArchives/);
  assert.match(schema, /publicFormRateLimits/);
  assert.match(mediaApi, /eq\(mediaAssets\.status, "published"\)/);
  assert.doesNotMatch(mediaApi, /fileKey:\s*mediaAssets\.fileKey/);
  assert.match(adminMediaApi, /rightsStatus !== "cleared"/);
  assert.match(adminMediaApi, /rightsReviewedBy/);
  assert.match(adminMediaApi, /HEIC 需要先转换为 JPG 或 WebP/);
  assert.match(adminSubmissionApi, /NOT EXISTS/);
  assert.match(adminSeasonApi, /cover\.rightsStatus !== "cleared"/);
  assert.match(fileValidation, /%PDF-/);
  assert.match(fileValidation, /RIFF/);
  assert.match(formSecurity, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(formSecurity, /status: 429/);
  assert.match(migration, /CREATE TABLE `media_assets`/);
  assert.match(migration, /CREATE TABLE `season_archives`/);
  assert.match(migration, /CREATE TABLE `public_form_rate_limits`/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(consentMigration, /rights_reviewed_by/);
  assert.match(consentMigration, /consent_version/);
});

test("keeps the six public archive goals visible and evidence based", async () => {
  const [
    page,
    publicContent,
    pulse,
    galleryWall,
    kitMuseum,
    seasonPage,
    sitemap,
    header,
  ] = await Promise.all([
    readFile(file("app/page.tsx"), "utf8"),
    readFile(file("lib/public-content.ts"), "utf8"),
    readFile(file("app/components/ClubPulse.tsx"), "utf8"),
    readFile(file("app/components/AutoGalleryWall.tsx"), "utf8"),
    readFile(file("app/components/KitMuseum.tsx"), "utf8"),
    readFile(file("app/seasons/[slug]/page.tsx"), "utf8"),
    readFile(file("app/sitemap.ts"), "utf8"),
    readFile(file("app/components/SiteHeader.tsx"), "utf8"),
  ]);
  const momentFiles = (await readdir(file("public/team/moments"))).filter((name) => name.endsWith(".jpg"));

  assert.equal(momentFiles.length, 9);
  assert.match(page, /<ClubPulse \/>/);
  assert.match(page, /\.\.\.teamMoments/);
  assert.match(publicContent, /night-celebration-toss\.jpg/);
  assert.match(publicContent, /trophy-lineup\.jpg/);
  assert.equal((publicContent.match(/foundation\(-20/g) ?? []).length, 7);
  assert.match(pulse, /新影像、赛季资料和球员投稿审核通过后会自动更新/);
  assert.match(galleryWall, /PublicMediaLightbox/);
  assert.match(kitMuseum, /kitEvidence/);
  assert.match(seasonPage, /不作为本赛季的年份证据/);
  assert.match(seasonPage, /alternates: \{ canonical:/);
  assert.match(sitemap, /knownSeasonArchives/);
  assert.match(header, /提交或修改我的球员档案/);
});
