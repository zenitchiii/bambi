import ScreenContainer from "@/components/ScreenContainer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

const ANNIVERSARY_DATE = "2023-06-15"; // still duplicated from Home — flagging again for later
const DATE_NIGHT_STORAGE_KEY = "nextDateNight";
const NOTES_STORAGE_KEY = "dateNotes";

function getMonthsaryDates(anniversaryISO: string): string[] {
  const [year, month, day] = anniversaryISO.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const d = new Date(year, month - 1 + i, day);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

type ModalMode = "options" | "note";

export default function CalendarScreen() {
  const [dateNight, setDateNight] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("options");
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(DATE_NIGHT_STORAGE_KEY).then((saved) => {
      if (saved) setDateNight(saved);
    });
    AsyncStorage.getItem(NOTES_STORAGE_KEY).then((saved) => {
      if (saved) setNotes(JSON.parse(saved));
    });
  }, []);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setModalMode("options");
    setNoteDraft(notes[day.dateString] ?? "");
  };

  const closeModal = () => setSelectedDate(null);

  const handleSetDateNight = async () => {
    if (!selectedDate) return;
    setDateNight(selectedDate);
    await AsyncStorage.setItem(DATE_NIGHT_STORAGE_KEY, selectedDate);
    closeModal();
  };

  const handleAddMemory = () => {
    closeModal();
    router.push("/memories");
  };

  const handleSaveNote = async () => {
    if (!selectedDate) return;
    const updated = { ...notes, [selectedDate]: noteDraft };
    setNotes(updated);
    await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    closeModal();
  };

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const addDot = (date: string, key: string, color: string) => {
      if (!marks[date]) marks[date] = { dots: [] };
      marks[date].dots.push({ key, color });
    };

    getMonthsaryDates(ANNIVERSARY_DATE).forEach((date) =>
      addDot(date, "anniversary", "#e75480"),
    );
    if (dateNight) addDot(dateNight, "dateNight", "#6bb9d6");
    Object.keys(notes).forEach((date) => {
      if (notes[date]?.trim()) addDot(date, "note", "#b5b5b5");
    });

    return marks;
  }, [dateNight, notes]);

  return (
    <ScreenContainer contentContainerStyle={{ gap: 12 }}>
      <Text style={styles.title}>Our Calendar</Text>
      <Calendar
        markedDates={markedDates}
        markingType="multi-dot"
        onDayPress={handleDayPress}
        theme={{ todayTextColor: "#e75480", arrowColor: "#e75480" }}
      />
      <Text style={styles.legend}>
        🩷 Anniversary/Monthsary 💙 Date ⚪ note
      </Text>
      {dateNight && (
        <Text style={styles.selected}>Next date night: {dateNight}</Text>
      )}

      <Modal
        visible={!!selectedDate}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.overlay} onPress={closeModal}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetDate}>{selectedDate}</Text>

            {modalMode === "options" ? (
              <>
                <Pressable
                  style={styles.optionButton}
                  onPress={handleSetDateNight}
                >
                  <Text style={styles.optionText}>Set as next date night</Text>
                </Pressable>
                <Pressable
                  style={styles.optionButton}
                  onPress={handleAddMemory}
                >
                  <Text style={styles.optionText}>
                    Add picture/video to this date
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.optionButton}
                  onPress={() => setModalMode("note")}
                >
                  <Text style={styles.optionText}>Add a note</Text>
                </Pressable>
                <Pressable style={styles.cancelButton} onPress={closeModal}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.noteInput}
                  multiline
                  placeholder="Write something to remember..."
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                />
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
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "700" },
  legend: { fontSize: 12, color: "#999" },
  selected: { fontSize: 16, fontWeight: "600", color: "#6bb9d6" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
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
});
