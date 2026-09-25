import ScreenContainer from "@/components/ScreenContainer";
import { formatDateISO } from "@/utils/dateMath";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useEvent } from "expo";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Check,
  ChevronLeft,
  Pause,
  Play,
  Plus,
  RotateCcw,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const MEMORIES_STORAGE_KEY = "memories";
const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 4;
const COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
const FOLDER_COLUMNS = 2;
const FOLDER_GAP = 14;
const FOLDER_SIZE =
  (SCREEN_WIDTH - 40 - FOLDER_GAP * (FOLDER_COLUMNS - 1)) / FOLDER_COLUMNS;

type Memory = {
  id: string;
  uri: string;
  type: "image" | "video";
  date: string;
};

function formatAlbumDate(dateISO: string): string {
  const today = formatDateISO(new Date());
  if (dateISO === today) return "Today";
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoViewer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  const duration = player.duration || 0;

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
  };

  const restart = () => {
    player.currentTime = 0;
  };

  return (
    <View style={styles.videoWrapper}>
      <VideoView
        style={styles.viewerMedia}
        player={player}
        nativeControls={false}
        contentFit="contain"
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={togglePlay}>
        {!isPlaying && (
          <View style={styles.centerPlayButton}>
            <Play color="#fff" size={36} fill="#fff" />
          </View>
        )}
      </Pressable>

      <View style={styles.videoControls}>
        <Slider
          style={styles.videoSlider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={currentTime}
          minimumTrackTintColor="#e75480"
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbTintColor="#e75480"
          onSlidingComplete={(value) => {
            player.currentTime = value;
          }}
        />
        <View style={styles.videoControlsRow}>
          <View style={styles.videoControlsLeft}>
            <Pressable onPress={togglePlay}>
              {isPlaying ? (
                <Pause color="#fff" size={22} fill="#fff" />
              ) : (
                <Play color="#fff" size={22} fill="#fff" />
              )}
            </Pressable>
            <Pressable onPress={restart}>
              <RotateCcw color="#fff" size={20} />
            </Pressable>
          </View>
          <Text style={styles.videoTime}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function MemoriesScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = formatDateISO(new Date());

  const [memories, setMemories] = useState<Memory[]>([]);
  const [viewerItem, setViewerItem] = useState<Memory | null>(null);
  const [openAlbum, setOpenAlbum] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  const [folderSelectionMode, setFolderSelectionMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    AsyncStorage.getItem(MEMORIES_STORAGE_KEY).then((saved) => {
      if (!saved) return;
      const parsed: any[] = JSON.parse(saved);
      const migrated: Memory[] = parsed.map((m) => ({
        ...m,
        date:
          m.date ??
          formatDateISO(new Date(Number(m.id?.split("-")[0]) || Date.now())),
      }));
      setMemories(migrated);
    });
  }, []);

  useEffect(() => {
    if (params.date) setOpenAlbum(params.date);
  }, [params.date]);

  const saveMemories = async (updated: Memory[]) => {
    setMemories(updated);
    await AsyncStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(updated));
  };

  const isFutureAlbum = openAlbum !== null && openAlbum > today;

  const handleAddMemory = async () => {
    if (isFutureAlbum) {
      Alert.alert(
        "Not yet!",
        "You can add photos and videos to this day once it actually happens 💕",
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const targetDate = openAlbum ?? today;
    const newMemories: Memory[] = result.assets.map((asset) => ({
      id: `${Date.now()}-${asset.assetId ?? Math.random()}`,
      uri: asset.uri,
      type: asset.type === "video" ? "video" : "image",
      date: targetDate,
    }));

    await saveMemories([...newMemories, ...memories]);
    if (!openAlbum) setOpenAlbum(targetDate);
  };

  const sections = (() => {
    const map: Record<string, Memory[]> = {};
    memories.forEach((m) => {
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  })();

  const currentAlbumItems = openAlbum
    ? (sections.find((s) => s.date === openAlbum)?.items ?? [])
    : [];

  // ---------- Item selection (inside an album) ----------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleItemPress = (item: Memory) => {
    if (selectionMode) toggleSelect(item.id);
    else setViewerItem(item);
  };

  const handleItemLongPress = (item: Memory) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([item.id]));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    setSelectedIds(new Set(currentAlbumItems.map((m) => m.id)));
  };

  const handleRemoveSelected = () => {
    Alert.alert(
      `Remove ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"}?`,
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await saveMemories(memories.filter((m) => !selectedIds.has(m.id)));
            exitSelectionMode();
          },
        },
      ],
    );
  };

  const handleMoveSelected = async (targetDate: string) => {
    const updated = memories.map((m) =>
      selectedIds.has(m.id) ? { ...m, date: targetDate } : m,
    );
    await saveMemories(updated);
    setMoveModalVisible(false);
    exitSelectionMode();
  };

  const closeAlbum = () => {
    exitSelectionMode();
    setOpenAlbum(null);
  };

  // ---------- Folder selection (top-level grid) ----------
  const toggleFolderSelect = (date: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleFolderPress = (date: string) => {
    if (folderSelectionMode) toggleFolderSelect(date);
    else setOpenAlbum(date);
  };

  const handleFolderLongPress = (date: string) => {
    if (!folderSelectionMode) {
      setFolderSelectionMode(true);
      setSelectedFolders(new Set([date]));
    }
  };

  const exitFolderSelectionMode = () => {
    setFolderSelectionMode(false);
    setSelectedFolders(new Set());
  };

  const selectAllFolders = () => {
    setSelectedFolders(new Set(sections.map((s) => s.date)));
  };

  const handleRemoveFolders = () => {
    const itemCount = sections
      .filter((s) => selectedFolders.has(s.date))
      .reduce((sum, s) => sum + s.items.length, 0);

    Alert.alert(
      `Delete ${selectedFolders.size} album${selectedFolders.size === 1 ? "" : "s"}?`,
      `This will remove ${itemCount} item${itemCount === 1 ? "" : "s"} inside. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await saveMemories(
              memories.filter((m) => !selectedFolders.has(m.date)),
            );
            exitFolderSelectionMode();
          },
        },
      ],
    );
  };

  // ---------- Folder list (top level) ----------
  if (!openAlbum) {
    return (
      <ScreenContainer contentContainerStyle={{ gap: 16 }}>
        {folderSelectionMode ? (
          <View style={styles.headerRow}>
            <Text style={styles.title}>{selectedFolders.size} selected</Text>
            <View style={styles.selectionActions}>
              <Pressable onPress={selectAllFolders}>
                <Text style={styles.headerLink}>Select all</Text>
              </Pressable>
              <Pressable onPress={exitFolderSelectionMode}>
                <Text style={styles.headerLinkMuted}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.title}>Memories</Text>
            <Pressable style={styles.addButton} onPress={handleAddMemory}>
              <Plus color="#fff" size={20} />
            </Pressable>
          </View>
        )}

        {folderSelectionMode && (
          <View style={styles.selectionBar}>
            <Pressable
              style={[
                styles.selectionBarButton,
                selectedFolders.size === 0 && styles.selectionBarButtonDisabled,
              ]}
              disabled={selectedFolders.size === 0}
              onPress={handleRemoveFolders}
            >
              <Text
                style={[styles.selectionBarButtonText, { color: "#d9534f" }]}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        )}

        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No memories yet</Text>
            <Text style={styles.emptyHint}>
              Tap the + button to add your first photo or video
            </Text>
          </View>
        ) : (
          <View style={styles.folderGrid}>
            {sections.map((section) => {
              const isSelected = selectedFolders.has(section.date);
              return (
                <Pressable
                  key={section.date}
                  style={styles.folderTile}
                  onPress={() => handleFolderPress(section.date)}
                  onLongPress={() => handleFolderLongPress(section.date)}
                >
                  <View>
                    <Image
                      source={{ uri: section.items[0].uri }}
                      style={styles.folderCover}
                    />
                    {folderSelectionMode && (
                      <View
                        style={[
                          styles.selectOverlay,
                          isSelected && styles.selectOverlayActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.checkCircle,
                            isSelected && styles.checkCircleActive,
                          ]}
                        >
                          {isSelected && <Check color="#fff" size={14} />}
                        </View>
                      </View>
                    )}
                  </View>
                  <Text style={styles.folderLabel}>
                    {formatAlbumDate(section.date)}
                  </Text>
                  <Text style={styles.folderCount}>
                    {section.items.length} item
                    {section.items.length === 1 ? "" : "s"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <MediaViewerModal
          viewerItem={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      </ScreenContainer>
    );
  }

  // ---------- Inside an album ----------
  return (
    <ScreenContainer contentContainerStyle={{ gap: 16 }}>
      {selectionMode ? (
        <View style={styles.headerRow}>
          <Text style={styles.title}>{selectedIds.size} selected</Text>
          <View style={styles.selectionActions}>
            <Pressable onPress={selectAll}>
              <Text style={styles.headerLink}>Select all</Text>
            </Pressable>
            <Pressable onPress={exitSelectionMode}>
              <Text style={styles.headerLinkMuted}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <Pressable style={styles.backRow} onPress={closeAlbum}>
            <ChevronLeft color="#e75480" size={22} />
            <Text style={styles.title}>{formatAlbumDate(openAlbum)}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.addButton,
              isFutureAlbum && styles.addButtonDisabled,
            ]}
            onPress={handleAddMemory}
          >
            <Plus color="#fff" size={20} />
          </Pressable>
        </View>
      )}

      {isFutureAlbum && !selectionMode && (
        <View style={styles.futureNotice}>
          <Text style={styles.futureNoticeText}>
            This day hasn't happened yet — you'll be able to add memories once
            it arrives
          </Text>
        </View>
      )}

      {selectionMode && (
        <View style={styles.selectionBar}>
          <Pressable
            style={[
              styles.selectionBarButton,
              selectedIds.size === 0 && styles.selectionBarButtonDisabled,
            ]}
            disabled={selectedIds.size === 0}
            onPress={() => setMoveModalVisible(true)}
          >
            <Text style={styles.selectionBarButtonText}>Move</Text>
          </Pressable>
          <Pressable
            style={[
              styles.selectionBarButton,
              selectedIds.size === 0 && styles.selectionBarButtonDisabled,
            ]}
            disabled={selectedIds.size === 0}
            onPress={handleRemoveSelected}
          >
            <Text style={[styles.selectionBarButtonText, { color: "#d9534f" }]}>
              Remove
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.grid}>
        {currentAlbumItems.map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => handleItemPress(item)}
              onLongPress={() => handleItemLongPress(item)}
            >
              <View style={styles.thumbnailWrapper}>
                <Image source={{ uri: item.uri }} style={styles.thumbnail} />
                {item.type === "video" && !selectionMode && (
                  <View style={styles.playOverlay}>
                    <Play color="#fff" size={20} fill="#fff" />
                  </View>
                )}
                {selectionMode && (
                  <View
                    style={[
                      styles.selectOverlay,
                      isSelected && styles.selectOverlayActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.checkCircle,
                        isSelected && styles.checkCircleActive,
                      ]}
                    >
                      {isSelected && <Check color="#fff" size={14} />}
                    </View>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <MediaViewerModal
        viewerItem={viewerItem}
        onClose={() => setViewerItem(null)}
      />

      <Modal
        visible={moveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setMoveModalVisible(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Move to album</Text>
            {sections
              .filter((s) => s.date !== openAlbum)
              .map((section) => (
                <Pressable
                  key={section.date}
                  style={styles.albumOption}
                  onPress={() => handleMoveSelected(section.date)}
                >
                  <Text style={styles.albumOptionText}>
                    {formatAlbumDate(section.date)}
                  </Text>
                </Pressable>
              ))}
            <Pressable
              style={styles.cancelButton}
              onPress={() => setMoveModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

function MediaViewerModal({
  viewerItem,
  onClose,
}: {
  viewerItem: Memory | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!viewerItem}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.viewerOverlay}>
        <Pressable style={styles.viewerClose} onPress={onClose}>
          <X color="#fff" size={28} />
        </Pressable>

        {viewerItem?.type === "image" ? (
          <Image
            source={{ uri: viewerItem.uri }}
            style={styles.viewerMedia}
            resizeMode="contain"
          />
        ) : viewerItem ? (
          <VideoViewer key={viewerItem.id} uri={viewerItem.uri} />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  title: { fontSize: 22, fontWeight: "700" },
  addButton: {
    backgroundColor: "#e75480",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { backgroundColor: "#e7a8ba" },
  selectionActions: { flexDirection: "row", gap: 16 },
  headerLink: { color: "#e75480", fontWeight: "600", fontSize: 14 },
  headerLinkMuted: { color: "#999", fontWeight: "600", fontSize: 14 },
  selectionBar: { flexDirection: "row", gap: 12 },
  selectionBarButton: {
    flex: 1,
    backgroundColor: "#fff5f7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  selectionBarButtonDisabled: { opacity: 0.4 },
  selectionBarButtonText: { fontWeight: "600", color: "#e75480" },
  futureNotice: { backgroundColor: "#fff5f7", borderRadius: 12, padding: 12 },
  futureNoticeText: { fontSize: 13, color: "#c98aa0", textAlign: "center" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 6 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#999" },
  emptyHint: { fontSize: 13, color: "#bbb", textAlign: "center" },
  folderGrid: { flexDirection: "row", flexWrap: "wrap", gap: FOLDER_GAP },
  folderTile: { width: FOLDER_SIZE, gap: 4 },
  folderCover: { width: FOLDER_SIZE, height: FOLDER_SIZE, borderRadius: 12 },
  folderLabel: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  folderCount: { fontSize: 12, color: "#999" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  thumbnailWrapper: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: "100%" },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    padding: 6,
    alignItems: "flex-end",
  },
  selectOverlayActive: { backgroundColor: "rgba(231,84,128,0.35)" },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleActive: { backgroundColor: "#e75480", borderColor: "#e75480" },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerMedia: { width: SCREEN_WIDTH, height: "70%" },
  viewerClose: { position: "absolute", top: 60, right: 20, zIndex: 1 },
  videoWrapper: { width: "100%", height: "100%", justifyContent: "center" },
  centerPlayButton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  videoControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  videoSlider: { width: "100%", height: 26 },
  videoControlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  videoControlsLeft: { flexDirection: "row", alignItems: "center", gap: 18 },
  videoTime: { color: "#fff", fontSize: 12 },
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
    gap: 10,
    width: "100%",
    maxWidth: 400,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  albumOption: { backgroundColor: "#fff5f7", borderRadius: 12, padding: 14 },
  albumOptionText: { fontSize: 15, fontWeight: "600", color: "#e75480" },
  cancelButton: { padding: 14, alignItems: "center" },
  cancelText: { color: "#999" },
});
