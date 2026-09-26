import ScreenContainer from "@/components/ScreenContainer";
import { formatDateISO } from "@/utils/dateMath";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useEvent } from "expo";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Check,
  ChevronLeft,
  Heart,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const MEMORIES_KEY = "memories";
const COVERS_KEY = "albumCovers";
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const GRID_GAP = 4;
const COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 40 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
const FOLDER_GAP = 14;
const FOLDER_SIZE = (SCREEN_WIDTH - 40 - FOLDER_GAP) / 2;
const FAVORITES_ALBUM = "__favorites__";
const TODAY = formatDateISO(new Date());
const MEMORIES_DIR = FileSystem.documentDirectory + "memories/";

type Memory = {
  id: string;
  uri: string;
  type: "image" | "video";
  date: string; // "YYYY-MM-DD"
  caption?: string;
  favorite?: boolean;
};

// Reusable "long-press to multi-select" behavior — used for the month grid,
// the day grid, and the item grid, since all three need identical
// active/selected/enter/toggle/exit/selectAll logic
function useMultiSelect() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return {
    active,
    selected,
    enter: (id: string) => {
      setActive(true);
      setSelected(new Set([id]));
    },
    toggle: (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    exit: () => {
      setActive(false);
      setSelected(new Set());
    },
    selectAll: (ids: string[]) => setSelected(new Set(ids)),
  };
}

async function ensureMemoriesDir() {
  const info = await FileSystem.getInfoAsync(MEMORIES_DIR);
  if (!info.exists)
    await FileSystem.makeDirectoryAsync(MEMORIES_DIR, { intermediates: true });
}

