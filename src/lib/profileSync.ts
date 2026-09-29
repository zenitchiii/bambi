import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export type SyncedProfile = {
  name: string;
  birthday: string;
  anniversary: string;
};

export async function syncProfile(
  coupleId: string,
  isMemberA: boolean,
  profile: SyncedProfile,
) {
  const field = isMemberA ? "profileA" : "profileB";
  await setDoc(
    doc(db, "couples", coupleId),
    { [field]: profile },
    { merge: true },
  );
}

export function watchPartnerProfile(
  coupleId: string,
  isMemberA: boolean,
  onUpdate: (profile: SyncedProfile | null) => void,
) {
  return onSnapshot(
    doc(db, "couples", coupleId),
    (snap) => {
      if (!snap.exists()) return onUpdate(null);
      const data = snap.data();
      onUpdate((isMemberA ? data.profileB : data.profileA) ?? null);
    },
    (error) => console.warn("[watchPartnerProfile]", error),
  );
}
