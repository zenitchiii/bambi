// Pure cycle-tracker core: no React, no Firestore, and no imports at all.
// Self-contained on purpose: it runs anywhere (including plain node for
// verification) and can never pull native modules into the bundle. The two
// tiny ISO helpers mirror dateMath's logic line-for-line.
export interface CyclePeriod {
  start: string; // local ISO YYYY-MM-DD
  end?: string; // absent = ongoing
  // True = auto-closed guess (repair or new-start close). Estimated ends
  // never feed length statistics — only explicit ones do.
  endEstimated?: boolean;
}

export interface CycleDataV2 {
  v: 2;
  periods: CyclePeriod[];
}

// Daily log entry (phase 5). Dormant until then: defined here so the shape
// is fixed, but nothing reads or writes logs yet.
export interface CycleLog {
  d: string; // local ISO date the entry belongs to
  mood?: string;
  drive?: 1 | 2 | 3;
  symptoms?: string[];
}

// Bound the log history on the write path so storage stays flat while
// reads stay untouched. Pure + tested.
export function pruneLogs(
  logs: CycleLog[],
  todayISO: string,
  keepDays = 180,
): CycleLog[] {
  const cutoffN =
    toDayNumber(todayISO) - (keepDays - 1);
  return logs.filter(
    (l) =>
      l &&
      typeof l.d === "string" &&
      isValidDateISO(l.d) &&
      toDayNumber(l.d) >= cutoffN,
  );
}

export type ProposeStartResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid" | "future" | "duplicate" | "inside-period" | "too-soon";
      conflicting?: CyclePeriod;
    };

export interface CycleStats {
  averageLength: number;
  predictedLength: number;
  nextStart: string | null;
  daysUntil: number | null;
}

export type DayKind = "period" | "projected" | "predicted";

export interface CycleMarks {
  logged: Set<string>;
  projected: Set<string>;
  predicted: Set<string>;
  status: Map<string, { kind: DayKind; day: number }>;
}

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const MIN_CYCLE_GAP = 15;
const MAX_CYCLE_GAP = 60;
const MIN_CYCLE_LENGTH = 21;
const MAX_CYCLE_LENGTH = 45;
const MAX_ONGOING_DAYS = 10;
const MAX_PREDICTED_SPAN = 15;
const TOO_SOON_DAYS = 15;
const DAY_MS = 86400000;

