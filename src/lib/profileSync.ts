import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export type Gender = "woman" | "man";

export type SyncedProfile = {
  name: string;
  birthday: string;
  anniversary: string;
  // Absent = not set (profiles synced before this field existed).
  gender?: Gender;
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
