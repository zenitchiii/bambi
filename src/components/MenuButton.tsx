import { memo } from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Menu } from "lucide-react-native";
import { useSidebar } from "@/context/SidebarContext";

type Props = {
  // Lets callers position it (e.g. absolute over the Home hero) without
  // forking the component.
  style?: StyleProp<ViewStyle>;
};

// The single menu button used on every tab. Memoized + context-driven: it
// only re-renders when the sidebar state it actually reads changes, and
// screens that render it don't subscribe to anything themselves.
function MenuButton({ style }: Props) {
  const { openSidebar } = useSidebar();

  return (
    <Pressable
      style={[styles.button, style]}
      onPress={openSidebar}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
    >
      <Menu color="#fff" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#e75480",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default memo(MenuButton);
