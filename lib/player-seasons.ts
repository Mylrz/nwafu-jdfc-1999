export type PlayerSeasonRecord = {
  season: string;
  jerseyNumber: string;
  position: string;
  role: string;
};

export const emptySeasonRecord = (season = "2026"): PlayerSeasonRecord => ({
  season,
  jerseyNumber: "",
  position: "",
  role: "队员",
});

export function sanitizeSeasonRecords(value: unknown): PlayerSeasonRecord[] {
  if (!Array.isArray(value)) return [];
  const bySeason = new Map<string, PlayerSeasonRecord>();

  for (const candidate of value.slice(0, 20)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const season = String(row.season ?? "").trim().slice(0, 10);
    if (!season) continue;
    bySeason.set(season, {
      season,
      jerseyNumber: String(row.jerseyNumber ?? "").trim().slice(0, 8),
      position: String(row.position ?? "").trim().slice(0, 20),
      role: String(row.role ?? "队员").trim().slice(0, 20) || "队员",
    });
  }

  return [...bySeason.values()].sort((a, b) => b.season.localeCompare(a.season, "zh-CN", { numeric: true }));
}

export function parseSeasonRecords(value: FormDataEntryValue | null): PlayerSeasonRecord[] {
  if (typeof value !== "string") return [];
  try {
    return sanitizeSeasonRecords(JSON.parse(value));
  } catch {
    return [];
  }
}
