import { ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const COMMIT_FRACTION = 0.22;
const FLING_VELOCITY = 700;
const BACK_SPRING = { damping: 28, stiffness: 250 };
const FLY_OUT_MS = 180;
const EDGE_COMMIT_DISTANCE = 50;
const EDGE_COMMIT_VELOCITY = 500;

type Props = {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Peek-rail captions, e.g. leftLabel="Memories". Shown while dragging. */
  leftLabel?: string;
  rightLabel?: string;
  // Flipped while an overlay that owns horizontal gestures is open (gallery
  // viewer, option sheets). Applied via Gesture.enabled() so the tree NEVER
  // unmounts — unmounting would reset scroll position, slideshows, etc.
  enabled?: boolean;
  /**
   * Called on a committed rightward drag starting within `edgeWidth` px of
   * the left edge (drawer open). The page content intentionally does NOT
   * follow these drags — the drawer slides over it. Owning the edge inside
   * this one gesture (instead of a separate PanResponder overlay) is what
   * guarantees the drawer wins with no cross-system starvation.
   */
  onEdgeSwipe?: () => void;
  edgeWidth?: number;
};

function clamp01(v: number) {
  "worklet";
  return Math.min(1, Math.max(0, v));
}

// Interactive tab pager: content follows the finger on the UI thread
// (Reanimated shared value, no JS re-renders), peek rails preview the
// adjacent tab while dragging, and release either springs back or flings
// out before navigating. Vertical drift fails fast so ScrollViews are
// untouched; only a committed horizontal swipe navigates.
export default function TabSwipeable({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  rightLabel,
  enabled = true,
  onEdgeSwipe,
  edgeWidth = 0,
}: Props) {
  const { width } = useWindowDimensions();
  const dragX = useSharedValue(0);
  const startX = useSharedValue(0);

  const commitDistance = width * COMMIT_FRACTION;
  // Plain values (not function calls) so the worklet closure can capture
  // them — calling a JS helper from in here would throw Remote Function.
  const hasEdgeSwipe = onEdgeSwipe != null;
  const edgeZone = edgeWidth;

  const finish = (dir: "left" | "right" | "edge") => {
    if (dir === "left") onSwipeLeft?.();
    else if (dir === "right") onSwipeRight?.();
    else onEdgeSwipe?.();
    // The new tab (or drawer) is now on screen — reset silently underneath.
    dragX.value = 0;
  };

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onBegin((e) => {
      startX.value = e.x;
    })
    .onUpdate((e) => {
      if (hasEdgeSwipe && startX.value < edgeZone) return; // drawer owns this drag
      let t = e.translationX;
      // Overdrag resistance when there is nowhere to go.
      if (t < 0 && !onSwipeLeft) t *= 0.25;
      if (t > 0 && !onSwipeRight) t *= 0.25;
      dragX.value = t;
    })
    .onEnd((e) => {
      const { translationX: tx, velocityX: vx } = e;
      // Edge zone: a committed rightward drag opens the drawer instead of
      // navigating — middle-of-screen swipes are unaffected.
      if (hasEdgeSwipe && startX.value < edgeZone) {
        if (tx > EDGE_COMMIT_DISTANCE || (tx > 20 && vx > EDGE_COMMIT_VELOCITY)) {
          runOnJS(finish)("edge");
        }
        return;
      }
      const flingLeft = tx < -40 && vx < -FLING_VELOCITY;
      const flingRight = tx > 40 && vx > FLING_VELOCITY;
      if (tx < -commitDistance || flingLeft) {
        if (onSwipeLeft) {
          dragX.value = withTiming(-width, { duration: FLY_OUT_MS }, (fin) => {
            if (fin) runOnJS(finish)("left");
          });
        } else {
          dragX.value = withSpring(0, BACK_SPRING);
        }
      } else if (tx > commitDistance || flingRight) {
        if (onSwipeRight) {
          dragX.value = withTiming(width, { duration: FLY_OUT_MS }, (fin) => {
            if (fin) runOnJS(finish)("right");
          });
        } else {
          dragX.value = withSpring(0, BACK_SPRING);
        }
      } else {
        dragX.value = withSpring(0, BACK_SPRING);
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  // Peek rails: fade/slide in proportionally to the drag.
  const rightPeekStyle = useAnimatedStyle(() => {
    const p = clamp01(-dragX.value / 90);
    return { opacity: p, transform: [{ translateX: (1 - p) * 24 }] };
  });
  const leftPeekStyle = useAnimatedStyle(() => {
    const p = clamp01(dragX.value / 90);
    return { opacity: p, transform: [{ translateX: -(1 - p) * 24 }] };
  });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.content, contentStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
      {onSwipeLeft && !!rightLabel && (
        <Animated.View
          style={[styles.peekRight, rightPeekStyle]}
          pointerEvents="none"
        >
          <View style={styles.chip}>
            <Text style={styles.chipText}>{rightLabel}</Text>
            <ChevronRight color="#fff" size={16} />
          </View>
        </Animated.View>
      )}
      {onSwipeRight && !!leftLabel && (
        <Animated.View
          style={[styles.peekLeft, leftPeekStyle]}
          pointerEvents="none"
        >
          <View style={styles.chip}>
            <ChevronLeft color="#fff" size={16} />
            <Text style={styles.chipText}>{leftLabel}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, overflow: "hidden" },
  peekRight: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  peekLeft: {
    position: "absolute",
    left: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(20,20,20,0.55)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
