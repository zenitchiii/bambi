import { db, storage } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export type SyncedProfile = {
  name: string;
  photoURL: string | null;
  birthday: string;
  anniversary: string;
};

// Converts a local file URI into a blob Firebase's SDK can upload —
// standard approach for Expo, since the SDK has no direct "upload this
// file path" method
export async function uploadProfilePhoto(
  coupleId: string,
  uid: string,
  localUri: string,
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `couples/${coupleId}/${uid}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

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
  return onSnapshot(doc(db, "couples", coupleId), (snap) => {
    if (!snap.exists()) return onUpdate(null);
    const data = snap.data();
    onUpdate((isMemberA ? data.profileB : data.profileA) ?? null);
  });
}
