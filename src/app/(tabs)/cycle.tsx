import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import {
  Circle,
  Line,
  Path,
  Rect,
  Svg,
  Text as SvgText,
} from "react-native-svg";
import { CalendarList, type DateData } from "react-native-calendars";
import MenuButton from "@/components/MenuButton";
import MonthJumpPicker from "@/components/calendar/MonthJumpPicker";
import {
  APP_START_DATE,
  CALENDAR_THEME,
  CYCLE_DOT,
  FUTURE_RANGE_MONTHS,
  SELECTED_DAY_COLOR,
  START_MONTH,
  START_YEAR,
  calendarHeaderTextStyle,
  monthDiffMonths,
  parseLocalDate,
} from "@/components/calendar/calendarTheme";
import { CycleActionPanel } from "@/components/cycle/CycleActionPanel";
import { usePartnerProfile } from "@/hooks/usePartnerProfile";
import { useProfile } from "@/context/ProfileContext";
import { useCycle } from "@/hooks/useCycle";
import { useToday } from "@/hooks/useToday";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDateISO } from "@/utils/dateMath";
import { cap, getPossessive } from "@/utils/pronouns";
import {
  fromDayNumber_,
  getCycleDay,
  getPhase,
  toDayNumber_,
} from "@/utils/cycle";
import type { Phase } from "@/utils/cycle";

const BG_GRADIENT: [string, string] = ["#fffafc", "#ffeef4"];
const TRACK_COLOR = "rgba(231,84,128,0.18)";
const PERIOD_RED = "#d32f2f";
const FERTILE_BG = "#fff3c4";
const OVULATION_ORANGE = "#ff9800";

type ViewMode = "today" | "calendar";

function dayWord(n: number) {
  return n === 1 ? "day" : "days";
}

// Supportive one-liners per phase. `{who}` is "Your" for the owner and
// "Her" for the partner (via getPossessive) — no hardcoded pronouns, and
// no medical claims anywhere.
const PHASE_MESSAGES: Record<Phase, (who: string) => string> = {
  period: (who) => `${who} body is shedding its lining — rest, warmth, and water help.`,
  follicular: (who) => `${who} energy is rebuilding — good days for plans and movement.`,
  fertile: (who) => `${who} fertile window is open — be intentional either way.`,
  ovulation: (_who) => `Ovulation day — the most fertile 24 hours.`,
  luteal: (who) => `The luteal wind-down — ${who} body may feel heavier. Be gentle.`,
  late: (_who) => `No period yet — a test can bring clarity.`,
};

