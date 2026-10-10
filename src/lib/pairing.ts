import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
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
  updates: Partial<
    Omit<SharedCoupleData, "memberA" | "memberB" | "profileA" | "profileB">
  >,
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

// Single writer for v3 cycle data. updateDoc REPLACES the whole cycle map
// (setDoc-merge deep-merges nested maps, which resurrected cleared
// overrides). The doc already exists at this point. Logs, when present,
// are pruned to ~180 days on the way in.
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
  // `undefined` values are illegal in write payloads, so the pruned logs
  // key is spread conditionally rather than set to undefined.
  const { logs, ...rest } = cycle;
  await updateDoc(doc(db, "couples", coupleId), {
    cycle: {
      ...rest,
      ...(logs ? { logs: pruneLogs(logs, formatDateISO(new Date())) } : {}),
    },
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
// retrying on the (rare) 6-digit collision. Throws a user-readable error
// after several attempts.
export async function createCoupleCode(myUid: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const snap = await getDoc(doc(db, "couples", code));
    if (!snap.exists()) {
      await setDoc(doc(db, "couples", code), {
        createdAt: serverTimestamp(),
        memberA: myUid,
        memberB: null,
      });
      return code;
    }
  }
  throw new Error("Couldn't find a free code — try again.");
}

// Called on the second phone when entering a code. Distinct outcomes so
// the UI can say exactly what happened; "own-code" stays client-side
// (the rules can't tell self-pairing from a legit claim).
export async function joinCoupleCode(
  code: string,
  myUid: string,
): Promise<"ok" | "missing" | "claimed" | "own-code"> {
  const ref = doc(db, "couples", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "missing";
  const data = snap.data();
  if (data.memberA === myUid) return "own-code";
  if (data.memberB && data.memberB !== myUid) return "claimed";
  await updateDoc(ref, { memberB: myUid });
  return "ok";
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

// Pending rejoin profile stash: the chosen slot's synced profile, so the
// Profile step can prefill name/birthday and lock gender. Removed on save.
export const REJOIN_PREFILL_KEY = "rejoinPrefill";

export type RejoinSlot = "memberA" | "memberB";

// Returning user reclaims their old slot after reinstall/clear-data: exactly
// one field changes to their new uid. The transaction re-reads and asserts
// the slot still holds the expected old uid and the other slot is intact —
// the race loser gets "claimed", never a silent steal.
export async function rejoinSlot(
  code: string,
  slot: RejoinSlot,
  expectedOldUid: string,
  myUid: string,
): Promise<"ok" | "claimed" | "missing" | "empty"> {
  if (expectedOldUid === myUid) return "ok"; // already mine (retry after success)
  const ref = doc(db, "couples", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return "missing";
    const data = snap.data();
    const other = slot === "memberA" ? "memberB" : "memberA";
    if (data[slot] !== expectedOldUid) return "claimed";
    // Partner never joined (or their slot was wiped): nothing to rejoin.
    if (typeof data[other] !== "string" || !data[other]) return "empty";
    tx.update(ref, { [slot]: myUid });
    return "ok";
  });
}

export async function isMemberA(
  coupleId: string,
  uid: string,
): Promise<boolean> {
  const snap = await getDoc(doc(db, "couples", coupleId));
  return snap.exists() && snap.data().memberA === uid;
}
