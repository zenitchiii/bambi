import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  uri: string;
  width: number;
  height: number;
  onSingleTap: () => void;
  onZoomChange?: (zoomed: boolean) => void;
};

function clamp(v: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, v));
}

// Single photo page with iOS-Photos-style interactions: pinch to zoom,
// double-tap to toggle zoom, single tap to toggle the viewer chrome.
// Deliberately two-finger-only for zooming so one-finger horizontal swipes
// always reach the paging FlatList — no gesture conflict by construction.
export default function ZoomableImage({
  uri,
  width,
  height,
  onSingleTap,
  onZoomChange,
}: Props) {
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const startFx = useSharedValue(0);
  const startFy = useSharedValue(0);
  const wasZoomed = useSharedValue(false);

  // Fresh photo (or page change) — drop any leftover zoom.
  useEffect(() => {
    scale.value = MIN_SCALE;
    savedScale.value = MIN_SCALE;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    wasZoomed.value = false;
  }, [uri, scale, savedScale, tx, ty, savedTx, savedTy, wasZoomed]);

  const reportZoom = (zoomed: boolean) => {
    if (wasZoomed.value !== zoomed) {
      wasZoomed.value = zoomed;
      if (onZoomChange) runOnJS(onZoomChange)(zoomed);
    }
  };

  const maxTranslate = (s: number, size: number) => {
    "worklet";
    return ((s - 1) * size) / 2;
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      startFx.value = e.focalX;
      startFy.value = e.focalY;
    })
    .onUpdate((e) => {
      const next = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      scale.value = next;
      if (next > MIN_SCALE) {
        tx.value = clamp(
          savedTx.value + (e.focalX - startFx.value),
          -maxTranslate(next, width),
          maxTranslate(next, width),
        );
        ty.value = clamp(
          savedTy.value + (e.focalY - startFy.value),
          -maxTranslate(next, height),
          maxTranslate(next, height),
        );
      } else {
        tx.value = 0;
        ty.value = 0;
      }
      reportZoom(next > MIN_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE + 0.01) {
        scale.value = MIN_SCALE;
        tx.value = 0;
        ty.value = 0;
      }
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      reportZoom(scale.value > MIN_SCALE);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.value > MIN_SCALE + 0.2) {
        scale.value = withTiming(MIN_SCALE);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = MIN_SCALE;
        savedTx.value = 0;
        savedTy.value = 0;
        reportZoom(false);
      } else {
        const s = DOUBLE_TAP_SCALE;
        // Bias the zoom toward the tapped point (view coordinates).
        const targetTx = clamp(
          (width / 2 - e.x) * (s - 1),
          -maxTranslate(s, width),
          maxTranslate(s, width),
        );
        const targetTy = clamp(
          (height / 2 - e.y) * (s - 1),
          -maxTranslate(s, height),
          maxTranslate(s, height),
        );
        scale.value = withTiming(s);
        tx.value = withTiming(targetTx);
        ty.value = withTiming(targetTy);
        savedScale.value = s;
        savedTx.value = targetTx;
        savedTy.value = targetTy;
        reportZoom(true);
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(300)
    .onEnd((_, success) => {
      if (success) runOnJS(onSingleTap)();
    });

  const composed = Gesture.Simultaneous(
    pinch,
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.page, { width, height }]}>
        <Animated.View style={[styles.fill, zoomStyle]}>
          <Image
            source={{ uri }}
            style={styles.fill}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: "center", alignItems: "center", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
});
