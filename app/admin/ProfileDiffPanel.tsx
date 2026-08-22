"use client";

import { AlertTriangle, ArrowRight, ImagePlus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import styles from "./ProfileDiffPanel.module.css";

export type ProfileDiffSeasonRecord = {
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
};

type ProfileDiffBase = {
  name: string;
  major: string;
  classYear: string;
  note: string;
  photoKey: string;
  season: string;
  jerseyNumber?: string;
  position?: string;
  role?: string;
  seasonRecords?: readonly ProfileDiffSeasonRecord[];
};

export type ProfileDiffSubmission = ProfileDiffBase;

export type ProfileDiffTarget = ProfileDiffBase & {
  id: number;
  status: string;
};

export type ProfileDiffPanelProps = {
  submission: ProfileDiffSubmission;
  target: ProfileDiffTarget | null;
  className?: string;
};

type ChangeState = "added" | "changed" | "cleared" | "unchanged";

type FieldDiff = {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
  state: ChangeState;
};

type SeasonDiff = {
  season: string;
  state: "added" | "changed" | "unchanged";
  fields: FieldDiff[];
};

const emptyTarget: ProfileDiffTarget = {
  id: 0,
  status: "missing",
  name: "",
  major: "",
  classYear: "",
  note: "",
  photoKey: "",
  season: "",
  seasonRecords: [],
};

const stateLabel: Record<ChangeState, string> = {
  added: "新增",
  changed: "已修改",
  cleared: "将清空",
  unchanged: "无变化",
};

export function isDiffTargetBlocked(target: ProfileDiffTarget | null): boolean {
  return !target || target.status !== "published";
}

function clean(value: string | undefined) {
  return String(value ?? "").trim();
}

function compareField(key: string, label: string, oldValue: string | undefined, newValue: string | undefined): FieldDiff {
  const previous = clean(oldValue);
  const next = clean(newValue);
  let state: ChangeState = "unchanged";
  if (previous !== next) state = !previous && next ? "added" : previous && !next ? "cleared" : "changed";
  return { key, label, oldValue: previous, newValue: next, state };
}

function normalizeRecords(profile: ProfileDiffBase) {
  const source = profile.seasonRecords?.length
    ? profile.seasonRecords
    : clean(profile.season)
      ? [{
          season: profile.season,
          jerseyNumber: profile.jerseyNumber ?? "",
          position: profile.position ?? "",
          role: profile.role ?? "",
        }]
      : [];
  const bySeason = new Map<string, ProfileDiffSeasonRecord>();
  for (const record of source) {
    const season = clean(record.season);
    if (!season) continue;
    bySeason.set(season, {
      season,
      jerseyNumber: clean(record.jerseyNumber),
      position: clean(record.position),
      role: clean(record.role),
    });
  }
  return bySeason;
}

function buildSeasonDiffs(submission: ProfileDiffSubmission, target: ProfileDiffTarget): SeasonDiff[] {
  const incoming = normalizeRecords(submission);
  const existing = normalizeRecords(target);
  const seasons = [...new Set([...incoming.keys(), ...existing.keys()])]
    .sort((a, b) => b.localeCompare(a, "zh-CN", { numeric: true }));

  return seasons.map((season) => {
    const oldRecord = existing.get(season);
    const newRecord = incoming.get(season);
    // The approval API merges by season. An existing season omitted from the
    // submission remains untouched rather than being deleted.
    const effectiveRecord = newRecord ?? oldRecord ?? { season, jerseyNumber: "", position: "", role: "" };
    const fields = [
      compareField(`${season}-number`, "球衣号码", oldRecord?.jerseyNumber, effectiveRecord.jerseyNumber),
      compareField(`${season}-position`, "场上位置", oldRecord?.position, effectiveRecord.position),
      compareField(`${season}-role`, "球队身份", oldRecord?.role, effectiveRecord.role),
    ];
    const state = !oldRecord && newRecord
      ? "added"
      : fields.some((field) => field.state !== "unchanged")
        ? "changed"
        : "unchanged";
    return { season, state, fields };
  });
}

function DisplayValue({ value, emptyLabel = "未填写" }: { value: string; emptyLabel?: string }) {
  return <span className={value ? styles.value : `${styles.value} ${styles.emptyValue}`}>{value || emptyLabel}</span>;
}

function FieldComparison({ field }: { field: FieldDiff }) {
  return (
    <li className={styles.field} data-state={field.state}>
      <div className={styles.fieldMeta}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <span className={styles.changeBadge}>{stateLabel[field.state]}</span>
      </div>
      <div className={styles.comparison}>
        <div className={styles.valueCell}>
          <span className={styles.columnLabel}>现有档案</span>
          <DisplayValue value={field.oldValue} />
        </div>
        <ArrowRight className={styles.arrow} aria-hidden="true" />
        <div className={styles.valueCell}>
          <span className={styles.columnLabel}>审核通过后</span>
          <DisplayValue value={field.newValue} emptyLabel={field.state === "cleared" ? "清空此项" : "未填写"} />
        </div>
      </div>
    </li>
  );
}

export function ProfileDiffPanel({ submission, target, className = "" }: ProfileDiffPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const titleId = useId();
  const profileTitleId = useId();
  const seasonsTitleId = useId();
  const comparisonTarget = target ?? emptyTarget;
  const blocked = isDiffTargetBlocked(target);

  const profileFields = useMemo(() => {
    const fields = [
      compareField("name", "姓名", comparisonTarget.name, submission.name),
      compareField("major", "专业", comparisonTarget.major, submission.major),
      compareField("classYear", "年级", comparisonTarget.classYear, submission.classYear),
      compareField("note", "个人简介 / 球队记忆", comparisonTarget.note, submission.note),
    ];
    const oldHasPhoto = Boolean(clean(comparisonTarget.photoKey));
    const submittedPhoto = clean(submission.photoKey);
    fields.push({
      key: "photo",
      label: "公开照片",
      oldValue: oldHasPhoto ? "已有公开照片" : "无照片",
      newValue: submittedPhoto
        ? oldHasPhoto ? "使用本次新照片替换" : "使用本次新照片"
        : oldHasPhoto ? "保留原照片" : "仍无照片",
      state: submittedPhoto && submittedPhoto !== clean(comparisonTarget.photoKey) ? (oldHasPhoto ? "changed" : "added") : "unchanged",
    });
    return fields;
  }, [comparisonTarget, submission]);

  const seasonDiffs = useMemo(
    () => buildSeasonDiffs(submission, comparisonTarget),
    [comparisonTarget, submission],
  );
  const changedProfileCount = profileFields.filter((field) => field.state !== "unchanged").length;
  const changedSeasonCount = seasonDiffs.filter((season) => season.state !== "unchanged").length;
  const visibleProfileFields = showAll ? profileFields : profileFields.filter((field) => field.state !== "unchanged");
  const visibleSeasons = showAll ? seasonDiffs : seasonDiffs.filter((season) => season.state !== "unchanged");

  let blockMessage = "";
  if (!target) blockMessage = "关联的目标球员档案不存在或尚未加载，不能审核入库。请先确认提交关联的档案编号。";
  else if (target.status === "archived") blockMessage = `目标球员档案 #${target.id} 已归档。请先恢复公开，再处理这份修改申请。`;
  else if (target.status !== "published") blockMessage = `目标球员档案 #${target.id} 当前状态为“${target.status}”，不是可更新的公开档案。`;

  return (
    <section className={`${styles.root}${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <div className={styles.topbar}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>UPDATE REVIEW · 修改影响</span>
          <h4 id={titleId}>新旧资料差异</h4>
          <span className={styles.intro}>
            {changedProfileCount || changedSeasonCount
              ? `发现 ${changedProfileCount} 项个人资料变化、${changedSeasonCount} 个赛季变化。`
              : "本次提交与现有公开档案没有实质差异。"}
          </span>
        </div>
        <button
          className={styles.toggle}
          type="button"
          aria-pressed={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "仅显示变化" : "显示全部字段"}
        </button>
      </div>

      {blocked ? (
        <div className={styles.blocked} role="alert">
          <AlertTriangle aria-hidden="true" />
          <div><strong>暂时不能批准这份修改</strong><span>{blockMessage}</span></div>
        </div>
      ) : null}

      <div className={styles.legend} aria-label="差异状态说明">
        <span data-tone="changed">已修改</span>
        <span data-tone="added">新增</span>
        <span data-tone="cleared">将清空</span>
        {showAll ? <span data-tone="unchanged">无变化</span> : null}
      </div>

      <section className={styles.section} aria-labelledby={profileTitleId}>
        <div className={styles.sectionHeading}>
          <h5 id={profileTitleId}>个人资料</h5>
          <span>{showAll ? `${profileFields.length} 个字段` : `${changedProfileCount} 项变化`}</span>
        </div>
        {visibleProfileFields.length ? (
          <ul className={styles.fieldList}>
            {visibleProfileFields.map((field) => <FieldComparison field={field} key={field.key} />)}
          </ul>
        ) : <div className={styles.noChanges}>个人资料没有变化。</div>}
      </section>

      <section className={styles.section} aria-labelledby={seasonsTitleId}>
        <div className={styles.sectionHeading}>
          <h5 id={seasonsTitleId}>逐赛季记录</h5>
          <span>{showAll ? `${seasonDiffs.length} 个赛季` : `${changedSeasonCount} 个赛季有变化`}</span>
        </div>
        <div className={styles.mergeNote}>
          <ImagePlus aria-hidden="true" />
          <span>审批会按赛季合并；本次未提交的旧赛季将原样保留，不会删除。</span>
        </div>
        {visibleSeasons.length ? (
          <ul className={styles.seasonList}>
            {visibleSeasons.map((season) => {
              const visibleFields = showAll || season.state === "added"
                ? season.fields
                : season.fields.filter((field) => field.state !== "unchanged");
              return (
                <li className={styles.seasonCard} data-state={season.state} key={season.season}>
                  <div className={styles.seasonHeading}>
                    <strong>{season.season} 赛季</strong>
                    <span>{season.state === "added" ? "新增赛季" : season.state === "changed" ? "记录有修改" : "原样保留"}</span>
                  </div>
                  <ul className={styles.fieldList}>
                    {visibleFields.map((field) => <FieldComparison field={field} key={field.key} />)}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : <div className={styles.noChanges}>逐赛季号码、位置和身份没有变化。</div>}
      </section>
    </section>
  );
}
