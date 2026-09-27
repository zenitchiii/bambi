import { Modal, Pressable, StyleSheet, Text } from "react-native";

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
          <Text style={styles.body}>
            Made with love, just for us. Happy birthday!
          </Text>
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
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 15, color: "#666", textAlign: "center" },
  closeButton: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24 },
  closeText: { color: "#e75480", fontWeight: "600" },
});
