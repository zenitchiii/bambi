import PairingStep from "@/components/onboarding/PairingStep";
import { router } from "expo-router";

// First gate: create or join a couple. No profile needed (uid only).
// Forward-only: replace leaves no route to come back to.
export default function PairScreen() {
  return <PairingStep onNext={() => router.replace("/profile")} />;
}
