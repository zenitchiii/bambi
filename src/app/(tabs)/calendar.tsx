import ScreenContainer from "@/components/ScreenContainer";
import MenuButton from "@/components/MenuButton";
import { APP_START_DATE } from "@/constants/date";
import { useProfile } from "@/context/ProfileContext";
import { usePartnerProfile } from "@/hooks/usePartnerProfile";
import { useCycle } from "@/hooks/useCycle";
import { useSharedCoupleData } from "@/hooks/useSharedCoupleData";
import {
  daysUntil,
  formatDateISO,
  getMonthsaryOccurrences,
  getYearlyOccurrences,
  getYearlyOccurrencesFromMonthDay,
} from "@/utils/dateMath";
import Holidays from "date-holidays";
import MonthJumpPicker from "@/components/calendar/MonthJumpPicker";
import {
  CALENDAR_THEME,
  CYCLE_DOT,
  END_YEAR,
  FUTURE_RANGE_MONTHS,
  START_MONTH,
  START_YEAR,
  calendarHeaderTextStyle,
  monthDiffMonths,
  parseLocalDate,
} from "@/components/calendar/calendarTheme";
import { cap, getPossessive } from "@/utils/pronouns";
import { cycleNoteForDate, fromDayNumber_, toDayNumber_ } from "@/utils/cycle";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CalendarList, DateData } from "react-native-calendars";

const hd = new Holidays("PH");
const SCREEN_WIDTH = Dimensions.get("window").width;

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const r = n % 100;
  return n + (s[(r - 20) % 10] || s[r] || s[0]);
}

type ModalMode = "options" | "note" | "event";

