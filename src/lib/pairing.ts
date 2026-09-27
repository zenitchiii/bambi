import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const COUPLE_ID_KEY = "coupleId";

export type SharedCoupleData = {
  dateNight: string | null;
  notes: Record<string, string>;
  customEvents: Record<string, string>;
  lastPoke: number | null;
};

const DEFAULT_SHARED_DATA: SharedCoupleData = {
  dateNight: null,
  notes: {},
  customEvents: {},
  lastPoke: null,
};

export async function updateSharedData(
  coupleId: string,
  updates: Partial<SharedCoupleData>,
) {
  await ensureSignedIn();
  await setDoc(doc(db, "couples", coupleId), updates, { merge: true });
}

export function watchSharedData(
  coupleId: string,
  onUpdate: (data: SharedCoupleData) => void,
) {
  return onSnapshot(doc(db, "couples", coupleId), (snap) => {
    if (!snap.exists()) return;
    onUpdate({ ...DEFAULT_SHARED_DATA, ...snap.data() });
  });
}
// Signs this device in anonymously if it isn't already, and resolves once
// we have a stable Firebase UID to work with
export function ensureSignedIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user.uid);
      } else {
        signInAnonymously(auth)
          .then((cred) => resolve(cred.user.uid))
          .catch(reject);
      }
    });
  });
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

// Creates a new couple document with this device as the first member,
// and returns the code to share with your partner
export async function createCoupleCode(myUid: string): Promise<string> {
  const code = generateCode();
  await setDoc(doc(db, "couples", code), {
    createdAt: serverTimestamp(),
    memberA: myUid,
    memberB: null,
  });
  return code;
}

// Called on the second phone when entering a code — links this device as
// memberB, as long as the code exists and isn't already taken
export async function joinCoupleCode(
  code: string,
  myUid: string,
): Promise<boolean> {
  const ref = doc(db, "couples", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const data = snap.data();
  if (data.memberB && data.memberB !== myUid) return false; // already paired to someone else
  await updateDoc(ref, { memberB: myUid });
  return true;
}

// Watches a couple doc in real time — used by the first phone to know the
// moment the second phone joins, without needing to manually refresh
export function watchCouple(code: string, onUpdate: (data: any) => void) {
  return onSnapshot(doc(db, "couples", code), (snap) => {
    if (snap.exists()) onUpdate(snap.data());
  });
}

export { COUPLE_ID_KEY };

export async function isMemberA(
  coupleId: string,
  uid: string,
): Promise<boolean> {
  const snap = await getDoc(doc(db, "couples", coupleId));
  return snap.exists() && snap.data().memberA === uid;
}
