import { memo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  END_MONTH_INDEX,
  END_YEAR,
  START_MONTH,
  START_YEAR,
} from "./calendarTheme";

type Props = {
  visible: boolean;
  year: number;
  onYearChange: (year: number) => void;
  onPickMonth: (year: number, monthIndex: number) => void;
  onClose: () => void;
};

// Month-jump picker shared by both calendars. Presentational only: year
// state and navigation live in each screen, so neither calendar's behavior
// changes. Overlay/sheet styles are duplicated from the main calendar
// on purpose — it still needs its own copies for its other modals.
function MonthJumpPicker({
  visible,
  year,
  onYearChange,
  onPickMonth,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetDate}>Jump to month</Text>
          <View style={styles.pickerRow}>
            <Pressable
              disabled={year <= START_YEAR}
              onPress={() => onYearChange(year - 1)}
            >
              <Text
                style={[
                  styles.pickerArrow,
                  year <= START_YEAR && styles.pickerArrowDisabled,
                ]}
              >
                ‹
              </Text>
            </Pressable>
            <Text style={styles.pickerYear}>{year}</Text>
            <Pressable
              disabled={year >= END_YEAR}
              onPress={() => onYearChange(year + 1)}
            >
              <Text
                style={[
                  styles.pickerArrow,
                  year >= END_YEAR && styles.pickerArrowDisabled,
                ]}
              >
                ›
              </Text>
            </Pressable>
          </View>
          <View style={styles.monthGrid}>
            {Array.from({ length: 12 }, (_, i) => i).map((monthIndex) => {
              const beforeStart =
                year === START_YEAR && monthIndex < START_MONTH - 1;
              const afterEnd =
                year === END_YEAR && monthIndex > END_MONTH_INDEX;
              const isDisabled = beforeStart || afterEnd;
              return (
                <Pressable
                  key={monthIndex}
                  disabled={isDisabled}
                  style={[
                    styles.monthCell,
                    isDisabled && styles.monthCellDisabled,
                  ]}
                  onPress={() => onPickMonth(year, monthIndex)}
                >
                  <Text
                    style={[
                      styles.monthCellText,
                      isDisabled && styles.monthCellTextDisabled,
                    ]}
                  >
                    {new Date(2000, monthIndex, 1).toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});

export default memo(MonthJumpPicker);
