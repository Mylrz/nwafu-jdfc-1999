"use client";

import { ChevronDown, ChevronUp, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { formatFileSize, optimizeImage } from "../../lib/compress-image";
import { emptySeasonRecord, type PlayerSeasonRecord } from "../../lib/player-seasons";

type PlayerProfileTarget = {
  id: number;
  name: string;
  major: string;
  classYear: string;
  note: string;
  seasonRecords: PlayerSeasonRecord[];
};

export function PlayerProfileSubmission() {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [seasonRecords, setSeasonRecords] = useState<PlayerSeasonRecord[]>([emptySeasonRecord()]);
  const [target, setTarget] = useState<PlayerProfileTarget | null>(null);
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [classYear, setClassYear] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function applyTarget(nextTarget: PlayerProfileTarget) {
      setTarget(nextTarget);
      setName(nextTarget.name);
      setMajor(nextTarget.major);
      setClassYear(nextTarget.classYear);
      setNote(nextTarget.note);
      setSeasonRecords(nextTarget.seasonRecords.length ? nextTarget.seasonRecords : [emptySeasonRecord()]);
      setStatus(`正在为「${nextTarget.name}」提交补充或更正，审核后才会更新公开档案。`);
      setOpen(true);
    }

    const saved = window.sessionStorage.getItem("jdfc-player-profile-target");
    if (saved) {
      try { applyTarget(JSON.parse(saved) as PlayerProfileTarget); } catch { window.sessionStorage.removeItem("jdfc-player-profile-target"); }
    }

    const handleRequest = (event: Event) => applyTarget((event as CustomEvent<PlayerProfileTarget>).detail);
    window.addEventListener("jdfc:request-player-update", handleRequest);
    return () => window.removeEventListener("jdfc:request-player-update", handleRequest);
  }, []);

  function clearTarget() {
    setTarget(null);
    setName("");
    setMajor("");
    setClassYear("");
    setNote("");
    setSeasonRecords([emptySeasonRecord()]);
    setStatus("");
    window.sessionStorage.removeItem("jdfc-player-profile-target");
  }

  function updateSeasonRecord(index: number, key: keyof PlayerSeasonRecord, value: string) {
    setSeasonRecords((records) => records.map((record, recordIndex) => recordIndex === index ? { ...record, [key]: value } : record));
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const seasons = seasonRecords.map((record) => record.season.trim()).filter(Boolean);
    if (!seasons.length || new Set(seasons).size !== seasons.length) {
      setStatus(!seasons.length ? "请至少填写一个效力赛季。" : "同一个赛季只需填写一次。");
      return;
    }
    const form = event.currentTarget;
    setSubmitting(true);
    const body = new FormData(form);
    const photo = body.get("photo");
    if (photo instanceof File && photo.size > 0) {
      setStatus("正在本地优化球员照片…");
      const optimized = await optimizeImage(photo, { maxDimension: 1200, quality: 0.82 });
      body.set("photo", optimized.file);
      setStatus(optimized.optimized
        ? `照片已从 ${formatFileSize(optimized.originalSize)} 优化至 ${formatFileSize(optimized.file.size)}，正在提交…`
        : "正在提交资料…");
    } else {
      setStatus("正在提交资料…");
    }

    try {
      const response = await fetch("/api/player-submissions", { method: "POST", body });
      const result = (await response.json()) as { error?: string; notice?: string };
      setStatus(result.notice ?? result.error ?? "提交失败，请稍后重试。");
      if (response.ok) {
        form.reset();
        setTarget(null);
        setName("");
        setMajor("");
        setClassYear("");
        setNote("");
        setSeasonRecords([emptySeasonRecord()]);
        window.sessionStorage.removeItem("jdfc-player-profile-target");
      }
    } catch {
      setStatus("网络连接中断，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`player-contribution${open ? " is-open" : ""}`} id="player-submit">
      <div className="player-contribution-copy">
        <p>{target ? "PROFILE UPDATE · 球员档案更正" : "PLAYER PROFILE FORM · 球员资料填报"}</p>
        <h3>{target ? <>正在补充「{target.name}」的档案。<br />每次修改都由管理员核对。</> : <>你曾穿过这件球衣？<br />在这里提交球员档案。</>}</h3>
        <span className="privacy-note"><ShieldCheck aria-hidden="true" />由球员本人提交，联系方式仅管理员可见；审核确认后才会出现在公开档案中。</span>
        {target ? <button className="profile-mode-reset" type="button" onClick={clearTarget}>取消修改，改为创建新档案</button> : null}
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="player-profile-form">
          {open ? "收起填写" : "提交我的球员资料"} {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <form className="player-profile-form" id="player-profile-form" onSubmit={submitProfile}>
          <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <input type="hidden" name="kind" value={target ? "update" : "create"} />
          {target ? <input type="hidden" name="targetPlayerId" value={target.id} /> : null}
          <label>姓名<input name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={30} required placeholder="真实姓名" /></label>
          <input type="hidden" name="seasonRecords" value={JSON.stringify(seasonRecords)} readOnly />
          <fieldset className="season-records-fieldset">
            <legend><span>逐年球衣记录</span><small>每个赛季分别填写当年的号码</small></legend>
            <div className="season-record-list">
              {seasonRecords.map((record, index) => (
                <div className="season-record-row" key={index}>
                  <label>赛季<input value={record.season} onChange={(event) => updateSeasonRecord(index, "season", event.target.value)} maxLength={10} required placeholder="2025" /></label>
                  <label>号码<input value={record.jerseyNumber} onChange={(event) => updateSeasonRecord(index, "jerseyNumber", event.target.value)} maxLength={8} placeholder="10" /></label>
                  <label>位置<select value={record.position} onChange={(event) => updateSeasonRecord(index, "position", event.target.value)}><option value="">请选择</option><option>门将</option><option>后卫</option><option>中场</option><option>前锋</option><option>其他</option></select></label>
                  <label>身份<input value={record.role} onChange={(event) => updateSeasonRecord(index, "role", event.target.value)} maxLength={20} /></label>
                  {seasonRecords.length > 1 ? <button type="button" onClick={() => setSeasonRecords((records) => records.filter((_, recordIndex) => recordIndex !== index))} aria-label={`删除第${index + 1}条赛季记录`}><Trash2 aria-hidden="true" /></button> : null}
                </div>
              ))}
            </div>
            <button className="add-season-record" type="button" onClick={() => setSeasonRecords((records) => [...records, emptySeasonRecord("")])}>
              <Plus aria-hidden="true" />添加另一个赛季
            </button>
          </fieldset>
          <div className="form-row">
            <label>专业<input name="major" value={major} onChange={(event) => setMajor(event.target.value)} maxLength={50} placeholder="例如 机械设计制造及其自动化" /></label>
            <label>年级<input name="classYear" value={classYear} onChange={(event) => setClassYear(event.target.value)} maxLength={20} placeholder="例如 2021级" /></label>
          </div>
          <label>联系方式<input name="contact" maxLength={80} required placeholder="微信、邮箱或电话，仅管理员可见" /></label>
          <label>个人简介 / 球队记忆<textarea name="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} rows={4} placeholder="可以写场上位置、任职经历或最难忘的一场比赛" /></label>
          <label className="file-field player-photo-field">
            <span><Upload aria-hidden="true" />个人或赛场照片（选填）</span>
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" />
            <small>JPG / PNG / WebP 会在本地自动优化；HEIC 原样上传，最大 8MB</small>
          </label>
          <label className="consent-field"><input name="consent" type="checkbox" required />我确认资料真实，并同意审核后用于球队纪念网站展示。</label>
          <button type="submit" disabled={submitting}>{submitting ? "正在安全提交…" : <>提交审核 <span>→</span></>}</button>
          <p className="form-status" role="status">{status}</p>
        </form>
      ) : null}
    </div>
  );
}
