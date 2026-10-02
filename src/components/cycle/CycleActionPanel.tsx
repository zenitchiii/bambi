import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export interface CyclePanelProps {
  dateTitle: string;
  statusLabel: string | null;
  markerColor: string | null;
  cycleDayLabel: string | null;
  primaryLabel: string | null;
  onPrimary: (() => void) | null;
  secondaryLabel?: string | null;
  onSecondary?: (() => void) | null;
  secondaryDestructive?: boolean;
  secondary2Label?: string | null;
  onSecondary2?: (() => void) | null;
  secondary2Destructive?: boolean;
}

// Dumb view only: parent derives everything via one O(1) memo lookup,
// so tapping only re-renders this panel. No logic lives here.
function CycleActionPanelView({
  dateTitle,
  statusLabel,
  markerColor,
  cycleDayLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  secondaryDestructive,
  secondary2Label,
  onSecondary2,
  secondary2Destructive,
}: CyclePanelProps) {
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.panel}>
      <Text style={styles.date}>{dateTitle}</Text>
      <View style={styles.statusRow}>
        {markerColor && (
          <View style={[styles.marker, { backgroundColor: markerColor }]} />
        )}
        {statusLabel && <Text style={styles.status}>{statusLabel}</Text>}
        {cycleDayLabel && <Text style={styles.cycleDay}>{cycleDayLabel}</Text>}
      </View>
      {primaryLabel && onPrimary ? (
        <Pressable
          onPress={onPrimary}
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          onPress={onSecondary}
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.secondaryText,
              secondaryDestructive && styles.destructive,
            ]}
          >
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
      {secondary2Label && onSecondary2 ? (
        <Pressable
          onPress={onSecondary2}
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.secondaryText,
              secondary2Destructive && styles.destructive,
            ]}
          >
            {secondary2Label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export const CycleActionPanel = memo(CycleActionPanelView);

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#fff",
    borderColor: "#ffd9e6",
    borderWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    gap: 6,
    elevation: 4,
    shadowColor: "#e75480",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  date: { fontSize: 16, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  marker: { width: 12, height: 12, borderRadius: 6 },
  status: { fontSize: 14, color: "#333", fontWeight: "600" },
  cycleDay: { fontSize: 12, color: "#999" },
  primary: {
    backgroundColor: "#e75480",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  primaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  secondary: { paddingVertical: 6, alignItems: "center" },
  secondaryText: { color: "#e75480", fontSize: 13, fontWeight: "600" },
  destructive: { color: "#d32f2f" },
  pressed: { opacity: 0.6 },
});
