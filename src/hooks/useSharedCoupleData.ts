import { useCoupleData } from "@/context/CoupleDataContext";

// Thin alias so existing screens keep their import. The single onSnapshot
// lives in CoupleDataProvider; this subscribes to nothing.
export function useSharedCoupleData() {
  return useCoupleData();
}