function isValidDateISO(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("-");
  if (parts.length !== 3) return false;
  const [y, m, d] = parts.map(Number);
  return (
    Number.isFinite(y) &&
    Number.isFinite(m) &&
    Number.isFinite(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= 31
  );
}

// Exported for verification/debugging; app code should prefer the
// date-level helpers above.
export function toDayNumber_(iso: string): number {
  return toDayNumber(iso);
}

export function fromDayNumber_(n: number): string {
  return fromDayNumber(n);
}
function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n: number): string {
  // Mirrors dateMath.formatDateISO (local calendar parts of a UTC-midnight
  // instant): exact for UTC+0..+14 zones including UTC+8. Western zones
  // would need UTC getters here instead — noted, not needed for this app.
  const d = new Date(n * DAY_MS);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sortedValid(periods: CyclePeriod[]): CyclePeriod[] {
  return [...periods]
    .filter((p) => isValidDateISO(p.start))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
}

// Expected bleed length: last completed, NON-estimated period, else 5.
// Estimated ends are guesses, so they must never teach the predictor.
function expectedBleedLength(periods: CyclePeriod[]): number {
  const done = periods.filter(
    (p) =>
      typeof p.end === "string" &&
      !p.endEstimated &&
      isValidDateISO(p.end) &&
      p.end >= p.start,
  );
  if (done.length === 0) return DEFAULT_PERIOD_LENGTH;
  const last = done.sort((a, b) => (a.start < b.start ? -1 : 1)).pop()!;
  return Math.min(
    MAX_PREDICTED_SPAN,
    Math.max(1, toDayNumber(last.end as string) - toDayNumber(last.start) + 1),
  );
}

// Enforce the timeline invariants on every read AND every write path:
// sorted, deduped, no future dates, ends within [start, today], and only
// the latest period may stay open (earlier opens are auto-closed with
// estimated ends). Ended overlaps are left as logged — display unions them
// and stats ignore them — because trimming explicit user data is worse.
export function normalizePeriods(
  raw: unknown,
  todayISO: string,
): CyclePeriod[] {
  let recs: CyclePeriod[] = [];
  if (raw && typeof raw === "object") {
    const r = raw as { periods?: unknown; periodStarts?: unknown };
    if (Array.isArray(r.periods)) {
      for (const p of r.periods) {
        if (!p || typeof p !== "object") continue;
        const rec = p as Partial<CyclePeriod>;
        if (!isValidDateISO(rec.start) || rec.start > todayISO) continue;
        const clean: CyclePeriod = { start: rec.start };
        if (
          typeof rec.end === "string" &&
          isValidDateISO(rec.end) &&
          rec.end >= rec.start &&
          rec.end <= todayISO
        ) {
          clean.end = rec.end;
          if (rec.endEstimated === true) clean.endEstimated = true;
        }
        recs.push(clean);
      }
    } else if (Array.isArray(r.periodStarts)) {
      // Quiet migration: legacy string[] becomes open records.
      for (const s of r.periodStarts) {
        if (typeof s === "string" && isValidDateISO(s) && s <= todayISO) {
          recs.push({ start: s });
        }
      }
    }
  }
  const byStart = new Map<string, CyclePeriod>();
  for (const p of recs) {
    const current = byStart.get(p.start);
    if (!current || (!current.end && p.end)) byStart.set(p.start, p);
  }
  const sorted = [...byStart.values()].sort((a, b) =>
    a.start < b.start ? -1 : 1,
  );
  const bleed = expectedBleedLength(sorted);
  return sorted.map((p, i) => {
    const isLast = i === sorted.length - 1;
    if (p.end || isLast) return p;
    const next = sorted[i + 1];
    const autoEnd = fromDayNumber(
      Math.min(
        toDayNumber(p.start) + bleed - 1,
        toDayNumber(next.start) - 1,
      ),
    );
    return { ...p, end: autoEnd, endEstimated: true };
  });
}

// Guard for a proposed new start. Never silently adds: conflicts come back
// for the UI confirm dialog (Move vs Add). Backfills (earlier than the
// latest start) pass freely — only forward motion is guarded.
export function proposeStart(
  periods: CyclePeriod[],
  dateISO: string,
  todayISO: string,
): ProposeStartResult {
  if (!isValidDateISO(dateISO)) return { ok: false, reason: "invalid" };
  if (dateISO > todayISO) return { ok: false, reason: "future" };
  const sorted = sortedValid(periods);
  const same = sorted.find((p) => p.start === dateISO);
  if (same) return { ok: false, reason: "duplicate", conflicting: same };
  const inside = sorted.find(
    (p) =>
      typeof p.end === "string" &&
      isValidDateISO(p.end) &&
      p.start <= dateISO &&
      dateISO <= p.end,
  );
  if (inside) return { ok: false, reason: "inside-period", conflicting: inside };
  const latest = sorted[sorted.length - 1];
  if (
    latest &&
    dateISO > latest.start &&
    toDayNumber(dateISO) - toDayNumber(latest.start) < TOO_SOON_DAYS
  ) {
    return { ok: false, reason: "too-soon", conflicting: latest };
  }
  return { ok: true };
}

// Log a new start, auto-closing any earlier open periods as estimates.
// Assumes the date passed proposeStart (or the user confirmed anyway);
// invalid/future dates leave the input untouched.
export function startPeriod(
  periods: CyclePeriod[],
  dateISO: string,
  todayISO: string,
): CyclePeriod[] {
  if (!isValidDateISO(dateISO) || dateISO > todayISO) return [...periods];
  if (periods.some((p) => p.start === dateISO)) return [...periods];
  const bleed = expectedBleedLength(periods);
  const closed = periods.map((p) => {
    if (p.end || p.start > dateISO) return p;
    const autoEnd = fromDayNumber(
      Math.min(
        toDayNumber(p.start) + bleed - 1,
        toDayNumber(dateISO) - 1,
      ),
    );
    return { ...p, end: autoEnd, endEstimated: true };
  });
  return [...closed, { start: dateISO }].sort((a, b) =>
    a.start < b.start ? -1 : 1,
  );
}

// Editing means replacing the date, never appending. Invalid moves
// (unknown source, future target, collision) leave the input untouched.
export function moveStart(
  periods: CyclePeriod[],
  fromISO: string,
  toISO: string,
  todayISO: string,
): CyclePeriod[] {
  const idx = periods.findIndex((p) => p.start === fromISO);
  if (idx < 0 || !isValidDateISO(toISO) || toISO > todayISO) {
    return [...periods];
  }
  if (periods.some((p, i) => i !== idx && p.start === toISO)) {
    return [...periods];
  }
  const rec = periods[idx];
  const moved: CyclePeriod = { start: toISO };
  if (rec.end && rec.end >= toISO) {
    moved.end = rec.end;
    if (rec.endEstimated) moved.endEstimated = true;
  }
  return [...periods.slice(0, idx), moved, ...periods.slice(idx + 1)].sort(
    (a, b) => (a.start < b.start ? -1 : 1),
  );
}

// Set an end. Anything outside [start, today] leaves the input untouched.
export function endPeriod(
  periods: CyclePeriod[],
  startISO: string,
  endISO: string,
  todayISO: string,
): CyclePeriod[] {
  return periods.map((p) => {
    if (p.start !== startISO) return p;
    if (!isValidDateISO(endISO) || endISO < startISO || endISO > todayISO) {
      return p;
    }
    // Explicit end: never estimated.
    return { start: p.start, end: endISO };
  });
}

// Drop one period, or one end (reopening it).
export function removePeriod(
  periods: CyclePeriod[],
  startISO: string,
): CyclePeriod[] {
  return periods.filter((p) => p.start !== startISO);
}

export function removeEnd(
  periods: CyclePeriod[],
  startISO: string,
): CyclePeriod[] {
  return periods.map((p) =>
    p.start === startISO ? { start: p.start } : p,
  );
}

// ---------- Fertility, phases, confidence (periods only, no logs) ----------

export const LUTEAL_DAYS = 14;
export const FERTILE_BEFORE_OVULATION = 5;
export const FERTILE_AFTER_OVULATION = 1;

export type Phase =
  | "period"
  | "follicular"
  | "fertile"
  | "ovulation"
  | "luteal"
  | "late";

export type PregnancyChance = "low" | "medium" | "high" | "unsure";

export interface FertilityInfo {
  ovulationDay: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  phase: Phase | null;
  cycleDay: number | null;
  rough: boolean;
  pregnancyChance: PregnancyChance;
}

// Valid start-to-start gaps, oldest first. Single definition shared by the
// average and the confidence check below.
function validGaps(periods: CyclePeriod[]): number[] {
  const starts = sortedValid(periods).map((p) => p.start);
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = toDayNumber(starts[i]) - toDayNumber(starts[i - 1]);
    if (gap >= MIN_CYCLE_GAP && gap <= MAX_CYCLE_GAP) gaps.push(gap);
  }
  return gaps;
}

