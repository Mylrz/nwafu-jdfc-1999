"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Check,
  CircleAlert,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundPen,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { emptySeasonRecord, type PlayerSeasonRecord } from "../../lib/player-seasons";
import { ArchiveWorkspace } from "./ArchiveWorkspace";
import { AdminOverview } from "./AdminOverview";
import { isDiffTargetBlocked, ProfileDiffPanel } from "./ProfileDiffPanel";
import styles from "./admin.module.css";

type Player = {
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
  status: string;
  updatedAt: string;
  seasonRecords: Array<PlayerSeasonRecord & { id: number }>;
};

type Message = {
  id: number;
  name: string;
  years: string;
  role: string;
  content: string;
  status: string;
  createdAt: string;
};

type Submission = {
  id: number;
  submitterName: string;
  title: string;
  season: string;
  contact: string;
  note: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  status: string;
  createdAt: string;
};

type PlayerSubmission = {
  id: number;
  season: string;
  name: string;
  jerseyNumber: string;
  position: string;
  role: string;
  major: string;
  classYear: string;
  contact: string;
  note: string;
  photoKey: string;
  photoFileName: string;
  status: string;
  createdAt: string;
  kind: "create" | "update";
  targetPlayerId: number | null;
  seasonRecords: Array<PlayerSeasonRecord & { id: number }>;
};

type ImportRow = {
  playerId: string;
  name: string;
  classYear: string;
  major: string;
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
  note: string;
};

type ImportPreview = ImportRow & { rowNumber: number; errors: string[] };
type PlayerForm = ReturnType<typeof makeEmptyPlayer>;
type Tab = "overview" | "players" | "archive" | "playerSubmissions" | "messages" | "submissions";
type Notice = { message: string; tone: "success" | "error" | "progress"; action?: { label: string; run: () => void } };
type Summary = {
  publishedPlayers: number;
  archivedPlayers: number;
  seasonsCount: number;
  pendingProfiles: number;
  pendingMessages: number;
  pendingFiles: number;
  missingPhotos: number;
  missingNumbers: number;
  totalSeasonRecords: number;
};

const makeEmptyPlayer = () => ({
  name: "",
  major: "",
  classYear: "",
  note: "",
  seasonRecords: [emptySeasonRecord()],
});

const statusLabel: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已忽略",
  archived: "已整理",
  published: "已公开",
  processing: "处理中",
};

function recordsForPlayer(player: Player) {
  return player.seasonRecords.length
    ? player.seasonRecords
    : [{ id: 0, season: player.season, jerseyNumber: player.jerseyNumber, position: player.position, role: player.role }];
}

function recordsForSubmission(item: PlayerSubmission) {
  return item.seasonRecords.length
    ? item.seasonRecords
    : [{ id: 0, season: item.season, jerseyNumber: item.jerseyNumber, position: item.position, role: item.role }];
}

function dateValue(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `请求失败（${response.status}）`);
  return result;
}

