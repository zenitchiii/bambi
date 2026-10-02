import type { Gender } from "@/lib/profileSync";

// Lookup keyed by gender: a later they/their option needs one new entry
// here plus one picker option — no if-chains scattered across screens.
const POSSESSIVE: Record<Gender, string> = {
  woman: "her",
  man: "his",
};

// Missing or unknown gender never guesses — it falls back to "their".
export function getPossessive(gender: Gender | null | undefined): string {
  if (!gender) return "their";
  return POSSESSIVE[gender] ?? "their";
}

// Capitalize at the point of use ("her birthday" vs "Her Birthday").
export function cap(word: string): string {
  return word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word;
}
