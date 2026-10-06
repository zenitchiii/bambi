import { useOnboarding } from "@/context/OnboardingContext";
import {
  BucketListItem,
  SharedCoupleData,
  normalizeCycle,
  updateSharedData,
  watchSharedData,
} from "@/lib/pairing";
import { formatDateISO } from "@/utils/dateMath";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DEFAULT: SharedCoupleData = {
  dateNight: null,
  notes: {},
  customEvents: {},
  lastPoke: null,
  bucketList: [],
  cycle: { periodStarts: [], periods: [] },
  memberA: null,
  memberB: null,
  profileA: null,
  profileB: null,
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
    // Identity slots may be absent on older docs — null, never undefined.
    memberA: typeof data.memberA === "string" ? data.memberA : null,
    memberB: typeof data.memberB === "string" ? data.memberB : null,
    profileA:
      data.profileA && typeof data.profileA === "object" ? data.profileA : null,
    profileB:
      data.profileB && typeof data.profileB === "object" ? data.profileB : null,
  };
}

type CoupleDataContextValue = {
  data: SharedCoupleData;
  update: (updates: Partial<SharedCoupleData>) => void;
  addBucketItem: (title: string) => void;
  toggleBucketItem: (id: string) => void;
  deleteBucketItem: (id: string) => void;
};

const CoupleDataContext = createContext<CoupleDataContextValue | undefined>(
  undefined,
);

// One onSnapshot for the whole app, keyed by coupleId. Returning the
// unsubscribe re-subscribes on code change and cleans up on unmount;
// resetting to DEFAULT on null keeps an ex-couple's data from flashing
// after unpair.
export function CoupleDataProvider({ children }: { children: ReactNode }) {
  const { coupleId } = useOnboarding();
  const [data, setData] = useState<SharedCoupleData>(DEFAULT);

  useEffect(() => {
    if (!coupleId) {
      setData(DEFAULT);
      return;
    }
    return watchSharedData(coupleId, (incoming) =>
      setData(normalize(incoming)),
    );
  }, [coupleId]);

  const update = useCallback(
    (updates: Partial<SharedCoupleData>) => {
      setData((prev) => normalize({ ...prev, ...updates })); // instant local feedback
      // Fire-and-forget on purpose, but never let a Firestore failure become
      // an unhandled rejection — the snapshot listener reconciles on retry.
      if (coupleId) updateSharedData(coupleId, updates).catch(console.warn);
    },
    [coupleId],
  );

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
      persistList([...data.bucketList, item]);
    },
    [data.bucketList, persistList],
  );

  const toggleBucketItem = useCallback(
    (id: string) => {
      persistList(
        data.bucketList.map((item) =>
          item.id === id
            ? {
                ...item,
                completed: !item.completed,
                completedAt: !item.completed ? Date.now() : null,
              }
            : item,
        ),
      );
    },
    [data.bucketList, persistList],
  );

  const deleteBucketItem = useCallback(
    (id: string) => {
      persistList(data.bucketList.filter((item) => item.id !== id));
    },
    [data.bucketList, persistList],
  );

  const value = useMemo(
    () => ({ data, update, addBucketItem, toggleBucketItem, deleteBucketItem }),
    [data, update, addBucketItem, toggleBucketItem, deleteBucketItem],
  );

  return (
    <CoupleDataContext.Provider value={value}>
      {children}
    </CoupleDataContext.Provider>
  );
}

export function useCoupleData() {
  const ctx = useContext(CoupleDataContext);
  if (!ctx)
    throw new Error("useCoupleData must be used within CoupleDataProvider");
  return ctx;
}
