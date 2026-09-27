import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

function RootNavigator() {
  const { status } = useOnboarding();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#e75480" />
      </View>
    );
  }

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
