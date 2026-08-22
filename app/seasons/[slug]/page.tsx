import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight, CalendarDays, Camera, ShieldCheck, Shirt, Trophy, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { mediaAssets, players, playerSeasonRecords, seasonArchives } from "../../../db/schema";
import { knownSeasonArchives, teamMoments } from "../../../lib/public-content";
import { SeasonShare } from "./SeasonShare";
import styles from "./season.module.css";

export const dynamic = "force-dynamic";

const siteUrl = "https://nwafu-jdfc-1999.mylrz.chatgpt.site";

const squadNames: Record<string, string> = {
  "men-futsal": "男子五人制",
  "men-11": "男子十一人制",
  "women-futsal": "女子五人制",
  mixed: "综合 / 全队",
  other: "其他队别",
};

type ArchiveRecord = {
  id: number;
  season: string;
  squad: string;
  slug: string;
  title: string;
  summary: string;
  story: string;
  coverMediaId: number | null;
  coverImageUrl: string | null;
  foundation: boolean;
  updatedAt: string;
};

async function readArchive(slug: string): Promise<ArchiveRecord | null> {
  const fallback = knownSeasonArchives.find((item) => item.slug === slug) ?? null;
  try {
    const [row] = await getDb().select({
      id: seasonArchives.id,
      season: seasonArchives.season,
      squad: seasonArchives.squad,
      slug: seasonArchives.slug,
      title: seasonArchives.title,
      summary: seasonArchives.summary,
      story: seasonArchives.story,
      coverMediaId: seasonArchives.coverMediaId,
      coverPublishedId: mediaAssets.id,
      updatedAt: seasonArchives.updatedAt,
    }).from(seasonArchives)
      .leftJoin(mediaAssets, and(
        eq(seasonArchives.coverMediaId, mediaAssets.id),
        eq(mediaAssets.status, "published"),
        eq(mediaAssets.rightsStatus, "cleared"),
      ))
      .where(and(eq(seasonArchives.slug, slug), eq(seasonArchives.status, "published")))
      .limit(1);

    if (!row) return fallback;
    return {
      id: row.id,
      season: row.season,
      squad: row.squad,
      slug: row.slug,
      title: row.title,
      summary: row.summary || fallback?.summary || "赛季摘要仍在整理中。",
      story: row.story || fallback?.story || "详细赛季故事仍在整理，欢迎亲历者提供资料。",
      coverMediaId: row.coverPublishedId ? row.coverMediaId : null,
      coverImageUrl: row.coverPublishedId ? `/api/media/${row.coverPublishedId}/file` : fallback?.coverImageUrl ?? null,
      foundation: false,
      updatedAt: row.updatedAt,
    };
  } catch {
    return fallback;
  }
}