// Days since the most recent start on or before the date, + 1. Null before
// the first logged start. Keeps counting when the period is late.
export function getCycleDay(
  periods: CyclePeriod[],
  dateISO: string,
): number | null {
  if (!isValidDateISO(dateISO)) return null;
  const starts = sortedValid(periods)
    .map((p) => p.start)
    .filter((s) => s <= dateISO);
  if (starts.length === 0) return null;
  return toDayNumber(dateISO) - toDayNumber(starts[starts.length - 1]) + 1;
}

// Phase of one date: logged span first (same capped spans as the dots),
// then zones around the predicted ovulation. Null only when no start
// exists on or before the date yet.
export function getPhase(
  periods: CyclePeriod[],
  dateISO: string,
  todayISO: string,
): Phase | null {
  if (!isValidDateISO(dateISO)) return null;
  const todayN = toDayNumber(todayISO);
  const dateN = toDayNumber(dateISO);
  const sorted = sortedValid(periods);
  for (const p of sorted) {
    const startN = toDayNumber(p.start);
    const hasEnd =
      typeof p.end === "string" && isValidDateISO(p.end) && p.end >= p.start;
    const lastN = hasEnd
      ? Math.min(toDayNumber(p.end as string), todayN)
      : Math.min(todayN, startN + MAX_ONGOING_DAYS - 1);
    if (dateN >= startN && dateN <= lastN) return "period";
  }
  const anchor = [...sorted].reverse().find((p) => p.start <= dateISO);
  if (!anchor) return null;
  const stats = deriveStats(periods, todayISO);
  if (stats.nextStart === null) return "follicular";
  const ovN = toDayNumber(stats.nextStart) - LUTEAL_DAYS;
  if (dateN === ovN) return "ovulation";
  if (
    dateN >= ovN - FERTILE_BEFORE_OVULATION &&
    dateN <= ovN + FERTILE_AFTER_OVULATION
  ) {
    return "fertile";
  }
  if (dateN >= toDayNumber(stats.nextStart)) return "late";
  if (dateN > ovN) return "luteal";
  return "follicular";
}