async function copyToAppStorage(
  sourceUri: string,
  id: string,
): Promise<string> {
  await ensureMemoriesDir();
  const ext = sourceUri.split(".").pop()?.split("?")[0] || "jpg";
  const destUri = `${MEMORIES_DIR}${id}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch {
    return sourceUri;
  }
}

async function deleteFromAppStorage(uri: string) {
  if (!uri.startsWith(MEMORIES_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}

function formatDayLabel(dateISO: string): string {
  if (dateISO === TODAY) return "Today";
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoPage({ uri }: { uri: string }) {
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
  const toggle = () => (isPlaying ? player.pause() : player.play());

  return (
    <View style={styles.page}>
      <VideoView
        style={styles.pageMedia}
        player={player}
        nativeControls={false}
        contentFit="contain"
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={toggle}>
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
          onSlidingComplete={(v) => {
            player.currentTime = v;
          }}
        />
        <View style={styles.videoControlsRow}>
          <View style={styles.videoControlsLeft}>
            <Pressable onPress={toggle}>
              {isPlaying ? (
                <Pause color="#fff" size={22} fill="#fff" />
              ) : (
                <Play color="#fff" size={22} fill="#fff" />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                player.currentTime = 0;
              }}
            >
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

function AnimatedHeartButton({
  favorite,
  onPress,
}: {
  favorite?: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePress = () => {
    scale.value = withSpring(1.4, { damping: 4 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };
  return (
    <Pressable onPress={handlePress} style={styles.iconButton}>
      <Animated.View style={animatedStyle}>
        <Heart
          color="#fff"
          size={20}
          fill={favorite ? "#e75480" : "transparent"}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function MemoriesScreen() {
  const params = useLocalSearchParams<{ date?: string }>();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [openMonth, setOpenMonth] = useState<string | null>(null); // "YYYY-MM"
  const [openAlbum, setOpenAlbum] = useState<string | null>(null); // "YYYY-MM-DD" or FAVORITES_ALBUM
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const [viewerList, setViewerList] = useState<Memory[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [captionDraft, setCaptionDraft] = useState("");
  const [editingCaption, setEditingCaption] = useState(false);

  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const monthSelection = useMultiSelect();
  const daySelection = useMultiSelect();
  const itemSelection = useMultiSelect();

  useEffect(() => {
    AsyncStorage.getItem(MEMORIES_KEY).then((saved) => {
      if (!saved) return;
      const parsed: any[] = JSON.parse(saved);
      setMemories(
        parsed.map((m) => ({
          ...m,
          date:
            m.date ??
            formatDateISO(new Date(Number(m.id?.split("-")[0]) || Date.now())),
        })),
      );
    });
    AsyncStorage.getItem(COVERS_KEY).then(
      (saved) => saved && setCovers(JSON.parse(saved)),
    );
  }, []);

  useEffect(() => {
    if (params.date) {
      setOpenMonth(params.date.slice(0, 7));
      setOpenAlbum(params.date);
    }
  }, [params.date]);

  const saveMemories = async (updated: Memory[]) => {
    setMemories(updated);
    await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(updated));
  };
  const saveCovers = async (updated: Record<string, string>) => {
    setCovers(updated);
    await AsyncStorage.setItem(COVERS_KEY, JSON.stringify(updated));
  };

  const isFutureAlbum =
    !!openAlbum && openAlbum !== FAVORITES_ALBUM && openAlbum > TODAY;

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

    const targetDate =
      openAlbum && openAlbum !== FAVORITES_ALBUM ? openAlbum : TODAY;
    const newOnes: Memory[] = [];
    for (const a of result.assets) {
      const id = `${Date.now()}-${a.assetId ?? Math.random()}`;
      const storedUri = await copyToAppStorage(a.uri, id);
      newOnes.push({
        id,
        uri: storedUri,
        type: a.type === "video" ? "video" : "image",
        date: targetDate,
      });
    }
    await saveMemories([...newOnes, ...memories]);
    if (!openAlbum) {
      setOpenMonth(targetDate.slice(0, 7));
      setOpenAlbum(targetDate);
    }
  };

  // Day-level groups, oldest first
  const daySections = useMemo(() => {
    const map: Record<string, Memory[]> = {};
    memories.forEach((m) => {
      (map[m.date] ??= []).push(m);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, items]) => ({ date, items }));
  }, [memories]);

  // Month-level groups, built from day groups so ordering is preserved, oldest first
  const monthSections = useMemo(() => {
    const map: Record<string, { date: string; items: Memory[] }[]> = {};
    daySections.forEach((day) => {
      const monthKey = day.date.slice(0, 7);
      (map[monthKey] ??= []).push(day);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, days]) => ({
        month,
        days,
        itemCount: days.reduce((sum, d) => sum + d.items.length, 0),
        coverUri: days[0].items[0]?.uri,
      }));
  }, [daySections]);

  const availableYears = useMemo(
    () =>
      Array.from(new Set(monthSections.map((s) => s.month.slice(0, 4))))
        .sort()
        .reverse(),
    [monthSections],
  );

  const visibleMonths = yearFilter
    ? monthSections.filter((s) => s.month.startsWith(yearFilter))
    : monthSections;
  const daysInOpenMonth = openMonth
    ? (monthSections.find((s) => s.month === openMonth)?.days ?? [])
    : [];
  const favorites = useMemo(
    () => memories.filter((m) => m.favorite),
    [memories],
  );

  // Sorted by when each item was actually added (its id embeds a timestamp)
  const currentAlbumItems = useMemo(() => {
    const raw =
      openAlbum === FAVORITES_ALBUM
        ? favorites
        : openAlbum
          ? (daySections.find((s) => s.date === openAlbum)?.items ?? [])
          : [];
    return [...raw].sort(
      (a, b) => Number(a.id.split("-")[0]) - Number(b.id.split("-")[0]),
    );
  }, [openAlbum, favorites, daySections]);

  // ---------- viewer ----------
  const openViewer = (list: Memory[], index: number) => {
    setViewerList(list);
    setViewerIndex(index);
  };
  const closeViewer = () => {
    setViewerList(null);
    setEditingCaption(false);
  };
  const currentViewerItem = viewerList?.[viewerIndex] ?? null;

  const updateMemory = (id: string, patch: Partial<Memory>) =>
    saveMemories(memories.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const toggleFavorite = (item: Memory) =>
    updateMemory(item.id, { favorite: !item.favorite });

  const saveCaption = () => {
    if (!currentViewerItem) return;
    updateMemory(currentViewerItem.id, { caption: captionDraft });
    setEditingCaption(false);
  };

  const removeFromViewer = (item: Memory) => {
    Alert.alert("Remove this memory?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteFromAppStorage(item.uri);
          await saveMemories(memories.filter((m) => m.id !== item.id));
          closeViewer();
        },
      },
    ]);
  };

  const setAsCover = (item: Memory) => {
    if (!openAlbum || openAlbum === FAVORITES_ALBUM) return;
    saveCovers({ ...covers, [openAlbum]: item.id });
  };

  // ---------- item selection (inside a day) ----------
  const handleItemPress = (item: Memory, index: number) =>
    itemSelection.active
      ? itemSelection.toggle(item.id)
      : openViewer(currentAlbumItems, index);
  const handleItemLongPress = (item: Memory) => {
    if (!itemSelection.active) itemSelection.enter(item.id);
  };

  const handleRemoveSelectedItems = () => {
    Alert.alert(
      `Remove ${itemSelection.selected.size} item${itemSelection.selected.size === 1 ? "" : "s"}?`,
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const toDelete = memories.filter((m) =>
              itemSelection.selected.has(m.id),
            );
            await Promise.all(toDelete.map((m) => deleteFromAppStorage(m.uri)));
            await saveMemories(
              memories.filter((m) => !itemSelection.selected.has(m.id)),
            );
            itemSelection.exit();
          },
        },
      ],
    );
  };
  const handleMoveSelectedItems = async (targetDate: string) => {
    await saveMemories(
      memories.map((m) =>
        itemSelection.selected.has(m.id) ? { ...m, date: targetDate } : m,
      ),
    );
    setMoveModalVisible(false);
    itemSelection.exit();
  };

  // Back from item grid: Favorites goes straight to top; a normal day goes
  // back to the day-list within its month (openMonth stays set)
  const closeAlbum = () => {
    itemSelection.exit();
    setOpenAlbum(null);
  };

  // ---------- day selection (inside a month) ----------
  const handleDayPress = (date: string) =>
    daySelection.active ? daySelection.toggle(date) : setOpenAlbum(date);
  const handleDayLongPress = (date: string) => {
    if (!daySelection.active) daySelection.enter(date);
  };

  const handleRemoveSelectedDays = () => {
    const toDelete = memories.filter((m) => daySelection.selected.has(m.date));
    Alert.alert(
      `Delete ${daySelection.selected.size} day${daySelection.selected.size === 1 ? "" : "s"}?`,
      `Removes ${toDelete.length} item${toDelete.length === 1 ? "" : "s"} inside. Can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Promise.all(toDelete.map((m) => deleteFromAppStorage(m.uri)));
            await saveMemories(
              memories.filter((m) => !daySelection.selected.has(m.date)),
            );
            daySelection.exit();
          },
        },
      ],
    );
  };

  const closeMonth = () => {
    daySelection.exit();
    setOpenMonth(null);
  };

  // ---------- month selection (top level) ----------
  const handleMonthPress = (month: string) =>
    monthSelection.active ? monthSelection.toggle(month) : setOpenMonth(month);
  const handleMonthLongPress = (month: string) => {
    if (!monthSelection.active) monthSelection.enter(month);
  };

  const handleRemoveSelectedMonths = () => {
    const toDelete = memories.filter((m) =>
      monthSelection.selected.has(m.date.slice(0, 7)),
    );
    Alert.alert(
      `Delete ${monthSelection.selected.size} month${monthSelection.selected.size === 1 ? "" : "s"}?`,
      `Removes ${toDelete.length} item${toDelete.length === 1 ? "" : "s"} inside. Can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Promise.all(toDelete.map((m) => deleteFromAppStorage(m.uri)));
            await saveMemories(
              memories.filter(
                (m) => !monthSelection.selected.has(m.date.slice(0, 7)),
              ),
            );
            monthSelection.exit();
          },
        },
      ],
    );
  };

  const goToCalendarDate = (date: string) =>
    router.push({ pathname: "/calendar", params: { date } });
  const dayCoverUri = (date: string, items: Memory[]) =>
    items.find((i) => i.id === covers[date])?.uri ?? items[0].uri;

  // ================= LEVEL 0: Month grid =================
  if (!openMonth && !openAlbum) {
    return (
      <ScreenContainer contentContainerStyle={{ gap: 16 }}>
        {monthSelection.active ? (
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {monthSelection.selected.size} selected
            </Text>
            <View style={styles.selectionActions}>
              <Pressable
                onPress={() =>
                  monthSelection.selectAll(visibleMonths.map((s) => s.month))
                }
              >
                <Text style={styles.headerLink}>Select all</Text>
              </Pressable>
              <Pressable onPress={monthSelection.exit}>
                <Text style={styles.headerLinkMuted}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.title}>Memories</Text>
            <View style={styles.headerButtons}>
              <Pressable onPress={() => setFilterVisible(true)}>
                <Text style={styles.headerLink}>
                  {yearFilter ?? "All years"}
                </Text>
              </Pressable>
              <Pressable style={styles.addButton} onPress={handleAddMemory}>
                <Plus color="#fff" size={20} />
              </Pressable>
            </View>
          </View>
        )}

        {monthSelection.active && (
          <View style={styles.selectionBar}>
            <Pressable
              style={[
                styles.selectionBarButton,
                monthSelection.selected.size === 0 &&
                  styles.selectionBarButtonDisabled,
              ]}
              disabled={monthSelection.selected.size === 0}
              onPress={handleRemoveSelectedMonths}
            >
              <Text
                style={[styles.selectionBarButtonText, { color: "#d9534f" }]}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        )}

        {monthSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No memories yet</Text>
            <Text style={styles.emptyHint}>
              Tap the + button to add your first photo or video
            </Text>
          </View>
        ) : (
          <View style={styles.folderGrid}>
            {favorites.length > 0 && !monthSelection.active && (
              <Pressable
                style={styles.folderTile}
                onPress={() => setOpenAlbum(FAVORITES_ALBUM)}
              >
                <Image
                  source={{ uri: favorites[0].uri }}
                  style={styles.folderCover}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={styles.favoriteBadge}>
                  <Heart color="#fff" size={12} fill="#fff" />
                </View>
                <Text style={styles.folderLabel}>Favorites</Text>
                <Text style={styles.folderCount}>
                  {favorites.length} item{favorites.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
            )}
            {visibleMonths.map((section) => {
              const isSelected = monthSelection.selected.has(section.month);
              return (
                <Pressable
                  key={section.month}
                  style={styles.folderTile}
                  onPress={() => handleMonthPress(section.month)}
                  onLongPress={() => handleMonthLongPress(section.month)}
                >
                  <View>
                    <Image
                      source={{ uri: section.coverUri }}
                      style={styles.folderCover}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    {monthSelection.active && (
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
                    {formatMonthLabel(section.month)}
                  </Text>
                  <Text style={styles.folderCount}>
                    {section.itemCount} item{section.itemCount === 1 ? "" : "s"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <MediaViewer
          list={viewerList}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={closeViewer}
          onToggleFavorite={toggleFavorite}
          onRemove={removeFromViewer}
          captionDraft={captionDraft}
          setCaptionDraft={setCaptionDraft}
          editingCaption={editingCaption}
          setEditingCaption={setEditingCaption}
          onSaveCaption={saveCaption}
          canSetCover={false}
          onSetCover={() => {}}
        />

        <Modal
          visible={filterVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterVisible(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setFilterVisible(false)}
          >
            <Pressable
              style={styles.sheet}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.sheetTitle}>Filter by year</Text>
              <Pressable
                style={styles.albumOption}
                onPress={() => {
                  setYearFilter(null);
                  setFilterVisible(false);
                }}
              >
                <Text style={styles.albumOptionText}>All years</Text>
              </Pressable>
              {availableYears.map((y) => (
                <Pressable
                  key={y}
                  style={styles.albumOption}
                  onPress={() => {
                    setYearFilter(y);
                    setFilterVisible(false);
                  }}
                >
                  <Text style={styles.albumOptionText}>{y}</Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.cancelButton}
                onPress={() => setFilterVisible(false)}
              >
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </ScreenContainer>
    );
  }

  // ================= LEVEL 1: Day grid within a month =================
  if (openMonth && !openAlbum) {
    return (
      <ScreenContainer contentContainerStyle={{ gap: 16 }}>
        {daySelection.active ? (
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {daySelection.selected.size} selected
            </Text>
            <View style={styles.selectionActions}>
              <Pressable
                onPress={() =>
                  daySelection.selectAll(daysInOpenMonth.map((d) => d.date))
                }
              >
                <Text style={styles.headerLink}>Select all</Text>
              </Pressable>
              <Pressable onPress={daySelection.exit}>
                <Text style={styles.headerLinkMuted}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Pressable style={styles.backRow} onPress={closeMonth}>
              <ChevronLeft color="#e75480" size={22} />
              <Text style={styles.title}>{formatMonthLabel(openMonth)}</Text>
            </Pressable>
          </View>
        )}

        {daySelection.active && (
          <View style={styles.selectionBar}>
            <Pressable
              style={[
                styles.selectionBarButton,
                daySelection.selected.size === 0 &&
                  styles.selectionBarButtonDisabled,
              ]}
              disabled={daySelection.selected.size === 0}
              onPress={handleRemoveSelectedDays}
            >
              <Text
                style={[styles.selectionBarButtonText, { color: "#d9534f" }]}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.folderGrid}>
          {daysInOpenMonth.map((day) => {
            const isSelected = daySelection.selected.has(day.date);
            return (
              <Pressable
                key={day.date}
                style={styles.folderTile}
                onPress={() => handleDayPress(day.date)}
                onLongPress={() => handleDayLongPress(day.date)}
              >
                <View>
                  <Image
                    source={{ uri: dayCoverUri(day.date, day.items) }}
                    style={styles.folderCover}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  {daySelection.active && (
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
                  {formatDayLabel(day.date)}
                </Text>
                <Text style={styles.folderCount}>
                  {day.items.length} item{day.items.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <MediaViewer
          list={viewerList}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={closeViewer}
          onToggleFavorite={toggleFavorite}
          onRemove={removeFromViewer}
          captionDraft={captionDraft}
          setCaptionDraft={setCaptionDraft}
          editingCaption={editingCaption}
          setEditingCaption={setEditingCaption}
          onSaveCaption={saveCaption}
          canSetCover={false}
          onSetCover={() => {}}
        />
      </ScreenContainer>
    );
  }

  // ================= LEVEL 2: Items inside a day (or Favorites) =================
  const albumTitle =
    openAlbum === FAVORITES_ALBUM ? "Favorites" : formatDayLabel(openAlbum!);

  return (
    <ScreenContainer contentContainerStyle={{ gap: 16 }}>
      {itemSelection.active ? (
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {itemSelection.selected.size} selected
          </Text>
          <View style={styles.selectionActions}>
            <Pressable
              onPress={() =>
                itemSelection.selectAll(currentAlbumItems.map((m) => m.id))
              }
            >
              <Text style={styles.headerLink}>Select all</Text>
            </Pressable>
            <Pressable onPress={itemSelection.exit}>
              <Text style={styles.headerLinkMuted}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <Pressable style={styles.backRow} onPress={closeAlbum}>
            <ChevronLeft color="#e75480" size={22} />
            <Text style={styles.title}>{albumTitle}</Text>
          </Pressable>
          <View style={styles.headerButtons}>
            {openAlbum !== FAVORITES_ALBUM && (
              <Pressable onPress={() => goToCalendarDate(openAlbum!)}>
                <Text style={styles.headerLink}>View in Calendar</Text>
              </Pressable>
            )}
            {openAlbum !== FAVORITES_ALBUM && (
              <Pressable
                style={[
                  styles.addButton,
                  isFutureAlbum && styles.addButtonDisabled,
                ]}
                onPress={handleAddMemory}
              >
                <Plus color="#fff" size={20} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isFutureAlbum && !itemSelection.active && (
        <View style={styles.futureNotice}>
          <Text style={styles.futureNoticeText}>
            This day hasn't happened yet — you'll be able to add memories once
            it arrives
          </Text>
        </View>
      )}

      {itemSelection.active && (
        <View style={styles.selectionBar}>
          <Pressable
            style={[
              styles.selectionBarButton,
              itemSelection.selected.size === 0 &&
                styles.selectionBarButtonDisabled,
            ]}
            disabled={itemSelection.selected.size === 0}
            onPress={() => setMoveModalVisible(true)}
          >
            <Text style={styles.selectionBarButtonText}>Move</Text>
          </Pressable>
          <Pressable
            style={[
              styles.selectionBarButton,
              itemSelection.selected.size === 0 &&
                styles.selectionBarButtonDisabled,
            ]}
            disabled={itemSelection.selected.size === 0}
            onPress={handleRemoveSelectedItems}
          >
            <Text style={[styles.selectionBarButtonText, { color: "#d9534f" }]}>
              Remove
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={currentAlbumItems}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={{ gap: GRID_GAP }}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        removeClippedSubviews
        initialNumToRender={12}
        renderItem={({ item, index }) => {
          const isSelected = itemSelection.selected.has(item.id);
          return (
            <Pressable
              onPress={() => handleItemPress(item, index)}
              onLongPress={() => handleItemLongPress(item)}
            >
              <View style={styles.thumbnailWrapper}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {item.favorite && !itemSelection.active && (
                  <View style={styles.favoriteCorner}>
                    <Heart color="#fff" size={12} fill="#fff" />
                  </View>
                )}
                {item.type === "video" && !itemSelection.active && (
                  <View style={styles.playOverlay}>
                    <Play color="#fff" size={20} fill="#fff" />
                  </View>
                )}
                {itemSelection.active && (
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
        }}
      />

      <MediaViewer
        list={viewerList}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={closeViewer}
        onToggleFavorite={toggleFavorite}
        onRemove={removeFromViewer}
        captionDraft={captionDraft}
        setCaptionDraft={setCaptionDraft}
        editingCaption={editingCaption}
        setEditingCaption={setEditingCaption}
        onSaveCaption={saveCaption}
        canSetCover={openAlbum !== FAVORITES_ALBUM}
        onSetCover={setAsCover}
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
            <Text style={styles.sheetTitle}>Move to day</Text>
            {daySections
              .filter((s) => s.date !== openAlbum)
              .map((section) => (
                <Pressable
                  key={section.date}
                  style={styles.albumOption}
                  onPress={() => handleMoveSelectedItems(section.date)}
                >
                  <Text style={styles.albumOptionText}>
                    {formatDayLabel(section.date)}
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

function MediaViewer({
  list,
  index,
  onIndexChange,
  onClose,
  onToggleFavorite,
  onRemove,
  captionDraft,
  setCaptionDraft,
  editingCaption,
  setEditingCaption,
  onSaveCaption,
  canSetCover,
  onSetCover,
}: {
  list: Memory[] | null;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onToggleFavorite: (item: Memory) => void;
  onRemove: (item: Memory) => void;
  captionDraft: string;
  setCaptionDraft: (v: string) => void;
  editingCaption: boolean;
  setEditingCaption: (v: boolean) => void;
  onSaveCaption: () => void;
  canSetCover: boolean;
  onSetCover: (item: Memory) => void;
}) {
  const current = list?.[index] ?? null;

  useEffect(() => {
    if (current) setCaptionDraft(current.caption ?? "");
  }, [current?.id]);

  if (!list) return null;

  return (
    <Modal
      visible={!!list}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.viewerOverlay}>
        <FlatList
          data={list}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(e) =>
            onIndexChange(
              Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
            )
          }
          renderItem={({ item }) =>
            item.type === "image" ? (
              <View style={styles.page}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.pageMedia}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            ) : (
              <VideoPage uri={item.uri} />
            )
          }
        />

        <Pressable style={styles.viewerClose} onPress={onClose}>
          <X color="#fff" size={28} />
        </Pressable>

        {current && (
          <View style={styles.viewerTopRight}>
            <AnimatedHeartButton
              favorite={current.favorite}
              onPress={() => onToggleFavorite(current)}
            />
            {canSetCover && (
              <Pressable
                onPress={() => onSetCover(current)}
                style={styles.iconButton}
              >
                <Star color="#fff" size={20} />
              </Pressable>
            )}
            <Pressable
              onPress={() => onRemove(current)}
              style={styles.iconButton}
            >
              <Trash2 color="#fff" size={20} />
            </Pressable>
          </View>
        )}

        {current && (
          <View style={styles.captionBar}>
            {editingCaption ? (
              <View style={styles.captionEditRow}>
                <TextInput
                  style={styles.captionInput}
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  placeholder="Add a caption..."
                  placeholderTextColor="#999"
                  maxLength={80}
                  autoFocus
                />
                <Pressable onPress={onSaveCaption}>
                  <Text style={styles.captionSave}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingCaption(true)}>
                <Text
                  style={
                    current.caption
                      ? styles.captionText
                      : styles.captionPlaceholder
                  }
                >
                  {current.caption || "Add a caption..."}
                </Text>
              </Pressable>
            )}
          </View>
        )}
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
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 14 },
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
  headerLink: { color: "#e75480", fontWeight: "600", fontSize: 13 },
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
  favoriteBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    padding: 4,
  },
  folderLabel: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  folderCount: { fontSize: 12, color: "#999" },
  thumbnailWrapper: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: "100%" },
  favoriteCorner: { position: "absolute", top: 4, right: 4 },
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
    borderRadius: 8,
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
  viewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
  },
  pageMedia: { width: SCREEN_WIDTH, height: "70%" },
  viewerClose: { position: "absolute", top: 60, left: 20, zIndex: 1 },
  viewerTopRight: {
    position: "absolute",
    top: 60,
    right: 20,
    flexDirection: "row",
    gap: 10,
    zIndex: 1,
  },
  iconButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  captionBar: { position: "absolute", bottom: 110, left: 20, right: 20 },
  captionText: { color: "#fff", fontSize: 14, textAlign: "center" },
  captionPlaceholder: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  captionEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: 8,
  },
  captionInput: { flex: 1, color: "#fff", fontSize: 14 },
  captionSave: { color: "#e75480", fontWeight: "700" },
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