async function readSeasonMaterial(archive: ArchiveRecord) {
  try {
    const db = getDb();
    const [media, roster] = await Promise.all([
      db.select({
        id: mediaAssets.id,
        title: mediaAssets.title,
        caption: mediaAssets.caption,
        credit: mediaAssets.credit,
      }).from(mediaAssets)
        .where(and(
          eq(mediaAssets.status, "published"),
          eq(mediaAssets.rightsStatus, "cleared"),
          eq(mediaAssets.season, archive.season),
          eq(mediaAssets.squad, archive.squad),
        ))
        .orderBy(desc(mediaAssets.publishedAt), desc(mediaAssets.id))
        .limit(12),
      db.select({
        playerId: players.id,
        name: players.name,
        major: players.major,
        classYear: players.classYear,
        photoKey: players.photoKey,
        jerseyNumber: playerSeasonRecords.jerseyNumber,
        position: playerSeasonRecords.position,
        role: playerSeasonRecords.role,
      }).from(playerSeasonRecords)
        .innerJoin(players, eq(playerSeasonRecords.playerId, players.id))
        .where(and(eq(players.status, "published"), eq(playerSeasonRecords.season, archive.season)))
        .orderBy(asc(players.name), asc(playerSeasonRecords.jerseyNumber))
        .limit(200),
    ]);
    return { media, roster };
  } catch {
    return { media: [], roster: [] };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const archive = await readArchive(decodeURIComponent(slug));
  if (!archive) return { title: "赛季档案｜西农机电足球队" };
  const image = archive.coverImageUrl?.startsWith("http")
    ? archive.coverImageUrl
    : `${siteUrl}${archive.coverImageUrl || "/og-v9.png"}`;
  return {
    title: `${archive.title}｜西农机电足球队`,
    description: archive.summary,
    alternates: { canonical: `${siteUrl}/seasons/${archive.slug}` },
    openGraph: {
      title: archive.title,
      description: archive.summary,
      type: "article",
      locale: "zh_CN",
      url: `${siteUrl}/seasons/${archive.slug}`,
      images: [{ url: image, alt: `${archive.title}赛季档案封面` }],
    },
  };
}

export default async function SeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const archive = await readArchive(decodeURIComponent(slug));
  if (!archive) notFound();
  const { media, roster } = await readSeasonMaterial(archive);
  const squad = squadNames[archive.squad] ?? "队别待确认";
  const paragraphs = archive.story.split(/\n+/).filter(Boolean);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/#season-stories"><ArrowLeft aria-hidden="true" /> 返回球队总档案</Link>
        <div><img src="/team/logo.jpg" alt="JDFC 队徽" /><span>JDFC SEASON ARCHIVE<small>西农机电足球队 · 1999 至今</small></span></div>
        <SeasonShare title={archive.title} />
      </header>

      <section className={styles.hero}>
        <img src={archive.coverImageUrl || "/team/moments/trophy-lineup.jpg"} alt={`${archive.title}赛季档案封面`} />
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <p><span /> VERIFIED SEASON FOUNDATION</p>
          <strong>{archive.season}</strong>
          <h1>{archive.title}</h1>
          <div><span>{squad}</span><span>{archive.foundation ? "已确认荣誉 · 资料待补" : "管理员公开档案"}</span></div>
        </div>
        <a href="#season-story">向下阅读 <span aria-hidden="true">↓</span></a>
      </section>

      <section className={styles.summary} aria-label="赛季概览">
        <article><CalendarDays aria-hidden="true" /><span>赛季</span><strong>{archive.season}</strong></article>
        <article><Trophy aria-hidden="true" /><span>已确认记录</span><strong>冠军</strong></article>
        <article><Shirt aria-hidden="true" /><span>队别</span><strong>{squad}</strong></article>
        <article><ShieldCheck aria-hidden="true" /><span>档案原则</span><strong>只记真实资料</strong></article>
      </section>

      <section className={styles.story} id="season-story">
        <div className={styles.sectionLabel}><span>01</span><p>SEASON STORY</p></div>
        <div className={styles.storyLead}>
          <p>赛季摘要</p>
          <h2>{archive.summary}</h2>
        </div>
        <div className={styles.storyBody}>
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <aside><ShieldCheck aria-hidden="true" /><p><strong>档案可信度说明</strong>目前只公开已经确认的冠军信息；不清楚的比分、名单与比赛过程保持空白，等待亲历者补齐。</p></aside>
        </div>
      </section>

      <section className={styles.roster}>
        <div className={styles.sectionLabel}><span>02</span><p>PLAYER RECORDS</p></div>
        <header><div><UsersRound aria-hidden="true" /><p>同年度公开球员记录</p></div><strong>{roster.length}</strong></header>
        {roster.length ? (
          <>
            <p className={styles.rosterCaveat}>旧档案尚未保存五人制、十一人制或女足队别字段，因此这里暂按“同年度”汇总；管理员核对后会继续细分。</p>
            <div className={styles.rosterGrid}>{roster.map((player) => (
              <article key={`${player.playerId}-${player.jerseyNumber}`}>
                {player.photoKey ? <img src={`/api/players/${player.playerId}/photo`} alt={`${player.name}球员照片`} /> : <span>{player.name.slice(0, 1)}</span>}
                <div><small>{player.role || "队员"}</small><h3>{player.name}</h3><p>{[player.position, player.major, player.classYear].filter(Boolean).join(" · ") || "资料待补充"}</p></div>
                <strong>{player.jerseyNumber || "—"}</strong>
              </article>
            ))}</div>
          </>
        ) : <div className={styles.empty}><UsersRound aria-hidden="true" /><strong>当届公开球员名单仍在征集</strong><p>球员可自行提交姓名、专业、位置和当季号码，管理员核实后会出现在这里。</p><Link href="/#player-submit">提交我的球员档案 <ArrowUpRight aria-hidden="true" /></Link></div>}
      </section>

      <section className={styles.media}>
        <div className={styles.sectionLabel}><span>03</span><p>VERIFIED MEDIA</p></div>
        <header><div><Camera aria-hidden="true" /><p>已关联本赛季的公开影像</p></div><strong>{media.length}</strong></header>
        {media.length ? <div className={styles.mediaGrid}>{media.map((item) => (
          <figure key={item.id}><img src={`/api/media/${item.id}/file`} alt={item.title} /><figcaption><strong>{item.title}</strong><span>{item.caption || item.credit || "球队公开影像"}</span></figcaption></figure>
        ))}</div> : <div className={styles.unverifiedStrip}>
          <p>下面是球队公共影像精选，不作为本赛季的年份证据。待管理员完成赛季标注后，照片才会正式关联到这里。</p>
          <div>{teamMoments.slice(0, 3).map((item) => <figure key={item.src}><img src={item.src} alt={item.alt} /><figcaption>{item.label}</figcaption></figure>)}</div>
        </div>}
      </section>

      <section className={styles.contribute}>
        <p>THIS ARCHIVE NEEDS ITS WITNESSES</p>
        <h2>你在这一届吗？<br />把记得的留在这里。</h2>
        <span>名单、号码、球衣正背面、赛程、证书与赛后合影，都能让这份档案更完整。</span>
        <Link href="/#contribute">补充 {archive.season} 赛季资料 <ArrowUpRight aria-hidden="true" /></Link>
      </section>

      <footer className={styles.footer}><span>JDFC · SINCE 1999</span><Link href="/">西农机电足球队数字档案</Link></footer>
    </main>
  );
}
