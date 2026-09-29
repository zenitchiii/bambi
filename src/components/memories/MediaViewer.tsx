import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { ChevronLeft, Heart, Pause, Play, RotateCcw, Star, Trash2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ZoomableImage from "./ZoomableImage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

export type ViewerMemory = {
  id: string;
  uri: string;
  type: "image" | "video";
  date: string;
  caption?: string;
  favorite?: boolean;
};

type Props = {
  list: ViewerMemory[];
  visible: boolean;
  index: number;
  headerTitle: string;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onToggleFavorite: (item: ViewerMemory) => void;
  onRemove: (item: ViewerMemory) => void;
  captionDraft: string;
  setCaptionDraft: (v: string) => void;
  editingCaption: boolean;
  setEditingCaption: (v: boolean) => void;
  onSaveCaption: () => void;
  canSetCover: boolean;
  coverId?: string;
  onSetCover: (item: ViewerMemory) => void;
};

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoPage({ uri, isActive }: { uri: string; isActive: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 0.5;
    if (isActive) p.play();
  });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);
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

function AnimatedIconButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePress = () => {
    scale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    onPress();
  };
  return (
    <Pressable onPress={handlePress} style={styles.iconButton}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}

// iOS-Photos-style viewer: dark glass backdrop, edge-to-edge pages with an
// enter scale/fade, tap-to-toggle chrome, pinch + double-tap zoom on photos.
// It lives in a Modal (separate hierarchy), so its horizontal paging can
// never fight the tab-swipe gestures underneath — no conflict by design.
export default function MediaViewer({
  list,
  visible,
  index,
  headerTitle,
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
  coverId,
  onSetCover,
}: Props) {
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList<ViewerMemory>>(null);
  const closingRef = useRef(false);
  const [pageLocked, setPageLocked] = useState(false);

  const enter = useSharedValue(0);
  const chrome = useSharedValue(1);

  const current = list[index] ?? null;

  useEffect(() => {
    if (current) setCaptionDraft(current.caption ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Open animation + state reset every time the viewer appears.
  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setPageLocked(false);
      chrome.value = 1;
      enter.value = withTiming(1, { duration: 260 });
      // Reopening at a different photo: jump the pager (initialScrollIndex
      // only applies on first mount).
      requestAnimationFrame(() => {
        flatRef.current?.scrollToIndex({ index, animated: false });
      });
    } else {
      enter.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    enter.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const toggleChrome = () => {
    chrome.value = withTiming(chrome.value > 0.5 ? 0 : 1, { duration: 200 });
  };

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.92 + 0.08 * enter.value }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.dim} />

        <Animated.View style={[styles.content, enterStyle]}>
          <FlatList
            ref={flatRef}
            data={list}
            horizontal
            pagingEnabled
            scrollEnabled={!pageLocked}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * i,
              index: i,
            })}
            onScrollToIndexFailed={(info) => {
              flatRef.current?.scrollToOffset({
                offset: info.index * SCREEN_WIDTH,
                animated: false,
              });
            }}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(e) => {
              // New page starts unzoomed — matches ZoomableImage's own reset.
              setPageLocked(false);
              onIndexChange(
                Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
              );
            }}
            renderItem={({ item, index: itemIndex }) =>
              item.type === "image" ? (
                <ZoomableImage
                  uri={item.uri}
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT}
                  onSingleTap={toggleChrome}
                  onZoomChange={setPageLocked}
                />
              ) : (
                <VideoPage uri={item.uri} isActive={itemIndex === index} />
              )
            }
          />

          <Animated.View
            style={[styles.topBar, { paddingTop: insets.top + 8 }, chromeStyle]}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backButton} onPress={animatedClose}>
              <ChevronLeft color="#fff" size={28} />
            </Pressable>
            <Text style={styles.dateLabel} numberOfLines={1}>
              {headerTitle}
            </Text>
            {current && (
              <View style={styles.actionsRow}>
                <AnimatedIconButton onPress={() => onToggleFavorite(current)}>
                  <Heart
                    color="#fff"
                    size={20}
                    fill={current.favorite ? "#e75480" : "transparent"}
                  />
                </AnimatedIconButton>
                {canSetCover && (
                  <AnimatedIconButton onPress={() => onSetCover(current)}>
                    <Star
                      color="#fff"
                      size={20}
                      fill={current.id === coverId ? "#d0ff00" : "transparent"}
                    />
                  </AnimatedIconButton>
                )}
                <AnimatedIconButton onPress={() => onRemove(current)}>
                  <Trash2 color="#fff" size={20} />
                </AnimatedIconButton>
              </View>
            )}
          </Animated.View>

          {current && (
            <Animated.View
              style={[
                styles.captionBar,
                { bottom: insets.bottom + 40 },
                chromeStyle,
              ]}
            >
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
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  content: { flex: 1 },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
  },
  pageMedia: { width: SCREEN_WIDTH, height: "70%" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dateLabel: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  iconButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  captionBar: { position: "absolute", left: 20, right: 20 },
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
});
