import { COUPLE_ID_KEY } from "@/lib/pairing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type OnboardingStatus = "loading" | "pair" | "profile" | "tabs";

type OnboardingContextValue = {
  status: OnboardingStatus;
  coupleId: string | null;
  uid: string | null;
  refreshStatus: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const [coupleId, setCoupleId] = useState<string | null>(null);
  // Single auth resolution for the app: set once the persisted session
  // restores (or a fresh anonymous sign-in completes). Screens stay on
  // "loading" until then instead of acting on a null user.
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
      } else {
        signInAnonymously(auth).catch((e) =>
          console.warn("[auth] sign-in failed", e),
        );
      }
    });
    return unsubscribe;
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const [storedCoupleId, profile] = await Promise.all([
        AsyncStorage.getItem(COUPLE_ID_KEY),
        AsyncStorage.getItem("userProfile"),
      ]);
      setCoupleId(storedCoupleId);
      // Three gates, evaluated in order: no code -> Pair; code but no
      // local profile -> Profile (resumes here after a mid-profile kill,
      // since the code is saved at pair time); both -> tabs.
      const next = !storedCoupleId ? "pair" : profile ? "tabs" : "profile";
      setStatus(next);
    } catch (e) {
      // Without this the app stays on the splash screen forever when storage
      // throws — safest fallback is to send the user through onboarding.
      console.warn("[onboarding] failed to load status", e);
      setCoupleId(null);
      setStatus("pair");
    }
  }, []);

  useEffect(() => {
    if (uid) refreshStatus();
  }, [uid, refreshStatus]);

  return (
    <OnboardingContext.Provider value={{ status, coupleId, uid, refreshStatus }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
