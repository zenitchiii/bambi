import ScreenContainer from "@/components/ScreenContainer";
import {
  ANNIVERSARY_DATE,
  APP_START_DATE,
  PARTNER_BIRTHDAY,
  YOUR_BIRTHDAY,
} from "@/constants/date";
import {
  daysUntil,
  formatDateISO,
  getMonthsaryOccurrences,
  getYearlyOccurrences,
  getYearlyOccurrencesFromMonthDay,
} from "@/utils/dateMath";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Holidays from "date-holidays";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
const DATE_NIGHT_KEY = "nextDateNight";
const NOTES_KEY = "dateNotes";
const EVENTS_KEY = "customEvents";
const SCREEN_WIDTH = Dimensions.get("window").width;
const [START_YEAR, START_MONTH] = APP_START_DATE.split("-").map(Number);
const TODAY = formatDateISO(new Date());
const FUTURE_RANGE_MONTHS = 60; // 5 years — matches the dateMath default window
const endDate = new Date(START_YEAR, START_MONTH - 1 + FUTURE_RANGE_MONTHS, 1);
const END_YEAR = endDate.getFullYear();
const END_MONTH_INDEX = endDate.getMonth(); // 0-indexed, matches monthIndex in the grid

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const r = n % 100;
  return n + (s[(r - 20) % 10] || s[r] || s[0]);
}

type ModalMode = "options" | "note" | "event";

