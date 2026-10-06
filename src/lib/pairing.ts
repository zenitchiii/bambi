import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { normalizePeriods, pruneLogs } from "@/utils/cycle";
// Single definition lives in cycle.ts (dependency-free); re-exported here
// so existing `from "@/lib/pairing"` imports keep working.
import type { CycleLog, CyclePeriod } from "@/utils/cycle";
export type { CycleLog, CyclePeriod } from "@/utils/cycle";
import { formatDateISO } from "@/utils/dateMath";
import type { SyncedProfile } from "@/lib/profileSync";

const COUPLE_ID_KEY = "coupleId";

export interface BucketListItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

export interface CycleData {
  // Writer version; set on every versioned write, absent on older docs.
  v?: 2 | 3;
  // Legacy read path only. Writers persist `periods` and never touch this;
  // normalize derives it from records so pre-redesign UI keeps working.
  periodStarts?: string[];
  // Per-period records (v2+). End absent = ongoing.
  periods?: CyclePeriod[];
  // Dormant until the logs phase: tolerated on read, never written yet.
  logs?: CycleLog[];
  // Manual overrides (days). UI falls back to 28 / 5 when absent.
  cycleLength?: number;
  periodLength?: number;
}

export type SharedCoupleData = {
  dateNight: string | null;
  notes: Record<string, string>;
  customEvents: Record<string, string>;
  lastPoke: number | null;
  bucketList: BucketListItem[];
  cycle: CycleData;
  // Identity slots from the couple doc (read-only locally; writers never
  // send these — update() only writes the explicit partial it receives).
  memberA: string | null;
  memberB: string | null;
  profileA: SyncedProfile | null;
  profileB: SyncedProfile | null;
};

const DEFAULT_SHARED_DATA: SharedCoupleData = {
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
  return onSnapshot(
    doc(db, "couples", coupleId),
    (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data();
      onUpdate({
        ...DEFAULT_SHARED_DATA,
        ...raw,
        // Older couple docs predate bucketList — fall back to [] so the
        // UI never has to null-check.
        bucketList: Array.isArray(raw.bucketList) ? raw.bucketList : [],
        cycle: normalizeCycle(raw.cycle, formatDateISO(new Date())),
      });
    },
    // Without this, permission/network errors fail silently and sync just
    // looks "stuck".
    (error) => console.warn("[watchSharedData]", error),
  );
}
// Couple docs written before a field existed (or partial writes) must load
// as sane defaults so the UI never null-checks. Period logic lives in
// cycle.ts; this is just the Firestore-facing adapter. `periodStarts` is
// derived from the records so pre-redesign readers keep working through
// the migration.
export function normalizeCycle(raw: unknown, todayISO: string): CycleData {
  if (!raw || typeof raw !== "object") {
    return { periodStarts: [], periods: [] };
  }
  const c = raw as Partial<CycleData>;
  const periods = normalizePeriods(raw, todayISO);
  return {
    periodStarts: periods.map((p) => p.start),
    periods,
    // Logs are dormant: tolerated so future data survives reads, but this
    // layer never interprets them (phase 5 owns log validation + writes).
    ...(Array.isArray(c.logs) ? { logs: c.logs } : {}),
    ...(typeof c.cycleLength === "number"
      ? { cycleLength: c.cycleLength }
      : {}),
    ...(typeof c.periodLength === "number"
      ? { periodLength: c.periodLength }
      : {}),
  };
}

// Single writer for v3 cycle data. Replaces the whole cycle object and
// deletes the legacy periodStarts field on first write (idempotent after
// that); merge keeps every other top-level couple field untouched. Logs,
// when present, are pruned to ~180 days on the way in.
export async function writeCycle(
  coupleId: string,
  cycle: {
    v: 3;
    periods: CyclePeriod[];
    logs?: CycleLog[];
    cycleLength?: number;
    periodLength?: number;
  },
) {
  await ensureSignedIn();
  // `undefined` values are illegal in setDoc payloads, so the pruned logs
  // key is spread conditionally rather than set to undefined.
  const { logs, ...rest } = cycle;
  await setDoc(
    doc(db, "couples", coupleId),
    {
      cycle: {
        ...rest,
        ...(logs ? { logs: pruneLogs(logs, formatDateISO(new Date())) } : {}),
        periodStarts: deleteField(),
      },
    },
    { merge: true },
  );
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
  return onSnapshot(
    doc(db, "couples", code),
    (snap) => {
      if (snap.exists()) onUpdate(snap.data());
    },
    (error) => console.warn("[watchCouple]", error),
  );
}

export { COUPLE_ID_KEY };

export async function isMemberA(
  coupleId: string,
  uid: string,
): Promise<boolean> {
  const snap = await getDoc(doc(db, "couples", coupleId));
  return snap.exists() && snap.data().memberA === uid;
}
