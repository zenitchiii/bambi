import { useProfile } from "@/context/ProfileContext";
import { usePartnerProfile } from "@/hooks/usePartnerProfile";

export type CycleRole = "owner" | "viewer" | "hidden";

// Who may log vs only watch, derived from both sides' synced genders.
// Owner ⟺ I'm "woman" and my partner is "man". Every other combination —
// unset, unknown (partner profile not synced yet), neither-woman, or
// both-woman — is "hidden" with a hint, per spec. No extra cases invented.
export function useCycleRole(): CycleRole {
  const { profile } = useProfile();
  const partner = usePartnerProfile();

  const mine = profile?.gender ?? null;
  const theirs = partner?.gender ?? null;

  if (mine === "woman" && theirs === "man") return "owner";
  if (mine === "man" && theirs === "woman") return "viewer";
  return "hidden";
}
