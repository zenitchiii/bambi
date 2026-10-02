import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { formatDateISO } from "@/utils/dateMath";

// Single clock for "today" across the cycle feature. A per-render
// `new Date()` goes stale if the app sleeps past midnight, so this refreshes
// when the app comes back to the foreground. Same-string sets bail out of
// re-renders on their own; the listener is removed on unmount.
export function useToday(): string {
  const [today, setToday] = useState(() => formatDateISO(new Date()));

  useEffect(() => {
    const refresh = () => setToday(formatDateISO(new Date()));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    refresh();
    return () => sub.remove();
  }, []);

  return today;
}
