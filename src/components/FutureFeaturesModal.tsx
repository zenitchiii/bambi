import { Sparkles } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type Props = { visible: boolean; onClose: () => void };

const FEATURES = [
  {
    title: "🔔 Real-Time Notifications",
    desc: "Instant push alerts when a poke or new memory is added.",
  },
  {
    title: "📱 Shared Mini-Games",
    desc: "Fun little interactive games we can play together when we are apart.",
  },
  {
    title: "💌 Shared Bucket List",
    desc: "A list of date ideas, places to visit, and goals to achieve together.",
  },
  {
    title: "🖼️ Shared Photo Sync",
    desc: "See each other's Memories and profile photos on both phones, instead of each phone only showing its own.",
  },
  {
    title: "🌙 Dark Mode",
    desc: "A toggle to switch the whole app to a dark color scheme.",
  },
  {
    title: "🧠 Couples Quiz",
    desc: "A daily question you both answer separately, scoring points when your answers match.",
  },
  {
    title: "✨ Polish Pass",
    desc: "Smaller fixes and refinements across the app — better text fitting on different phone sizes, and general tidying up.",
  },
];

export default function FutureFeaturesModal({ visible, onClose }: Props) {
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { height: height * 0.7 }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles color="#e75480" size={22} />
              <Text style={styles.title}>Future Features</Text>
            </View>
            <Text style={styles.subtitle}>Things planned for Bambi ✨</Text>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureItem}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
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
    maxWidth: 360,
    overflow: "hidden",
  },
  header: { alignItems: "center", gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center" },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  list: { flex: 1 },
  listContent: { gap: 10 },
  featureItem: {
    backgroundColor: "#fff5f7",
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  featureTitle: { fontSize: 15, fontWeight: "600", color: "#333" },
  featureDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
  closeButton: { alignItems: "center", paddingVertical: 10 },
  closeText: { color: "#e75480", fontWeight: "600" },
});
