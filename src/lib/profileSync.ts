import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";

export type Gender = "woman" | "man";

export type SyncedProfile = {
  name: string;
  birthday: string;
  anniversary: string;
  // Absent = not set (profiles synced before this field existed).
  gender?: Gender;
};

// Writes ONLY the caller's own slot (picked by comparing uid to memberA),
// as a field-level update — the partner's slot is never touched.
export async function writeOwnProfile(
  coupleId: string,
  myUid: string,
  profile: SyncedProfile,
) {
  const ref = doc(db, "couples", coupleId);
  const snap = await getDoc(ref);
  const slot = snap.exists() && snap.data().memberA === myUid ? "profileA" : "profileB";
  await updateDoc(ref, { [slot]: profile });
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
