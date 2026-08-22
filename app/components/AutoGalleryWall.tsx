"use client";

import { Expand, Images, Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useMobileViewport } from "../hooks/useMobileViewport";

const PublicMediaLightbox = lazy(() => import("./PublicMediaLightbox"));

export type GalleryWallItem = {
  src: string;
  alt: string;
  label: string;
  meta: string;
};

type PublicMediaItem = {
  id?: number;
  title?: string;
  caption?: string;
  season?: string;
  squad?: string;
  imageUrl?: string;
};

const squadNames: Record<string, string> = {
  "men-futsal": "男子五人制",
  "men-11": "男子十一人制",
  "women-futsal": "女子五人制",
  mixed: "综合全队",
  other: "球队影像",
};

function WallSequence({ items, duplicate, row, onSelect }: {
  items: readonly GalleryWallItem[];
  duplicate?: boolean;
  row: number;
  onSelect: (item: GalleryWallItem) => void;
}) {
  return (
    <div className="gallery-wall-sequence" aria-hidden={duplicate || undefined}>
      {items.map((item, index) => (
        <figure className="gallery-wall-card" key={`${row}-${duplicate ? "copy" : "main"}-${item.src}-${index}`}>
          <button type="button" tabIndex={duplicate ? -1 : 0} onClick={() => onSelect(item)} aria-label={`全屏查看：${item.label}`}>
            {/* Static team images and reviewed R2 assets do not share a compatible image loader. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt={duplicate ? "" : item.alt} loading="lazy" decoding="async" />
            <span><Expand aria-hidden="true" /> 查看大图</span>
          </button>
          <figcaption>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function AutoGalleryWall({ items }: { items: readonly GalleryWallItem[] }) {
  const reduceMotion = useReducedMotion();
  const isMobile = useMobileViewport();
  const [publicItems, setPublicItems] = useState<GalleryWallItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/media?limit=8", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gallery unavailable");
        return await response.json() as { media?: PublicMediaItem[] };
      })
      .then((payload) => {
        const reviewed = Array.isArray(payload.media)
          ? payload.media.flatMap((item) => {
              const src = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
              const label = typeof item.title === "string" ? item.title.trim() : "";
              if (!src || !label) return [];
              const season = typeof item.season === "string" ? item.season.trim() : "";
              const squad = typeof item.squad === "string" ? squadNames[item.squad] ?? item.squad : "";
              const caption = typeof item.caption === "string" ? item.caption.trim() : "";
              return [{
                src,
                alt: label,
                label,
                meta: [season, squad, caption].filter(Boolean).slice(0, 2).join(" · ") || "已审核球队影像",
              }];
            })
          : [];
        setPublicItems(reviewed);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPublicItems([]);
      });
    return () => controller.abort();
  }, []);

  const allItems = useMemo(() => {
    const seen = new Set<string>();
    return [...items, ...publicItems].filter((item) => {
      if (seen.has(item.src)) return false;
      seen.add(item.src);
      return true;
    });
  }, [items, publicItems]);

  const tracks = useMemo(() => {
    const trackCount = isMobile ? 2 : 3;
    return Array.from({ length: trackCount }, (_, row) => (
      allItems.filter((_, index) => index % trackCount === row)
    )).filter((track) => track.length);
  }, [allItems, isMobile]);

  const slides = allItems.map((item) => ({
    src: item.src,
    alt: item.alt,
    title: item.label,
    description: item.meta,
  }));
  const activeIndex = activeSrc ? allItems.findIndex((item) => item.src === activeSrc) : -1;

  const motionPaused = paused || Boolean(reduceMotion);

  return (
    <div className="auto-gallery-wall" data-paused={motionPaused ? "true" : "false"}>
      <header className="gallery-wall-toolbar">
        <div>
          <span><i aria-hidden="true" /> LIVE GALLERY WALL</span>
          <strong><Images aria-hidden="true" /> 蓝色记忆正在放映</strong>
        </div>
        <button
          type="button"
          aria-pressed={motionPaused}
          disabled={Boolean(reduceMotion)}
          onClick={() => setPaused((value) => !value)}
        >
          {motionPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {reduceMotion ? "已遵循系统减少动态" : paused ? "继续流动" : "暂停流动"}
        </button>
      </header>

      <div className="gallery-wall-viewport" aria-label="自动流动的球队图库墙">
        {tracks.map((track, row) => (
          <div className="gallery-wall-row" data-row={row + 1} key={row}>
            <div className="gallery-wall-track">
              <WallSequence items={track} row={row} onSelect={(item) => setActiveSrc(item.src)} />
              {!reduceMotion ? <WallSequence items={track} duplicate row={row} onSelect={(item) => setActiveSrc(item.src)} /> : null}
            </div>
          </div>
        ))}
      </div>

      <footer className="gallery-wall-footer">
        <p>{publicItems.length ? `已自动汇入 ${publicItems.length} 张审核通过的投稿影像。` : "球队精选影像会持续流动展示；审核通过的新投稿将自动加入。"}</p>
        <a href={publicItems.length ? "#archive-media" : "#contribute"}>
          {publicItems.length ? "进入可筛选影像档案" : "投稿补充图库"} <span aria-hidden="true">↗</span>
        </a>
      </footer>

      {activeIndex >= 0 ? (
        <Suspense fallback={null}>
          <PublicMediaLightbox
            index={activeIndex}
            slides={slides}
            reduceMotion={Boolean(reduceMotion)}
            onClose={() => setActiveSrc(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
