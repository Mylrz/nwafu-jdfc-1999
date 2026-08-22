"use client";

import { ArrowUpRight, Search, Shirt, Sparkles, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PlayerDetailDialog, type PlayerArchivePlayer, type PlayerProfileTarget } from "./PlayerDetailDialog";
import { PlayerProfileSubmission } from "./PlayerProfileSubmission";
import { useMobileViewport } from "../hooks/useMobileViewport";

function recordsFor(player: PlayerArchivePlayer) {
  return player.seasonRecords.length
    ? player.seasonRecords
    : [{ id: 0, season: player.season, jerseyNumber: player.jerseyNumber, position: player.position, role: player.role }];
}

function positionGroup(position: string) {
  if (position.includes("门将")) return "门将";
  if (position.includes("后卫")) return "后卫";
  if (position.includes("中场")) return "中场";
  if (position.includes("前锋")) return "前锋";
  return position.trim() ? "其他" : "待补充";
}

export function RosterArchive() {
  const isMobile = useMobileViewport();
  const [season, setSeason] = useState("all");
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerArchivePlayer[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerArchivePlayer | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const closePlayerDetail = useCallback(() => setSelectedPlayer(null), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/players?season=all&q=", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Player archive unavailable");
        return await response.json() as { players?: PlayerArchivePlayer[]; seasons?: string[] };
      })
      .then((data) => {
        setPlayers(data.players ?? []);
        setSeasons(data.seasons ?? []);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPlayers([]);
          setSeasons([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestVersion]);

  useEffect(() => {
    const focusPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      const nextQuery = detail?.query?.trim();
      if (!nextQuery) return;
      setSeason("all");
      setQuery(nextQuery);
      setVisibleCount(10);
    };
    window.addEventListener("jdfc:focus-player", focusPlayer);
    return () => window.removeEventListener("jdfc:focus-player", focusPlayer);
  }, []);

  const seasonPlayers = useMemo(() => players.filter((player) => (
    season === "all" || recordsFor(player).some((record) => record.season === season)
  )), [players, season]);

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return seasonPlayers;
    return seasonPlayers.filter((player) => [
      player.name,
      player.major,
      player.classYear,
      ...recordsFor(player).flatMap((record) => [record.season, record.jerseyNumber, record.position, record.role]),
    ].some((value) => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery)));
  }, [query, seasonPlayers]);
  const renderedPlayers = filteredPlayers.slice(0, visibleCount);

  const seasonSummary = useMemo(() => {
    const selectedRecords = seasonPlayers.flatMap((player) => {
      const records = recordsFor(player);
      return season === "all" ? records : records.filter((record) => record.season === season);
    });
    const positions = new Map<string, number>();
    for (const record of selectedRecords) {
      const group = positionGroup(record.position);
      positions.set(group, (positions.get(group) ?? 0) + 1);
    }
    const specialRoles = seasonPlayers.flatMap((player) => recordsFor(player)
      .filter((record) => (season === "all" || record.season === season) && record.role && record.role !== "队员")
      .map((record) => `${player.name} · ${record.role}`));

    return {
      recordCount: selectedRecords.length,
      numberedCount: selectedRecords.filter((record) => record.jerseyNumber.trim()).length,
      positions: [...positions.entries()].sort((a, b) => b[1] - a[1]),
      specialRoles: [...new Set(specialRoles)],
    };
  }, [season, seasonPlayers]);

  function requestPlayerUpdate(player: PlayerArchivePlayer) {
    const target: PlayerProfileTarget = {
      id: player.id,
      name: player.name,
      major: player.major,
      classYear: player.classYear,
      note: player.note,
      seasonRecords: recordsFor(player).map(({ season: recordSeason, jerseyNumber, position, role }) => ({
        season: recordSeason,
        jerseyNumber,
        position,
        role,
      })),
    };
    window.sessionStorage.setItem("jdfc-player-profile-target", JSON.stringify(target));
    window.dispatchEvent(new CustomEvent<PlayerProfileTarget>("jdfc:request-player-update", { detail: target }));
    setSelectedPlayer(null);
    window.setTimeout(() => document.getElementById("player-submit")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <section className="roster section" id="roster">
      <div className="section-head">
        <p className="kicker">08 / PLAYER ARCHIVE</p>
        <p className="section-index">历届阵容 · 持续收集中</p>
      </div>

      <div className="roster-intro">
        <div>
          <h2>找回那个号码，<br />也找回那一年。</h2>
          <p>选择一个赛季查看当年阵容，或按姓名、球衣号码、位置和专业查找。点击球员卡可展开完整的历年号码档案。</p>
        </div>
        <label className="player-search">
          <span><Search aria-hidden="true" /> SEARCH PLAYER</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(isMobile ? 8 : 16);
            }}
            placeholder="姓名、号码、位置或专业"
            aria-label="搜索球员姓名、号码、位置或专业"
          />
        </label>
      </div>

      <div className="season-strip" role="tablist" aria-label="选择赛季">
        {["all", ...seasons].map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={season === item}
            className={season === item ? "active" : ""}
            onClick={() => {
              setSeason(item);
              setVisibleCount(isMobile ? 8 : 16);
            }}
            key={item}
          >
            {item === "all" ? "全部赛季" : `${item} 赛季`}
          </button>
        ))}
      </div>

      {!loading && !loadError ? (
        <section className="season-overview" aria-label={`${season === "all" ? "历届" : `${season}赛季`}档案概览`}>
          <div className="season-overview-title">
            <p>{season === "all" ? "SQUAD ARCHIVE" : `SEASON ${season}`}</p>
            <h3>{season === "all" ? "球队历届档案" : `${season} 赛季阵容`}</h3>
            <span>{season === "all" ? `跨越 ${seasons.length} 个已收录赛季` : "阵容会随着队员投稿持续补齐"}</span>
          </div>
          <div className="season-overview-metrics">
            <span><UsersRound aria-hidden="true" /><strong>{seasonPlayers.length}</strong><small>收录球员</small></span>
            <span><Shirt aria-hidden="true" /><strong>{seasonSummary.numberedCount}</strong><small>号码记录</small></span>
            <span><Sparkles aria-hidden="true" /><strong>{seasonSummary.recordCount}</strong><small>{season === "all" ? "赛季记录" : "当季档案"}</small></span>
          </div>
          <div className="season-overview-meta">
            <div>
              <span>位置分布</span>
              <p>{seasonSummary.positions.length ? seasonSummary.positions.map(([position, count]) => <b key={position}>{position} {count}</b>) : <b>等待补充</b>}</p>
            </div>
            <div>
              <span>球队身份</span>
              <p>{seasonSummary.specialRoles.length ? seasonSummary.specialRoles.slice(0, 5).map((role) => <b key={role}>{role}</b>) : <b>队长、领队等资料待补充</b>}</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loadError ? <div className="roster-result-note" aria-live="polite">
        <span>{query ? `找到 ${filteredPlayers.length} 位匹配球员` : `${season === "all" ? "历届" : `${season} 赛季`} · ${filteredPlayers.length} 位球员`}</span>
        {season !== "all" || query ? <button type="button" onClick={() => { setSeason("all"); setQuery(""); setVisibleCount(isMobile ? 8 : 16); }}>清除筛选</button> : null}
      </div> : null}

      <div className="player-grid" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="archive-empty">正在翻阅球队档案…</div>
        ) : loadError ? (
          <div className="archive-empty" role="alert">
            <strong>球队档案暂时没有打开。</strong>
            <span>这不是“暂无球员”，而是资料服务暂时不可用；现有档案没有丢失。</span>
            <button type="button" onClick={() => { setLoading(true); setLoadError(false); setRequestVersion((value) => value + 1); }}>重新读取档案</button>
          </div>
        ) : filteredPlayers.length ? (
          renderedPlayers.map((player) => {
            const allRecords = recordsFor(player);
            const selectedRecord = season === "all" ? allRecords[0] : allRecords.find((record) => record.season === season) ?? allRecords[0];
            const displayRecords = season === "all"
              ? allRecords
              : [selectedRecord, ...allRecords.filter((record) => record.id !== selectedRecord.id)];
            return <article className="player-card" key={player.id}>
              <button className="player-card-open" type="button" onClick={() => setSelectedPlayer(player)} aria-label={`查看${player.name}的完整球员档案`} />
              <div className="player-photo-shell">
                {player.photoKey ? <img className="player-photo" src={`/api/players/${player.id}/photo`} alt={`${player.name}的球员照片`} loading="lazy" /> : <span>{player.name.slice(0, 1)}</span>}
              </div>
              <div className="player-season-numbers" aria-label={`${player.name}的历年球衣号码`}>
                {displayRecords.map((record) => <span className={record.id === selectedRecord.id ? "is-current" : ""} key={`${record.season}-${record.id}`}><b>{record.jerseyNumber || "—"}</b><small>{record.season}</small></span>)}
              </div>
              <div className="player-card-copy">
                <p>{allRecords.map((record) => record.season).join(" / ")} · {selectedRecord.role}</p>
                <h3>{player.name}</h3>
                <small>{[selectedRecord.position, player.major, player.classYear].filter(Boolean).join(" · ") || "资料整理中"}</small>
                {player.note ? <blockquote>{player.note}</blockquote> : null}
                <span className="player-card-more"><UserRound aria-hidden="true" /> 查看完整档案 <ArrowUpRight aria-hidden="true" /></span>
              </div>
            </article>;
          })
        ) : (
          <div className="archive-empty">
            <strong>这一页还在等待名字。</strong>
            <span>没有匹配的公开档案；老队员可以在下方投稿补充资料。</span>
          </div>
        )}
      </div>

      {!loading && !loadError && renderedPlayers.length < filteredPlayers.length ? (
        <div className="roster-load-more">
          <p aria-live="polite">已显示 {renderedPlayers.length} / {filteredPlayers.length} 位球员</p>
          <button type="button" onClick={() => setVisibleCount((count) => count + (isMobile ? 8 : 16))}>
            加载更多球员 <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <PlayerProfileSubmission />

      <PlayerDetailDialog
        player={selectedPlayer}
        onClose={closePlayerDetail}
        onRequestUpdate={requestPlayerUpdate}
      />
    </section>
  );
}
