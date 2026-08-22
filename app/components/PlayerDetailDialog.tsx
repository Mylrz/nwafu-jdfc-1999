"use client";

import { ArrowDownRight, CalendarDays, Shirt, UserRoundPen, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export type PlayerArchiveSeasonRecord = {
  id: number;
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
};

export type PlayerArchivePlayer = {
  id: number;
  season: string;
  name: string;
  jerseyNumber: string;
  position: string;
  role: string;
  major: string;
  classYear: string;
  note: string;
  photoKey: string;
  seasonRecords: PlayerArchiveSeasonRecord[];
};

export type PlayerProfileTarget = {
  id: number;
  name: string;
  major: string;
  classYear: string;
  note: string;
  seasonRecords: Array<Omit<PlayerArchiveSeasonRecord, "id">>;
};

type PlayerDetailDialogProps = {
  player: PlayerArchivePlayer | null;
  onClose: () => void;
  onRequestUpdate: (player: PlayerArchivePlayer) => void;
};

export function PlayerDetailDialog({ player, onClose, onRequestUpdate }: PlayerDetailDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!player) return;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest<HTMLElement>("[role='dialog']");
      const focusable = dialog ? [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")] : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      activeElement?.focus();
    };
  }, [onClose, player]);

  if (!player) return null;
  const records = (player.seasonRecords.length
    ? player.seasonRecords
    : [{ id: 0, season: player.season, jerseyNumber: player.jerseyNumber, position: player.position, role: player.role }])
    .slice()
    .sort((a, b) => b.season.localeCompare(a.season, "zh-CN", { numeric: true }));
  const latest = records[0];

  return (
    <div className="player-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="player-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <header className="player-dialog-header">
          <button ref={closeButtonRef} className="player-dialog-close" type="button" onClick={onClose} aria-label="关闭球员档案">
            <X aria-hidden="true" />
          </button>
          <div className="player-dialog-photo">
            {player.photoKey ? <img src={`/api/players/${player.id}/photo`} alt={`${player.name}的球员照片`} /> : <span>{player.name.slice(0, 1)}</span>}
          </div>
          <div className="player-dialog-identity">
            <p>JDFC PLAYER ARCHIVE · {records.length} 个赛季</p>
            <h2 id={titleId}>{player.name}</h2>
            <span>{[latest.role, latest.position, player.major, player.classYear].filter(Boolean).join(" · ") || "球员资料持续整理中"}</span>
          </div>
          <strong className="player-dialog-number" aria-label={`最近记录号码${latest.jerseyNumber || "待补充"}`}>{latest.jerseyNumber || "—"}</strong>
        </header>

        <div className="player-dialog-body">
          <div className="player-dialog-story">
            <p className="player-dialog-label"><UserRoundPen aria-hidden="true" /> 球队记忆</p>
            <blockquote id={descriptionId}>{player.note || "这名球员的故事还在等待本人或队友补充。"}</blockquote>
          </div>

          <div className="player-timeline">
            <div className="player-dialog-label"><CalendarDays aria-hidden="true" /> 逐年战袍记录</div>
            {records.map((record, index) => (
              <article key={`${record.id}-${record.season}`}>
                <i aria-hidden="true" />
                <div>
                  <span>{record.season} SEASON</span>
                  <strong>{record.season} 赛季</strong>
                  <small>{[record.position, record.role].filter(Boolean).join(" · ") || "位置与身份待补充"}</small>
                </div>
                <b aria-label={`${record.season}赛季${record.jerseyNumber || "号码待补充"}`}><Shirt aria-hidden="true" />{record.jerseyNumber || "—"}</b>
                {index === 0 ? <em>最近记录</em> : null}
              </article>
            ))}
          </div>
        </div>

        <footer className="player-dialog-footer">
          <div>
            <strong>资料有遗漏或需要更正？</strong>
            <span>本人提交后由管理员核对，不会直接修改公开档案。</span>
          </div>
          <button type="button" onClick={() => onRequestUpdate(player)}>
            申请补充 / 修改资料 <ArrowDownRight aria-hidden="true" />
          </button>
        </footer>
      </section>
    </div>
  );
}
