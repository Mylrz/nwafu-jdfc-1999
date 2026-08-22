"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatFileSize, optimizeImage } from "../../lib/compress-image";

type GuestbookMessage = {
  id: number;
  name: string;
  years: string;
  role: string;
  content: string;
  createdAt: string;
};

export function CommunitySections() {
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [messagesError, setMessagesError] = useState(false);
  const [messagesRequestVersion, setMessagesRequestVersion] = useState(0);
  const [guestbookStatus, setGuestbookStatus] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [submittingArchive, setSubmittingArchive] = useState(false);

  useEffect(() => {
    fetch("/api/guestbook")
      .then(async (response) => {
        if (!response.ok) throw new Error("Guestbook unavailable");
        return await response.json() as { messages?: GuestbookMessage[] };
      })
      .then((data) => { setMessages(data.messages ?? []); setMessagesError(false); })
      .catch(() => { setMessages([]); setMessagesError(true); });
  }, [messagesRequestVersion]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingMessage) return;
    setSubmittingMessage(true);
    setGuestbookStatus("正在提交…");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { error?: string; notice?: string };
      setGuestbookStatus(result.notice ?? result.error ?? "提交失败，请稍后重试。");
      if (response.ok) form.reset();
    } catch {
      setGuestbookStatus("网络连接中断，请稍后重试。");
    } finally {
      setSubmittingMessage(false);
    }
  }

  async function submitArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingArchive) return;
    setSubmittingArchive(true);
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get("file");

    if (file instanceof File && file.type.startsWith("image/") && file.size > 0) {
      setSubmissionStatus("正在优化照片，减少手机流量…");
      const result = await optimizeImage(file, { maxDimension: 2400, quality: 0.84 });
      body.set("file", result.file);
      setSubmissionStatus(result.optimized
        ? `照片已从 ${formatFileSize(result.originalSize)} 优化至 ${formatFileSize(result.file.size)}，正在上传…`
        : "正在上传，请不要关闭页面…");
    } else {
      setSubmissionStatus("正在上传，请不要关闭页面…");
    }

    try {
      const response = await fetch("/api/submissions", { method: "POST", body });
      const result = (await response.json()) as { error?: string; notice?: string };
      setSubmissionStatus(result.notice ?? result.error ?? "上传失败，请稍后重试。");
      if (response.ok) form.reset();
    } catch {
      setSubmissionStatus("网络连接中断，请保留文件后重试。");
    } finally {
      setSubmittingArchive(false);
    }
  }

  return (
    <>
      <section className="guestbook section" id="guestbook">
        <div className="section-head">
          <p className="kicker">09 / ALUMNI WALL</p>
          <p className="section-index">写给这支球队</p>
        </div>

        <div className="guestbook-grid">
          <div className="guestbook-copy">
            <h2>多年以后，<br />再和队友说句话。</h2>
            <p>留言将在管理员审核后公开。可以写下你的届数、号码、位置，或者某场一直记得的比赛。</p>
            <form className="memory-form" onSubmit={submitMessage}>
              <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="form-row">
                <label>姓名<input name="name" maxLength={30} required placeholder="你的名字" /></label>
                <label>效力年份<input name="years" maxLength={30} placeholder="例如 2018—2022" /></label>
              </div>
              <label>身份<input name="role" maxLength={30} placeholder="例如 10号 / 队长 / 领队" /></label>
              <label>留言<textarea name="content" maxLength={500} minLength={4} required placeholder="写下想对球队说的话" rows={5} /></label>
              <button type="submit" disabled={submittingMessage}>{submittingMessage ? "正在提交…" : <>提交留言 <span>→</span></>}</button>
              <p className="form-status" role="status">{guestbookStatus}</p>
            </form>
          </div>

          <div className="message-wall">
            {messages.length ? messages.map((message) => (
              <article key={message.id}>
                <p>“{message.content}”</p>
                <footer>
                  <strong>{message.name}</strong>
                  <span>{[message.years, message.role].filter(Boolean).join(" · ")}</span>
                </footer>
              </article>
            )) : messagesError ? (
              <div className="message-empty" role="alert">
                <span>···</span>
                <strong>留言墙暂时没有打开。</strong>
                <p>已经公开的留言没有丢失，请稍后重新读取。</p>
                <button type="button" onClick={() => { setMessagesError(false); setMessagesRequestVersion((value) => value + 1); }}>重新读取留言</button>
              </div>
            ) : (
              <div className="message-empty">
                <span>001</span>
                <strong>第一条留言，等一位老队员来写。</strong>
                <p>每一句真实的回忆，都会成为球队历史的一部分。</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="contribute" id="contribute">
        <div className="contribute-copy">
          <p className="eyebrow"><span /> ARCHIVE CONTRIBUTION</p>
          <h2>你硬盘里的旧照片，<br />可能正是缺失的队史。</h2>
          <p>欢迎提交老照片、获奖证书、名单或赛季资料。管理员审核后会整理进网站，文件不会直接公开。</p>
        </div>

        <form className="archive-form" onSubmit={submitArchive}>
          <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="form-row">
            <label>提交人<input name="submitterName" maxLength={30} required placeholder="你的名字" /></label>
            <label>大致年份<input name="season" maxLength={20} placeholder="例如 2012" /></label>
          </div>
          <label>资料标题<input name="title" maxLength={80} required placeholder="例如 2012届球队毕业合影" /></label>
          <label>联系方式<input name="contact" maxLength={80} placeholder="微信、邮箱或电话（仅管理员可见）" /></label>
          <label>补充说明<textarea name="note" maxLength={500} rows={3} placeholder="照片里有哪些人、发生了什么" /></label>
          <label className="file-field">
            <span>选择照片或 PDF</span>
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" required />
            <small>JPG / PNG / WebP 会在本地自动优化；HEIC / PDF 原样上传，最大 15MB</small>
          </label>
          <label className="consent-field">
            <input name="consent" type="checkbox" required />
            我确认拥有这份资料的投稿权，并同意管理员审核后将适合公开的内容用于球队纪念网站；联系方式仅管理员可见。
          </label>
          <button type="submit" disabled={submittingArchive}>{submittingArchive ? "正在安全上传…" : <>提交球队档案 <span>↗</span></>}</button>
          <p className="form-status" role="status">{submissionStatus}</p>
        </form>
      </section>
    </>
  );
}