// Shared display for "note" and "custom event" — same shape, different data
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
  const [dateNight, setDateNight] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Record<string, string>>({});
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

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(DATE_NIGHT_KEY),
      AsyncStorage.getItem(NOTES_KEY),
      AsyncStorage.getItem(EVENTS_KEY),
    ]).then(([dn, n, e]) => {
      if (dn) setDateNight(dn);
      if (n) setNotes(JSON.parse(n));
      if (e) setEvents(JSON.parse(e));
    });
  }, []);

  const isDateNight = selectedDate === dateNight && selectedDate !== null;
  const existingNote = selectedDate ? notes[selectedDate] : undefined;
  const monthDay = selectedDate?.slice(5) ?? null;
  const existingEvent = monthDay ? events[monthDay] : undefined;
  const isFutureDate = !!selectedDate && selectedDate > TODAY;

  const holidayName = useMemo(() => {
    if (!selectedDate) return null;
    const year = Number(selectedDate.split("-")[0]);
    return (
      hd.getHolidays(year).find((h) => h.date.startsWith(selectedDate))?.name ??
      null
    );
  }, [selectedDate]);

  const dateLabels = useMemo(() => {
    if (!selectedDate) return [];
    const [yearStr, monthStr, dayStr] = selectedDate.split("-");
    const [annYearStr, annMonthStr, annDayStr] = ANNIVERSARY_DATE.split("-");
    const [, yourMonthStr, yourDayStr] = YOUR_BIRTHDAY.split("-");
    const [, partnerMonthStr, partnerDayStr] = PARTNER_BIRTHDAY.split("-");
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
      labels.push("Her birthday");
    return labels;
  }, [selectedDate]);

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

  const handleToday = () => {
    const now = new Date();
    jumpToMonth(now.getFullYear(), now.getMonth());
    setSelectedDate(TODAY);
  };

  const openOptions = () => {
    setNoteDraft(selectedDate ? (notes[selectedDate] ?? "") : "");
    setEventDraft(monthDay ? (events[monthDay] ?? "") : "");
    setModalMode("options");
    setOptionsVisible(true);
  };
  const closeOptions = () => setOptionsVisible(false);

  const persist = async (key: string, value: any) =>
    AsyncStorage.setItem(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    );

  const setAndSave = <T,>(setter: (v: T) => void, key: string, value: T) => {
    setter(value);
    persist(key, value);
  };

  const handleSetDateNight = () => {
    if (!selectedDate) return;
    setAndSave(setDateNight, DATE_NIGHT_KEY, selectedDate);
    closeOptions();
  };
  const handleRemoveDateNight = async () => {
    setDateNight(null);
    await AsyncStorage.removeItem(DATE_NIGHT_KEY);
    closeOptions();
  };

  const handleSaveNote = () => {
    if (!selectedDate) return;
    setAndSave(setNotes, NOTES_KEY, { ...notes, [selectedDate]: noteDraft });
    closeOptions();
  };
  const handleRemoveNote = () => {
    if (!selectedDate) return;
    const updated = { ...notes };
    delete updated[selectedDate];
    setAndSave(setNotes, NOTES_KEY, updated);
    closeOptions();
  };

  const handleSaveEvent = () => {
    if (!monthDay) return;
    setAndSave(setEvents, EVENTS_KEY, { ...events, [monthDay]: eventDraft });
    closeOptions();
  };
  const handleRemoveEvent = () => {
    if (!monthDay) return;
    const updated = { ...events };
    delete updated[monthDay];
    setAndSave(setEvents, EVENTS_KEY, updated);
    closeOptions();
  };

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

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const addDot = (date: string, key: string, color: string) => {
      if (date < APP_START_DATE) return;
      if (!marks[date]) marks[date] = { dots: [] };
      marks[date].dots.push({ key, color });
    };

    for (let y = START_YEAR; y <= END_YEAR; y++) {
      hd.getHolidays(y).forEach((h) =>
        addDot(h.date.split(" ")[0], `holiday-${h.name}`, "#f2b134"),
      );
    }
    getYearlyOccurrences(YOUR_BIRTHDAY).forEach((d) =>
      addDot(d, "bday-you", "#8e6bd6"),
    );
    getYearlyOccurrences(PARTNER_BIRTHDAY).forEach((d) =>
      addDot(d, "bday-partner", "#8e6bd6"),
    );
    getMonthsaryOccurrences(ANNIVERSARY_DATE).forEach((d) =>
      addDot(d, "anniversary", "#e75480"),
    );
    Object.keys(events).forEach((md) =>
      getYearlyOccurrencesFromMonthDay(md, START_YEAR, 5).forEach((d) =>
        addDot(d, `event-${md}`, "#3aa17e"),
      ),
    );
    if (dateNight) addDot(dateNight, "dateNight", "#6bb9d6");
    Object.entries(notes).forEach(
      ([d, t]) => t?.trim() && addDot(d, "note", "#b5b5b5"),
    );

    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: "rgba(231,84,128,0.15)",
      };
    }
    return marks;
  }, [dateNight, notes, events, selectedDate]);

  const dateNightCountdown = dateNight ? daysUntil(dateNight) : null;

  return (
    <ScreenContainer contentContainerStyle={{ gap: 12 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Our Calendar</Text>
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
        current={APP_START_DATE}
        pastScrollRange={0}
        futureScrollRange={FUTURE_RANGE_MONTHS}
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
        theme={{ todayTextColor: "#e75480", arrowColor: "#e75480" }}
        renderHeader={(date: any) => {
          const d = new Date(date);
          return (
            <Pressable
              onPress={() => {
                setPickerYear(d.getFullYear());
                setMonthPickerVisible(true);
              }}
            >
              <Text style={styles.calendarHeaderText}>
                {d.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </Pressable>
          );
        }}
      />

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
            <Text style={styles.noteLabel}>Note</Text>
            <Text
              style={existingNote ? styles.notePreview : styles.notePlaceholder}
            >
              {existingNote || 'No note yet — tap "More options" to add one'}
            </Text>
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

      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setMonthPickerVisible(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetDate}>Jump to month</Text>
            <View style={styles.pickerRow}>
              <Pressable
                disabled={pickerYear <= START_YEAR}
                onPress={() => setPickerYear((y) => y - 1)}
              >
                <Text
                  style={[
                    styles.pickerArrow,
                    pickerYear <= START_YEAR && styles.pickerArrowDisabled,
                  ]}
                >
                  ‹
                </Text>
              </Pressable>
              <Text style={styles.pickerYear}>{pickerYear}</Text>
              <Pressable
                disabled={pickerYear >= END_YEAR}
                onPress={() => setPickerYear((y) => y + 1)}
              >
                <Text
                  style={[
                    styles.pickerArrow,
                    pickerYear >= END_YEAR && styles.pickerArrowDisabled,
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            </View>
            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }, (_, i) => i).map((monthIndex) => {
                const beforeStart =
                  pickerYear === START_YEAR && monthIndex < START_MONTH - 1;
                const afterEnd =
                  pickerYear === END_YEAR && monthIndex > END_MONTH_INDEX;
                const isDisabled = beforeStart || afterEnd;
                return (
                  <Pressable
                    key={monthIndex}
                    disabled={isDisabled}
                    style={[
                      styles.monthCell,
                      isDisabled && styles.monthCellDisabled,
                    ]}
                    onPress={() => {
                      setMonthPickerVisible(false);
                      jumpToMonth(pickerYear, monthIndex);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        isDisabled && styles.monthCellTextDisabled,
                      ]}
                    >
                      {new Date(2000, monthIndex, 1).toLocaleDateString(
                        "en-US",
                        { month: "short" },
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  calendarHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e75480",
    textAlign: "center",
    paddingVertical: 8,
  },
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
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  pickerArrow: { fontSize: 28, color: "#e75480", paddingHorizontal: 12 },
  pickerArrowDisabled: { color: "#ddd" },
  pickerYear: { fontSize: 18, fontWeight: "700" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  monthCell: {
    width: "30%",
    backgroundColor: "#fff5f7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  monthCellDisabled: { backgroundColor: "#f5f5f5" },
  monthCellText: { fontWeight: "600", color: "#e75480" },
  monthCellTextDisabled: { color: "#ccc" },
  noteListItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  noteListDate: { fontSize: 12, fontWeight: "700", color: "#e75480" },
  noteListText: { fontSize: 14, color: "#444" },
});
