import { useOnboarding } from "@/context/OnboardingContext";
import {
    SharedCoupleData,
    updateSharedData,
    watchSharedData,
} from "@/lib/pairing";
import { useEffect, useState } from "react";

const DEFAULT: SharedCoupleData = {
  dateNight: null,
  notes: {},
  customEvents: {},
  lastPoke: null,
};

export function useSharedCoupleData() {
  const { coupleId } = useOnboarding();
  const [data, setData] = useState<SharedCoupleData>(DEFAULT);

  useEffect(() => {
    if (!coupleId) return;
    return watchSharedData(coupleId, setData);
  }, [coupleId]);

  const update = (updates: Partial<SharedCoupleData>) => {
    setData((prev) => ({ ...prev, ...updates })); // instant local feedback
    if (coupleId) updateSharedData(coupleId, updates);
  };

  return { data, update };
}
