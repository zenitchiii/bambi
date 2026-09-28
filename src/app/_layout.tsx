import SplashScreenView, { SPLASH_MIN_MS } from "@/components/SplashScreenView";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

// Module scope on purpose: must run before the first render, or the native splash can vanish early.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

function RootNavigator() {
  const { status } = useOnboarding();
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Hooks above must run on every render, so the early return goes below them.
  if (status === "loading" || !minTimePassed) return <SplashScreenView />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" redirect={status !== "onboarded"} />
      <Stack.Screen name="onboarding" redirect={status === "onboarded"} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <ProfileProvider>
        <RootNavigator />
      </ProfileProvider>
    </OnboardingProvider>
  );
}
