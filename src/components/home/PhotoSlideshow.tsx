import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, memo } from "react";
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const MEMORIES_KEY = "memories";
const SLIDE_INTERVAL_MS = 4000;
const SLIDE_DURATION_MS = 1200; // Slow, luxurious 1.2s slide transition

type MemoryItem = { uri: string; date: string; type?: "photo" | "video" };

const MAX_SLIDESHOW_PHOTOS = 15;

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type Props = { height?: number; rounded?: boolean; style?: ViewStyle };

// memo: Home re-renders on every modal open/close — without this the hero
// slideshow would re-render (and previously, with the swipe tree
// unmounting, fully reset) each time "Add a dream" opens. Props are
// primitives/stable, so memo skips all of that.
function PhotoSlideshow({
  height = 160,
  rounded = true,
  style,
}: Props) {
  const [photos, setPhotos] = useState<MemoryItem[]>([]);
  const [width, setWidth] = useState(0);

  const translateX = useSharedValue(0);
  const currentIndexRef = useRef(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(MEMORIES_KEY)
        .then((saved) => {
          if (!active) return;
          if (!saved) {
            setPhotos([]);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(saved);
            if (!Array.isArray(parsed)) {
              setPhotos([]);
              return;
            }
            const validPhotos = parsed.filter(
              (m: any) =>
                m &&
                typeof m.uri === "string" &&
                m.uri.trim() !== "" &&
                m.type !== "video",
            );

            setPhotos(shuffle(validPhotos).slice(0, MAX_SLIDESHOW_PHOTOS));
            currentIndexRef.current = 0;
            translateX.value = 0;
          } catch (e) {
            if (active) setPhotos([]);
            console.warn("[slideshow] failed to load memories", e);
          }
        })
        .catch((e) => console.warn("[slideshow] failed to load memories", e));
      return () => {
        active = false;
      };
    }, []),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) {
      setWidth(w);
    }
  };

  useEffect(() => {
    if (photos.length < 2 || width === 0) return;

    const interval = setInterval(() => {
      const nextIndex = currentIndexRef.current + 1;
      currentIndexRef.current = nextIndex;

      // Smooth custom easing over 1.2 seconds
      translateX.value = withTiming(-nextIndex * width, {
        duration: SLIDE_DURATION_MS,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      });

      // When reaching the cloned photo at the end, reset position invisibly after animation finishes
      if (nextIndex === photos.length) {
        resetTimeoutRef.current = setTimeout(() => {
          currentIndexRef.current = 0;
          translateX.value = 0;
        }, SLIDE_DURATION_MS);
      }
    }, SLIDE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [photos, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // 1. Empty State
  if (photos.length === 0) {
    return (
      <View
        onLayout={onLayout}
        style={[
          styles.card,
          rounded && { borderRadius: 16 },
          { height },
          style,
          styles.emptyState,
        ]}
      >
        <Image
          source={require("../../assets/images/bunny.png")}
          style={styles.bunny}
          contentFit="contain"
        />
      </View>
    );
  }

  // 2. Single Photo State
  if (photos.length === 1) {
    return (
      <View
        onLayout={onLayout}
        style={[
          styles.card,
          rounded && { borderRadius: 16 },
          { height },
          style,
        ]}
      >
        <Image
          source={{ uri: photos[0].uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </View>
    );
  }

  // 3. Multi-Photo Infinite Horizontal Strip
  const loopPhotos = [...photos, photos[0]];

  return (
    <View
      onLayout={onLayout}
      style={[styles.card, rounded && { borderRadius: 16 }, { height }, style]}
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.strip,
            { width: width * loopPhotos.length },
            animatedStyle,
          ]}
        >
          {loopPhotos.map((item, i) => (
            <View key={`${item.uri}-${i}`} style={{ width, height: "100%" }}>
              <Image
                source={{ uri: item.uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

export default memo(PhotoSlideshow);

const styles = StyleSheet.create({
  card: { overflow: "hidden" },
  strip: { flexDirection: "row", height: "100%" },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff5f7",
  },
  bunny: { width: "50%", height: "50%" },
});