export default function CycleScreen() {
  const { role, canEdit, periods, marks, stats, actions, fertility } = useCycle();
  const { profile } = useProfile();
  const partner = usePartnerProfile();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>("today");
  const [barW, setBarW] = useState(0);
  // Default selection is today (main calendar's selected-day style),
  // so the panel always has something to show — no null state.
  const [selectedISO, setSelectedISO] = useState(today);
  const cycleCalRef = useRef<any>(null);
  const [cycleCalKey, setCycleCalKey] = useState(0);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(START_YEAR);
  const { width: windowWidth } = useWindowDimensions();

  const selectDay = useCallback((iso: string) => setSelectedISO(iso), []);
  const handleShowToday = useCallback(() => setView("today"), []);
  const handleShowCalendar = useCallback(() => setView("calendar"), []);

  const jumpToMonth = (year: number, monthIdx: number) => {
    if (year === START_YEAR && monthIdx === START_MONTH - 1) {
      setCycleCalKey((k) => k + 1); // scrollToMonth can't reliably land back on the first rendered month
    } else {
      setTimeout(
        () => cycleCalRef.current?.scrollToMonth(new Date(year, monthIdx, 1)),
        100,
      );
    }
  };

  const handleTodayCal = useCallback(() => {
    const now = new Date();
    jumpToMonth(now.getFullYear(), now.getMonth());
    selectDay(formatDateISO(now));
    // jumpToMonth/selectDay are stable (refs + setState), so no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectDay]);

  const handlePickMonth = (year: number, monthIndex: number) => {
    setMonthPickerVisible(false);
    jumpToMonth(year, monthIndex);
  };

  const closeMonthPicker = () => setMonthPickerVisible(false);

  const handleDayPress = useCallback(
    (d: DateData) => {
      if (d.dateString < APP_START_DATE) return;
      selectDay(d.dateString);
    },
    [selectDay],
  );

  const renderCycleHeader = useCallback((date: any) => {
    const d = new Date(date);
    return (
      <Pressable
        onPress={() => {
          setPickerYear(d.getFullYear());
          setMonthPickerVisible(true);
        }}
      >
        <Text style={calendarHeaderTextStyle}>
          {d.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </Text>
      </Pressable>
    );
  }, []);

  // Derived scroll ranges: earliest month stays APP_START_DATE's month and
  // the forward stop matches the main calendar, both recomputed from today
  // so they hold as time passes. Clamped so a far-future today can't invert.
  const [tyNow, tmNow] = today.split("-").map(Number);
  const pastRange = Math.max(
    0,
    monthDiffMonths(APP_START_DATE, tyNow, tmNow - 1),
  );
  const futureRange = Math.max(
    0,
    FUTURE_RANGE_MONTHS - pastRange,
  );

  // Dots-only markings for the built-in multi-dot renderer: one dot per
  // day by priority period > predicted > ovulation > fertile. Only marked
  // dates get entries (no whole-range loop), and selection just adds the
  // same selected wash the main calendar uses.
  const cycleDots = useMemo(() => {
    const dots: Record<
      string,
      {
        dots: { key: string; color: string }[];
        selected?: boolean;
        selectedColor?: string;
      }
    > = {};
    const addDot = (date: string, key: string, color: string) => {
      if (date < APP_START_DATE || dots[date]) return;
      dots[date] = { dots: [{ key, color }] };
    };
    marks.logged.forEach((d) => addDot(d, "period", CYCLE_DOT.period));
    marks.projected.forEach((d) => addDot(d, "predicted", CYCLE_DOT.predicted));
    marks.predicted.forEach((d) => addDot(d, "predicted", CYCLE_DOT.predicted));
    if (fertility.ovulationDay) {
      addDot(fertility.ovulationDay, "ovulation", CYCLE_DOT.ovulation);
    }
    if (fertility.fertileStart && fertility.fertileEnd) {
      const endN = toDayNumber_(fertility.fertileEnd);
      for (
        let n = toDayNumber_(fertility.fertileStart);
        n <= endN;
        n++
      ) {
        addDot(fromDayNumber_(n), "fertile", CYCLE_DOT.fertile);
      }
    }
    const sel = dots[selectedISO];
    if (sel) {
      sel.selected = true;
      sel.selectedColor = SELECTED_DAY_COLOR;
    } else if (selectedISO >= APP_START_DATE) {
      dots[selectedISO] = {
        dots: [],
        selected: true,
        selectedColor: SELECTED_DAY_COLOR,
      };
    }
    return dots;
  }, [marks, fertility, selectedISO]);

  const bothWoman =
    profile?.gender === "woman" && partner?.gender === "woman";
  const ownerGender = profile?.gender === "woman" ? profile.gender : (partner?.gender ?? null);
  const who = role === "owner" ? "Your" : cap(getPossessive(ownerGender));
  const title = canEdit ? "My cycle" : `${partner?.name ?? "Partner"}'s cycle`;

  // Hero headline + subline from one memo (strings only, no style objects).
  const hero = useMemo(() => {
    if (periods.length === 0) return null;
    const daysLeft = stats.daysUntil;
    let headline: string;
    if (fertility.phase === "period") {
      headline = `Period · Day ${fertility.cycleDay ?? "?"}`;
    } else if (fertility.phase === "fertile" || fertility.phase === "ovulation") {
      headline = "Fertile window";
    } else if (daysLeft !== null && daysLeft < 0) {
      headline = `Period is ${-daysLeft} ${dayWord(-daysLeft)} late`;
    } else if (daysLeft === 0) {
      headline = "Period due today";
    } else {
      headline = `Next period in ${daysLeft ?? "?"} days`;
    }
    let subline = "";
    if (fertility.ovulationDay) {
      const diff =
        toDayNumber_(fertility.ovulationDay) - toDayNumber_(today);
      subline =
        diff > 0
          ? `Ovulation: ${diff} ${dayWord(diff)} left`
          : diff === 0
            ? "Ovulation: today"
            : `Ovulation was ${-diff} ${dayWord(-diff)} ago`;
    }
    return { headline, subline };
  }, [fertility, stats.daysUntil, periods.length, today]);

  // Segmented cycle bar geometry in real pixels (measured once via onLayout
  // so the ovulation dot stays a true circle at any screen width).
  const bar = useMemo(() => {
    if (barW <= 0 || periods.length === 0 || !stats.nextStart) return null;
    const s0 = toDayNumber_(periods[periods.length - 1].start);
    const s1 = toDayNumber_(stats.nextStart);
    const total = Math.max(1, s1 - s0);
    const X = (n: number) => ((n - s0) / total) * barW;
    const periodEnd = Math.min(s0 + stats.predictedLength, s1);
    const fertile =
      fertility.fertileStart && fertility.fertileEnd
        ? {
            x: X(toDayNumber_(fertility.fertileStart)),
            w: Math.max(
              2,
              X(toDayNumber_(fertility.fertileEnd) + 1) -
                X(toDayNumber_(fertility.fertileStart)),
            ),
          }
        : null;
    const tx = Math.min(
      barW,
      Math.max(0, X(toDayNumber_(today))),
    );
    return {
      period: { x: 0, w: Math.max(2, X(periodEnd) - X(s0)) },
      fertile,
      ovulationX: fertility.ovulationDay
        ? X(toDayNumber_(fertility.ovulationDay))
        : null,
      todayX: tx,
      labelX: Math.min(barW - 24, Math.max(24, tx)),
      cycleDay: fertility.cycleDay,
    };
  }, [barW, periods, stats, fertility, today]);

  // Bell curve over the fertile window. Pure viewBox geometry (no measurement
  // needed): x maps ovulation ±8 days, y is a gaussian bell.
  const bell = useMemo(() => {
    if (!fertility.ovulationDay) return null;
    const W = 300;
    const BASE = 78;
    const AMP = 62;
    const SIGMA = 2.2;
    const RANGE = 8;
    const N = 25;
    const x = (offset: number) =>
      8 + ((offset + RANGE) / (2 * RANGE)) * (W - 16);
    let d = "";
    for (let i = 0; i < N; i++) {
      const off = -RANGE + (i / (N - 1)) * 2 * RANGE;
      const y = BASE - AMP * Math.exp(-(off * off) / (2 * SIGMA * SIGMA));
      d += `${i === 0 ? "M" : "L"}${x(off).toFixed(1)},${y.toFixed(1)} `;
    }
    const tOff =
      toDayNumber_(today) - toDayNumber_(fertility.ovulationDay);
    return { d: d.trim(), tx: Math.min(W - 4, Math.max(4, x(tOff))) };
  }, [fertility, today]);

  const onBarLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = Math.round(e.nativeEvent.layout.width);
      setBarW((prev) => (prev === w ? prev : w));
    },
    [],
  );

  // Same propose→confirm contract as before: ambiguous dates offer
  // Move vs Add instead of silently duplicating. Selection is kept —
  // the panel stays visible, no sheet to close.
  const commitLog = useCallback(
    (iso: string) => {
      const res = actions.proposeStart(iso);
      if (res.ok) {
        actions.startPeriod(iso);
        return;
      }
      if (
        res.reason === "duplicate" ||
        res.reason === "future" ||
        res.reason === "invalid"
      ) {
        return;
      }
      const conflicting = res.conflicting?.start ?? "";
      Alert.alert(
        "Overlaps an existing period",
        `This date is ${
          res.reason === "inside-period" ? "inside" : "very close to"
        } the period starting ${conflicting}.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move start here",
            onPress: () => {
              if (res.conflicting) {
                actions.moveStart(res.conflicting.start, iso);
              }
            },
          },
          {
            text: "Add anyway",
            onPress: () => {
              actions.startPeriod(iso);
            },
          },
        ],
      );
    },
    [actions],
  );

  // Imperative Android picker — no component state. Why: the old
  // <DateTimePicker> needed 4 states (visible/draft × 2 pickers);
  // .open() shows the native dialog and calls back once.
  const openLogPicker = useCallback(
    (anchorISO: string | null) => {
      DateTimePickerAndroid.open({
        value: anchorISO ? parseLocalDate(anchorISO) : new Date(),
        mode: "date",
        maximumDate: parseLocalDate(today),
        onChange: (event, date) => {
          if (event.type === "dismissed" || !date) return;
          commitLog(formatDateISO(date));
        },
      });
    },
    [commitLog, today],
  );

  const openChangePickerFor = useCallback(
    (fromISO: string) => {
      DateTimePickerAndroid.open({
        value: parseLocalDate(fromISO),
        mode: "date",
        maximumDate: parseLocalDate(today),
        onChange: (event, date) => {
          if (event.type === "dismissed" || !date) return;
          const toISO = formatDateISO(date);
          if (toISO === fromISO) return;
          actions.moveStart(fromISO, toISO);
          setSelectedISO(toISO);
        },
      });
    },
    [actions, today],
  );

  // End-date picker: native min/max enforce [start, today], and the same
  // endPeriod action re-validates (end >= start, never future).
  const openEndPicker = useCallback(
    (startISO: string, initialISO: string) => {
      DateTimePickerAndroid.open({
        value: parseLocalDate(initialISO),
        mode: "date",
        minimumDate: parseLocalDate(startISO),
        maximumDate: parseLocalDate(today),
        onChange: (event, date) => {
          if (event.type === "dismissed" || !date) return;
          actions.endPeriod(startISO, formatDateISO(date));
        },
      });
    },
    [actions, today],
  );

  const handleClearCycle = useCallback(() => {    Alert.alert(
      "Clear cycle data?",
      "Removes all logged period days for both of you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => actions.clear(),
        },
      ],
    );
  }, [actions]);

  const handleEditLast = useCallback(() => {
    const latest = periods[periods.length - 1] ?? null;
    if (!latest) return;
    openChangePickerFor(latest.start);
  }, [periods, openChangePickerFor]);

  const handleLogEmpty = useCallback(() => {
    openLogPicker(null);
  }, [openLogPicker]);

  // One O(1) lookup in the memoized day map per selection.
  // Parent owns the rules; the panel only renders primitives.
  const panel = useMemo(() => {
    const [sy, sm, sd] = selectedISO.split("-").map(Number);
    const dateTitle = new Date(sy, sm - 1, sd).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const cycleDayN = getCycleDay(periods, selectedISO);
    const cycleDayLabel =
      cycleDayN != null ? `Cycle day ${cycleDayN}` : null;
    // Label for the end-date picker (defaults to today).
    const todayShort = parseLocalDate(today).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (periods.length === 0) {
      if (!canEdit) {
        return {
          dateTitle,
          statusLabel: "Nothing shared yet",
          markerColor: null as string | null,
          cycleDayLabel: null as string | null,
          primaryLabel: null as string | null,
          primaryKind: null as string | null,
          secondaryLabel: null as string | null,
          secondaryKind: null as string | null,
          secondaryDestructive: false,
          secondary2Label: null as string | null,
          secondary2Kind: null as string | null,
          secondary2Destructive: false,
        };
      }
      return {
        dateTitle,
        statusLabel: null as string | null,
        markerColor: null as string | null,
        cycleDayLabel: null as string | null,
        primaryLabel: "Log your last period",
        primaryKind: "log-empty",
        secondaryLabel: null as string | null,
        secondaryKind: null as string | null,
        secondaryDestructive: false,
        secondary2Label: null as string | null,
        secondary2Kind: null as string | null,
        secondary2Destructive: false,
      };
    }

    const st = marks.status.get(selectedISO);
    const ph = getPhase(periods, selectedISO, today);
    let statusLabel: string | null = null;
    let markerColor: string | null = null;
    if (st?.kind === "period") {
      statusLabel = `Period day ${st.day}`;
      markerColor = CYCLE_DOT.period;
    } else if (st) {
      statusLabel = "Expected period";
      markerColor = CYCLE_DOT.predicted;
    } else if (ph === "ovulation") {
      statusLabel = "Ovulation day";
      markerColor = CYCLE_DOT.ovulation;
    } else if (ph === "fertile") {
      statusLabel = "Fertile window";
      markerColor = CYCLE_DOT.fertile;
    }

    if (!canEdit) {
      return {
        dateTitle,
        statusLabel,
        markerColor,
        cycleDayLabel,
        primaryLabel: null as string | null,
        primaryKind: null as string | null,
        secondaryLabel: null as string | null,
        secondaryKind: null as string | null,
        secondaryDestructive: false,
        secondary2Label: null as string | null,
        secondary2Kind: null as string | null,
        secondary2Destructive: false,
      };
    }
    if (selectedISO > today) {
      return {
        dateTitle,
        statusLabel,
        markerColor,
        cycleDayLabel,
        primaryLabel: null as string | null,
        primaryKind: null as string | null,
        secondaryLabel: null as string | null,
        secondaryKind: null as string | null,
        secondaryDestructive: false,
        secondary2Label: null as string | null,
        secondary2Kind: null as string | null,
        secondary2Destructive: false,
      };
    }

    const latest = periods[periods.length - 1] ?? null;
    const isStart = periods.some((p) => p.start === selectedISO);
    const isEnd = latest?.end === selectedISO;
    if (isStart) {
      const ongoing = latest && !latest.end && selectedISO >= latest.start;
      // Picker button joins only when its date (today) differs from the
      // selected day — otherwise the direct button already ends today.
      const endPick = ongoing && selectedISO !== today;
      return {
        dateTitle,
        statusLabel,
        markerColor,
        cycleDayLabel,
        primaryLabel: "Change start date",
        primaryKind: "change",
        secondaryLabel: "Remove period",
        secondaryKind: "remove",
        secondaryDestructive: true,
        secondary2Label: ongoing
          ? endPick
            ? `Period ended on ${todayShort}`
            : "Period ended this day"
          : null,
        secondary2Kind: ongoing ? (endPick ? "end-pick" : "end") : null,
        secondary2Destructive: false,
      };
    }
    if (isEnd) {
      // An auto-closed guess reads as an estimate until the owner picks a
      // real date; picking replaces it via the same endPeriod action.
      const estimated = !!latest?.endEstimated;
      return {
        dateTitle,
        statusLabel: estimated ? "Estimated end" : statusLabel,
        markerColor: estimated ? CYCLE_DOT.predicted : markerColor,
        cycleDayLabel,
        primaryLabel: "Change end date",
        primaryKind: "change-end",
        secondaryLabel: "Remove end date",
        secondaryKind: "remove-end",
        secondaryDestructive: false,
        secondary2Label: null as string | null,
        secondary2Kind: null as string | null,
        secondary2Destructive: false,
      };
    }
    if (latest && !latest.end && selectedISO >= latest.start) {
      const endPick = selectedISO !== today;
      return {
        dateTitle,
        statusLabel,
        markerColor,
        cycleDayLabel,
        primaryLabel: "Period ended this day",
        primaryKind: "end",
        secondaryLabel: endPick ? `Period ended on ${todayShort}` : null,
        secondaryKind: endPick ? "end-pick" : null,
        secondaryDestructive: false,
        secondary2Label: null as string | null,
        secondary2Kind: null as string | null,
        secondary2Destructive: false,
      };
    }
    if (st?.kind === "period") {
      return {
        dateTitle,
        statusLabel,
        markerColor,
        cycleDayLabel,
        primaryLabel: null as string | null,
        primaryKind: null as string | null,
        secondaryLabel: null as string | null,
        secondaryKind: null as string | null,
        secondaryDestructive: false,
        secondary2Label: null as string | null,
        secondary2Kind: null as string | null,
        secondary2Destructive: false,
      };
    }
    return {
      dateTitle,
      statusLabel,
      markerColor,
      cycleDayLabel,
      primaryLabel: "Period started this day",
      primaryKind: "log",
      secondaryLabel: null as string | null,
      secondaryKind: null as string | null,
      secondaryDestructive: false,
      secondary2Label: null as string | null,
      secondary2Kind: null as string | null,
      secondary2Destructive: false,
    };
  }, [selectedISO, periods, marks, today, canEdit]);

  const handlePanelPrimary = useCallback(() => {
    if (panel.primaryKind === "log" || panel.primaryKind === "log-empty") {
      if (panel.primaryKind === "log-empty") openLogPicker(null);
      else commitLog(selectedISO);
    } else if (panel.primaryKind === "end") {
      const latest = periods[periods.length - 1] ?? null;
      if (!latest) return;
      actions.endPeriod(latest.start, selectedISO);
    } else if (panel.primaryKind === "change") {
      openChangePickerFor(selectedISO);
    } else if (panel.primaryKind === "change-end") {
      const latest = periods[periods.length - 1] ?? null;
      if (!latest?.end) return;
      openEndPicker(latest.start, latest.end);
    }
  }, [
    panel.primaryKind,
    openLogPicker,
    commitLog,
    selectedISO,
    periods,
    actions,
    openChangePickerFor,
    openEndPicker,
  ]);

  const handlePanelSecondary = useCallback(() => {
    if (panel.secondaryKind === "remove") {
      Alert.alert("Remove period?", "This start date will be deleted.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => actions.removePeriod(selectedISO),
        },
      ]);
    } else if (panel.secondaryKind === "remove-end") {
      const latest = periods[periods.length - 1] ?? null;
      if (!latest) return;
      actions.removeEnd(latest.start);
    } else if (panel.secondaryKind === "end-pick") {
      const latest = periods[periods.length - 1] ?? null;
      if (!latest || latest.end) return;
      openEndPicker(latest.start, today);
    }
  }, [panel.secondaryKind, actions, selectedISO, periods, openEndPicker]);

  const handlePanelSecondary2 = useCallback(() => {
    if (panel.secondary2Kind === "end") {
      const latest = periods[periods.length - 1] ?? null;
      if (!latest) return;
      actions.endPeriod(latest.start, selectedISO);
    } else if (panel.secondary2Kind === "end-pick") {
      const latest = periods[periods.length - 1] ?? null;
      if (!latest || latest.end) return;
      openEndPicker(latest.start, today);
    }
  }, [panel.secondary2Kind, actions, selectedISO, periods, openEndPicker]);

  const chance = fertility.pregnancyChance;
  const chanceColor =
    chance === "high"
      ? PERIOD_RED
      : chance === "medium"
        ? OVULATION_ORANGE
        : "#999";

  const showPanel = !bothWoman && view === "calendar";

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20 },
        ]}
      >
        <View style={styles.headerRow}>
          <MenuButton />
          <Text style={styles.title}>{title}</Text>
        </View>

        {canEdit && (
          <View style={styles.chipRow}>
            <Text style={styles.chip}>Shared with your partner</Text>
          </View>
        )}

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, view === "today" && styles.toggleActive]}
            onPress={handleShowToday}
          >
            <Text
              style={[
                styles.toggleText,
                view === "today" && styles.toggleTextActive,
              ]}
            >
              Today
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, view === "calendar" && styles.toggleActive]}
            onPress={handleShowCalendar}
          >
            <Text
              style={[
                styles.toggleText,
                view === "calendar" && styles.toggleTextActive,
              ]}
            >
              Calendar
            </Text>
          </Pressable>
        </View>

        {bothWoman ? (
          <View style={styles.card}>
            <Text style={styles.cardHint}>
              Choose who tracks the cycle in Edit Profile.
            </Text>
          </View>
        ) : view === "calendar" ? (
            <View style={styles.card}>
              <View style={styles.listTopRow}>
                <Pressable onPress={handleTodayCal} hitSlop={8}>
                  <Text style={styles.todayLink}>Today</Text>
                </Pressable>
              </View>
              <CalendarList
                key={cycleCalKey}
                ref={cycleCalRef}
                current={today}
                pastScrollRange={pastRange}
                futureScrollRange={futureRange}
                windowSize={21}
                horizontal
                pagingEnabled
                showScrollIndicator={false}
                hideArrows
                calendarWidth={windowWidth - 74}
                minDate={APP_START_DATE}
                markedDates={cycleDots}
                markingType="multi-dot"
                onDayPress={handleDayPress}
                theme={CALENDAR_THEME}
                renderHeader={renderCycleHeader}
              />
              <View style={styles.legend}>
                <View style={styles.legendRow}>
                  <View style={styles.legendPeriod} />
                  <Text style={styles.legendText}>Period</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={styles.legendPredicted} />
                  <Text style={styles.legendText}>Predicted period</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={styles.legendFertile} />
                  <Text style={styles.legendText}>Fertile window</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={styles.legendOvulation} />
                  <Text style={styles.legendText}>Ovulation day</Text>
                </View>
              </View>
            </View>
        ) : periods.length === 0 ? (
          canEdit ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No cycle logged yet</Text>
              <Text style={styles.cardHint}>
                Switch to Calendar to log your last period.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleLogEmpty}
              >
                <Text style={styles.primaryButtonText}>
                  Log your last period
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardHint}>Nothing shared yet.</Text>
              {!profile?.gender && (
                <Text style={styles.cardHint}>
                  Set your gender in Edit Profile to use cycle tracking.
                </Text>
              )}
            </View>
          )
        ) : (
          <>
            {hero && (
              <View style={styles.hero}>
                <Text style={styles.heroTitle}>{hero.headline}</Text>
                {hero.subline !== "" && (
                  <Text style={styles.heroSub}>{hero.subline}</Text>
                )}
              </View>
            )}

            {fertility.phase && (
              <View style={styles.card}>
                <Text style={styles.phaseMessage}>
                  {PHASE_MESSAGES[fertility.phase](who)}
                </Text>
                {bar && (
                  <View onLayout={onBarLayout} style={styles.barWrap}>
                    <Svg width={barW} height={64}>
                      <Rect
                        x={0}
                        y={10}
                        width={barW}
                        height={12}
                        rx={6}
                        fill={TRACK_COLOR}
                      />
                      <Rect
                        x={bar.period.x}
                        y={10}
                        width={bar.period.w}
                        height={12}
                        rx={6}
                        fill={PERIOD_RED}
                      />
                      {bar.fertile && (
                        <Rect
                          x={bar.fertile.x}
                          y={10}
                          width={bar.fertile.w}
                          height={12}
                          rx={6}
                          fill={FERTILE_BG}
                        />
                      )}
                      {bar.ovulationX !== null && (
                        <Circle
                          cx={bar.ovulationX}
                          cy={16}
                          r={5}
                          fill={OVULATION_ORANGE}
                        />
                      )}
                      <Line
                        x1={bar.todayX}
                        y1={4}
                        x2={bar.todayX}
                        y2={44}
                        stroke="#e75480"
                        strokeWidth={2}
                      />
                      <SvgText
                        x={bar.labelX}
                        y={58}
                        fontSize={11}
                        fontWeight="700"
                        fill="#e75480"
                        textAnchor="middle"
                      >
                        {`Day ${bar.cycleDay ?? "?"}`}
                      </SvgText>
                    </Svg>
                  </View>
                )}
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.chanceRow}>
                <Text style={styles.cardTitle}>Pregnancy chance</Text>
                <Text style={[styles.chanceLabel, { color: chanceColor }]}>
                  {chance === "unsure"
                    ? "Unsure"
                    : chance[0].toUpperCase() + chance.slice(1)}
                </Text>
              </View>
              {bell && (
                <Svg
                  width="100%"
                  height={84}
                  viewBox="0 0 300 84"
                  preserveAspectRatio="none"
                >
                  <Path
                    d={`${bell.d} L296,84 L4,84 Z`}
                    fill="#ffd9e6"
                    fillOpacity={0.55}
                    stroke="#e75480"
                    strokeWidth={2}
                  />
                  <Line
                    x1={bell.tx}
                    y1={6}
                    x2={bell.tx}
                    y2={78}
                    stroke="#e75480"
                    strokeWidth={2}
                  />
                </Svg>
              )}
              <Text style={styles.disclaimer}>
                Estimates only. Not birth control or medical advice.
              </Text>
            </View>

            {canEdit && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Manage</Text>
                <View style={styles.manageRow}>
                  <Pressable
                    onPress={handleEditLast}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text style={styles.manageLink}>
                      Edit last period start
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleClearCycle}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text style={styles.manageDanger}>Clear cycle data</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <MonthJumpPicker
        visible={monthPickerVisible}
        year={pickerYear}
        onYearChange={setPickerYear}
        onPickMonth={handlePickMonth}
        onClose={closeMonthPicker}
      />
      {showPanel && (
        <CycleActionPanel
          key={selectedISO}
          dateTitle={panel.dateTitle}
          statusLabel={panel.statusLabel}
          markerColor={panel.markerColor}
          cycleDayLabel={panel.cycleDayLabel}
          primaryLabel={panel.primaryLabel}
          onPrimary={panel.primaryLabel ? handlePanelPrimary : null}
          secondaryLabel={panel.secondaryLabel}
          onSecondary={panel.secondaryLabel ? handlePanelSecondary : null}
          secondaryDestructive={panel.secondaryDestructive}
          secondary2Label={panel.secondary2Label}
          onSecondary2={
            panel.secondary2Label ? handlePanelSecondary2 : null
          }
          secondary2Destructive={panel.secondary2Destructive}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "700", flex: 1 },
  chipRow: { alignItems: "flex-start" },
  chip: {
    backgroundColor: "#ffd9e6",
    color: "#e75480",
    fontSize: 12,
    fontWeight: "600",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderColor: "#ffd9e6",
    borderWidth: 1,
    borderRadius: 20,
    padding: 4,
    gap: 4,
  },
  toggle: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#e75480" },
  toggleText: { color: "#e75480", fontWeight: "600", fontSize: 14 },
  toggleTextActive: { color: "#fff" },
  hero: { alignItems: "center", gap: 4, paddingVertical: 4 },
  heroTitle: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  heroSub: { fontSize: 14, color: "#999" },
  card: {
    backgroundColor: "#fff",
    borderColor: "#ffd9e6",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardHint: { fontSize: 14, color: "#999", textAlign: "center" },
  phaseMessage: { fontSize: 14, color: "#333", lineHeight: 20 },
  barWrap: { paddingTop: 4 },
  chanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chanceLabel: { fontSize: 16, fontWeight: "700" },
  disclaimer: { fontSize: 12, color: "#999", textAlign: "center" },
  primaryButton: {
    backgroundColor: "#e75480",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  listTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  todayLink: { color: "#e75480", fontWeight: "600", fontSize: 13 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 6,
    marginTop: 2,
    backgroundColor: "#fff5f7",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendPeriod: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYCLE_DOT.period,
  },
  legendPredicted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYCLE_DOT.predicted,
  },
  legendFertile: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYCLE_DOT.fertile,
  },
  legendOvulation: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYCLE_DOT.ovulation,
  },
  legendText: { fontSize: 12, color: "#999" },
  pressed: { opacity: 0.6 },
  manageRow: { flexDirection: "row", gap: 16, marginTop: 2 },
  manageLink: { color: "#e75480", fontWeight: "600", fontSize: 13 },
  manageDanger: { color: "#d32f2f", fontWeight: "600", fontSize: 13 },
});
