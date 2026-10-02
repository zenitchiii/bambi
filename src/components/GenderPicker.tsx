import type { Gender } from "@/lib/profileSync";
import { Pressable, StyleSheet, Text, View } from "react-native";

const OPTIONS: { value: Gender; label: string }[] = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
];

type Props = {
  value: Gender | null;
  onChange: (gender: Gender) => void;
};

// Two-option segmented control in the existing dateButton visual language
// (bordered box, pink when selected). Shared by onboarding + Edit Profile
// so the options can never drift apart.
export default function GenderPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.optionText, selected && styles.optionTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, width: "100%" },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: "#e75480",
    borderColor: "#e75480",
  },
  optionText: { fontSize: 16, color: "#333" },
  optionTextSelected: { color: "#fff", fontWeight: "600" },
});
