import { COUPLE_ID_KEY } from "@/lib/pairing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type OnboardingStatus = "loading" | "onboarded" | "needs-onboarding";

type OnboardingContextValue = {
  status: OnboardingStatus;
  coupleId: string | null;
  refreshStatus: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const [coupleId, setCoupleId] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const [storedCoupleId, profile] = await Promise.all([
      AsyncStorage.getItem(COUPLE_ID_KEY),
      AsyncStorage.getItem("userProfile"),
    ]);
    setCoupleId(storedCoupleId);
    setStatus(storedCoupleId && profile ? "onboarded" : "needs-onboarding");
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <OnboardingContext.Provider value={{ status, coupleId, refreshStatus }}>
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
