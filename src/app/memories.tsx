import ScreenContainer from "@/components/ScreenContainer";
import { formatDateISO } from "@/utils/dateMath";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useEvent } from "expo";
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
  X
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

type Memory = {
  id: string;
  uri: string;
  type: "image" | "video";
  date: string;
  caption?: string;
  favorite?: boolean;
};

function formatAlbumDate(dateISO: string): string {
  if (dateISO === TODAY) return "Today";
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

export default function MemoriesScreen() {
  const params = useLocalSearchParams<{ date?: string }>();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [openAlbum, setOpenAlbum] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const [viewerList, setViewerList] = useState<Memory[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [captionDraft, setCaptionDraft] = useState("");
  const [editingCaption, setEditingCaption] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  const [folderSelectionMode, setFolderSelectionMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );

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
    if (params.date) setOpenAlbum(params.date);
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
    const newOnes: Memory[] = result.assets.map((a) => ({
      id: `${Date.now()}-${a.assetId ?? Math.random()}`,
      uri: a.uri,
      type: a.type === "video" ? "video" : "image",
      date: targetDate,
    }));
    await saveMemories([...newOnes, ...memories]);
    if (!openAlbum) setOpenAlbum(targetDate);
  };

  const sections = useMemo(() => {
    const map: Record<string, Memory[]> = {};
    memories.forEach((m) => {
      (map[m.date] ??= []).push(m);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  }, [memories]);

  const availableYears = useMemo(
    () =>
      Array.from(new Set(sections.map((s) => s.date.slice(0, 4))))
        .sort()
        .reverse(),
    [sections],
  );

  const visibleSections = yearFilter
    ? sections.filter((s) => s.date.startsWith(yearFilter))
    : sections;
  const favorites = useMemo(
    () => memories.filter((m) => m.favorite),
    [memories],
  );

  const currentAlbumItems =
    openAlbum === FAVORITES_ALBUM
      ? favorites
      : openAlbum
        ? (sections.find((s) => s.date === openAlbum)?.items ?? [])
        : [];

  // ---------- viewer (swipeable) ----------
  const openViewer = (list: Memory[], index: number) => {
    setViewerList(list);
    setViewerIndex(index);
  };
  const closeViewer = () => {
    setViewerList(null);
    setEditingCaption(false);
  };

  const currentViewerItem = viewerList?.[viewerIndex] ?? null;

  const updateMemory = (id: string, patch: Partial<Memory>) => {
    const updated = memories.map((m) => (m.id === id ? { ...m, ...patch } : m));
    saveMemories(updated);
  };

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

  // ---------- item selection (inside an album) ----------
  const toggleSelect = (id: string) =>
    setSelectedIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const handleItemPress = (item: Memory, index: number) =>
    selectionMode
      ? toggleSelect(item.id)
      : openViewer(currentAlbumItems, index);
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
  const selectAll = () =>
    setSelectedIds(new Set(currentAlbumItems.map((m) => m.id)));

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
    await saveMemories(
      memories.map((m) =>
        selectedIds.has(m.id) ? { ...m, date: targetDate } : m,
      ),
    );
    setMoveModalVisible(false);
    exitSelectionMode();
  };

  const closeAlbum = () => {
    exitSelectionMode();
    setOpenAlbum(null);
  };

  // ---------- folder selection (top-level grid) ----------
  const toggleFolderSelect = (date: string) =>
    setSelectedFolders((p) => {
      const n = new Set(p);
      n.has(date) ? n.delete(date) : n.add(date);
      return n;
    });
  const handleFolderPress = (date: string) =>
    folderSelectionMode ? toggleFolderSelect(date) : setOpenAlbum(date);
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
  const selectAllFolders = () =>
    setSelectedFolders(new Set(visibleSections.map((s) => s.date)));

  const handleRemoveFolders = () => {
    const count = sections
      .filter((s) => selectedFolders.has(s.date))
      .reduce((sum, s) => sum + s.items.length, 0);
    Alert.alert(
      `Delete ${selectedFolders.size} album${selectedFolders.size === 1 ? "" : "s"}?`,
      `Removes ${count} item${count === 1 ? "" : "s"} inside. Can't be undone.`,
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

  const goToCalendarDate = (date: string) =>
    router.push({ pathname: "/calendar", params: { date } });

  const folderCoverUri = (date: string, items: Memory[]) =>
    items.find((i) => i.id === covers[date])?.uri ?? items[0].uri;

  // ---------- Folder list ----------
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
            {favorites.length > 0 && !folderSelectionMode && (
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
            {visibleSections.map((section) => {
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
                      source={{
                        uri: folderCoverUri(section.date, section.items),
                      }}
                      style={styles.folderCover}
                      contentFit="cover"
                      cachePolicy="memory-disk"
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

  // ---------- Inside an album ----------
  const albumTitle =
    openAlbum === FAVORITES_ALBUM ? "Favorites" : formatAlbumDate(openAlbum);

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
            <Text style={styles.title}>{albumTitle}</Text>
          </Pressable>
          <View style={styles.headerButtons}>
            {openAlbum !== FAVORITES_ALBUM && (
              <Pressable onPress={() => goToCalendarDate(openAlbum)}>
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
          const isSelected = selectedIds.has(item.id);
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
                {item.favorite && !selectionMode && (
                  <View style={styles.favoriteCorner}>
                    <Heart color="#fff" size={12} fill="#fff" />
                  </View>
                )}
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
            <Pressable
              onPress={() => onToggleFavorite(current)}
              style={styles.iconButton}
            >
              <Heart
                color="#fff"
                size={20}
                fill={current.favorite ? "#e75480" : "transparent"}
              />
            </Pressable>
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
