import { useMemo } from "react";
import { APP_START_DATE } from "@/constants/date";
import { useOnboarding } from "@/context/OnboardingContext";
import { writeCycle } from "@/lib/pairing";
import {
  buildCycleMarks,
  deriveStats,
  endPeriod,
  getFertility,
  moveStart,
  proposeStart,
  removeEnd,
  removePeriod,
  startPeriod,
  type CyclePeriod,
  type ProposeStartResult,
} from "@/utils/cycle";
import { useCycleRole } from "./useCycleRole";
import { useSharedCoupleData } from "./useSharedCoupleData";
import { useToday } from "./useToday";

// Single entry point for cycle data. Calendar and Home consume only this
// hook — never cycle math or Firestore directly. The shared snapshot is
// already normalized upstream, so periods/stats/marks derive straight from
// state; writes go through the one versioned writer (which also migrates
// legacy docs via deleteField on first write).
export function useCycle() {
  const { coupleId } = useOnboarding();
  const { data } = useSharedCoupleData();
  const role = useCycleRole();

  const todayISO = useToday();
  const periods = data.cycle.periods ?? [];

  const stats = useMemo(
    () => deriveStats(periods, todayISO),
    // todayISO is a value-compared string: same day, no recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periods, todayISO],
  );
  const marks = useMemo(
    () => buildCycleMarks(periods, todayISO, APP_START_DATE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periods, todayISO],
  );
  // Fertility/phase/confidence ride the same memo discipline: periods-only
  // inputs, so logs (phase 5) can never perturb predictions.
  const fertility = useMemo(
    () => getFertility(periods, todayISO),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periods, todayISO],
  );

  const actions = useMemo(() => {
    const persist = (next: CyclePeriod[]) => {
      if (!coupleId) return;
      const { cycleLength, periodLength, logs } = data.cycle;
      writeCycle(coupleId, {
        v: 3,
        periods: next,
        ...(typeof cycleLength === "number" ? { cycleLength } : {}),
        ...(typeof periodLength === "number" ? { periodLength } : {}),
        // Dormant logs must survive v3 writes untouched (pruned inside).
        ...(Array.isArray(logs) ? { logs } : {}),
      }).catch(console.warn);
    };
    return {
      proposeStart: (dateISO: string): ProposeStartResult =>
        proposeStart(periods, dateISO, todayISO),
      startPeriod: (dateISO: string) =>
        persist(startPeriod(periods, dateISO, todayISO)),
      moveStart: (fromISO: string, toISO: string) =>
        persist(moveStart(periods, fromISO, toISO, todayISO)),
      endPeriod: (startISO: string, endISO: string) =>
        persist(endPeriod(periods, startISO, endISO, todayISO)),
      removeEnd: (startISO: string) => persist(removeEnd(periods, startISO)),
      removePeriod: (startISO: string) =>
        persist(removePeriod(periods, startISO)),
      clear: () => persist([]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, data.cycle, periods, todayISO]);

  return {
    role,
    canEdit: role === "owner",
    periods,
    marks,
    stats,
    fertility,
    actions,
  };
}
