"use client";

import { ArrowUpRight, Camera, Expand, Filter, Images } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useMobileViewport } from "../hooks/useMobileViewport";

const PublicMediaLightbox = lazy(() => import("./PublicMediaLightbox"));

type PublicMediaItem = {
  id: string;
  title: string;
  caption: string;
  season: string;
  squad: string;
  credit: string;
  source: string;
  publishedAt: string;
  updatedAt: string;
  imageUrl: string;
};

type MediaResponse = {
  media?: unknown;
};

const squadNames: Record<string, string> = {
  "men-futsal": "男子五人制",
  "mens-futsal": "男子五人制",
  "men-11": "男子十一人制",
  "men-xi": "男子十一人制",
  "mens-xi": "男子十一人制",
  "women-futsal": "女子五人制",
  "womens-futsal": "女子五人制",
  mixed: "综合 / 全队",
  other: "其他队别",
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMedia(value: unknown): PublicMediaItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "number" ? String(item.id) : text(item.id);
  const title = text(item.title);
  if (!id || !title) return null;

  return {
    id,
    title,
    caption: text(item.caption),
    season: text(item.season),
    squad: text(item.squad),
    credit: text(item.credit),
    source: text(item.source),
    publishedAt: text(item.publishedAt),
    updatedAt: text(item.updatedAt),
    imageUrl: text(item.imageUrl),
  };
}

function squadLabel(squad: string) {
  return squadNames[squad.toLowerCase()] ?? squad;
}

