import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type SidebarContextValue = {
  open: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined,
);

// Single source of truth for the drawer. Mounted once around the tab
// navigator, so every tab shares it instead of each screen owning its own
// `sidebarOpen` boolean. The value is memoized, and screens never subscribe
// to it directly (only MenuButton + SidebarHost do), so toggling the drawer
// doesn't re-render your screens.
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openSidebar, closeSidebar }),
    [open, openSidebar, closeSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
