"use client";

/* Dynamic archive images do not expose dimensions to the browser client. */
/* eslint-disable @next/next/no-img-element */

import { ArrowUpRight, CalendarClock, Check, Images, Link2, Radio, Share2, Sparkles, UsersRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { knownSeasonArchives, teamMoments } from "../../lib/public-content";

type LatestMedia = {
  id: number;
  title: string;
  caption: string;
  season: string;
  imageUrl: string;
};

type LatestSeason = {
  slug: string;
  season: string;
  title: string;
  summary: string;
};

export function ClubPulse() {
  const reduceMotion = useReducedMotion();
  const [latestMedia, setLatestMedia] = useState<LatestMedia | null>(null);
  const [latestSeason, setLatestSeason] = useState<LatestSeason | null>(knownSeasonArchives[knownSeasonArchives.length - 1]);
  const [seasonCount, setSeasonCount] = useState(knownSeasonArchives.length);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetch("/api/media?limit=1", { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch("/api/seasons", { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([mediaResult, seasonResult]) => {
      if (controller.signal.aborted) return;
      if (mediaResult.status === "fulfilled") {
        const item = (mediaResult.value as { media?: LatestMedia[] }).media?.[0];
        if (item?.imageUrl && item.title) setLatestMedia(item);
      }
      if (seasonResult.status === "fulfilled") {
        const items = (seasonResult.value as { seasons?: LatestSeason[] }).seasons ?? [];
        if (items[0]) setLatestSeason(items[0]);
        if (items.length) setSeasonCount(items.length);
      }
    });
    return () => controller.abort();
  }, []);

  async function shareArchive() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "西农机电足球队｜1999 至今",
          text: "机电驱动，绿茵传承。查看球队七冠、赛季、球员与真实影像档案。",
          url: window.location.origin,
        });
        return;
      }
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setCopied(false);
    }
  }

  const feature = latestMedia ?? {
    id: -1,
    title: "九张真实球队影像，已经回到档案中。",
    caption: "从夜场庆祝、赛前围拢到阳光下的比赛瞬间，这批原图将作为球队长期影像资料保存。",
    season: "",
    imageUrl: teamMoments[8].src,
  };

  return (
    <section className="club-pulse section" id="pulse" aria-labelledby="club-pulse-title">
      <header className="club-pulse-header">
        <div><p><Radio aria-hidden="true" /> NOW AT JDFC</p><h2 id="club-pulse-title">球队档案，<br />不是一座静止的展柜。</h2></div>
        <div><span><i aria-hidden="true" /> 持续整理中</span><p>这里只呈现已经确认的球队动态；新影像、赛季资料和球员投稿审核通过后会自动更新。</p></div>
      </header>

      <div className="club-pulse-grid">
        <motion.a
          className="club-pulse-feature"
          href={latestMedia ? "#archive-media" : "#moments"}
          initial={reduceMotion ? false : { opacity: 0, y: 48, clipPath: "inset(9% 0 0 0)" }}
          whileInView={{ opacity: 1, y: 0, clipPath: "inset(0% 0 0 0)" }}
          viewport={{ once: true, amount: .16 }}
          transition={{ duration: .9, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={feature.imageUrl} alt={feature.title} loading="lazy" decoding="async" />
          <span className="club-pulse-feature-shade" />
          <div><p><Images aria-hidden="true" /> {latestMedia ? "LATEST PUBLISHED MEDIA" : "NEW ARCHIVE DROP"}</p><h3>{feature.title}</h3><span>{feature.caption}</span><strong>进入球队影像 <ArrowUpRight aria-hidden="true" /></strong></div>
        </motion.a>

        <div className="club-pulse-cards">
          <a href={latestSeason ? `/seasons/${encodeURIComponent(latestSeason.slug)}` : "#season-stories"}>
            <span><CalendarClock aria-hidden="true" /> 最新赛季主页</span>
            <strong>{latestSeason?.season || "—"}</strong>
            <h3>{latestSeason?.title || "赛季资料仍在整理"}</h3>
            <p>{latestSeason?.summary || "确认后再公开，不用猜测补齐历史。"}</p>
            <i>打开赛季档案 <ArrowUpRight aria-hidden="true" /></i>
          </a>
          <a href="#player-submit">
            <span><UsersRound aria-hidden="true" /> 球员档案开放填报</span>
            <strong>{seasonCount}</strong>
            <h3>个冠军赛季主页已建立</h3>
            <p>球员可按每一年分别提交号码、位置与身份，由管理员审核后公开。</p>
            <i>提交我的档案 <ArrowUpRight aria-hidden="true" /></i>
          </a>
          <a href="#contribute">
            <span><Sparkles aria-hidden="true" /> 长期资料征集</span>
            <strong>{teamMoments.length}</strong>
            <h3>张本轮新增真实影像</h3>
            <p>还缺历届名单、球衣正背面、证书、赛程和更多原始合影。</p>
            <i>补全球队历史 <ArrowUpRight aria-hidden="true" /></i>
          </a>
          <button type="button" onClick={() => void shareArchive()}>
            <span>{copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />} SHARE THE ARCHIVE</span>
            <h3>{copied ? "首页链接已复制" : "把这支球队，分享给老队友。"}</h3>
            <p>支持手机系统分享；不支持时会复制网站链接。</p>
            <i>{copied ? "现在可以发给队友" : <>分享网站 <Link2 aria-hidden="true" /></>}</i>
          </button>
        </div>
      </div>

      <footer className="club-pulse-note"><i aria-hidden="true" /><p><strong>赛程与招新信息尚未建立可信数据源。</strong><span>在球队确认时间、地点和联系人之前，网站不会显示虚假的倒计时或报名入口。</span></p></footer>
    </section>
  );
}
