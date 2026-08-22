"use client";

import {
  Archive,
  Check,
  ExternalLink,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./ArchiveWorkspace.module.css";

type Submission = {
  id: number;
  submitterName: string;
  title: string;
  season: string;
  note: string;
  fileName: string;
  contentType: string;
  status: string;
  createdAt: string;
};

type MediaAsset = {
  id: number;
  submissionId: number | null;
  title: string;
  caption: string;
  season: string;
  squad: Squad;
  credit: string;
  source: string;
  rightsStatus: "pending" | "cleared" | "restricted";
  status: "draft" | "published" | "archived";
  fileName: string;
  contentType: string;
  updatedAt: string;
};

type SeasonArchive = {
  id: number;
  season: string;
  squad: Squad;
  slug: string;
  title: string;
  summary: string;
  story: string;
  status: "draft" | "published" | "archived";
  coverMediaId: number | null;
  updatedAt: string;
};

type Squad = "men-futsal" | "men-11" | "women-futsal" | "mixed" | "other";
type ArchiveNotice = { message: string; tone: "success" | "error" | "progress" };

const squads: Array<{ value: Squad; label: string }> = [
  { value: "men-futsal", label: "男子五人制" },
  { value: "men-11", label: "男子十一人制" },
  { value: "women-futsal", label: "女子五人制" },
  { value: "mixed", label: "综合 / 全队" },
  { value: "other", label: "其他队别" },
];

const emptyMediaForm = {
  mediaId: 0,
  expectedUpdatedAt: "",
  submissionId: 0,
  title: "",
  caption: "",
  season: "",
  squad: "mixed" as Squad,
  credit: "",
  source: "球队成员投稿",
  rightsCleared: false,
  status: "published" as "draft" | "published",
};

const emptySeasonForm = {
  seasonId: 0,
  expectedUpdatedAt: "",
  season: "",
  squad: "men-futsal" as Squad,
  slug: "",
  title: "",
  summary: "",
  story: "",
  status: "draft" as "draft" | "published",
  coverMediaId: "",
};

function squadLabel(value: string) {
  return squads.find((item) => item.value === value)?.label ?? "队别待确认";
}

function slugFor(season: string, squad: Squad) {
  return `${season.trim()}-${squad}`.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `请求失败（${response.status}）`);
  return data;
}

