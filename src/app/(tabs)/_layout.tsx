import { Tabs } from "expo-router";
import { Calendar, Flower2, Home, Images } from "lucide-react-native";
import { type ReactNode } from "react";
import { Pressable, PressableProps } from "react-native";
import SidebarHost from "@/components/SidebarHost";
import { SidebarProvider } from "@/context/SidebarContext";
import { useCycleRole } from "@/hooks/useCycleRole";

// Ripple-free tab button, defined once at module scope so it keeps a stable
// identity across renders. The navigator injects
// `android_ripple: { borderless: true }` into EVERY button it renders
// (BottomTabItem.js) — including custom ones — and RN's Pressable honors
// android_ripple natively, so `{...rest}` was smuggling the gray circle
// through. Stripping it here is the actual removal; plain Pressable has no
// pressColor concept, so there is nothing else to neutralize.
function NoRippleTabButton({
  children,
  style,
  href: _href,
  android_ripple: _ripple,
  ...rest
}: PressableProps & {
  children?: ReactNode;
  href?: unknown;
  android_ripple?: unknown;
}) {
  return (
    <Pressable {...rest} style={style}>
      {children}
    </Pressable>
  );
}

export default function TabLayout() {
  const role = useCycleRole();
  // Owner-only tab: viewer, hidden and loading all hide it (href null
  // removes the button; the route itself stays for deep links).
  const hideCycle = role !== "owner";

  return (
    <SidebarProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#e75480",
          tabBarInactiveTintColor: "#999",
          tabBarButton: NoRippleTabButton,
          // Built-in scene transition: slight horizontal shift over 220ms
          // instead of the default snap ('none').
          animation: "shift",
          transitionSpec: {
            animation: "timing",
            config: { duration: 220 },
          },
          tabBarStyle: {
            height: 80,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            // Stroke highlight: pink + heavier when focused, gray + lighter
            // otherwise. (The pink/gray itself comes from the tint colors
            // above via `color`.) No fill, so inner details stay crisp.
            tabBarIcon: ({ color, size, focused }) => (
              <Home
                color={color}
                size={size}
                fill="none"
                strokeWidth={focused ? 2.5 : 1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ color, size, focused }) => (
              <Calendar
                color={color}
                size={size}
                fill="none"
                strokeWidth={focused ? 2.5 : 1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="memories"
          options={{
            title: "Memories",
            tabBarIcon: ({ color, size, focused }) => (
              <Images
                color={color}
                size={size}
                fill="none"
                strokeWidth={focused ? 2.5 : 1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="cycle"
          options={{
            title: "Cycle",
            href: hideCycle ? null : "/cycle",
            tabBarIcon: ({ color, size, focused }) => (
              <Flower2
                color={color}
                size={size}
                fill="none"
                strokeWidth={focused ? 2.5 : 1.75}
              />
            ),
          }}
        />
      </Tabs>
      {/* Mounted once: overlays every tab, driven by SidebarContext. */}
      <SidebarHost />
    </SidebarProvider>
  );
}
