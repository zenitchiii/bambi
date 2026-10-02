import { useOnboarding } from "@/context/OnboardingContext";
import {
    BucketListItem,
    SharedCoupleData,
    normalizeCycle,
    updateSharedData,
    watchSharedData,
} from "@/lib/pairing";
import { formatDateISO } from "@/utils/dateMath";
import { useCallback, useEffect, useState } from "react";

const DEFAULT: SharedCoupleData = {
  dateNight: null,
  notes: {},
  customEvents: {},
  lastPoke: null,
  bucketList: [],
  cycle: { periodStarts: [], periods: [] },
};

function normalize(data: SharedCoupleData): SharedCoupleData {
  return {
    ...DEFAULT,
    ...data,
    // A doc written by an older client (or a partial write) can carry null
    // for these map fields — guard so Object.entries call sites never crash.
    notes: data.notes ?? {},
    customEvents: data.customEvents ?? {},
    bucketList: Array.isArray(data.bucketList) ? data.bucketList : [],
    // Cyclical timeline needs "today" (future dates are invalid records).
    cycle: normalizeCycle(data.cycle, formatDateISO(new Date())),
  };
}

export function useSharedCoupleData() {
  const { coupleId } = useOnboarding();
  const [data, setData] = useState<SharedCoupleData>(DEFAULT);

  useEffect(() => {
    if (!coupleId) return;
    return watchSharedData(coupleId, (incoming) =>
      setData(normalize(incoming)),
    );
  }, [coupleId]);

  const update = (updates: Partial<SharedCoupleData>) => {
    setData((prev) => normalize({ ...prev, ...updates })); // instant local feedback
    // Fire-and-forget on purpose, but never let a Firestore failure become
    // an unhandled rejection — the snapshot listener reconciles on retry.
    if (coupleId) updateSharedData(coupleId, updates).catch(console.warn);
  };

  const persistList = useCallback(
    (next: BucketListItem[]) => {
      setData((prev) => ({ ...prev, bucketList: next }));
      if (coupleId)
        updateSharedData(coupleId, { bucketList: next }).catch(console.warn);
    },
    [coupleId],
  );

  const addBucketItem = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const item: BucketListItem = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        title: trimmed.slice(0, 120),
        completed: false,
        createdAt: Date.now(),
        completedAt: null,
      };
      const next = [...(data.bucketList ?? []), item];
      persistList(next);
    },
    [data.bucketList, persistList],
  );

  const toggleBucketItem = useCallback(
    (id: string) => {
      const next = (data.bucketList ?? []).map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? Date.now() : null,
            }
          : item,
      );
      persistList(next);
    },
    [data.bucketList, persistList],
  );

  const deleteBucketItem = useCallback(
    (id: string) => {
      const next = (data.bucketList ?? []).filter((item) => item.id !== id);
      persistList(next);
    },
    [data.bucketList, persistList],
  );

  return { data, update, addBucketItem, toggleBucketItem, deleteBucketItem };
}
