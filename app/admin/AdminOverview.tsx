"use client";

import {
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FolderClock,
  ImageOff,
  MessageSquareText,
  Shirt,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./AdminOverview.module.css";

export type AdminOverviewTab = "players" | "playerSubmissions" | "messages" | "submissions";

export type AdminOverviewItem = {
  id: number;
  title: string;
  meta: string;
  createdAt: string;
};

export type AdminOverviewProps = {
  playersCount: number;
  archivedPlayers: number;
  seasonsCount: number;
  pendingProfiles: number;
  pendingMessages: number;
  pendingFiles: number;
  missingPhotos: number;
  missingNumbers: number;
  totalSeasonRecords?: number;
  profileItems: AdminOverviewItem[];
  messageItems: AdminOverviewItem[];
  fileItems: AdminOverviewItem[];
  onNavigate: (tab: AdminOverviewTab) => void;
};

type Queue = {
  tab: Exclude<AdminOverviewTab, "players">;
  eyebrow: string;
  title: string;
  count: number;
  items: AdminOverviewItem[];
  icon: LucideIcon;
  emptyCopy: string;
};

function clampCount(value: number) {
  return Math.max(0, Math.floor(value || 0));
}

function stableDateLabel(value: string) {
  const normalized = value.replace("T", " ").replace("Z", "");
  const match = normalized.match(/^\d{4}-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]} · ${match[3]}:${match[4]}` : value;
}

export function AdminOverview({
  playersCount,
  archivedPlayers,
  seasonsCount,
  pendingProfiles,
  pendingMessages,
  pendingFiles,
  missingPhotos,
  missingNumbers,
  totalSeasonRecords = 0,
  profileItems,
  messageItems,
  fileItems,
  onNavigate,
}: AdminOverviewProps) {
  const safePlayers = clampCount(playersCount);
  const safeArchived = clampCount(archivedPlayers);
  const activePlayers = safePlayers;
  const safeMissingPhotos = clampCount(missingPhotos);
  const safeMissingNumbers = clampCount(missingNumbers);
  const photoCoverage = activePlayers ? Math.max(0, Math.round((1 - Math.min(safeMissingPhotos, activePlayers) / activePlayers) * 100)) : 100;
  const safeSeasonRecords = clampCount(totalSeasonRecords);
  const numberCoverage = safeSeasonRecords ? Math.max(0, Math.round((1 - Math.min(safeMissingNumbers, safeSeasonRecords) / safeSeasonRecords) * 100)) : 100;
  const healthScore = Math.round((photoCoverage + numberCoverage) / 2);
  const queues: Queue[] = [
    {
      tab: "playerSubmissions",
      eyebrow: "PLAYER PROFILES",
      title: "球员资料审核",
      count: clampCount(pendingProfiles),
      items: profileItems,
      icon: UserRoundCheck,
      emptyCopy: "球员填档均已处理",
    },
    {
      tab: "messages",
      eyebrow: "GUESTBOOK",
      title: "老队员留言",
      count: clampCount(pendingMessages),
      items: messageItems,
      icon: MessageSquareText,
      emptyCopy: "留言队列已经清空",
    },
    {
      tab: "submissions",
      eyebrow: "ARCHIVE FILES",
      title: "老照片与资料",
      count: clampCount(pendingFiles),
      items: fileItems,
      icon: FolderClock,
      emptyCopy: "投稿资料均已整理",
    },
  ];
  const totalPending = queues.reduce((total, queue) => total + queue.count, 0);
  const firstPending = queues.find((queue) => queue.count > 0)?.tab ?? "players";

  return (
    <section className={styles.overview} aria-labelledby="admin-overview-title">
      <header className={styles.intro}>
        <div>
          <span className={styles.kicker}><Sparkles aria-hidden="true" /> TODAY&apos;S ARCHIVE</span>
          <h2 id="admin-overview-title">资料库今日概览</h2>
        </div>
        <p>先处理待办，再补齐历届档案。每一次整理，都会让球队历史更完整一点。</p>
      </header>

      <div className={styles.primaryGrid}>
        <article className={`${styles.pendingCard} ${totalPending === 0 ? styles.isClear : ""}`}>
          <div className={styles.cardGlow} aria-hidden="true" />
          {totalPending === 0 ? (
            <>
              <span className={styles.statusIcon}><CheckCircle2 aria-hidden="true" /></span>
              <div className={styles.pendingCopy}>
                <p>ALL CAUGHT UP</p>
                <h3>待办队列已全部清空</h3>
                <span>今天没有新的球员资料、留言或文件需要审核。</span>
              </div>
              <button type="button" onClick={() => onNavigate("players")}>
                巡视球员档案 <ArrowRight aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <span className={styles.statusIcon}><ClipboardCheck aria-hidden="true" /></span>
              <div className={styles.pendingCopy}>
                <p>OPEN TASKS</p>
                <strong>{totalPending}</strong>
                <h3>条资料等待处理</h3>
                <span>最早提交的内容已排在各队列前面。</span>
              </div>
              <button type="button" onClick={() => onNavigate(firstPending)}>
                开始处理 <ArrowRight aria-hidden="true" />
              </button>
            </>
          )}
        </article>

        <aside className={styles.snapshot} aria-label="档案规模">
          <div>
            <UsersRound aria-hidden="true" />
            <span>球员档案<strong>{safePlayers}</strong><small>人</small></span>
          </div>
          <div>
            <Shirt aria-hidden="true" />
            <span>已记录赛季<strong>{clampCount(seasonsCount)}</strong><small>届</small></span>
          </div>
          <div>
            <Archive aria-hidden="true" />
            <span>历史归档<strong>{safeArchived}</strong><small>人</small></span>
          </div>
        </aside>
      </div>

      <div className={styles.queueGrid} aria-label="待审核队列">
        {queues.map((queue) => {
          const Icon = queue.icon;
          const visibleItems = queue.items.slice(0, 2);
          return (
            <article className={styles.queueCard} key={queue.tab}>
              <header>
                <span className={styles.queueIcon}><Icon aria-hidden="true" /></span>
                <div><p>{queue.eyebrow}</p><h3>{queue.title}</h3></div>
                <strong aria-label={`${queue.count}条待处理`}>{queue.count}</strong>
              </header>

              {visibleItems.length ? (
                <ol className={styles.itemList}>
                  {visibleItems.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onNavigate(queue.tab)} aria-label={`前往处理：${item.title}`}>
                        <span><b>{item.title}</b><small>{item.meta}</small></span>
                        <time dateTime={item.createdAt}>{stableDateLabel(item.createdAt)}</time>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className={styles.queueEmpty}>
                  {queue.count ? <FolderClock aria-hidden="true" /> : <Check aria-hidden="true" />}
                  <span>{queue.count ? `还有 ${queue.count} 条内容待查看` : queue.emptyCopy}</span>
                </div>
              )}

              <button className={styles.queueAction} type="button" onClick={() => onNavigate(queue.tab)}>
                {queue.count ? `查看全部 ${queue.count} 条` : "查看历史记录"} <ArrowRight aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>

      <section className={styles.health} aria-labelledby="archive-health-title">
        <div className={styles.healthHeading}>
          <span className={styles.healthScore} aria-label={`档案健康度${healthScore}分`}>
            <strong>{healthScore}</strong><small>/ 100</small>
          </span>
          <div>
            <p>ARCHIVE HEALTH</p>
            <h3 id="archive-health-title">档案健康度</h3>
            <span>{activePlayers} 位公开球员、{safeSeasonRecords} 条赛季记录中，还有哪些资料值得优先补齐。</span>
          </div>
        </div>

        <div className={styles.healthChecks}>
          <div className={styles.healthRow}>
            <span className={styles.healthIcon}><ImageOff aria-hidden="true" /></span>
            <div>
              <header><b>球员照片</b><span>{safeMissingPhotos ? `${safeMissingPhotos} 人待补` : "全部完整"}</span></header>
              <div className={styles.progress} role="progressbar" aria-label="球员照片完整度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={photoCoverage}>
                <i style={{ width: `${photoCoverage}%` }} />
              </div>
            </div>
            <strong>{photoCoverage}%</strong>
          </div>
          <div className={styles.healthRow}>
            <span className={styles.healthIcon}><Shirt aria-hidden="true" /></span>
            <div>
              <header><b>历年号码</b><span>{safeMissingNumbers ? `${safeMissingNumbers} 条待补` : "全部完整"}</span></header>
              <div className={styles.progress} role="progressbar" aria-label="历年号码完整度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={numberCoverage}>
                <i style={{ width: `${numberCoverage}%` }} />
              </div>
            </div>
            <strong>{numberCoverage}%</strong>
          </div>
        </div>

        <button className={styles.healthAction} type="button" onClick={() => onNavigate("players")}>
          进入球员档案维护 <ArrowRight aria-hidden="true" />
        </button>
      </section>
    </section>
  );
}
