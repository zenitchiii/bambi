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
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
const DATE_NIGHT_STORAGE_KEY = "nextDateNight";
const NOTES_STORAGE_KEY = "dateNotes";
const CUSTOM_EVENTS_STORAGE_KEY = "customEvents";
const SCREEN_WIDTH = Dimensions.get("window").width;

const [START_YEAR, START_MONTH] = APP_START_DATE.split("-").map(Number); // START_MONTH is 1-indexed

function getOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = n % 100;
  return (
    n + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0])
  );
}

type ModalMode = "options" | "note" | "event";

export default function CalendarScreen() {
  const calendarRef = useRef<any>(null);
  const [dateNight, setDateNight] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [customEvents, setCustomEvents] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("options");
  const [noteDraft, setNoteDraft] = useState("");
  const [eventDraft, setEventDraft] = useState("");
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [notesListVisible, setNotesListVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(START_YEAR);
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(DATE_NIGHT_STORAGE_KEY).then((saved) => {
      if (saved) setDateNight(saved);
    });
    AsyncStorage.getItem(NOTES_STORAGE_KEY).then((saved) => {
      if (saved) setNotes(JSON.parse(saved));
    });
    AsyncStorage.getItem(CUSTOM_EVENTS_STORAGE_KEY).then((saved) => {
      if (saved) setCustomEvents(JSON.parse(saved));
    });
  }, []);

  const isDateNight = selectedDate !== null && selectedDate === dateNight;
  const existingNote = selectedDate ? notes[selectedDate] : undefined;
  const selectedMonthDay = selectedDate ? selectedDate.slice(5) : null;
  const existingCustomEvent = selectedMonthDay
    ? customEvents[selectedMonthDay]
    : undefined;

  const holidayName = useMemo(() => {
    if (!selectedDate) return null;
    const year = Number(selectedDate.split("-")[0]);
    const match = hd
      .getHolidays(year)
      .find((h) => h.date.startsWith(selectedDate));
    return match?.name ?? null;
  }, [selectedDate]);

  const dateLabels = useMemo(() => {
    if (!selectedDate) return [];
    const [yearStr, monthStr, dayStr] = selectedDate.split("-");
    const [annYearStr, annMonthStr, annDayStr] = ANNIVERSARY_DATE.split("-");
    const [, yourMonthStr, yourDayStr] = YOUR_BIRTHDAY.split("-");
    const [, partnerMonthStr, partnerDayStr] = PARTNER_BIRTHDAY.split("-");

    const labels: string[] = [];

    if (dayStr === annDayStr) {
      const year = Number(yearStr);
      const month = Number(monthStr);
      const annYear = Number(annYearStr);
      const annMonth = Number(annMonthStr);
      const monthsElapsed = (year - annYear) * 12 + (month - annMonth);

      if (monthsElapsed === 0) {
        labels.push("Anniversary");
      } else if (monthsElapsed > 0) {
        if (monthsElapsed % 12 === 0) {
          labels.push(`${getOrdinal(monthsElapsed / 12)} Anniversary`);
        } else {
          labels.push(`${getOrdinal(monthsElapsed)} Monthsary`);
        }
      }
    }

    if (monthStr === yourMonthStr && dayStr === yourDayStr)
      labels.push("Your birthday");
    if (monthStr === partnerMonthStr && dayStr === partnerDayStr)
      labels.push("Her birthday");

    return labels;
  }, [selectedDate]);

  const sortedNoteEntries = useMemo(() => {
    return Object.entries(notes)
      .filter(([, text]) => text?.trim())
      .sort(([a], [b]) => (a < b ? -1 : 1));
  }, [notes]);

  const jumpToMonth = (year: number, monthIndexZeroBased: number) => {
    const isStartMonth =
      year === START_YEAR && monthIndexZeroBased === START_MONTH - 1;
    if (isStartMonth) {
      // scrollToMonth has a known issue landing back on the very first
      // rendered month — remounting is the reliable workaround here
      setCalendarKey((k) => k + 1);
    } else {
      setTimeout(() => {
        calendarRef.current?.scrollToMonth(
          new Date(year, monthIndexZeroBased, 1),
        );
      }, 100);
    }
  };

  const handleToday = () => {
    const now = new Date();
    jumpToMonth(now.getFullYear(), now.getMonth());
    setSelectedDate(formatDateISO(now));
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const openOptions = () => {
    setNoteDraft(selectedDate ? (notes[selectedDate] ?? "") : "");
    setEventDraft(
      selectedMonthDay ? (customEvents[selectedMonthDay] ?? "") : "",
    );
    setModalMode("options");
    setOptionsVisible(true);
  };

  const closeOptions = () => setOptionsVisible(false);

  const handleSetDateNight = async () => {
    if (!selectedDate) return;
    setDateNight(selectedDate);
    await AsyncStorage.setItem(DATE_NIGHT_STORAGE_KEY, selectedDate);
    closeOptions();
  };

  const handleRemoveDateNight = async () => {
    setDateNight(null);
    await AsyncStorage.removeItem(DATE_NIGHT_STORAGE_KEY);
    closeOptions();
  };

  const handleAddMemory = () => {
    closeOptions();
    router.push("/memories");
  };

  const handleSaveNote = async () => {
    if (!selectedDate) return;
    const updated = { ...notes, [selectedDate]: noteDraft };
    setNotes(updated);
    await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    closeOptions();
  };

  const handleRemoveNote = async () => {
    if (!selectedDate) return;
    const updated = { ...notes };
    delete updated[selectedDate];
    setNotes(updated);
    await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    closeOptions();
  };

  const handleSaveCustomEvent = async () => {
    if (!selectedMonthDay) return;
    const updated = { ...customEvents, [selectedMonthDay]: eventDraft };
    setCustomEvents(updated);
    await AsyncStorage.setItem(
      CUSTOM_EVENTS_STORAGE_KEY,
      JSON.stringify(updated),
    );
    closeOptions();
  };

  const handleRemoveCustomEvent = async () => {
    if (!selectedMonthDay) return;
    const updated = { ...customEvents };
    delete updated[selectedMonthDay];
    setCustomEvents(updated);
    await AsyncStorage.setItem(
      CUSTOM_EVENTS_STORAGE_KEY,
      JSON.stringify(updated),
    );
    closeOptions();
  };

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const addDot = (date: string, key: string, color: string) => {
      if (!marks[date]) marks[date] = { dots: [] };
      marks[date].dots.push({ key, color });
    };

    const currentYear = new Date().getFullYear();
    [currentYear, currentYear + 1].forEach((year) => {
      hd.getHolidays(year).forEach((holiday) => {
        const date = holiday.date.split(" ")[0];
        if (date >= APP_START_DATE)
          addDot(date, `holiday-${holiday.name}`, "#f2b134");
      });
    });

    getYearlyOccurrences(YOUR_BIRTHDAY)
      .filter((date) => date >= APP_START_DATE)
      .forEach((date) => addDot(date, "birthday-you", "#8e6bd6"));

    getYearlyOccurrences(PARTNER_BIRTHDAY)
      .filter((date) => date >= APP_START_DATE)
      .forEach((date) => addDot(date, "birthday-partner", "#8e6bd6"));

    getMonthsaryOccurrences(ANNIVERSARY_DATE)
      .filter((date) => date >= APP_START_DATE)
      .forEach((date) => addDot(date, "anniversary", "#e75480"));

    Object.keys(customEvents).forEach((monthDay) => {
      getYearlyOccurrencesFromMonthDay(monthDay, START_YEAR, 5)
        .filter((date) => date >= APP_START_DATE)
        .forEach((date) => addDot(date, `custom-${monthDay}`, "#3aa17e"));
    });

    if (dateNight) addDot(dateNight, "dateNight", "#6bb9d6");
    Object.keys(notes).forEach((date) => {
      if (notes[date]?.trim()) addDot(date, "note", "#b5b5b5");
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: "rgba(231, 84, 128, 0.15)",
      };
    }

    return marks;
  }, [dateNight, notes, customEvents, selectedDate]);

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
              ? "Date night is today"
              : `${dateNightCountdown} day${dateNightCountdown === 1 ? "" : "s"} until your date night`}
          </Text>
        </View>
      )}

      <CalendarList
        key={calendarKey}
        ref={calendarRef}
        current={APP_START_DATE}
        pastScrollRange={0}
        futureScrollRange={120}
        windowSize={21}
        scrollEnabled={true}
        horizontal={true}
        pagingEnabled={true}
        showScrollIndicator={false}
        hideArrows={true}
        calendarWidth={SCREEN_WIDTH - 40}
        minDate={APP_START_DATE}
        markedDates={markedDates}
        markingType="multi-dot"
        onDayPress={handleDayPress}
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
              <Text style={styles.panelDateNight}>
                This is your next date night
              </Text>
            )}

            {holidayName && (
              <Text style={styles.panelHoliday}>{holidayName}</Text>
            )}

            {dateLabels.map((label) => (
              <Text key={label} style={styles.panelLabel}>
                {label}
              </Text>
            ))}

            {existingCustomEvent && (
              <>
                <Text style={styles.noteLabel}>Yearly event</Text>
                <Text style={styles.notePreview}>{existingCustomEvent}</Text>
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

            {modalMode === "options" ? (
              <>
                {isDateNight ? (
                  <View style={styles.statusCard}>
                    <Text style={styles.statusText}>
                      Set as next date night
                    </Text>
                    <Pressable onPress={handleRemoveDateNight}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.optionButton}
                    onPress={handleSetDateNight}
                  >
                    <Text style={styles.optionText}>
                      Set as next date night
                    </Text>
                  </Pressable>
                )}

                {existingNote ? (
                  <View style={styles.statusCard}>
                    <Text style={styles.noteLabel}>Note</Text>
                    <Text style={styles.notePreview}>{existingNote}</Text>
                    <View style={styles.noteActionsRow}>
                      <Pressable onPress={() => setModalMode("note")}>
                        <Text style={styles.linkText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={handleRemoveNote}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={styles.optionButton}
                    onPress={() => setModalMode("note")}
                  >
                    <Text style={styles.optionText}>Add a note</Text>
                  </Pressable>
                )}

                {existingCustomEvent ? (
                  <View style={styles.statusCard}>
                    <Text style={styles.noteLabel}>Yearly event</Text>
                    <Text style={styles.notePreview}>
                      {existingCustomEvent}
                    </Text>
                    <View style={styles.noteActionsRow}>
                      <Pressable onPress={() => setModalMode("event")}>
                        <Text style={styles.linkText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={handleRemoveCustomEvent}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={styles.optionButton}
                    onPress={() => setModalMode("event")}
                  >
                    <Text style={styles.optionText}>
                      Make this a yearly event
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.optionButton}
                  onPress={handleAddMemory}
                >
                  <Text style={styles.optionText}>
                    Add picture/video to this date
                  </Text>
                </Pressable>

                <Pressable style={styles.cancelButton} onPress={closeOptions}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : modalMode === "note" ? (
              <>
                <TextInput
                  style={styles.noteInput}
                  multiline
                  maxLength={300}
                  placeholder="Write something to remember..."
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                />
                <Text style={styles.charCounter}>{noteDraft.length}/300</Text>
                <Pressable style={styles.optionButton} onPress={handleSaveNote}>
                  <Text style={styles.optionText}>Save note</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setModalMode("options")}
                >
                  <Text style={styles.cancelText}>Back</Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.noteInput}
                  maxLength={60}
                  placeholder="e.g. Her mom's birthday"
                  value={eventDraft}
                  onChangeText={setEventDraft}
                />
                <Text style={styles.charCounter}>{eventDraft.length}/60</Text>
                <Text style={styles.eventHint}>
                  Repeats every year on this month and day
                </Text>
                <Pressable
                  style={styles.optionButton}
                  onPress={handleSaveCustomEvent}
                >
                  <Text style={styles.optionText}>Save event</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setModalMode("options")}
                >
                  <Text style={styles.cancelText}>Back</Text>
                </Pressable>
              </>
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
              <Pressable onPress={() => setPickerYear((y) => y + 1)}>
                <Text style={styles.pickerArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }, (_, i) => i).map((monthIndex) => {
                const isDisabled =
                  pickerYear === START_YEAR && monthIndex < START_MONTH - 1;
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
              {sortedNoteEntries.length === 0 ? (
                <Text style={styles.notePlaceholder}>No notes yet</Text>
              ) : (
                sortedNoteEntries.map(([date, text]) => (
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
  optionText: { fontSize: 15, fontWeight: "600", color: "#e75480" },
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
