import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = { visible: boolean; onClose: () => void };

export default function AboutModal({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Bambi 🐰</Text>
          <Text style={styles.subtitle}>Ouu shii</Text>

          <View style={styles.divider} />

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>The Story Behind Bambi</Text>
            <Text style={styles.placeholderText}>
              Ayun ginawa ko to kasi nagiisip pa ako ibang mareregalo, may
              dumaan sa tiktok ko binigyan nya raw ng app gf nya sa anniversary,
              edi ayun pumasok sa isipan ko pede ren gawen pag birthday, alam ko
              di pa kumpleto to marami pa ako gustong idagdag pero gusto ko
              mapakita na agad sayo to sa bday mo at maraming bugs na di ko alam
              HAHSAHSHASA pero ill try my best to update this app na may
              features na gusto mo
            </Text>
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
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center" },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    width: "100%",
    marginVertical: 4,
  },
  scrollArea: { width: "100%" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  placeholderText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    textAlign: "center",
    fontStyle: "italic",
  },
  closeButton: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24 },
  closeText: { color: "#e75480", fontWeight: "600" },
});