function EditableEntry({
  label,
  content,
  onEdit,
  onRemove,
  onAdd,
  addLabel,
}: {
  label: string;
  content?: string;
  onEdit: () => void;
  onRemove: () => void;
  onAdd: () => void;
  addLabel: string;
}) {
  if (!content) {
    return (
      <Pressable style={styles.optionButton} onPress={onAdd}>
        <Text style={styles.optionText}>{addLabel}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.statusCard}>
      <Text style={styles.noteLabel}>{label}</Text>
      <Text style={styles.notePreview}>{content}</Text>
      <View style={styles.noteActionsRow}>
        <Pressable onPress={onEdit}>
          <Text style={styles.linkText}>Edit</Text>
        </Pressable>
        <Pressable onPress={onRemove}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Shared edit form for note/event — differs only by these props
function FieldEditor({
  value,
  onChangeText,
  maxLength,
  placeholder,
  multiline,
  hint,
  onSave,
  onBack,
}: {
  value: string;
  onChangeText: (v: string) => void;
  maxLength: number;
  placeholder: string;
  multiline?: boolean;
  hint?: string;
  onSave: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <TextInput
        style={styles.noteInput}
        multiline={multiline}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
      />
      <Text style={styles.charCounter}>
        {value.length}/{maxLength}
      </Text>
      {hint && <Text style={styles.eventHint}>{hint}</Text>}
      <Pressable style={styles.optionButton} onPress={onSave}>
        <Text style={styles.optionText}>Save</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelText}>Back</Text>
      </Pressable>
    </>
  );
}

export default function CalendarScreen() {
  const calendarRef = useRef<any>(null);
  const { profile } = useProfile();
  const partner = usePartnerProfile();
  const {
    data: shared,
    update: updateShared,
    removeNote,
    removeCustomEvent,
  } = useSharedCoupleData();
  const { dateNight, notes, customEvents: events } = shared;
  const { role, periods, marks, stats, fertility } = useCycle();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("options");
  const [noteDraft, setNoteDraft] = useState("");
  const [eventDraft, setEventDraft] = useState("");
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [notesListVisible, setNotesListVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(START_YEAR);
  const [calendarKey, setCalendarKey] = useState(0);
  const params = useLocalSearchParams<{ date?: string }>();
  // Computed once: today (local, never UTC) is the initial page; the past
  // range bridges APP_START_DATE -> today. Cause of the bug: current was
  // APP_START_DATE with pastScrollRange 0, so index 0 (September) opened.
  const { today, pastRange, futureRange } = useMemo(() => {
    const t = formatDateISO(new Date());
    const [y, m] = t.split("-").map(Number);
    const past = Math.max(0, monthDiffMonths(APP_START_DATE, y, m - 1));
    return {
      today: t,
      pastRange: past,
      futureRange: Math.max(0, FUTURE_RANGE_MONTHS - past),
    };
  }, []);
  const isDateNight = selectedDate === dateNight && selectedDate !== null;
  const existingNote = selectedDate ? notes[selectedDate] : undefined;
  const monthDay = selectedDate?.slice(5) ?? null;
  const existingEvent = monthDay ? events[monthDay] : undefined;
  const isFutureDate = !!selectedDate && selectedDate > today;

  const holidayName = useMemo(() => {
    if (!selectedDate) return null;
    const year = Number(selectedDate.split("-")[0]);
    return (
      hd.getHolidays(year).find((h) => h.date.startsWith(selectedDate))?.name ??
      null
    );
  }, [selectedDate]);

  const dateLabels = useMemo(() => {
    if (!selectedDate || !profile) return [];
    const [yearStr, monthStr, dayStr] = selectedDate.split("-");
    const [annYearStr, annMonthStr, annDayStr] = formatDateISO(
      new Date(profile.anniversary),
    ).split("-");
    const [, yourMonthStr, yourDayStr] = formatDateISO(
      new Date(profile.birthday),
    ).split("-");
    const partnerBirthdayISO = partner
      ? formatDateISO(new Date(partner.birthday))
      : null;
    const [, partnerMonthStr, partnerDayStr] = partnerBirthdayISO
      ? partnerBirthdayISO.split("-")
      : [null, null, null];
    const labels: string[] = [];

    if (dayStr === annDayStr) {
      const elapsed =
        (Number(yearStr) - Number(annYearStr)) * 12 +
        (Number(monthStr) - Number(annMonthStr));
      if (elapsed === 0) labels.push("Anniversary");
      else if (elapsed > 0)
        labels.push(
          elapsed % 12 === 0
            ? `${getOrdinal(elapsed / 12)} Anniversary`
            : `${getOrdinal(elapsed)} Monthsary`,
        );
    }
    if (monthStr === yourMonthStr && dayStr === yourDayStr)
      labels.push("Your birthday");
    if (monthStr === partnerMonthStr && dayStr === partnerDayStr)
      labels.push(`${cap(getPossessive(partner?.gender))} birthday`);
    return labels;
  }, [selectedDate, profile, partner]);

  const sortedNotes = useMemo(
    () =>
      Object.entries(notes)
        .filter(([, t]) => t?.trim())
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    [notes],
  );

  const jumpToMonth = (year: number, monthIdx: number) => {
    if (year === START_YEAR && monthIdx === START_MONTH - 1) {
      setCalendarKey((k) => k + 1); // scrollToMonth can't reliably land back on the first rendered month
    } else {
      setTimeout(
        () => calendarRef.current?.scrollToMonth(new Date(year, monthIdx, 1)),
        100,
      );
    }
  };

  useEffect(() => {
    if (params.date) {
      setSelectedDate(params.date);
      const [y, m] = params.date.split("-").map(Number);
      jumpToMonth(y, m - 1);
    }
  }, [params.date]);

  // Tabs stay mounted, so the grid keeps its scroll position across tab
  // switches — re-land on today at each focus ("Today" button stays for
  // manual jumps). Ref only, no new state; the key is untouched (no remount).
  useFocusEffect(
    useCallback(() => {
      calendarRef.current?.scrollToMonth(parseLocalDate(today));
    }, [today]),
  );

  const handleToday = () => {
    const [y, m] = today.split("-").map(Number);
    jumpToMonth(y, m - 1);
    setSelectedDate(today);
  };

  const openOptions = () => {
    setNoteDraft(selectedDate ? (notes[selectedDate] ?? "") : "");
    setEventDraft(monthDay ? (events[monthDay] ?? "") : "");
    setModalMode("options");
    setOptionsVisible(true);
  };
  const closeOptions = () => setOptionsVisible(false);
  const closeMonthPicker = () => setMonthPickerVisible(false);
  const handlePickMonth = (year: number, monthIndex: number) => {
    setMonthPickerVisible(false);
    jumpToMonth(year, monthIndex);
  };

  const handleSetDateNight = () => {
    if (!selectedDate) return;
    updateShared({ dateNight: selectedDate });
    closeOptions();
  };
  const handleRemoveDateNight = () => {
    updateShared({ dateNight: null });
    closeOptions();
  };

  const handleSaveNote = () => {
    if (!selectedDate) return;
    updateShared({ notes: { ...notes, [selectedDate]: noteDraft } });
    closeOptions();
  };
  const handleRemoveNote = () => {
    if (!selectedDate) return;
    removeNote(selectedDate);
    closeOptions();
  };

  const handleSaveEvent = () => {
    if (!monthDay) return;
    // A blank draft would otherwise persist as an empty-label event and
    // render as a nameless "— today" row on Home — treat it as a removal.
    if (eventDraft.trim() === "") {
      removeCustomEvent(monthDay);
    } else {
      updateShared({
        customEvents: { ...events, [monthDay]: eventDraft.trim() },
      });
    }
    closeOptions();
  };
  const handleRemoveEvent = () => {
    if (!monthDay) return;
    removeCustomEvent(monthDay);
    closeOptions();
  };

  // Man's side only, read-only: one shared line for the tapped date,
  // shown in the day panel and the More-options sheet. Display only —
  // never written into notes.
  const cycleNote = useMemo(() => {
    if (role !== "viewer" || !selectedDate) return null;
    return cycleNoteForDate(
      selectedDate,
      marks,
      periods,
      today,
      cap(getPossessive(partner?.gender)),
    );
  }, [role, selectedDate, marks, periods, partner, today]);

  const handleAddMemory = () => {
    if (!selectedDate) return;
    if (isFutureDate) {
      Alert.alert(
        "Unavailable",
        "You can add photos and videos to this day once it actually happens!",
      );
      return;
    }
    closeOptions();
    router.push({ pathname: "/memories", params: { date: selectedDate } });
  };

  // Viewer-only cycle dots, built once (period > predicted > ovulation >
  // fertile, first wins so each day carries at most one cycle dot).
  // Owner sees none here — she has the full calendar in her Cycle tab.
  // Iterates mark sets, never whole ranges.
  const cycleDots = useMemo(() => {
    const map = new Map<string, { key: string; color: string }>();
    if (role !== "viewer") return map;
    const add = (date: string, key: string, color: string) => {
      if (date < APP_START_DATE || map.has(date)) return;
      map.set(date, { key, color });
    };
    marks.logged.forEach((d) => add(d, "cycle-logged", CYCLE_DOT.period));
    marks.projected.forEach((d) => add(d, "cycle-projected", CYCLE_DOT.predicted));
    marks.predicted.forEach((d) => add(d, "cycle-predicted", CYCLE_DOT.predicted));
    if (fertility.ovulationDay) {
      add(fertility.ovulationDay, "cycle-ovulation", CYCLE_DOT.ovulation);
    }
    if (fertility.fertileStart && fertility.fertileEnd) {
      const endN = toDayNumber_(fertility.fertileEnd);
      for (let n = toDayNumber_(fertility.fertileStart); n <= endN; n++) {
        add(fromDayNumber_(n), "cycle-fertile", CYCLE_DOT.fertile);
      }
    }
    return map;
  }, [role, marks, fertility]);

  const markedDates = useMemo(() => {
    const dots: Record<string, any> = {};
    const addDot = (date: string, key: string, color: string) => {
      if (date < APP_START_DATE) return;
      if (!dots[date]) dots[date] = { dots: [] };
      dots[date].dots.push({ key, color });
    };

    for (let y = START_YEAR; y <= END_YEAR; y++) {
      hd.getHolidays(y).forEach((h) =>
        addDot(h.date.split(" ")[0], `holiday-${h.name}`, "#f2b134"),
      );
    }
    if (profile) {
      getYearlyOccurrences(formatDateISO(new Date(profile.birthday))).forEach(
        (d) => addDot(d, "bday-you", "#8e6bd6"),
      );
    }
    if (partner) {
      getYearlyOccurrences(formatDateISO(new Date(partner.birthday))).forEach(
        (d) => addDot(d, "bday-partner", "#8e6bd6"),
      );
    }
    if (profile) {
      getMonthsaryOccurrences(
        formatDateISO(new Date(profile.anniversary)),
      ).forEach((d) => addDot(d, "anniversary", "#e75480"));
    }
    Object.keys(events).forEach((md) =>
      getYearlyOccurrencesFromMonthDay(md, START_YEAR, 5).forEach((d) =>
        addDot(d, `event-${md}`, "#3aa17e"),
      ),
    );
    if (dateNight) addDot(dateNight, "dateNight", "#6bb9d6");
    Object.entries(notes).forEach(
      ([d, t]) => t?.trim() && addDot(d, "note", "#b5b5b5"),
    );
    // Cycle dots merge into the same helper (multi-dot keeps the other
    // markers); pre-APP_START_DATE dates are skipped automatically.
    cycleDots.forEach(({ key, color }, d) => addDot(d, key, color));

    if (selectedDate) {
      dots[selectedDate] = {
        ...dots[selectedDate],
        selected: true,
        selectedColor: "rgba(231,84,128,0.15)",
      };
    }
    return dots;
  }, [dateNight, notes, events, selectedDate, profile, partner, cycleDots]);

  const dateNightCountdown = dateNight ? daysUntil(dateNight) : null;

  return (
    <ScreenContainer contentContainerStyle={{ gap: 12 }}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <MenuButton />
              <Text style={styles.title}>Our Calendar</Text>
            </View>
            <View style={styles.headerButtons}>
              <Pressable onPress={handleToday}>
                <Text style={styles.headerLink}>Today</Text>
              </Pressable>
              <Pressable onPress={() => setNotesListVisible(true)}>
                <Text style={styles.headerLink}>All notes</Text>
              </Pressable>
            </View>
          </View>

          {dateNightCountdown !== null && dateNightCountdown >= 0 && (
            <View style={styles.countdownBanner}>
              <Text style={styles.countdownText}>
                {dateNightCountdown === 0
                  ? "Your date is today"
                  : `${dateNightCountdown} day${dateNightCountdown === 1 ? "" : "s"} until your date`}
              </Text>
            </View>
          )}

      <CalendarList
        key={calendarKey}
        ref={calendarRef}
        current={today}
        pastScrollRange={pastRange}
        futureScrollRange={futureRange}
        windowSize={21}
        horizontal
        pagingEnabled
        showScrollIndicator={false}
        hideArrows
        calendarWidth={SCREEN_WIDTH - 40}
        minDate={APP_START_DATE}
        markedDates={markedDates}
        markingType="multi-dot"
        onDayPress={(d: DateData) => setSelectedDate(d.dateString)}
        theme={CALENDAR_THEME}
        renderHeader={(date: any) => {
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
        }}
      />

      {role === "viewer" && (
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
      )}

        <View style={styles.panel}>
        {selectedDate ? (
          <>
            <View style={styles.panelHeader}>
              <Text style={styles.panelDate}>{selectedDate}</Text>
              <Pressable onPress={openOptions}>
                <Text style={styles.moreOptions}>More options</Text>
              </Pressable>
            </View>
            {isDateNight && (
              <Text style={styles.panelDateNight}>Your next date</Text>
            )}
            {holidayName && (
              <Text style={styles.panelHoliday}>{holidayName}</Text>
            )}
            {dateLabels.map((l) => (
              <Text key={l} style={styles.panelLabel}>
                {l}
              </Text>
            ))}
            {existingEvent && (
              <>
                <Text style={styles.noteLabel}>Yearly event</Text>
                <Text style={styles.notePreview}>{existingEvent}</Text>
              </>
            )}
            {cycleNote && (
              <>
                <Text style={styles.noteLabel}>Cycle</Text>
                <Text style={styles.notePreview}>{cycleNote}</Text>
              </>
            )}
            <Text style={styles.noteLabel}>Note</Text>
            <Text
              style={existingNote ? styles.notePreview : styles.notePlaceholder}
            >
              {existingNote || 'No note yet — tap "More options" to add one'}
            </Text>
            {(role === "viewer" || role === "owner") &&
              stats.daysUntil !== null &&
              stats.daysUntil < 0 &&
              (selectedDate === today ||
                selectedDate === stats.nextStart) && (
                <Text style={styles.panelLabel}>
                  Expected {-stats.daysUntil} day
                  {-stats.daysUntil === 1 ? "" : "s"} ago
                </Text>
              )}
          </>
        ) : (
          <Text style={styles.notePlaceholder}>
            Tap a date to see its details here
          </Text>
        )}
        </View>

      <Modal
        visible={optionsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeOptions}
      >
        <Pressable style={styles.overlay} onPress={closeOptions}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetDate}>{selectedDate}</Text>

            {modalMode === "options" && (
              <>
                {cycleNote && (
                  <>
                    <Text style={styles.noteLabel}>Cycle</Text>
                    <Text style={styles.notePreview}>{cycleNote}</Text>
                  </>
                )}
                {isDateNight ? (
                  <View style={styles.statusCard}>
                    <Text style={styles.statusText}>Set as next date</Text>
                    <Pressable onPress={handleRemoveDateNight}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.optionButton}
                    onPress={handleSetDateNight}
                  >
                    <Text style={styles.optionText}>Set as next date</Text>
                  </Pressable>
                )}

                <EditableEntry
                  label="Note"
                  content={existingNote}
                  onEdit={() => setModalMode("note")}
                  onRemove={handleRemoveNote}
                  onAdd={() => setModalMode("note")}
                  addLabel="Add a note"
                />

                <EditableEntry
                  label="Yearly event"
                  content={existingEvent}
                  onEdit={() => setModalMode("event")}
                  onRemove={handleRemoveEvent}
                  onAdd={() => setModalMode("event")}
                  addLabel="Make this a yearly event"
                />

                <Pressable
                  style={[
                    styles.optionButton,
                    isFutureDate && styles.optionButtonDisabled,
                  ]}
                  onPress={handleAddMemory}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isFutureDate && styles.optionTextDisabled,
                    ]}
                  >
                    Add picture/video to this date
                  </Text>
                </Pressable>

                <Pressable style={styles.cancelButton} onPress={closeOptions}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            )}

            {modalMode === "note" && (
              <FieldEditor
                value={noteDraft}
                onChangeText={setNoteDraft}
                maxLength={300}
                placeholder="Write something to remember..."
                multiline
                onSave={handleSaveNote}
                onBack={() => setModalMode("options")}
              />
            )}

            {modalMode === "event" && (
              <FieldEditor
                value={eventDraft}
                onChangeText={setEventDraft}
                maxLength={60}
                placeholder="e.g. Her mom's birthday"
                hint="Repeats every year on this month and day"
                onSave={handleSaveEvent}
                onBack={() => setModalMode("options")}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <MonthJumpPicker
        visible={monthPickerVisible}
        year={pickerYear}
        onYearChange={setPickerYear}
        onPickMonth={handlePickMonth}
        onClose={closeMonthPicker}
      />

      <Modal
        visible={notesListVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesListVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setNotesListVisible(false)}
        >
          <Pressable
            style={[styles.sheet, { maxHeight: "70%" }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetDate}>All notes</Text>
            <ScrollView>
              {sortedNotes.length === 0 ? (
                <Text style={styles.notePlaceholder}>No notes yet</Text>
              ) : (
                sortedNotes.map(([date, text]) => (
                  <Pressable
                    key={date}
                    style={styles.noteListItem}
                    onPress={() => {
                      setNotesListVisible(false);
                      setSelectedDate(date);
                      const [y, m] = date.split("-").map(Number);
                      jumpToMonth(y, m - 1);
                    }}
                  >
                    <Text style={styles.noteListDate}>{date}</Text>
                    <Text style={styles.noteListText} numberOfLines={1}>
                      {text}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setNotesListVisible(false)}
            >
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "700" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerButtons: { flexDirection: "row", gap: 16 },
  headerLink: { color: "#e75480", fontWeight: "600", fontSize: 13 },
  countdownBanner: {
    backgroundColor: "#e6f4fa",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  countdownText: { color: "#3a8fb3", fontWeight: "600" },
  panel: {
    backgroundColor: "#fff5f7",
    borderRadius: 16,
    padding: 16,
    gap: 6,
    minHeight: 90,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 6,
    backgroundColor: "#fff5f7",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 5 },
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
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelDate: { fontSize: 16, fontWeight: "700" },
  moreOptions: { color: "#e75480", fontWeight: "600", fontSize: 13 },
  panelDateNight: { color: "#6bb9d6", fontWeight: "600" },
  panelHoliday: { color: "#f2b134", fontWeight: "600" },
  panelLabel: { color: "#e75480", fontWeight: "600" },
  noteLabel: { fontSize: 12, color: "#999", fontWeight: "600", marginTop: 4 },
  notePreview: { fontSize: 14, color: "#444" },
  notePlaceholder: { fontSize: 14, color: "#bbb", fontStyle: "italic" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 12,
    width: "100%",
    maxWidth: 400,
  },
  sheetDate: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  optionButton: { backgroundColor: "#fff5f7", borderRadius: 12, padding: 14 },
  optionButtonDisabled: { opacity: 0.5 },
  optionText: { fontSize: 15, fontWeight: "600", color: "#e75480" },
  optionTextDisabled: { color: "#bbb" },
  cancelButton: { padding: 14, alignItems: "center" },
  cancelText: { color: "#999" },
  noteInput: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCounter: { fontSize: 11, color: "#bbb", textAlign: "right" },
  eventHint: { fontSize: 12, color: "#999" },
  statusCard: {
    backgroundColor: "#fff5f7",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  statusText: { fontSize: 15, fontWeight: "600", color: "#6bb9d6" },
  noteActionsRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  linkText: { color: "#6bb9d6", fontWeight: "600" },
  removeText: { color: "#d9534f", fontWeight: "600" },
  noteListItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  noteListDate: { fontSize: 12, fontWeight: "700", color: "#e75480" },
  noteListText: { fontSize: 14, color: "#444" },
});
