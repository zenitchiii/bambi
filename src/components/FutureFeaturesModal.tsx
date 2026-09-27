import { Sparkles } from "lucide-react-native";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Props = { visible: boolean; onClose: () => void };

export default function FutureFeaturesModal({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Sparkles color="#e75480" size={22} />
            <Text style={styles.title}>Future Features</Text>
          </View>
          <Text style={styles.subtitle}>Things planned for Bambi ✨</Text>

          <View style={styles.divider} />

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>📱 Shared Mini-Games</Text>
              <Text style={styles.featureDesc}>
                Fun little interactive games we can play together when we are
                apart.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>💌 Shared Bucket List</Text>
              <Text style={styles.featureDesc}>
                A list of date ideas, places to visit, and goals to achieve
                together.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>
                🔔 Real-Time Notifications
              </Text>
              <Text style={styles.featureDesc}>
                Instant push alerts when a poke or new memory is added.
              </Text>
            </View>
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
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
    maxWidth: 360,
    maxHeight: "75%",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center" },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    width: "100%",
    marginVertical: 4,
  },
  scrollArea: { width: "100%" },
  featureItem: {
    backgroundColor: "#fff5f7",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  featureDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  closeButton: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24 },
  closeText: { color: "#e75480", fontWeight: "600" },
});
