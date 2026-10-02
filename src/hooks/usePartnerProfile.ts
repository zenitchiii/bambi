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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    // Cold-start offline (or flaky WiFi) makes the one-time role check
    // throw. Retry a few times as the connection comes up instead of
    // giving up and leaving the partner stuck on "Waiting..." — warn only
    // if all attempts fail.
    const trySubscribe = async () => {
      try {
        const uid = await ensureSignedIn();
        const memberA = await isMemberA(coupleId, uid);
        if (!mounted) return;
        unsubscribe = watchPartnerProfile(coupleId, memberA, (p) => {
          if (mounted) setPartner(p);
        });
      } catch (e) {
        if (!mounted) return;
        attempts += 1;
        if (attempts <= 3) {
          timer = setTimeout(trySubscribe, attempts * 2000);
        } else {
          console.warn("[partner] failed to subscribe", e);
        }
      }
    };
    trySubscribe();
    return () => {
      mounted = false;
      unsubscribe?.();
      if (timer) clearTimeout(timer);
    };
  }, [coupleId]);

  return partner;
}
