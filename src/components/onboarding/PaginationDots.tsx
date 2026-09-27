import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedStyle,
} from "react-native-reanimated";

type Props = {
  scrollX: SharedValue<number>;
  count: number;
};

export default function PaginationDots({ scrollX, count }: Props) {
  const { width } = useWindowDimensions();

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} index={i} scrollX={scrollX} width={width} />
      ))}
    </View>
  );
}

function Dot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1.4, 0.8],
      "clamp",
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 1, 0.4],
      "clamp",
    );
    return { transform: [{ scale }], opacity };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e75480" },
});
