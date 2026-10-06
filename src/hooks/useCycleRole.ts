import { useCoupleData } from "@/context/CoupleDataContext";
import { useProfile } from "@/context/ProfileContext";
import { auth } from "@/lib/firebase";
import { useMemo } from "react";

export type CycleRole = "owner" | "viewer" | "hidden" | "loading";

// Both partners may SEE cycle info; only the owner may edit it.
export function canSeeCycle(role: CycleRole): boolean {
  return role === "owner" || role === "viewer";
}

// Who may log vs only watch, derived from uid-bound doc slots — never from
// a one-time check. "Me" is my uid's slot, "partner" is always the OTHER
// slot, so this phone can never mistake its own profile for the partner's.
// One memo, no listeners or state: it recomputes when the shared snapshot
// (single provider subscription) or the local profile changes.
export function useCycleRole(): CycleRole {
  const { profile } = useProfile();
  const { data } = useCoupleData();

  return useMemo(() => {
    // Stable within an install; null only before the first sign-in.
    const uid = auth.currentUser?.uid ?? null;
    if (uid === null) return "loading";
    // Doc not arrived yet: members unknown (distinct from "known but unset",
    // which stays "hidden" so the UI never flashes a wrong role).
    if (data.memberA === null && data.memberB === null) return "loading";
    const amA = data.memberA === uid;
    const mySynced = amA ? data.profileA : data.profileB;
    const partnerSynced = amA ? data.profileB : data.profileA;
    // Local first (written at onboarding before the first sync lands),
    // synced slot as backup.
    const mine = profile?.gender ?? mySynced?.gender ?? null;
    const theirs = partnerSynced?.gender ?? null;
    if (mine === "woman" && theirs === "man") return "owner";
    if (mine === "man" && theirs === "woman") return "viewer";
    return "hidden";
  }, [data, profile]);
}
