import { useOnboarding } from "@/context/OnboardingContext";
import { ensureSignedIn, isMemberA } from "@/lib/pairing";
import { SyncedProfile, watchPartnerProfile } from "@/lib/profileSync";
import { useEffect, useState } from "react";

export function usePartnerProfile() {
  const { coupleId } = useOnboarding();
  const [partner, setPartner] = useState<SyncedProfile | null>(null);

  useEffect(() => {
    if (!coupleId) return;
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const uid = await ensureSignedIn();
        const memberA = await isMemberA(coupleId, uid);
        if (!mounted) return;
        unsubscribe = watchPartnerProfile(coupleId, memberA, (p) => {
          if (mounted) setPartner(p);
        });
      } catch (e) {
        console.warn("[partner] failed to subscribe", e);
      }
    })();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [coupleId]);

  return partner;
}
