import { useOnboarding } from "@/context/OnboardingContext";
import { ensureSignedIn, isMemberA } from "@/lib/pairing";
import { SyncedProfile, watchPartnerProfile } from "@/lib/profileSync";
import { useEffect, useState } from "react";

export function usePartnerProfile() {
  const { coupleId } = useOnboarding();
  const [partner, setPartner] = useState<SyncedProfile | null>(null);

  useEffect(() => {
    if (!coupleId) return;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const uid = await ensureSignedIn();
      const memberA = await isMemberA(coupleId, uid);
      unsubscribe = watchPartnerProfile(coupleId, memberA, setPartner);
    })();
    return () => unsubscribe?.();
  }, [coupleId]);

  return partner;
}
