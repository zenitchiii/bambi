import PaginationDots from "@/components/onboarding/PaginationDots";
import PairingStep from "@/components/onboarding/PairingStep";
import ProfileStep from "@/components/onboarding/ProfileStep";
import { useRef } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
} from "react-native-reanimated";

const STEPS = [PairingStep, ProfileStep];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        ref={listRef}
        data={STEPS}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item: Step, index }) => (
          <View style={{ width }}>
            <Step
              onNext={() =>
                listRef.current?.scrollToOffset({
                  offset: (index + 1) * width,
                  animated: true,
                })
              }
            />
          </View>
        )}
      />
      <PaginationDots scrollX={scrollX} count={STEPS.length} />
    </View>
  );
}
