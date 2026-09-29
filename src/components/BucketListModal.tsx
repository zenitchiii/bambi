import { useSharedCoupleData } from "@/hooks/useSharedCoupleData";
import { Check, HeartHandshake, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

type Props = { visible: boolean; onClose: () => void };

export default function BucketListModal({ visible, onClose }: Props) {
  const { height } = useWindowDimensions();
  const { data, addBucketItem, toggleBucketItem, deleteBucketItem } =
    useSharedCoupleData();
  const [draft, setDraft] = useState("");

  const items = data.bucketList ?? [];
  const done = items.filter((i) => i.completed).length;
  const progress = items.length === 0 ? 0 : done / items.length;

  const handleAdd = () => {
    if (!draft.trim()) return;
    addBucketItem(draft);
    setDraft("");
  };

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
              <HeartHandshake color="#e75480" size={22} />
              <Text style={styles.title}>Bucket List</Text>
            </View>
            <Text style={styles.subtitle}>
              {items.length === 0
                ? "Dream up something to do together"
                : `${done} of ${items.length} completed`}
            </Text>
            {items.length > 0 && (
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { flex: progress }]}
                />
                <View style={[styles.progressRest, { flex: 1 - progress }]} />
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a date idea or goal..."
              placeholderTextColor="#aaa"
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <Pressable
              style={[styles.addButton, !draft.trim() && styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!draft.trim()}
            >
              <Plus color="#fff" size={20} />
            </Pressable>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No dreams yet</Text>
              <Text style={styles.emptyHint}>
                Add your first bucket list item above — it syncs instantly to
                both phones
              </Text>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.featureItem,
                    item.completed && styles.featureItemDone,
                  ]}
                >
                  <Pressable
                    style={[
                      styles.checkCircle,
                      item.completed && styles.checkCircleDone,
                    ]}
                    onPress={() => toggleBucketItem(item.id)}
                  >
                    {item.completed && <Check color="#fff" size={14} />}
                  </Pressable>
                  <Pressable
                    style={styles.itemTextWrap}
                    onPress={() => toggleBucketItem(item.id)}
                  >
                    <Text
                      style={[
                        styles.featureTitle,
                        item.completed && styles.featureTitleDone,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteBucketItem(item.id)}
                    hitSlop={8}
                  >
                    <Trash2 color="#d1a0ae" size={16} />
                  </Pressable>
                </View>
              )}
            />
          )}

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
  progressTrack: {
    flexDirection: "row",
    height: 8,
    width: "100%",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    marginTop: 4,
  },
  progressFill: { backgroundColor: "#e75480" },
  progressRest: { backgroundColor: "transparent" },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#333",
  },
  addButton: {
    backgroundColor: "#e75480",
    borderRadius: 12,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { backgroundColor: "#e7a8ba" },
  list: { flex: 1 },
  listContent: { gap: 10 },
  featureItem: {
    backgroundColor: "#fff5f7",
    borderRadius: 12,
    padding: 14,
    gap: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  featureItemDone: { opacity: 0.7 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e75480",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: { backgroundColor: "#e75480" },
  itemTextWrap: { flex: 1, marginHorizontal: 10 },
  featureTitle: { fontSize: 15, fontWeight: "600", color: "#333" },
  featureTitleDone: {
    textDecorationLine: "line-through",
    color: "#aaa",
  },
  deleteButton: { padding: 4 },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 6, flex: 1, justifyContent: "center" },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#999" },
  emptyHint: { fontSize: 13, color: "#bbb", textAlign: "center", lineHeight: 18 },
  closeButton: { alignItems: "center", paddingVertical: 10 },
  closeText: { color: "#e75480", fontWeight: "600" },
});
