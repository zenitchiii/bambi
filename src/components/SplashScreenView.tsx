import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

export const SPLASH_MIN_MS = 2400;

const BAR_WIDTH = 160; // numeric on purpose: avoids `${n}%` string typing issues
const bunny = require("../assets/images/bunny.png"); // relative path, per the tsconfig quirk

export default function SplashScreenView() {
  const intro = useSharedValue(0); // 0 -> 1: fade/scale in
  const float = useSharedValue(0); // 0 <-> 1: gentle bobbing
  const progress = useSharedValue(0); // 0 -> 1: loading bar

  useEffect(() => {
    intro.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    float.value = withDelay(
      700,
      withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    progress.value = withTiming(1, {
      duration: SPLASH_MIN_MS,
      easing: Easing.inOut(Easing.quad),
    });
  }, []);

  const bunnyStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [
      { scale: 0.85 + 0.15 * intro.value },
      { translateY: -8 * float.value },
    ],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: intro.value }));
  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * BAR_WIDTH,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={() => SplashScreen.hideAsync()} // hide the native splash only once ours is on screen
    >
      <LinearGradient
        colors={["#fffafc", "#ffeef4", "#ffd9e6"]}
        style={styles.center}
      >
        <Animated.View style={bunnyStyle}>
          <Image source={bunny} style={styles.bunny} contentFit="contain" />
        </Animated.View>
        <Animated.Text style={[styles.title, titleStyle]}>Bambi</Animated.Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bunny: { width: 200, height: 200 },
  title: {
    marginTop: 16,
    fontSize: 34,
    fontWeight: "700",
    color: "#e75480",
    letterSpacing: 1,
  },
  track: {
    position: "absolute",
    bottom: 72,
    width: BAR_WIDTH,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(231,84,128,0.18)",
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: "#e75480" },
});
