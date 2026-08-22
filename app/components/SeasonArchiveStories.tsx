"use client";

import { ArrowUpRight, CalendarDays, ChevronRight, ShieldCheck, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SeasonArchive = {
  id: number;
  season: string;
  squad: string;
  slug: string;
  title: string;
  summary: string;
  story: string;
  coverMediaId: number | null;
  coverImageUrl: string | null;
  foundation?: boolean;
};

const squadNames: Record<string, string> = {
  "men-futsal": "男子五人制",
  "men-11": "男子十一人制",
  "women-futsal": "女子五人制",
  mixed: "综合 / 全队",
  other: "其他队别",
};

function squadLabel(value: string) {
  return squadNames[value] ?? "队别待确认";
}

export function SeasonArchiveStories() {
  const [items, setItems] = useState<SeasonArchive[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/seasons", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Season archive unavailable");
        return await response.json() as { seasons?: SeasonArchive[] };
      })
      .then((result) => setItems(result.seasons ?? []))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setItems([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const selectSeason = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (detail?.slug) setSelectedSlug(detail.slug);
    };
    window.addEventListener("jdfc:select-season", selectSeason);
    return () => window.removeEventListener("jdfc:select-season", selectSeason);
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.slug === selectedSlug) ?? items[0] ?? null,
    [items, selectedSlug],
  );

  if (!selected) return null;

  return (
    <section className="season-stories section" id="season-stories">
      <div className="section-head">
        <p className="kicker">05 / SEASON ARCHIVE</p>
        <p className="section-index">按队别保存，不让记忆混在一起</p>
      </div>

      <div className="season-stories-intro">
        <div>
          <p><CalendarDays aria-hidden="true" /> STRUCTURED HISTORY</p>
          <h2>每一届球队，<br />都有自己的名字。</h2>
        </div>
        <p>男子五人制、男子十一人制与女子五人制分别建档。资料不完整的赛季会先保留骨架，等待亲历者慢慢补齐。</p>
      </div>

      <div className="season-story-layout">
        <nav className="season-story-index" aria-label="选择公开赛季档案">
          {items.map((item) => (
            <button type="button" aria-pressed={selected.slug === item.slug} onClick={() => setSelectedSlug(item.slug)} key={item.id}>
              <span><b>{item.season}</b><small>{squadLabel(item.squad)}</small></span>
              <strong>{item.title}</strong>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </nav>

        <article className="season-story-feature" key={selected.slug}>
          <div className="season-story-cover">
            {selected.coverImageUrl ? <img src={selected.coverImageUrl} alt={`${selected.title}赛季档案封面`} /> : <span><Trophy aria-hidden="true" /><b>{selected.season}</b><small>影像待补充</small></span>}
            <div><b>{selected.season}</b><span>{squadLabel(selected.squad)}</span></div>
          </div>
          <div className="season-story-copy">
            <p><ShieldCheck aria-hidden="true" /> {selected.foundation ? "已确认荣誉 · 资料持续补充" : "已由球队档案管理员发布"}</p>
            <h3>{selected.title}</h3>
            {selected.summary ? <strong>{selected.summary}</strong> : <strong>这一赛季的摘要仍在整理中。</strong>}
            {selected.story ? <div className="season-story-text">{selected.story.split(/\n+/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div> : <p className="season-story-pending">详细故事、阵容与比赛资料会随着投稿继续补充。</p>}
            <div className="season-story-actions">
              <a href={`/seasons/${encodeURIComponent(selected.slug)}`}>打开完整赛季主页 <ArrowUpRight aria-hidden="true" /></a>
              <a href="#contribute">我能补充这一赛季 <ArrowUpRight aria-hidden="true" /></a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
