// src/context/ProfileContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";

type Profile = {
  name: string;
  photoUri: string | null;
  birthday: string; // ISO string
  anniversary: string; // ISO string
};

type ProfileContextValue = {
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(
  undefined,
);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("userProfile");
      setProfile(raw ? JSON.parse(raw) : null);
    } catch (e) {
      // Storage failure previously left callers hanging with an unhandled
      // rejection — fall back to null instead.
      console.warn("[profile] failed to load", e);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <ProfileContext.Provider value={{ profile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