// Full fertility picture for one day (usually today). Rough when fewer
// than 3 valid gaps exist or they spread more than 7 days — then the
// chance reads "unsure" no matter the distance.
export function getFertility(
  periods: CyclePeriod[],
  todayISO: string,
): FertilityInfo {
  const stats = deriveStats(periods, todayISO);
  const gaps = validGaps(periods);
  const recent = gaps.slice(-6);
  const rough =
    recent.length < 3 ||
    Math.max(...recent) - Math.min(...recent) > 7;
  if (stats.nextStart === null) {
    return {
      ovulationDay: null,
      fertileStart: null,
      fertileEnd: null,
      phase: getPhase(periods, todayISO, todayISO),
      cycleDay: getCycleDay(periods, todayISO),
      rough: true,
      pregnancyChance: "unsure",
    };
  }
  const ovN = toDayNumber(stats.nextStart) - LUTEAL_DAYS;
  const dist = Math.abs(toDayNumber(todayISO) - ovN);
  const inWindow =
    todayISO >= fromDayNumber(ovN - FERTILE_BEFORE_OVULATION) &&
    todayISO <= fromDayNumber(ovN + FERTILE_AFTER_OVULATION);
  return {
    ovulationDay: fromDayNumber(ovN),
    fertileStart: fromDayNumber(ovN - FERTILE_BEFORE_OVULATION),
    fertileEnd: fromDayNumber(ovN + FERTILE_AFTER_OVULATION),
    phase: getPhase(periods, todayISO, todayISO),
    cycleDay: getCycleDay(periods, todayISO),
    rough,
    pregnancyChance: rough
      ? "unsure"
      : dist <= 1
        ? "high"
        : inWindow
          ? "medium"
          : "low",
  };
}
export interface CycleStats {
  averageLength: number;
  predictedLength: number;
  nextStart: string | null;
  daysUntil: number | null;
}

// Stats: mean of the LAST 6 valid start-to-start gaps (15–60d), else 28,
// clamped 21–45. Length from the last completed non-estimated period,
// else 5. Start and length stay independent by design: bleed duration
// doesn't move ovulation, so coupling them would only inject noise.
export function deriveStats(
  periods: CyclePeriod[],
  todayISO: string,
): CycleStats {
  const starts = sortedValid(periods).map((p) => p.start);
  const recent = validGaps(periods).slice(-6);
  const averageLength =
    recent.length > 0
      ? Math.min(
          MAX_CYCLE_LENGTH,
          Math.max(
            MIN_CYCLE_LENGTH,
            Math.round(recent.reduce((a, b) => a + b, 0) / recent.length),
          ),
        )
      : DEFAULT_CYCLE_LENGTH;
  const predictedLength = expectedBleedLength(sortedValid(periods));
  const nextStart =
    starts.length > 0
      ? fromDayNumber(toDayNumber(starts[starts.length - 1]) + averageLength)
      : null;
  return {
    averageLength,
    predictedLength,
    nextStart,
    daysUntil:
      nextStart === null
        ? null
        : toDayNumber(nextStart) - toDayNumber(todayISO),
  };
}

export interface DayStatus {
  kind: DayKind;
  day: number;
}

export interface CycleMarks {
  logged: Set<string>;
  projected: Set<string>;
  predicted: Set<string>;
  status: Map<string, DayStatus>;
}

// All marks in the documented order over one logical pass per span group:
// logged facts first, then ongoing projection, then next-cycle prediction.
// Fact beats forecast on any overlap. Nothing before appStart is emitted.
export function buildCycleMarks(
  periods: CyclePeriod[],
  todayISO: string,
  appStartISO: string,
): CycleMarks {
  const todayN = toDayNumber(todayISO);
  const logged = new Set<string>();
  const projected = new Set<string>();
  const predicted = new Set<string>();
  const status = new Map<string, DayStatus>();
  const stats = deriveStats(periods, todayISO);
  const sorted = sortedValid(periods);

  const emit = (
    set: Set<string>,
    kind: DayKind,
    dayISO: string,
    dayIndex: number,
  ) => {
    if (dayISO < appStartISO || status.has(dayISO)) return;
    set.add(dayISO);
    status.set(dayISO, { kind, day: dayIndex });
  };

  for (const p of sorted) {
    const startN = toDayNumber(p.start);
    const hasEnd =
      typeof p.end === "string" && isValidDateISO(p.end) && p.end >= p.start;
    // Ongoing: solid through today, capped at 10 so forgotten entries stop.
    const lastN = hasEnd
      ? Math.min(toDayNumber(p.end as string), todayN)
      : Math.min(todayN, startN + MAX_ONGOING_DAYS - 1);
    for (let n = startN; n <= lastN; n++) {
      emit(logged, "period", fromDayNumber(n), n - startN + 1);
    }
    // Projection: tomorrow through the expected end, only while ongoing.
    if (!hasEnd) {
      const projLastN = startN + stats.predictedLength - 1;
      for (let n = Math.max(startN, todayN + 1); n <= projLastN; n++) {
        emit(projected, "projected", fromDayNumber(n), n - startN + 1);
      }
    }
  }

  if (stats.nextStart !== null) {
    const nextN = toDayNumber(stats.nextStart);
    for (let n = nextN; n < nextN + stats.predictedLength; n++) {
      const d = fromDayNumber(n);
      // Never dot past prediction days.
      if (d < todayISO) continue;
      emit(predicted, "predicted", d, n - nextN + 1);
    }
  }

  return { logged, projected, predicted, status };
}
