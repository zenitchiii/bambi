import SplashScreenView, { SPLASH_MIN_MS } from "@/components/SplashScreenView";
import { CoupleDataProvider } from "@/context/CoupleDataContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import { ProfileProvider } from "@/context/ProfileContext";
import Constants, { AppOwnership } from "expo-constants";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Module scope on purpose: must run before the first render, or the native splash can vanish early.
SplashScreen.preventAutoHideAsync();
// setOptions is unsupported in Expo Go and logs a warning there —
// only apply it in standalone / dev builds.
if (Constants.appOwnership !== AppOwnership.Expo) {
  SplashScreen.setOptions({ duration: 400, fade: true });
}

function RootNavigator() {
  const { status } = useOnboarding();
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Hooks above must run on every render, so the early return goes below them.
  // The Stack stays mounted from the first render — gating it behind the
  // splash made expo-router's linking initialization race the navigator's
  // late mount ("state update on a component that hasn't mounted yet").
  // The splash overlays it instead and unmounts once we're ready.
  const ready = status !== "loading" && minTimePassed;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" redirect={status !== "onboarded"} />
        <Stack.Screen name="onboarding" redirect={status === "onboarded"} />
      </Stack>
      {!ready && <SplashScreenView />}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OnboardingProvider>
        <CoupleDataProvider>
          <ProfileProvider>
            <RootNavigator />
          </ProfileProvider>
        </CoupleDataProvider>
      </OnboardingProvider>
    </GestureHandlerRootView>
  );
}
