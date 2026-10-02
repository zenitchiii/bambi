import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import { useEvent, useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { ChevronLeft, Heart, Pause, Play, Star, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import ZoomableImage from "./ZoomableImage";

// Viewer spacing, defined once and reused below.
const CHROME_GAP = 10;
const CONTROL_PAD = 14;
const CONTROL_PAD_Y = 12;
const FOOTER_PAD_Y = 16;

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

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function VideoPage({
  uri,
  isActive,
  pageWidth,
  pagerLock,
}: {
  uri: string;
  isActive: boolean;
  pageWidth: number;
  pagerLock: SharedValue<boolean>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 0.15;
    if (isActive) p.play();
  });

  // Ground truth for "video finished" — play() alone is a no-op in the
  // ended state on Android, which is why the button went dead.
  const [finished, setFinished] = useState(false);
  // Fraction 0..1 while the finger is down; playback value otherwise, so
  // 0.15s progress events never fight the thumb mid-drag.
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const handleEnded = useCallback(() => setFinished(true), []);
  // Auto-removed on unmount — no manual cleanup needed.
  useEventListener(player, "playToEnd", handleEnded);

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  // New source remounts via key={uri} below, so finished/scrub state can
  // never leak across videos — no reset effect needed.

  // Pager lock that flips synchronously on the UI thread at touch-down.
  // Created once per mount (never per render), so an in-progress scrub can
  // never lose it to a re-render.
  const sliderPan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          pagerLock.value = true;
        })
        .onFinalize(() => {
          pagerLock.value = false;
        }),
    [pagerLock],
  );

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
  const progress = duration > 0 ? clamp01(currentTime / duration) : 0;

  const toggle = useCallback(() => {
    if (finished) {
      // Ended state ignores play(): seek out of it first, then play.
      player.currentTime = 0;
      player.play();
      setFinished(false);
    } else if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [finished, isPlaying, player]);

  // Reads player imperatively so the identity never changes mid-playback.
  const handleSlidingStart = useCallback(() => {
    setScrubValue(progressAt(player));
    setScrubbing(true);
  }, [player]);

  const handleValueChange = useCallback((v: number) => {
    setScrubValue(clamp01(v));
  }, []);

  // Single seek on release — never on every move event.
  const handleSlidingComplete = useCallback(
    (v: number) => {
      const d = player.duration || 0;
      if (d > 0) player.currentTime = clamp01(v) * d;
      setFinished(false);
      setScrubbing(false);
    },
    [player],
  );

  const shownTime = scrubbing ? scrubValue * duration : currentTime;

  return (
    <View style={[styles.videoPage, { width: pageWidth }]}>
      <View style={styles.videoMedia}>
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit="contain"
          surfaceType="textureView"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={toggle}>
          {!isPlaying && (
            <View style={styles.centerPlayButton}>
              <Play color="#fff" size={36} fill="#fff" />
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.videoControls}>
        {/* Padded wrapper: tall touch area, thin visual line. Tap-to-seek
            comes free with the community slider. */}
        <GestureDetector gesture={sliderPan}>
          <View style={styles.sliderTouchZone}>
          <Slider
            style={styles.videoSlider}
            minimumValue={0}
            maximumValue={1}
            step={0}
            value={scrubbing ? scrubValue : progress}
            minimumTrackTintColor="#e75480"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#e75480"
            onSlidingStart={handleSlidingStart}
            onValueChange={handleValueChange}
            onSlidingComplete={handleSlidingComplete}
          />
        </View>
        </GestureDetector>
        <View style={styles.videoControlsRow}>
          <View style={styles.videoControlsLeft}>
            <Pressable onPress={toggle}>
              {isPlaying ? (
                <Pause color="#fff" size={22} fill="#fff" />
              ) : (
                <Play color="#fff" size={22} fill="#fff" />
              )}
            </Pressable>
          </View>
          <Text style={styles.videoTime}>
            {formatTime(shownTime)} / {formatTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Fraction helper for the scrub-start sync (plain JS: only worklets need the
// directive, and this is never called from one).
function progressAt(player: { currentTime: number; duration: number }) {
  const d = player.duration || 0;
  return d > 0 ? clamp01(player.currentTime / d) : 0;
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

// Viewer as a strict column — header, media area, footer — so media can
// never slide under the header (the old absolute overlay did exactly that
// on tall photos). It lives in a Modal (separate hierarchy), so its
// horizontal paging can never fight gestures underneath.
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
  const flatRef = useRef<FlatList<ViewerMemory>>(null);
  const closingRef = useRef(false);
  const [pageLocked, setPageLocked] = useState(false);
  // UI-thread pager lock, flipped by the slider gesture at touch-down.
  // Applied through animatedProps so no React render sits between the
  // touch and the lock — a setState flip always loses that race on Android.
  const pagerLock = useSharedValue(false);
  const pagerAnimatedProps = useAnimatedProps(() => ({
    scrollEnabled: !pagerLock.value,
  }));
  // Zoom lock lives in React state (it changes with taps, not touches), so
  // mirror it into the same value the gesture writes.
  useEffect(() => {
    pagerLock.value = pageLocked;
  }, [pageLocked, pagerLock]);
  // Live window fallback for the first frame before the pager measures
  // itself below.
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  // Measured media box (falls back to window size on the first frame).
  // ZoomableImage needs concrete dims for its gesture math, and measuring
  // keeps media inside the column instead of assuming full-screen height.
  const [mediaSize, setMediaSize] = useState({
    w: winWidth,
    h: winHeight,
  });

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
      pagerLock.value = false;
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
    Keyboard.dismiss();
    enter.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const toggleChrome = () => {
    chrome.value = withTiming(chrome.value > 0.5 ? 0 : 1, { duration: 200 });
  };

  const handlePagerLayout = (e: LayoutChangeEvent) => {
    // Raw float on purpose: Math.round here can push the stride off the
    // physical pixel grid (e.g. 392.73dp → 393dp = 1081px vs a 1080px snap),
    // drifting ~1px per page. The single correct rounding happens in
    // pageWidth below. Epsilon guard: float reports jitter between passes.
    const w = e.nativeEvent.layout.width;
    const h = Math.round(e.nativeEvent.layout.height);
    setMediaSize((prev) =>
      Math.abs(prev.w - w) < 0.01 && prev.h === h ? prev : { w, h },
    );
  };

  // THE single page width: snapped to whole physical pixels so item edges,
  // layout math, and the native snap all agree exactly. Memoized — it only
  // recomputes when the measured viewport actually changes (rotation).
  const pageWidth = useMemo(
    () => PixelRatio.roundToNearestPixel(mediaSize.w),
    [mediaSize.w],
  );

  // Stable callbacks (not inline arrows) so FlatList/buttons don't get new
  // handler identities on every render.
  const handleSaveCaption = useCallback(() => {
    Keyboard.dismiss();
    onSaveCaption();
  }, [onSaveCaption]);

  const handleIndexChange = useCallback(
    (i: number) => {
      // Swiping away ends editing: the keyboard goes down with it and can't
      // linger or pop back up on the new page.
      setEditingCaption(false);
      Keyboard.dismiss();
      onIndexChange(i);
    },
    [onIndexChange, setEditingCaption],
  );

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
          {/* Inside the Modal: a Modal doesn't inherit the screen's keyboard
              handling, so the avoider must live here. behavior="padding"
              also applies on Android (needed edge-to-edge), offset 0 because
              the modal already starts at the screen top. The media area is
              flex: 1, so the photo shrinks and the caption is pushed up. */}
          <KeyboardAvoidingView
            style={styles.kav}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
          <SafeAreaView edges={["top"]}>
            <Animated.View
              style={[styles.topBar, chromeStyle]}
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
          </SafeAreaView>

          <View style={styles.mediaArea}>
            <Animated.FlatList
              ref={flatRef}
              style={styles.mediaList}
              data={list}
              horizontal
              pagingEnabled
              animatedProps={pagerAnimatedProps}
              onLayout={handlePagerLayout}
              initialScrollIndex={index}
              getItemLayout={(_, i) => ({
                length: pageWidth,
                offset: pageWidth * i,
                index: i,
              })}
              onScrollToIndexFailed={(info) => {
                flatRef.current?.scrollToOffset({
                  offset: info.index * pageWidth,
                  animated: false,
                });
              }}
              keyExtractor={(item) => item.id}
              onMomentumScrollEnd={(e) => {
                // New page starts unzoomed — matches ZoomableImage's own reset.
                setPageLocked(false);
                handleIndexChange(
                  Math.round(e.nativeEvent.contentOffset.x / pageWidth),
                );
              }}
              renderItem={({ item, index: itemIndex }) =>
                item.type === "image" ? (
                  <ZoomableImage
                    uri={item.uri}
                    width={pageWidth}
                    height={mediaSize.h}
                    onSingleTap={toggleChrome}
                    onZoomChange={setPageLocked}
                  />
                ) : (
                  <VideoPage
                    key={item.uri}
                    uri={item.uri}
                    isActive={itemIndex === index}
                    pageWidth={pageWidth}
                    pagerLock={pagerLock}
                  />
                )
              }
            />
          </View>

          {current && (
            <SafeAreaView edges={["bottom"]}>
              <Animated.View style={[styles.viewerFooter, chromeStyle]}>
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
                    <Pressable onPress={handleSaveCaption}>
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
            </SafeAreaView>
          )}
          </KeyboardAvoidingView>
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
  // Fills the animated wrapper so keyboard padding squeezes the column
  // (and the flex: 1 media) instead of covering the caption.
  kav: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: CHROME_GAP,
  },
  mediaArea: { flex: 1 },
  mediaList: { flex: 1 },
  viewerFooter: { paddingHorizontal: 20, paddingVertical: FOOTER_PAD_Y },
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
  actionsRow: { flexDirection: "row", gap: CHROME_GAP },
  iconButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
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
  videoPage: { flex: 1, overflow: "hidden" },
  videoMedia: { flex: 1 },
  videoControls: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: CONTROL_PAD,
    paddingTop: CONTROL_PAD_Y,
    paddingBottom: CONTROL_PAD_Y,
    gap: CHROME_GAP,
  },
  videoSlider: { width: "100%", height: 26 },
  // Tall touch target around the thin slider: the thumb is easy to grab
  // without changing the visual line weight.
  sliderTouchZone: { paddingVertical: 10, marginVertical: -4 },
  videoControlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  videoControlsLeft: { flexDirection: "row", alignItems: "center", gap: 18 },
  videoTime: { color: "#fff", fontSize: 12 },
});
