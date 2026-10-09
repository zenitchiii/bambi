import ProfileStep from "@/components/onboarding/ProfileStep";
import { router } from "expo-router";

// Second gate: profile setup after the couple exists. No back button by
// design — leaving the couple happens in Settings, not here.
export default function ProfileScreen() {
  return <ProfileStep onNext={() => router.replace("/(tabs)")} />;
}
