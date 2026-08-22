"use client";

/* The hub mixes static team imagery with reviewed R2 assets of unknown dimensions. */
/* eslint-disable @next/next/no-img-element */

import {
  ArrowUpRight,
  CalendarDays,
  Image as ImageIcon,
  Search,
  Shirt,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PlayerRecord = {
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
};

type HubPlayer = {
  id: number;
  name: string;
  major: string;
  classYear: string;
  note: string;
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
  seasonRecords?: PlayerRecord[];
};

type HubMedia = {
  id: number;
  title: string;
  caption: string;
  season: string;
  squad: string;
  imageUrl: string;
};

type HubSeason = {
  id: number;
  season: string;
  squad: string;
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
};

type HubResult = {
  key: string;
  kind: "player" | "season" | "media" | "shortcut";
  label: string;
  meta: string;
  href: string;
  imageUrl?: string;
  query?: string;
  slug?: string;
};

const squadNames: Record<string, string> = {
  "men-futsal": "男子五人制",
  "men-11": "男子十一人制",
  "women-futsal": "女子五人制",
  mixed: "综合全队",
  other: "其他队别",
};

const shortcuts: HubResult[] = [
  { key: "honours", kind: "shortcut", label: "七冠档案", meta: "2022—2026 · 六组冠军影像", href: "#champion-archive" },
  { key: "kits", kind: "shortcut", label: "历年战袍", meta: "按赛季征集球衣正背面资料", href: "#kits" },
  { key: "guestbook", kind: "shortcut", label: "老队员留言", meta: "把记忆留给下一届", href: "#guestbook" },
  { key: "contribute", kind: "shortcut", label: "资料投稿", meta: "照片、故事与历史资料", href: "#contribute" },
];

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function playerRecords(player: HubPlayer) {
  return player.seasonRecords?.length
    ? player.seasonRecords
    : [{
        season: player.season,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        role: player.role,
      }];
}

function resultIcon(kind: HubResult["kind"]) {
  if (kind === "player") return <UserRound aria-hidden="true" />;
  if (kind === "season") return <CalendarDays aria-hidden="true" />;
  if (kind === "media") return <ImageIcon aria-hidden="true" />;
  return <ArrowUpRight aria-hidden="true" />;
}

async function readJson<T>(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Archive unavailable");
  return await response.json() as T;
}

export function ClubHub() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<HubPlayer[]>([]);
  const [media, setMedia] = useState<HubMedia[]>([]);
  const [seasons, setSeasons] = useState<HubSeason[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      readJson<{ players?: HubPlayer[] }>("/api/players?season=all&q=", controller.signal),
      readJson<{ media?: HubMedia[] }>("/api/media?limit=200", controller.signal),
      readJson<{ seasons?: HubSeason[] }>("/api/seasons", controller.signal),
    ]).then(([playerResult, mediaResult, seasonResult]) => {
      if (controller.signal.aborted) return;
      setPlayers(playerResult.status === "fulfilled" ? playerResult.value.players ?? [] : []);
      setMedia(mediaResult.status === "fulfilled" ? mediaResult.value.media ?? [] : []);
      setSeasons(seasonResult.status === "fulfilled" ? seasonResult.value.seasons ?? [] : []);
      setLoaded(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (
        target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      );
      if (isTyping) return;
      if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchRef.current?.focus();
        document.getElementById("club-hub")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const seasonCount = useMemo(() => new Set([
    ...seasons.map((item) => item.season),
    ...players.flatMap((player) => playerRecords(player).map((record) => record.season)),
  ].filter(Boolean)).size, [players, seasons]);

  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return [];

    const playerMatches: HubResult[] = players.filter((player) => [
      player.name,
      player.major,
      player.classYear,
      player.note,
      ...playerRecords(player).flatMap((record) => [record.season, record.jerseyNumber, record.position, record.role]),
    ].some((value) => normalize(value).includes(needle))).map((player) => ({
      key: `player-${player.id}`,
      kind: "player",
      label: player.name,
      meta: `${playerRecords(player).map((record) => record.season).join(" / ")} · ${player.major || "球员档案"}`,
      href: "#roster",
      query: player.name,
    }));

    const seasonMatches: HubResult[] = seasons.filter((item) => [
      item.season,
      item.title,
      item.summary,
      squadNames[item.squad] ?? item.squad,
    ].some((value) => normalize(value).includes(needle))).map((item) => ({
      key: `season-${item.id}`,
      kind: "season",
      label: item.title,
      meta: `${item.season} · ${squadNames[item.squad] ?? item.squad}`,
      href: `/seasons/${encodeURIComponent(item.slug)}`,
      imageUrl: item.coverImageUrl ?? undefined,
      slug: item.slug,
    }));

    const mediaMatches: HubResult[] = media.filter((item) => [
      item.title,
      item.caption,
      item.season,
      squadNames[item.squad] ?? item.squad,
    ].some((value) => normalize(value).includes(needle))).map((item) => ({
      key: `media-${item.id}`,
      kind: "media",
      label: item.title,
      meta: [item.season, squadNames[item.squad] ?? item.squad].filter(Boolean).join(" · ") || "公共影像档案",
      href: "#archive-media",
      imageUrl: item.imageUrl,
    }));

    const shortcutMatches = shortcuts.filter((item) => normalize(`${item.label} ${item.meta}`).includes(needle));
    return [...playerMatches, ...seasonMatches, ...mediaMatches, ...shortcutMatches].slice(0, 12);
  }, [media, players, query, seasons]);

  const latestMedia = media[0] ?? null;
  const latestSeason = seasons[0] ?? null;

  function chooseResult(result: HubResult) {
    if (result.kind === "player" && result.query) {
      window.dispatchEvent(new CustomEvent("jdfc:focus-player", { detail: { query: result.query } }));
    }
    if (result.kind === "season" && result.slug) {
      window.dispatchEvent(new CustomEvent("jdfc:select-season", { detail: { slug: result.slug } }));
    }
    setQuery("");
  }

  return (
    <section className="club-hub" id="club-hub" aria-labelledby="club-hub-title">
      <header className="club-hub-header">
        <div>
          <p>JDFC CLUB HUB / 球队档案中心</p>
          <h2 id="club-hub-title">先找到你想看的，再继续深入。</h2>
        </div>
        <label className="club-hub-search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索球员、号码、赛季、影像或故事"
            aria-label="搜索整个球队档案"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><X aria-hidden="true" /></button> : <kbd>/</kbd>}
        </label>
      </header>

      {query ? (
        <div className="club-hub-results" aria-live="polite">
          <div className="club-hub-results-head">
            <span>SEARCH RESULTS</span>
            <strong>{results.length ? `找到 ${results.length} 个相关档案` : "没有找到匹配档案"}</strong>
          </div>
          {results.length ? <div className="club-hub-result-grid">{results.map((result) => (
            <a href={result.href} onClick={() => chooseResult(result)} key={result.key}>
              {result.imageUrl ? <img src={result.imageUrl} alt="" loading="lazy" /> : <span>{resultIcon(result.kind)}</span>}
              <div><small>{result.kind === "player" ? "球员" : result.kind === "season" ? "赛季" : result.kind === "media" ? "影像" : "快捷入口"}</small><strong>{result.label}</strong><p>{result.meta}</p></div>
              <ArrowUpRight aria-hidden="true" />
            </a>
          ))}</div> : <div className="club-hub-no-results"><Search aria-hidden="true" /><p>换个姓名、号码、年份或关键词试试。</p><a href="#contribute">资料还没收录？欢迎补充投稿 ↗</a></div>}
        </div>
      ) : (
        <div className="club-hub-grid" data-loaded={loaded ? "true" : "false"}>
          <a className="club-hub-feature" href={latestMedia ? "#archive-media" : "#moments"}>
            <img src={latestMedia?.imageUrl || "/team/celebration.jpg"} alt={latestMedia?.title || "机电学院足球队冠军庆祝影像"} />
            <div className="club-hub-feature-shade" />
            <div className="club-hub-feature-copy">
              <span><i aria-hidden="true" /> {latestMedia ? "LATEST ARCHIVE" : "EDITOR'S PICK"}</span>
              <h3>{latestMedia?.title || "七冠之后，故事仍在继续。"}</h3>
              <p>{latestMedia?.caption || "从夺冠合影到训练日常，把每一代机电人的蓝色记忆留在这里。"}</p>
              <strong>{latestMedia ? "查看公共影像档案" : "进入球队影像"} <ArrowUpRight aria-hidden="true" /></strong>
            </div>
          </a>

          <a className="club-hub-season" href={latestSeason ? `/seasons/${encodeURIComponent(latestSeason.slug)}` : "#contribute"}>
            {latestSeason?.coverImageUrl ? <img src={latestSeason.coverImageUrl} alt="" /> : null}
            <span><CalendarDays aria-hidden="true" /> LATEST SEASON</span>
            <strong>{latestSeason?.season || "赛季档案"}</strong>
            <h3>{latestSeason?.title || "等待亲历者补齐每一届故事"}</h3>
            <p>{latestSeason?.summary || "按男子五人制、男子十一人制与女子五人制分别保存。"}</p>
            <i>{latestSeason ? "阅读赛季故事" : "提供赛季资料"} ↗</i>
          </a>

          <a className="club-hub-stat" href="#roster">
            <span><UsersRound aria-hidden="true" /> PLAYER ARCHIVE</span>
            <strong>{loaded ? players.length : "—"}</strong>
            <p>公开球员档案</p>
            <small><Shirt aria-hidden="true" /> {seasonCount || "—"} 个已收录赛季</small>
          </a>

          <a className="club-hub-join" href="#contribute">
            <span><Sparkles aria-hidden="true" /> KEEP IT GROWING</span>
            <h3>你记得的，<br />正是档案缺少的。</h3>
            <p>提交老照片、赛季故事或球员资料，经审核后加入球队历史。</p>
            <strong>补全球队档案 <ArrowUpRight aria-hidden="true" /></strong>
          </a>
        </div>
      )}

      <nav className="club-hub-links" aria-label="球队档案快捷入口">
        {shortcuts.map((item, index) => <a href={item.href} key={item.key}><span>0{index + 1}</span>{item.label}<ArrowUpRight aria-hidden="true" /></a>)}
      </nav>
    </section>
  );
}