function imageUrl(item: PublicMediaItem) {
  if (item.imageUrl.startsWith("/") || /^https?:\/\//i.test(item.imageUrl)) return item.imageUrl;
  return `/api/media/${encodeURIComponent(item.id)}/file`;
}

function sourceUrl(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function PublicMediaArchive() {
  const reduceMotion = useReducedMotion();
  const isMobile = useMobileViewport();
  const [items, setItems] = useState<PublicMediaItem[]>([]);
  const [season, setSeason] = useState("all");
  const [squad, setSquad] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/media?limit=200", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load public media");
        return response.json() as Promise<MediaResponse>;
      })
      .then((payload) => {
        const media = Array.isArray(payload.media)
          ? payload.media.map(normalizeMedia).filter((item): item is PublicMediaItem => item !== null)
          : [];
        setItems(media);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setItems([]);
      });

    return () => controller.abort();
  }, []);

  const seasons = useMemo(() => (
    [...new Set(items.map((item) => item.season).filter(Boolean))]
      .sort((left, right) => right.localeCompare(left, "zh-CN", { numeric: true }))
  ), [items]);

  const squads = useMemo(() => (
    [...new Set(items.map((item) => item.squad).filter(Boolean))]
      .sort((left, right) => squadLabel(left).localeCompare(squadLabel(right), "zh-CN"))
  ), [items]);

  const visibleItems = useMemo(() => items.filter((item) => (
    (season === "all" || item.season === season) && (squad === "all" || item.squad === squad)
  )), [items, season, squad]);
  const renderedItems = visibleItems.slice(0, visibleCount);

  const slides = visibleItems.map((item) => ({
    src: imageUrl(item),
    alt: item.title,
    title: item.title,
    description: [
      item.caption,
      item.credit ? `图像署名：${item.credit}` : "",
      item.source ? `资料来源：${item.source}` : "",
    ].filter(Boolean).join(" · "),
  }));
  const activeIndex = activeId ? visibleItems.findIndex((item) => item.id === activeId) : -1;

  // The public archive should not leave an empty shell on the homepage while
  // the first approved records are still being prepared, or if the API is offline.
  if (!items.length) return null;

  const chooseSeason = (value: string) => {
    setActiveId(null);
    setSeason(value);
    setVisibleCount(isMobile ? 6 : 12);
  };
  const chooseSquad = (value: string) => {
    setActiveId(null);
    setSquad(value);
    setVisibleCount(isMobile ? 6 : 12);
  };

  return (
    <section className="public-media-archive section" id="archive-media">
      <div className="section-head section-head--light">
        <p className="kicker">06 / PUBLIC MEDIA ARCHIVE</p>
        <p className="section-index">仅展示已审核并获准公开的资料</p>
      </div>

      <div className="public-media-intro">
        <div>
          <p><Images aria-hidden="true" /> TEAM MEMORY, VERIFIED</p>
          <h2>让散落的影像，<br />回到它属于的赛季。</h2>
        </div>
        <div>
          <p>按赛季和队别翻阅球队已经整理公开的影像。照片的说明、来源与署名会随资料核实持续补充。</p>
          <a href="#contribute">补充照片或档案 <ArrowUpRight aria-hidden="true" /></a>
        </div>
      </div>

      {(seasons.length > 1 || squads.length > 1) ? (
        <div className="public-media-filters" aria-label="筛选公共影像档案">
          {seasons.length > 1 ? (
            <div className="public-media-filter" role="group" aria-label="按赛季筛选">
              <span><Filter aria-hidden="true" /> 赛季</span>
              <div>
                <button type="button" aria-pressed={season === "all"} onClick={() => chooseSeason("all")}>全部</button>
                {seasons.map((item) => (
                  <button type="button" aria-pressed={season === item} onClick={() => chooseSeason(item)} key={item}>{item}</button>
                ))}
              </div>
            </div>
          ) : null}
          {squads.length > 1 ? (
            <div className="public-media-filter" role="group" aria-label="按队别筛选">
              <span><Camera aria-hidden="true" /> 队别</span>
              <div>
                <button type="button" aria-pressed={squad === "all"} onClick={() => chooseSquad("all")}>全部</button>
                {squads.map((item) => (
                  <button type="button" aria-pressed={squad === item} onClick={() => chooseSquad(item)} key={item}>{squadLabel(item)}</button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleItems.length ? (
        <div className="public-media-grid" aria-live="polite">
          {renderedItems.map((item, index) => {
            const link = sourceUrl(item.source);
            return (
              <motion.article
                className="public-media-card"
                key={item.id}
                initial={reduceMotion ? false : { opacity: 0, y: 58, clipPath: "inset(8% 0 0 0)" }}
                whileInView={{ opacity: 1, y: 0, clipPath: "inset(0% 0 0 0)" }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: isMobile ? 0.58 : 0.78, delay: reduceMotion ? 0 : Math.min(index % (isMobile ? 2 : 3), 2) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <button className="public-media-preview" type="button" onClick={() => setActiveId(item.id)} aria-label={`查看大图：${item.title}`}>
                  {/* The archive endpoint serves dynamic R2 assets without known dimensions. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(item)} alt={item.title} loading="lazy" />
                  <span className="public-media-expand"><Expand aria-hidden="true" /> 查看大图</span>
                  {(item.season || item.squad) ? (
                    <span className="public-media-tags">
                      {item.season ? <b>{item.season}</b> : null}
                      {item.squad ? <b>{squadLabel(item.squad)}</b> : null}
                    </span>
                  ) : null}
                </button>
                <div className="public-media-copy">
                  <h3>{item.title}</h3>
                  {item.caption ? <p>{item.caption}</p> : null}
                  {(item.credit || item.source) ? (
                    <footer>
                      {item.credit ? <span>图像署名：{item.credit}</span> : null}
                      {item.source ? (
                        link
                          ? <a href={link} target="_blank" rel="noreferrer">资料来源 <ArrowUpRight aria-hidden="true" /></a>
                          : <span>资料来源：{item.source}</span>
                      ) : null}
                    </footer>
                  ) : null}
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        <div className="public-media-no-match" role="status">
          <strong>这个筛选组合暂时没有影像。</strong>
          <button type="button" onClick={() => { chooseSeason("all"); setSquad("all"); }}>查看全部档案</button>
        </div>
      )}

      {renderedItems.length < visibleItems.length ? (
        <div className="public-media-load-more">
          <p aria-live="polite">已显示 {renderedItems.length} / {visibleItems.length} 张</p>
          <button type="button" onClick={() => setVisibleCount((count) => count + (isMobile ? 6 : 12))}>
            加载更多影像 <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {activeIndex >= 0 ? (
        <Suspense fallback={null}>
          <PublicMediaLightbox
            index={activeIndex}
            slides={slides}
            reduceMotion={Boolean(reduceMotion)}
            onClose={() => setActiveId(null)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