export function AdminDashboard({ displayName }: { displayName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSubmissions, setPlayerSubmissions] = useState<PlayerSubmission[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [playerForm, setPlayerForm] = useState<PlayerForm>(makeEmptyPlayer);
  const [initialPlayerForm, setInitialPlayerForm] = useState(() => JSON.stringify(makeEmptyPlayer()));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [playerStatusFilter, setPlayerStatusFilter] = useState("published");
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [reviewQuery, setReviewQuery] = useState("");
  const [reviewSort, setReviewSort] = useState<"oldest" | "newest">("oldest");
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  const isDirty = useMemo(() => JSON.stringify(playerForm) !== initialPlayerForm, [initialPlayerForm, playerForm]);

  const notify = useCallback((message: string, tone: Notice["tone"] = "success", action?: Notice["action"]) => {
    setNotice({ message, tone, action });
  }, []);

  const startBusy = useCallback((key: string) => setBusyKeys((keys) => keys.includes(key) ? keys : [...keys, key]), []);
  const stopBusy = useCallback((key: string) => setBusyKeys((keys) => keys.filter((item) => item !== key)), []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled([
      fetchJson<{ players?: Player[] }>("/api/admin/players"),
      fetchJson<{ submissions?: PlayerSubmission[] }>("/api/admin/player-submissions"),
      fetchJson<{ messages?: Message[] }>("/api/admin/messages"),
      fetchJson<{ submissions?: Submission[] }>("/api/admin/submissions"),
      fetchJson<{ summary?: Summary }>("/api/admin/summary"),
    ]);
    const labels = ["球员档案", "球员资料申请", "留言", "资料投稿", "档案统计"];
    const errors: string[] = [];

    if (results[0].status === "fulfilled") setPlayers(results[0].value.players ?? []);
    else errors.push(labels[0]);
    if (results[1].status === "fulfilled") setPlayerSubmissions(results[1].value.submissions ?? []);
    else errors.push(labels[1]);
    if (results[2].status === "fulfilled") setMessages(results[2].value.messages ?? []);
    else errors.push(labels[2]);
    if (results[3].status === "fulfilled") setSubmissions(results[3].value.submissions ?? []);
    else errors.push(labels[3]);
    if (results[4].status === "fulfilled") setSummary(results[4].value.summary ?? null);
    else errors.push(labels[4]);

    setLoadErrors(errors);
    setInitialLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadData(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadData]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const seasons = useMemo(
    () => Array.from(new Set(players.flatMap((player) => recordsForPlayer(player).map((record) => record.season)).filter(Boolean)))
      .sort((a, b) => b.localeCompare(a, "zh-CN", { numeric: true })),
    [players],
  );

  const localSummary = useMemo<Summary>(() => ({
    publishedPlayers: players.filter((player) => player.status === "published").length,
    archivedPlayers: players.filter((player) => player.status === "archived").length,
    seasonsCount: seasons.length,
    pendingProfiles: playerSubmissions.filter((item) => item.status === "pending").length,
    pendingMessages: messages.filter((item) => item.status === "pending").length,
    pendingFiles: submissions.filter((item) => item.status === "pending").length,
    missingPhotos: players.filter((player) => player.status === "published" && !player.photoKey).length,
    missingNumbers: players.filter((player) => player.status === "published")
      .reduce((total, player) => total + recordsForPlayer(player).filter((record) => !record.jerseyNumber).length, 0),
    totalSeasonRecords: players.filter((player) => player.status === "published")
      .reduce((total, player) => total + recordsForPlayer(player).length, 0),
  }), [messages, playerSubmissions, players, seasons.length, submissions]);

  const archiveSummary = { ...localSummary, ...(summary ?? {}) };
  const pendingTotal = archiveSummary.pendingProfiles + archiveSummary.pendingMessages + archiveSummary.pendingFiles;

  const filteredPlayers = useMemo(() => {
    const query = playerQuery.trim().toLowerCase();
    return players.filter((player) => {
      const records = recordsForPlayer(player);
      const matchesStatus = playerStatusFilter === "all" || player.status === playerStatusFilter;
      const matchesSeason = seasonFilter === "all" || records.some((record) => record.season === seasonFilter);
      const matchesQuery = !query || [player.name, player.major, player.classYear, String(player.id), ...records.flatMap((record) => [record.jerseyNumber, record.position, record.season])]
        .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesSeason && matchesQuery;
    });
  }, [playerQuery, playerStatusFilter, players, seasonFilter]);

  const visibleProfileSubmissions = useMemo(() => {
    const query = reviewQuery.trim().toLowerCase();
    return playerSubmissions
      .filter((item) => reviewFilter === "all" || item.status === reviewFilter)
      .filter((item) => !query || [item.name, item.contact, item.season, item.classYear, item.major, String(item.targetPlayerId ?? "")]
        .some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => (reviewSort === "oldest" ? 1 : -1) * (dateValue(a.createdAt) - dateValue(b.createdAt)));
  }, [playerSubmissions, reviewFilter, reviewQuery, reviewSort]);

  const visibleMessages = useMemo(() => {
    const query = reviewQuery.trim().toLowerCase();
    return messages
      .filter((item) => reviewFilter === "all" || item.status === reviewFilter)
      .filter((item) => !query || [item.name, item.years, item.role, item.content].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => (reviewSort === "oldest" ? 1 : -1) * (dateValue(a.createdAt) - dateValue(b.createdAt)));
  }, [messages, reviewFilter, reviewQuery, reviewSort]);

  const visibleSubmissions = useMemo(() => {
    const query = reviewQuery.trim().toLowerCase();
    return submissions
      .filter((item) => reviewFilter === "all" || item.status === reviewFilter)
      .filter((item) => !query || [item.title, item.submitterName, item.season, item.fileName, item.contact].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => (reviewSort === "oldest" ? 1 : -1) * (dateValue(a.createdAt) - dateValue(b.createdAt)));
  }, [reviewFilter, reviewQuery, reviewSort, submissions]);

  const oldestProfiles = useMemo(() => playerSubmissions.filter((item) => item.status === "pending")
    .slice().sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt)).slice(0, 3)
    .map((item) => ({ id: item.id, title: item.name, meta: item.kind === "update" ? `修改档案 #${item.targetPlayerId ?? "?"}` : "创建新档案", createdAt: item.createdAt })), [playerSubmissions]);
  const oldestMessages = useMemo(() => messages.filter((item) => item.status === "pending")
    .slice().sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt)).slice(0, 3)
    .map((item) => ({ id: item.id, title: item.name, meta: item.content, createdAt: item.createdAt })), [messages]);
  const oldestFiles = useMemo(() => submissions.filter((item) => item.status === "pending")
    .slice().sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt)).slice(0, 3)
    .map((item) => ({ id: item.id, title: item.title, meta: `${item.submitterName} · ${item.fileName}`, createdAt: item.createdAt })), [submissions]);

  const tabItems: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "overview", label: "待办首页", count: pendingTotal },
    { id: "players", label: "球员档案" },
    { id: "archive", label: "档案发布" },
    { id: "playerSubmissions", label: "球员资料", count: archiveSummary.pendingProfiles },
    { id: "messages", label: "留言审核", count: archiveSummary.pendingMessages },
    { id: "submissions", label: "资料投稿", count: archiveSummary.pendingFiles },
  ];

  function navigateTo(nextTab: Tab) {
    if (tab === "players" && nextTab !== "players" && isDirty && !window.confirm("球员表单还有未保存修改。切换页面会保留草稿，但请记得返回保存。继续切换吗？")) return;
    if (nextTab !== "players") setReviewFilter("pending");
    setReviewQuery("");
    setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateFromOverview(nextTab: "players" | "playerSubmissions" | "messages" | "submissions") {
    navigateTo(nextTab);
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabItems.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabItems.length) % tabItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabItems.length - 1;
    document.getElementById(`admin-tab-${tabItems[nextIndex].id}`)?.focus();
    navigateTo(tabItems[nextIndex].id);
  }

  function resetPlayerEditor() {
    const next = makeEmptyPlayer();
    setEditingId(null);
    setEditingUpdatedAt("");
    setPlayerForm(next);
    setInitialPlayerForm(JSON.stringify(next));
    setFormError("");
  }

  function cancelPlayerEdit() {
    if (isDirty && !window.confirm("放弃尚未保存的球员档案修改吗？")) return;
    resetPlayerEditor();
  }

  async function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const name = playerForm.name.trim();
    const seasonNames = playerForm.seasonRecords.map((record) => record.season.trim()).filter(Boolean);
    if (!name) {
      setFormError("请填写球员姓名。");
      document.getElementById("player-name")?.focus();
      return;
    }
    if (!seasonNames.length || new Set(seasonNames).size !== seasonNames.length) {
      setFormError(!seasonNames.length ? "请至少填写一个赛季。" : "同一个赛季只需保留一条号码记录。");
      document.getElementById("player-season-0")?.focus();
      return;
    }

    setSaving(true);
    notify("正在安全保存球员档案…", "progress");
    try {
      const response = await fetch("/api/admin/players", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, expectedUpdatedAt: editingUpdatedAt, ...playerForm } : playerForm),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        const message = result.error ?? "保存失败，请稍后重试。";
        setFormError(message);
        notify(message, "error");
        return;
      }
      resetPlayerEditor();
      notify(editingId ? "球员档案修改已保存。" : "新球员已加入档案。", "success");
      await loadData();
    } catch {
      setFormError("网络连接中断，表单内容仍保留，请重试。");
      notify("保存失败，表单内容仍保留。", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(player: Player) {
    if (!window.confirm(`将“${player.name}”移入归档吗？前台将不再显示，但资料可以恢复。`)) return;
    const key = `player-archive-${player.id}`;
    startBusy(key);
    try {
      const result = await fetchJson<{ updatedAt?: string }>(`/api/admin/players?id=${player.id}&expectedUpdatedAt=${encodeURIComponent(player.updatedAt)}`, { method: "DELETE" });
      const archivedPlayer = { ...player, status: "archived", updatedAt: result.updatedAt ?? player.updatedAt };
      notify(`${player.name} 已移入归档。`, "success", { label: "撤销归档", run: () => void restorePlayer(archivedPlayer) });
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : "归档失败，请重试。", "error");
    } finally {
      stopBusy(key);
    }
  }

  async function restorePlayer(player: Player) {
    const key = `player-restore-${player.id}`;
    startBusy(key);
    try {
      await fetchJson("/api/admin/players", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: player.id, action: "restore", expectedUpdatedAt: player.updatedAt }),
      });
      notify(`${player.name} 已恢复公开。`, "success");
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : "恢复失败，请重试。", "error");
    } finally {
      stopBusy(key);
    }
  }

  async function permanentlyDeletePlayer(player: Player) {
    if (player.photoKey) {
      notify("该档案仍有关联照片，请先确认照片的保留与授权状态。", "error");
      return;
    }
    if (!window.confirm(`永久删除“${player.name}”吗？球员档案和全部赛季号码记录都将无法恢复。系统会再次核对档案编号、姓名和版本。`)) return;
    const key = `player-delete-${player.id}`;
    startBusy(key);
    try {
      await fetchJson(`/api/admin/players?id=${player.id}&expectedUpdatedAt=${encodeURIComponent(player.updatedAt)}&permanent=true&confirmName=${encodeURIComponent(player.name)}`, { method: "DELETE" });
      if (editingId === player.id) resetPlayerEditor();
      notify(`${player.name} 的球员档案和赛季记录已永久删除。`, "success");
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : "永久删除失败，请刷新后重试。", "error");
    } finally {
      stopBusy(key);
    }
  }

  async function updateStatus(kind: "messages" | "submissions", id: number, nextStatus: string) {
    const key = `${kind}-${id}-${nextStatus}`;
    startBusy(key);
    try {
      await fetchJson(`/api/admin/${kind}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      notify("状态已更新。", "success");
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : "更新失败，请重试。", "error");
    } finally {
      stopBusy(key);
    }
  }

  async function reviewPlayerSubmission(item: PlayerSubmission, action: "approve" | "reject" | "pending") {
    if (action === "approve") {
      const target = item.targetPlayerId ? players.find((player) => player.id === item.targetPlayerId) ?? null : null;
      if (item.kind === "update" && isDiffTargetBlocked(target)) {
        notify("关联球员不存在或已归档，暂时不能通过这份修改。", "error");
        return;
      }
      const description = item.kind === "update"
        ? `将更新球员档案 #${item.targetPlayerId}，并合并 ${recordsForSubmission(item).length} 个赛季的资料。继续吗？`
        : `将创建“${item.name}”的正式球员档案。继续吗？`;
      if (!window.confirm(description)) return;
    }
    if (action === "reject" && !window.confirm(`确定不采用“${item.name}”提交的这份资料吗？之后仍可恢复待审。`)) return;

    const key = `profile-${item.id}-${action}`;
    startBusy(key);
    try {
      const result = await fetchJson<{ notice?: string }>("/api/admin/player-submissions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          action,
          expectedTargetUpdatedAt: item.kind === "update"
            ? players.find((player) => player.id === item.targetPlayerId)?.updatedAt ?? ""
            : undefined,
        }),
      });
      notify(result.notice ?? (action === "approve" ? "资料已审核并写入球员档案。" : "审核状态已更新。"), "success");
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : "审核失败，请重试。", "error");
    } finally {
      stopBusy(key);
    }
  }

  function editPlayer(player: Player) {
    if (isDirty && !window.confirm("当前有未保存修改，确定切换到另一名球员吗？")) return;
    const next = {
      name: player.name,
      major: player.major,
      classYear: player.classYear,
      note: player.note,
      seasonRecords: recordsForPlayer(player).map(({ season, jerseyNumber, position, role }) => ({ season, jerseyNumber, position, role })),
    };
    setEditingId(player.id);
    setEditingUpdatedAt(player.updatedAt);
    setPlayerForm(next);
    setInitialPlayerForm(JSON.stringify(next));
    setFormError("");
    window.requestAnimationFrame(() => document.getElementById("player-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function updatePlayerSeason(index: number, key: keyof PlayerSeasonRecord, value: string) {
    setPlayerForm((form) => ({
      ...form,
      seasonRecords: form.seasonRecords.map((record, recordIndex) => recordIndex === index ? { ...record, [key]: value } : record),
    }));
  }

  function removeSeasonRecord(index: number) {
    const record = playerForm.seasonRecords[index];
    const hasContent = Boolean(record.season || record.jerseyNumber || record.position || (record.role && record.role !== "队员"));
    if (hasContent && !window.confirm(`删除 ${record.season || "这一条"} 赛季记录吗？保存后该赛季号码将从档案中移除。`)) return;
    setPlayerForm((form) => ({ ...form, seasonRecords: form.seasonRecords.filter((_, recordIndex) => recordIndex !== index) }));
  }

  async function exportPlayers() {
    const Papa = (await import("papaparse")).default;
    const rows = filteredPlayers.flatMap((player) => recordsForPlayer(player)
      .filter((record) => seasonFilter === "all" || record.season === seasonFilter)
      .map((record) => ({
        "档案ID": player.id,
        "姓名": player.name,
        "年级": player.classYear,
        "专业": player.major,
        "赛季": record.season,
        "号码": record.jerseyNumber,
        "位置": record.position,
        "身份": record.role,
        "备注": player.note,
      })));
    const csv = `\uFEFF${Papa.unparse(rows, { escapeFormulae: true })}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `JDFC-球员档案-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadImportTemplate() {
    const Papa = (await import("papaparse")).default;
    const csv = `\uFEFF${Papa.unparse([{
      "档案ID": "",
      "姓名": "示例球员",
      "年级": "2023级",
      "专业": "机械设计制造及其自动化",
      "赛季": "2025",
      "号码": "10",
      "位置": "中场",
      "身份": "队员",
      "备注": "同一球员每个赛季一行",
    }], { escapeFormulae: true })}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "JDFC-球员档案导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function previewImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify("CSV 文件不能超过 2MB。", "error");
      return;
    }
    try {
      const Papa = (await import("papaparse")).default;
      const parsed = await new Promise<import("papaparse").ParseResult<Record<string, string>>>((resolve) => {
        Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: "greedy", worker: true, complete: resolve });
      });
      if (parsed.data.length > 500) {
        notify("单次最多导入 500 行，请拆分文件。", "error");
        return;
      }
      const previews = parsed.data.map((row, index) => {
        const preview: ImportPreview = {
          rowNumber: index + 2,
          playerId: (row["档案ID"] ?? row.playerId ?? "").trim(),
          name: (row["姓名"] ?? row.name ?? "").trim(),
          classYear: (row["年级"] ?? row.classYear ?? "").trim(),
          major: (row["专业"] ?? row.major ?? "").trim(),
          season: (row["赛季"] ?? row.season ?? "").trim(),
          jerseyNumber: (row["号码"] ?? row.jerseyNumber ?? "").trim(),
          position: (row["位置"] ?? row.position ?? "").trim(),
          role: (row["身份"] ?? row.role ?? "队员").trim() || "队员",
          note: (row["备注"] ?? row.note ?? "").trim(),
          errors: [],
        };
        if (!preview.name) preview.errors.push("姓名必填");
        if (!/^(?:19|20)\d{2}(?:[-—/]\d{2,4})?$/.test(preview.season)) preview.errors.push("赛季格式无效");
        if (preview.playerId && !/^\d+$/.test(preview.playerId)) preview.errors.push("档案ID应为数字");
        return preview;
      });
      setImportPreview(previews);
      setImportFileName(file.name);
      setImportOpen(true);
      notify(parsed.errors.length ? `CSV 有 ${parsed.errors.length} 条解析提示，请检查预览。` : `已解析 ${previews.length} 行，请确认后导入。`, parsed.errors.length ? "error" : "success");
    } catch {
      notify("无法读取这份 CSV，请确认文件编码和表头。", "error");
    }
  }

  async function commitImport() {
    if (!importPreview.length || importPreview.some((row) => row.errors.length)) return;
    setImporting(true);
    notify("正在写入球员档案，请不要关闭页面…", "progress");
    try {
      const response = await fetch("/api/admin/players/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: importPreview.map((row) => ({
          playerId: row.playerId,
          name: row.name,
          classYear: row.classYear,
          major: row.major,
          season: row.season,
          jerseyNumber: row.jerseyNumber,
          position: row.position,
          role: row.role,
          note: row.note,
        })) }),
      });
      const result = (await response.json()) as {
        error?: string;
        summary?: { created: number; updated: number; errors: number };
        results?: Array<{ name: string; status: string; detail: string }>;
      };
      if (result.summary) {
        notify(`导入完成：新增 ${result.summary.created} 人，更新 ${result.summary.updated} 人，失败 ${result.summary.errors} 人。`, result.summary.errors ? "error" : "success");
        setImportPreview((rows) => rows.map((row) => {
          const matched = result.results?.find((item) => item.name === row.name && item.status === "error");
          return matched ? { ...row, errors: [matched.detail] } : row;
        }));
      } else {
        notify(result.error ?? "导入失败，请检查文件。", "error");
      }
      if (response.ok) {
        await loadData();
        if (!result.summary?.errors) {
          setImportOpen(false);
          setImportPreview([]);
          setImportFileName("");
        }
      }
    } catch {
      notify("导入请求中断，预览仍保留，请重试。", "error");
    } finally {
      setImporting(false);
    }
  }

  const activePanelId = `admin-panel-${tab}`;
  const reviewStatusOptions = tab === "playerSubmissions"
    ? [{ value: "pending", label: "待处理" }, { value: "approved", label: "已通过" }, { value: "rejected", label: "已忽略" }, { value: "processing", label: "处理中 / 异常" }, { value: "all", label: "全部" }]
    : tab === "messages"
      ? [{ value: "pending", label: "待处理" }, { value: "approved", label: "已公开" }, { value: "rejected", label: "不公开" }, { value: "all", label: "全部" }]
      : [{ value: "pending", label: "待处理" }, { value: "approved", label: "已建立媒体档案" }, { value: "archived", label: "仅内部整理" }, { value: "rejected", label: "已忽略" }, { value: "all", label: "全部" }];

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/admin" aria-label="返回管理首页">
          <img src="/team/logo.jpg" alt="" />
          <span><strong>JDFC 档案管理</strong><small>ARCHIVE WORKSPACE</small></span>
        </Link>
        <nav aria-label="管理后台快捷入口">
          <span className={styles.adminName}>{displayName}</span>
          <button type="button" className={styles.headerAction} onClick={() => void loadData()} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? styles.spinning : ""} /><span>刷新</span>
          </button>
          <Link className={styles.headerAction} href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} /><span>查看网站</span></Link>
          <a className={styles.headerAction} href="/signout-with-chatgpt?return_to=/"><LogOut size={15} /><span>退出</span></a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <p><ShieldCheck size={15} /> PRIVATE ARCHIVE</p>
          <h1>球队档案工作台</h1>
          <span>先处理待办，再维护长期资料。每一次修改都更清楚、更安全。</span>
        </div>
        <div className={styles.heroStats}>
          <button type="button" onClick={() => navigateTo("overview")}><strong>{initialLoading ? "—" : pendingTotal}</strong><span>当前待办</span><ArrowRight size={17} /></button>
          <button type="button" onClick={() => navigateTo("players")}><strong>{initialLoading ? "—" : archiveSummary.publishedPlayers}</strong><span>公开球员</span><ArrowRight size={17} /></button>
          <span><strong>{initialLoading ? "—" : archiveSummary.seasonsCount}</strong><small>已收录赛季</small></span>
        </div>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="管理功能">
        {tabItems.map((item, index) => (
          <button
            type="button"
            role="tab"
            id={`admin-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`admin-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? styles.active : ""}
            onClick={() => navigateTo(item.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            key={item.id}
          >
            {item.label}{item.count ? <i aria-label={`${item.count} 项待办`}>{item.count}</i> : null}
          </button>
        ))}
      </div>

      {notice ? (
        <div className={styles.notice} data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"} aria-live={notice.tone === "error" ? "assertive" : "polite"} aria-atomic="true">
          {notice.tone === "progress" ? <LoaderCircle className={styles.spinning} size={17} /> : notice.tone === "error" ? <CircleAlert size={17} /> : <Check size={17} />}
          <span>{notice.message}</span>
          {notice.action ? <button type="button" onClick={notice.action.run}>{notice.action.label}</button> : null}
          <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label="关闭提示"><X size={15} /></button>
        </div>
      ) : null}

      {loadErrors.length ? (
        <div className={styles.loadError} role="alert">
          <CircleAlert size={18} />
          <span><strong>部分数据暂未加载：</strong>{loadErrors.join("、")}。已加载的区域仍可使用。</span>
          <button type="button" onClick={() => void loadData()} disabled={refreshing}>{refreshing ? "正在重试…" : "重新加载"}</button>
        </div>
      ) : null}

      {initialLoading ? (
        <section className={styles.loadingState} aria-live="polite"><LoaderCircle className={styles.spinning} size={28} /><strong>正在打开球队档案…</strong><span>加载球员、投稿与待审核资料</span></section>
      ) : null}

      {!initialLoading && tab === "overview" ? (
        <section role="tabpanel" id={activePanelId} aria-labelledby="admin-tab-overview">
          <AdminOverview
            playersCount={archiveSummary.publishedPlayers}
            archivedPlayers={archiveSummary.archivedPlayers}
            seasonsCount={archiveSummary.seasonsCount}
            pendingProfiles={archiveSummary.pendingProfiles}
            pendingMessages={archiveSummary.pendingMessages}
            pendingFiles={archiveSummary.pendingFiles}
            missingPhotos={archiveSummary.missingPhotos}
            missingNumbers={archiveSummary.missingNumbers}
            totalSeasonRecords={archiveSummary.totalSeasonRecords}
            profileItems={oldestProfiles}
            messageItems={oldestMessages}
            fileItems={oldestFiles}
            onNavigate={navigateFromOverview}
          />
        </section>
      ) : null}

      {!initialLoading && tab === "players" ? (
        <section className={styles.playerArea} role="tabpanel" id={activePanelId} aria-labelledby="admin-tab-players">
          <div className={styles.sectionHeading}>
            <div><p>PLAYER ARCHIVE</p><h2>球员与逐赛季号码</h2><span>每名球员只建一份档案，号码、位置和身份按赛季独立记录。</span></div>
            <button type="button" onClick={() => { if (isDirty && !window.confirm("放弃当前未保存内容并新建球员吗？")) return; resetPlayerEditor(); document.getElementById("player-editor")?.scrollIntoView({ behavior: "smooth" }); }}><Plus size={16} /> 新增球员</button>
          </div>

          <details className={styles.maintenancePanel} open={importOpen || undefined}>
            <summary><span><FileSpreadsheet size={18} /><strong>批量维护与安全备份</strong><small>CSV 导入、名单导出与完整 JSON 备份</small></span><ArrowRight size={17} /></summary>
            <div className={styles.maintenanceBody}>
              <p>CSV 一行代表一名球员的一个赛季。填写“档案ID”可以准确更新同名球员；JSON 备份含联系方式等私密数据，请妥善保管。</p>
              <div className={styles.maintenanceActions}>
                <label className={styles.importButton}><Upload size={15} />选择 CSV 并预览<input type="file" accept=".csv,text/csv" onChange={previewImport} /></label>
                <button type="button" onClick={() => void downloadImportTemplate()}><Download size={15} />下载导入模板</button>
                <a href="/api/admin/backup" download><DatabaseBackup size={15} />下载 JSON 备份</a>
              </div>
              {importOpen ? (
                <div className={styles.importReview}>
                  <header>
                    <div><strong>{importFileName}</strong><span>{importPreview.length} 行 · {importPreview.filter((row) => row.errors.length).length} 行需修正</span></div>
                    <button type="button" onClick={() => { setImportOpen(false); setImportPreview([]); setImportFileName(""); }}>关闭预览</button>
                  </header>
                  <div className={styles.importTableWrap}>
                    <table>
                      <thead><tr><th>行</th><th>档案ID</th><th>姓名</th><th>年级</th><th>赛季</th><th>号码</th><th>位置</th><th>校验</th></tr></thead>
                      <tbody>{importPreview.slice(0, 100).map((row) => (
                        <tr key={row.rowNumber} data-error={row.errors.length ? "true" : "false"}>
                          <td>{row.rowNumber}</td><td>{row.playerId || "新增"}</td><td>{row.name || "—"}</td><td>{row.classYear || "—"}</td><td>{row.season || "—"}</td><td>{row.jerseyNumber || "—"}</td><td>{row.position || "—"}</td><td>{row.errors.length ? row.errors.join("；") : "通过"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  {importPreview.length > 100 ? <small>这里只显示前 100 行，提交时会处理全部 {importPreview.length} 行。</small> : null}
                  <footer>
                    <span>提交时仍会在服务端复验；同一球员的多行会合并为逐年号码记录。</span>
                    <button type="button" disabled={importing || !importPreview.length || importPreview.some((row) => row.errors.length > 0)} onClick={() => void commitImport()}>{importing ? <><LoaderCircle className={styles.spinning} size={15} />正在导入</> : "确认导入有效数据"}</button>
                  </footer>
                </div>
              ) : null}
            </div>
          </details>

          <form id="player-editor" className={styles.playerForm} onSubmit={savePlayer} noValidate>
            <header className={styles.formHeader}>
              <div><span>{editingId ? `PLAYER #${editingId}` : "NEW PLAYER"}</span><h2>{editingId ? `编辑 · ${playerForm.name || "未命名球员"}` : "新增球员档案"}</h2></div>
              {isDirty ? <em>有未保存修改</em> : null}
            </header>
            {formError ? <p className={styles.fieldError} role="alert"><CircleAlert size={16} />{formError}</p> : null}
            <div className={styles.formGrid}>
              <label htmlFor="player-name">姓名<input id="player-name" value={playerForm.name} onChange={(event) => setPlayerForm({ ...playerForm, name: event.target.value })} disabled={saving} required /></label>
              <label>专业<input value={playerForm.major} onChange={(event) => setPlayerForm({ ...playerForm, major: event.target.value })} disabled={saving} /></label>
              <label>年级<input value={playerForm.classYear} onChange={(event) => setPlayerForm({ ...playerForm, classYear: event.target.value })} disabled={saving} /></label>
              <label className={styles.full}>球员简介<textarea value={playerForm.note} onChange={(event) => setPlayerForm({ ...playerForm, note: event.target.value })} rows={3} disabled={saving} /></label>
              <fieldset className={`${styles.full} ${styles.seasonEditor}`}>
                <legend>逐年球衣记录</legend>
                {playerForm.seasonRecords.map((record, index) => (
                  <div className={styles.seasonEditorRow} key={index}>
                    <label>赛季<input id={`player-season-${index}`} value={record.season} onChange={(event) => updatePlayerSeason(index, "season", event.target.value)} required placeholder="2025" disabled={saving} /></label>
                    <label>号码<input value={record.jerseyNumber} onChange={(event) => updatePlayerSeason(index, "jerseyNumber", event.target.value)} placeholder="10" disabled={saving} /></label>
                    <label>位置<input value={record.position} onChange={(event) => updatePlayerSeason(index, "position", event.target.value)} placeholder="中场" disabled={saving} /></label>
                    <label>身份<input value={record.role} onChange={(event) => updatePlayerSeason(index, "role", event.target.value)} disabled={saving} /></label>
                    {playerForm.seasonRecords.length > 1 ? <button type="button" onClick={() => removeSeasonRecord(index)} disabled={saving}>删除</button> : null}
                  </div>
                ))}
                <button type="button" onClick={() => setPlayerForm((form) => ({ ...form, seasonRecords: [...form.seasonRecords, emptySeasonRecord("")] }))} disabled={saving}><Plus size={15} />添加赛季</button>
              </fieldset>
            </div>
            <div className={styles.formActions}>
              <button type="submit" disabled={saving || !isDirty}>{saving ? <><LoaderCircle className={styles.spinning} size={16} />正在保存</> : editingId ? "保存修改" : "加入档案"}</button>
              {(editingId || isDirty) ? <button type="button" onClick={cancelPlayerEdit} disabled={saving}>取消</button> : null}
              {editingId ? <span>保存时会检查是否被另一位管理员更新</span> : null}
            </div>
          </form>

          <div className={styles.recordsPanel}>
            <div className={styles.recordsHeader}><div><h2>档案列表</h2><span>{filteredPlayers.length} 名球员</span></div></div>
            <div className={styles.toolbar}>
              <label className={styles.searchField}><span className={styles.srOnly}>搜索球员</span><Search size={16} /><input type="search" value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="姓名、号码、位置、专业或ID" /></label>
              <label><span className={styles.srOnly}>筛选公开状态</span><select value={playerStatusFilter} onChange={(event) => setPlayerStatusFilter(event.target.value)}><option value="published">前台公开</option><option value="archived">已归档</option><option value="all">全部状态</option></select></label>
              <label><span className={styles.srOnly}>筛选赛季</span><select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)}><option value="all">全部赛季</option>{seasons.map((season) => <option key={season}>{season}</option>)}</select></label>
              <button type="button" onClick={() => void exportPlayers()}><Download size={15} />导出 CSV</button>
            </div>
            <div className={styles.records}>
              {filteredPlayers.length ? filteredPlayers.map((player) => {
                const records = recordsForPlayer(player);
                const playerBusy = busyKeys.some((key) => key.startsWith("player-") && key.includes(`-${player.id}`));
                return (
                  <article key={player.id}>
                    {player.photoKey ? <img className={styles.playerThumb} src={`/api/players/${player.id}/photo`} alt={`${player.name}档案照片`} /> : <span className={styles.number}>{records[0].jerseyNumber || "—"}</span>}
                    <div>
                      <div className={styles.seasonBadges}>{player.status === "archived" ? <span className={styles.archivedBadge}><b>已归档</b> · 前台不可见</span> : null}{records.map((record) => <span key={`${record.id}-${record.season}`}><b>{record.season}</b> · {record.jerseyNumber ? `${record.jerseyNumber}号` : "号码待补"}</span>)}</div>
                      <h3>{player.name}<small>#{player.id}</small></h3>
                      <p>{[records[0].role, player.major, player.classYear].filter(Boolean).join(" · ") || "资料待补充"}</p>
                    </div>
                    <aside>
                      <button type="button" onClick={() => editPlayer(player)} disabled={playerBusy}><UserRoundPen size={14} />编辑</button>
                      {player.status === "archived" ? <>
                        <button type="button" onClick={() => void restorePlayer(player)} disabled={playerBusy}>{playerBusy ? <LoaderCircle className={styles.spinning} size={14} /> : <RotateCcw size={14} />}恢复公开</button>
                        <button className={styles.dangerButton} type="button" onClick={() => void permanentlyDeletePlayer(player)} disabled={playerBusy}><Trash2 size={14} />永久删除</button>
                      </> : <button type="button" onClick={() => void deletePlayer(player)} disabled={playerBusy}>{playerBusy ? <LoaderCircle className={styles.spinning} size={14} /> : <Archive size={14} />}移入归档</button>}
                    </aside>
                  </article>
                );
              }) : <p className={styles.empty}>没有符合当前筛选条件的球员。</p>}
            </div>
          </div>
        </section>
      ) : null}

      {!initialLoading && !["overview", "players", "archive"].includes(tab) ? (
        <div className={styles.reviewToolbar}>
          <label className={styles.searchField}><span className={styles.srOnly}>搜索当前审核队列</span><Search size={16} /><input type="search" value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} placeholder="搜索当前队列" /></label>
          <label><span>状态</span><select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>{reviewStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <label><span>排序</span><select value={reviewSort} onChange={(event) => setReviewSort(event.target.value as "oldest" | "newest")}><option value="oldest">最早提交优先</option><option value="newest">最新提交优先</option></select></label>
        </div>
      ) : null}

      {!initialLoading && tab === "archive" ? (
        <div role="tabpanel" id={activePanelId} aria-labelledby="admin-tab-archive">
          <ArchiveWorkspace submissions={submissions} onSubmissionUpdated={loadData} />
        </div>
      ) : null}

      {!initialLoading && tab === "playerSubmissions" ? (
        <section className={styles.reviewList} role="tabpanel" id={activePanelId} aria-labelledby="admin-tab-playerSubmissions">
          <div className={styles.sectionHeading}><div><p>PROFILE REVIEW</p><h2>球员资料审核</h2><span>修改申请先核对差异；新建申请先检查是否有同名档案。</span></div></div>
          {visibleProfileSubmissions.length ? visibleProfileSubmissions.map((item) => {
            const target = item.targetPlayerId ? players.find((player) => player.id === item.targetPlayerId) ?? null : null;
            const blocked = item.kind === "update" && isDiffTargetBlocked(target);
            const duplicates = item.kind === "create" ? players.filter((player) => player.status === "published" && player.name.trim() === item.name.trim()).slice(0, 3) : [];
            const itemBusy = busyKeys.some((key) => key.startsWith(`profile-${item.id}-`));
            return (
              <article className={styles.profileReview} key={item.id}>
                <header><div><strong>{item.name}</strong><span>{item.kind === "update" ? `修改档案 #${item.targetPlayerId ?? "?"}` : "创建新档案"} · {recordsForSubmission(item).length} 个赛季</span></div><em data-status={item.status}>{statusLabel[item.status] ?? item.status}</em></header>
                <div className={styles.profileReviewBody}>
                  {item.photoKey ? <a className={styles.submittedPhoto} href={`/api/admin/player-submissions/${item.id}/photo`} target="_blank" rel="noreferrer"><img src={`/api/admin/player-submissions/${item.id}/photo`} alt={`${item.name}提交的照片`} /><span>查看原图 <ExternalLink size={13} /></span></a> : <div className={styles.noPhoto}>未提交照片</div>}
                  <div>
                    {item.kind === "update" ? <ProfileDiffPanel submission={item} target={target} /> : null}
                    {duplicates.length ? <div className={styles.duplicateWarning}><CircleAlert size={17} /><div><strong>发现同名公开档案</strong><p>请确认不是重复建档：{duplicates.map((player) => `#${player.id} ${player.name}（${player.classYear || "年级待补"}）`).join("、")}</p></div></div> : null}
                    {item.kind === "create" ? <div className={styles.reviewSeasons}>{recordsForSubmission(item).map((record) => <span key={`${record.id}-${record.season}`}><b>{record.season}</b><strong>{record.jerseyNumber || "—"}号</strong><small>{record.position || "位置待补"} · {record.role || "队员"}</small></span>)}</div> : null}
                    <dl><div><dt>专业 / 年级</dt><dd>{[item.major, item.classYear].filter(Boolean).join(" · ") || "未填写"}</dd></div><div><dt>联系方式</dt><dd>{item.contact}</dd></div><div><dt>提交时间</dt><dd>{new Date(item.createdAt).toLocaleString("zh-CN")}</dd></div></dl>
                    <p className={styles.submissionNote}>{item.note || "没有补充简介"}</p>
                  </div>
                </div>
                <footer>
                  {item.status === "pending" ? <><button type="button" disabled={itemBusy || blocked} aria-disabled={itemBusy || blocked} title={blocked ? "关联球员不存在或已归档" : undefined} onClick={() => void reviewPlayerSubmission(item, "approve")}>{itemBusy ? <LoaderCircle className={styles.spinning} size={15} /> : <Check size={15} />}{itemBusy ? "正在入库" : "审核通过并入库"}</button><button type="button" disabled={itemBusy} onClick={() => void reviewPlayerSubmission(item, "reject")}>不采用</button></> : null}
                  {["rejected", "processing"].includes(item.status) ? <button type="button" disabled={itemBusy} onClick={() => void reviewPlayerSubmission(item, "pending")}><RotateCcw size={15} />{item.status === "processing" ? "解除异常并恢复待审" : "恢复待审"}</button> : null}
                  {item.status === "approved" ? <span className={styles.completedAction}><Check size={15} />已经写入正式档案</span> : null}
                </footer>
              </article>
            );
          }) : <p className={styles.empty}>当前筛选下没有球员资料提交。</p>}
        </section>
      ) : null}

      {!initialLoading && tab === "messages" ? (
        <section className={styles.reviewList} role="tabpanel" id={activePanelId} aria-labelledby="admin-tab-messages">
          <div className={styles.sectionHeading}><div><p>GUESTBOOK REVIEW</p><h2>老队员留言审核</h2><span>公开后的内容会出现在球队网站留言墙。</span></div></div>
          {visibleMessages.length ? visibleMessages.map((message) => {
            const itemBusy = busyKeys.some((key) => key.startsWith(`messages-${message.id}-`));
            return <article key={message.id}><header><div><strong>{message.name}</strong><span>{message.years || "年份待补"} · {message.role || "身份待补"}</span></div><em data-status={message.status}>{statusLabel[message.status] ?? message.status}</em></header><blockquote>“{message.content}”</blockquote><small>提交于 {new Date(message.createdAt).toLocaleString("zh-CN")}</small><footer>{message.status === "pending" ? <><button type="button" disabled={itemBusy} onClick={() => void updateStatus("messages", message.id, "approved")}>{itemBusy ? <LoaderCircle className={styles.spinning} size={15} /> : <Check size={15} />}公开留言</button><button type="button" disabled={itemBusy} onClick={() => void updateStatus("messages", message.id, "rejected")}>不公开</button></> : <button type="button" disabled={itemBusy} onClick={() => void updateStatus("messages", message.id, "pending")}><RotateCcw size={15} />恢复待审</button>}</footer></article>;
          }) : <p className={styles.empty}>当前筛选下没有留言。</p>}
        </section>
      ) : null}

      {!initialLoading && tab === "submissions" ? (
        <section className={styles.reviewList} role="tabpanel" id={activePanelId} aria-labelledby="admin-tab-submissions">
          <div className={styles.sectionHeading}><div><p>MEMORY INBOX</p><h2>老照片与资料投稿</h2><span>照片可进入“档案发布”补齐说明与授权后公开；PDF 等资料继续保留在内部档案。</span></div><button type="button" onClick={() => navigateTo("archive")}><FileImage size={15} />打开档案发布</button></div>
          {visibleSubmissions.length ? visibleSubmissions.map((submission) => {
            const itemBusy = busyKeys.some((key) => key.startsWith(`submissions-${submission.id}-`));
            const isImage = submission.contentType?.startsWith("image/");
            return (
              <article key={submission.id}>
                <header><div><strong>{submission.title}</strong><span>{submission.submitterName} · {submission.season || "年份待确认"}</span></div><em data-status={submission.status}>{submission.status === "approved" ? "已建立媒体档案" : statusLabel[submission.status] ?? submission.status}</em></header>
                <p className={styles.fileNote}>{submission.note || "没有补充说明"}</p>
                <dl className={styles.fileMeta}><div><dt>联系方式</dt><dd>{submission.contact || "未填写"}</dd></div><div><dt>文件</dt><dd>{submission.fileName}</dd></div><div><dt>大小</dt><dd>{(submission.fileSize / 1024 / 1024).toFixed(1)} MB</dd></div><div><dt>提交时间</dt><dd>{new Date(submission.createdAt).toLocaleString("zh-CN")}</dd></div></dl>
                <footer>
                  <a href={`/api/admin/submissions/${submission.id}/file`} target="_blank" rel="noreferrer"><ExternalLink size={15} />查看文件</a>
                  {submission.status === "pending" ? <>
                    {isImage ? <button type="button" disabled={itemBusy} onClick={() => navigateTo("archive")}><FileImage size={15} />整理并发布</button> : null}
                    <button type="button" disabled={itemBusy} onClick={() => void updateStatus("submissions", submission.id, "archived")}>{itemBusy ? <LoaderCircle className={styles.spinning} size={15} /> : <Check size={15} />}{isImage ? "仅作内部资料" : "已整理"}</button>
                    <button type="button" disabled={itemBusy} onClick={() => void updateStatus("submissions", submission.id, "rejected")}>忽略</button>
                  </> : null}
                  {submission.status === "approved" ? <><span className={styles.completedAction}><Check size={15} />已建立媒体档案，公开状态以发布工作台为准</span><button type="button" onClick={() => navigateTo("archive")}><FileImage size={15} />管理媒体档案</button></> : null}
                  {["archived", "rejected"].includes(submission.status) ? <button type="button" disabled={itemBusy} onClick={() => void updateStatus("submissions", submission.id, "pending")}><RotateCcw size={15} />恢复待处理</button> : null}
                </footer>
              </article>
            );
          }) : <p className={styles.empty}>当前筛选下没有资料投稿。</p>}
        </section>
      ) : null}
    </main>
  );
}