export function ArchiveWorkspace({ submissions, onSubmissionUpdated }: {
  submissions: Submission[];
  onSubmissionUpdated: () => Promise<void>;
}) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [seasons, setSeasons] = useState<SeasonArchive[]>([]);
  const [mediaForm, setMediaForm] = useState(emptyMediaForm);
  const [seasonForm, setSeasonForm] = useState(emptySeasonForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<ArchiveNotice | null>(null);
  const [error, setError] = useState("");
  const notify = useCallback((message: string, tone: ArchiveNotice["tone"] = "success") => setNotice({ message, tone }), []);

  const loadArchive = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mediaResult, seasonResult] = await Promise.all([
        requestJson<{ media?: MediaAsset[] }>("/api/admin/media"),
        requestJson<{ seasons?: SeasonArchive[] }>("/api/admin/seasons"),
      ]);
      setMedia(mediaResult.media ?? []);
      setSeasons(seasonResult.seasons ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "档案发布数据暂时无法加载。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadArchive(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadArchive]);

  const publishedSubmissionIds = useMemo(() => new Set(media.map((item) => item.submissionId).filter(Boolean)), [media]);
  const imageSubmissions = useMemo(() => submissions
    .filter((item) => item.contentType?.startsWith("image/") && !publishedSubmissionIds.has(item.id) && item.status === "pending")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [publishedSubmissionIds, submissions]);
  const publishedMedia = useMemo(
    () => media.filter((item) => item.status === "published" && item.rightsStatus === "cleared"),
    [media],
  );

  function selectSubmission(submission: Submission) {
    const inferredSquad: Squad = /女/.test(`${submission.title}${submission.note}`) ? "women-futsal" : "mixed";
    setMediaForm({
      ...emptyMediaForm,
      submissionId: submission.id,
      title: submission.title,
      caption: submission.note,
      season: submission.season,
      squad: inferredSquad,
      credit: submission.submitterName,
    });
    setNotice(null);
    document.getElementById("archive-publish-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function editMedia(item: MediaAsset) {
    setMediaForm({
      mediaId: item.id,
      expectedUpdatedAt: item.updatedAt,
      submissionId: item.submissionId ?? 0,
      title: item.title,
      caption: item.caption,
      season: item.season,
      squad: item.squad,
      credit: item.credit,
      source: item.source,
      rightsCleared: item.rightsStatus === "cleared",
      status: item.status === "published" ? "published" : "draft",
    });
    notify(item.status === "archived" ? "正在编辑已下线影像；重新确认授权后可以再次公开。" : "正在编辑媒体档案。", "progress");
    document.getElementById("archive-publish-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function publishMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mediaForm.submissionId && !mediaForm.mediaId) return notify("请先从左侧选择一份照片投稿。", "error");
    if (mediaForm.status === "published" && !mediaForm.rightsCleared) return notify("公开照片前，必须确认投稿者已经授权公开展示。", "error");
    setBusy("publish-media");
    setNotice(null);
    try {
      await requestJson("/api/admin/media", {
        method: mediaForm.mediaId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: mediaForm.mediaId || undefined,
          expectedUpdatedAt: mediaForm.mediaId ? mediaForm.expectedUpdatedAt : undefined,
          submissionId: mediaForm.submissionId,
          title: mediaForm.title,
          caption: mediaForm.caption,
          season: mediaForm.season,
          squad: mediaForm.squad,
          credit: mediaForm.credit,
          source: mediaForm.source,
          rightsStatus: mediaForm.rightsCleared ? "cleared" : "pending",
          status: mediaForm.status,
        }),
      });
      setMediaForm(emptyMediaForm);
      notify(mediaForm.status === "published" ? "照片已发布到球队公共影像档案。" : "照片已保存为草稿，暂未公开。");
      await Promise.all([loadArchive(), onSubmissionUpdated()]);
    } catch (saveError) {
      notify(saveError instanceof Error ? saveError.message : "保存失败，请稍后重试。", "error");
    } finally {
      setBusy("");
    }
  }

  const activePreviewUrl = mediaForm.mediaId
    ? `/api/admin/media/${mediaForm.mediaId}/file`
    : mediaForm.submissionId
      ? `/api/admin/submissions/${mediaForm.submissionId}/file`
      : "";

  async function updateMediaStatus(item: MediaAsset, status: MediaAsset["status"]) {
    if (status === "archived" && !window.confirm(`将“${item.title}”从前台下线吗？原文件仍会保留。`)) return;
    setBusy(`media-${item.id}`);
    try {
      await requestJson("/api/admin/media", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, expectedUpdatedAt: item.updatedAt, status }),
      });
      notify(status === "published" ? "影像已重新公开。" : "影像已从前台下线，可随时恢复。");
      await loadArchive();
    } catch (updateError) {
      notify(updateError instanceof Error ? updateError.message : "状态更新失败。", "error");
    } finally {
      setBusy("");
    }
  }

  async function revokeMediaRights(item: MediaAsset) {
    if (!window.confirm(`确认撤销“${item.title}”的公开授权并立即下线吗？原文件仍保留在受保护的后台。`)) return;
    setBusy(`media-${item.id}`);
    try {
      await requestJson("/api/admin/media", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          expectedUpdatedAt: item.updatedAt,
          rightsStatus: "restricted",
          status: "archived",
        }),
      });
      notify("公开授权已撤销，影像已经从前台下线；后台原件仍安全保留。");
      await loadArchive();
    } catch (updateError) {
      notify(updateError instanceof Error ? updateError.message : "授权撤回失败，请重试。", "error");
    } finally {
      setBusy("");
    }
  }

  async function saveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save-season");
    setNotice(null);
    try {
      await requestJson("/api/admin/seasons", {
        method: seasonForm.seasonId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...seasonForm,
          id: seasonForm.seasonId || undefined,
          expectedUpdatedAt: seasonForm.seasonId ? seasonForm.expectedUpdatedAt : undefined,
          slug: seasonForm.slug || slugFor(seasonForm.season, seasonForm.squad),
          coverMediaId: seasonForm.coverMediaId ? Number(seasonForm.coverMediaId) : null,
        }),
      });
      setSeasonForm(emptySeasonForm);
      notify(seasonForm.seasonId ? "赛季档案修改已保存。" : "赛季档案已建立，后续可以继续补充阵容、战袍和故事。");
      await loadArchive();
    } catch (saveError) {
      notify(saveError instanceof Error ? saveError.message : "赛季档案保存失败。", "error");
    } finally {
      setBusy("");
    }
  }

  function editSeason(item: SeasonArchive) {
    setSeasonForm({
      seasonId: item.id,
      expectedUpdatedAt: item.updatedAt,
      season: item.season,
      squad: item.squad,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      story: item.story,
      status: item.status === "published" ? "published" : "draft",
      coverMediaId: item.coverMediaId ? String(item.coverMediaId) : "",
    });
    notify("正在编辑赛季档案，保存时会检查是否被其他管理员修改。", "progress");
    document.getElementById("season-archive-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function updateSeasonStatus(item: SeasonArchive, status: SeasonArchive["status"]) {
    setBusy(`season-${item.id}`);
    try {
      await requestJson("/api/admin/seasons", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, expectedUpdatedAt: item.updatedAt, status }),
      });
      notify(status === "published" ? "赛季档案已经公开。" : "赛季档案已转为内部草稿。");
      await loadArchive();
    } catch (updateError) {
      notify(updateError instanceof Error ? updateError.message : "赛季状态更新失败。", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="archive-workspace-title">
      <header className={styles.heading}>
        <div><p>PUBLICATION WORKFLOW</p><h2 id="archive-workspace-title">档案发布工作台</h2><span>把投稿整理成可核实、可追溯、可长期展示的球队史料。</span></div>
        <button type="button" onClick={() => void loadArchive()} disabled={loading}><RefreshCw className={loading ? styles.spin : ""} aria-hidden="true" />刷新</button>
      </header>

      {error ? <div className={styles.alert} role="alert">{error}<button type="button" onClick={() => void loadArchive()}>重试</button></div> : null}
      {notice ? <div className={styles.notice} data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"} aria-live={notice.tone === "error" ? "assertive" : "polite"}>{notice.message}</div> : null}

      <div className={styles.publicationGrid}>
        <section className={styles.inbox} aria-labelledby="media-inbox-title">
          <header><span><ImagePlus aria-hidden="true" /></span><div><p>01 / 投稿收件箱</p><h3 id="media-inbox-title">选择一张照片开始整理</h3></div><strong>{imageSubmissions.length}</strong></header>
          <div className={styles.inboxList}>
            {imageSubmissions.length ? imageSubmissions.map((submission) => (
              <button type="button" className={mediaForm.submissionId === submission.id ? styles.selected : ""} onClick={() => selectSubmission(submission)} key={submission.id}>
                <img src={`/api/admin/submissions/${submission.id}/file`} alt="" />
                <span><b>{submission.title}</b><small>{submission.season || "年份待确认"} · {submission.submitterName}</small><em>{submission.status === "approved" ? "已整理" : "待整理"}</em></span>
              </button>
            )) : <div className={styles.empty}><Check aria-hidden="true" /><strong>没有等待发布的照片</strong><span>新的图片投稿会自动出现在这里；PDF 会继续留在资料审核队列。</span></div>}
          </div>
        </section>

        <form id="archive-publish-form" className={styles.publishForm} onSubmit={publishMedia}>
          <header><span><FileImage aria-hidden="true" /></span><div><p>02 / 核实并发布</p><h3>{mediaForm.mediaId ? `编辑媒体档案 #${mediaForm.mediaId}` : mediaForm.submissionId ? "补齐这张照片的档案信息" : "尚未选择照片"}</h3></div></header>
          {activePreviewUrl ? <a className={styles.previewLink} href={activePreviewUrl} target="_blank" rel="noreferrer"><img src={activePreviewUrl} alt="待发布投稿预览" /><span>查看原件 <ExternalLink aria-hidden="true" /></span></a> : <div className={styles.previewPlaceholder}>从左侧选择图片投稿</div>}
          <div className={styles.formGrid}>
            <label className={styles.full}>公开标题<input value={mediaForm.title} onChange={(event) => setMediaForm({ ...mediaForm, title: event.target.value })} required maxLength={100} /></label>
            <label>赛季<input value={mediaForm.season} onChange={(event) => setMediaForm({ ...mediaForm, season: event.target.value })} maxLength={20} placeholder="2025" /></label>
            <label>队别<select value={mediaForm.squad} onChange={(event) => setMediaForm({ ...mediaForm, squad: event.target.value as Squad })}>{squads.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className={styles.full}>照片说明<textarea value={mediaForm.caption} onChange={(event) => setMediaForm({ ...mediaForm, caption: event.target.value })} maxLength={600} rows={4} placeholder="人物、赛事和这张照片背后的故事" /></label>
            <label>署名<input value={mediaForm.credit} onChange={(event) => setMediaForm({ ...mediaForm, credit: event.target.value })} maxLength={80} placeholder="摄影 / 投稿者" /></label>
            <label>资料来源<input value={mediaForm.source} onChange={(event) => setMediaForm({ ...mediaForm, source: event.target.value })} maxLength={120} /></label>
            <label className={styles.full}>发布方式<select value={mediaForm.status} onChange={(event) => setMediaForm({ ...mediaForm, status: event.target.value as "draft" | "published" })}><option value="published">核实后立即公开</option><option value="draft">先存草稿，暂不公开</option></select></label>
            <label className={`${styles.full} ${styles.rightsCheck}`}><input type="checkbox" checked={mediaForm.rightsCleared} onChange={(event) => setMediaForm({ ...mediaForm, rightsCleared: event.target.checked })} /><ShieldCheck aria-hidden="true" /><span>已确认投稿者拥有投稿权，并同意在球队纪念网站公开展示。</span></label>
          </div>
          <button className={styles.primaryAction} type="submit" disabled={(!mediaForm.submissionId && !mediaForm.mediaId) || busy === "publish-media"}>{busy === "publish-media" ? <><LoaderCircle className={styles.spin} aria-hidden="true" />正在保存</> : mediaForm.status === "published" ? "确认并发布影像" : "保存为内部草稿"}</button>
        </form>
      </div>

      <section className={styles.library} aria-labelledby="media-library-title">
        <header><div><p>MEDIA LIBRARY</p><h3 id="media-library-title">媒体档案库</h3></div><strong>{media.length}</strong></header>
        <div className={styles.mediaStrip}>
          {media.length ? media.map((item) => (
            <article key={item.id} data-status={item.status}>
              <img src={`/api/admin/media/${item.id}/file`} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              <div><span>{item.season || "年份待确认"} · {squadLabel(item.squad)}</span><h4>{item.title}</h4><small>{item.rightsStatus === "restricted" ? "授权已撤回 · 前台下线" : item.status === "published" ? "前台公开" : item.status === "draft" ? "内部草稿" : "已下线"}</small></div>
              <aside className={styles.mediaActions}>
                <button type="button" onClick={() => editMedia(item)}>编辑资料</button>
                <button type="button" disabled={busy === `media-${item.id}`} onClick={() => item.status !== "published" && item.rightsStatus !== "cleared" ? editMedia(item) : void updateMediaStatus(item, item.status === "published" ? "archived" : "published")}>
                  {item.status === "published" ? <><Archive aria-hidden="true" />下线</> : item.rightsStatus === "cleared" ? <><Check aria-hidden="true" />公开</> : <><ShieldCheck aria-hidden="true" />补授权</>}
                </button>
                {item.rightsStatus !== "restricted" ? <button type="button" disabled={busy === `media-${item.id}`} onClick={() => void revokeMediaRights(item)}>撤销授权</button> : null}
              </aside>
            </article>
          )) : <p className={styles.emptyLine}>还没有正式发布的球队影像。</p>}
        </div>
      </section>

      <section className={styles.seasons} aria-labelledby="season-archive-title">
        <form id="season-archive-form" onSubmit={saveSeason}>
          <header><span><Plus aria-hidden="true" /></span><div><p>SEASON FOUNDATION</p><h3 id="season-archive-title">{seasonForm.seasonId ? `编辑赛季档案 #${seasonForm.seasonId}` : "建立赛季档案骨架"}</h3></div></header>
          <p className={styles.helper}>同一年按男子五人制、男子十一人制、女子五人制分别建档，后续阵容、战袍和比赛都挂到正确队别。</p>
          <div className={styles.formGrid}>
            <label>赛季<input value={seasonForm.season} onChange={(event) => setSeasonForm({ ...seasonForm, season: event.target.value, slug: slugFor(event.target.value, seasonForm.squad) })} required placeholder="2025" /></label>
            <label>队别<select value={seasonForm.squad} onChange={(event) => { const squad = event.target.value as Squad; setSeasonForm({ ...seasonForm, squad, slug: slugFor(seasonForm.season, squad) }); }}>{squads.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className={styles.full}>赛季标题<input value={seasonForm.title} onChange={(event) => setSeasonForm({ ...seasonForm, title: event.target.value })} required placeholder="2025 男子五人制 · 冠军赛季" /></label>
            <label className={styles.full}>固定链接<input value={seasonForm.slug} onChange={(event) => setSeasonForm({ ...seasonForm, slug: event.target.value })} required placeholder="2025-men-futsal" /></label>
            <label className={styles.full}>一句话摘要<input value={seasonForm.summary} onChange={(event) => setSeasonForm({ ...seasonForm, summary: event.target.value })} maxLength={220} placeholder="这一届最值得记住的成绩和故事" /></label>
            <label className={styles.full}>赛季故事<textarea value={seasonForm.story} onChange={(event) => setSeasonForm({ ...seasonForm, story: event.target.value })} rows={5} maxLength={3000} placeholder="资料不完整时可以先留空，日后慢慢补充。" /></label>
            <label>封面影像<select value={seasonForm.coverMediaId} onChange={(event) => setSeasonForm({ ...seasonForm, coverMediaId: event.target.value })}><option value="">暂不设置</option>{publishedMedia.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
            <label>状态<select value={seasonForm.status} onChange={(event) => setSeasonForm({ ...seasonForm, status: event.target.value as "draft" | "published" })}><option value="draft">内部草稿</option><option value="published">立即公开</option></select></label>
          </div>
          <div className={styles.formFooter}><button className={styles.primaryAction} type="submit" disabled={busy === "save-season"}>{busy === "save-season" ? "正在保存…" : seasonForm.seasonId ? "保存赛季修改" : "建立赛季档案"}</button>{seasonForm.seasonId ? <button type="button" onClick={() => setSeasonForm(emptySeasonForm)}>取消编辑</button> : null}</div>
        </form>

        <div className={styles.seasonList}>
          <header><div><p>SEASON INDEX</p><h3>已建立的赛季与队别</h3></div><strong>{seasons.length}</strong></header>
          {seasons.length ? seasons.map((item) => (
            <article key={item.id}>
              <span>{item.season}</span>
              <div><small>{squadLabel(item.squad)}</small><h4>{item.title}</h4><p>{item.summary || "摘要待补充"}</p></div>
              <em data-status={item.status}>{item.status === "published" ? "已公开" : item.status === "draft" ? "草稿" : "已归档"}</em>
              <div className={styles.seasonActions}><button type="button" onClick={() => editSeason(item)}>编辑资料</button><button type="button" disabled={busy === `season-${item.id}`} onClick={() => void updateSeasonStatus(item, item.status === "published" ? "draft" : "published")}>{item.status === "published" ? "转为草稿" : "公开"}</button></div>
            </article>
          )) : <p className={styles.emptyLine}>还没有结构化赛季档案，从第一届资料最完整的赛季开始建立即可。</p>}
        </div>
      </section>
    </section>
  );
}
