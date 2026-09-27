import { useOnboarding } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";
import { usePartnerProfile } from "@/hooks/usePartnerProfile";
import { COUPLE_ID_KEY } from "@/lib/pairing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Heart, Info, LogOut, User } from "lucide-react-native";
import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const SIDEBAR_WIDTH = Dimensions.get("window").width * 0.75;

type Props = {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onAbout: () => void;
};

export default function Sidebar({
  visible,
  onClose,
  onEditProfile,
  onAbout,
}: Props) {
  const { profile } = useProfile();
  const { coupleId, refreshStatus } = useOnboarding();
  const partner = usePartnerProfile();

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 220 }),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(visible ? 0 : -SIDEBAR_WIDTH, { duration: 220 }),
      },
    ],
  }));

  const handleUnpair = () => {
    Alert.alert(
      "Unpair this device?",
      "You'll need to pair again with an invite code to use the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unpair",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([COUPLE_ID_KEY, "userProfile"]);
            onClose();
            await refreshStatus();
          },
        },
      ],
    );
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.panel, { width: SIDEBAR_WIDTH }, panelStyle]}
      >
        <View style={styles.couplesRow}>
          <View style={styles.personColumn}>
            {profile?.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User color="#e75480" size={22} />
              </View>
            )}
            <Text style={styles.personName}>{profile?.name ?? "You"}</Text>
          </View>

          <Heart color="#e75480" size={20} fill="#e75480" />
          <View style={styles.personColumn}>
            {partner?.photoURL ? (
              <Image source={{ uri: partner.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                + <User color="#bbb" size={22} />
              </View>
            )}
            <Text style={styles.personName}>
              {partner?.name ?? "Waiting..."}
            </Text>
          </View>
        </View>

        {coupleId && (
          <Text style={styles.codeText}>Invite code: {coupleId}</Text>
        )}

        <View style={styles.divider} />

        <Pressable style={styles.item} onPress={onEditProfile}>
          <User color="#e75480" size={20} />
          <Text style={styles.itemText}>Edit Profile</Text>
        </Pressable>

        <Pressable style={styles.item} onPress={onAbout}>
          <Info color="#e75480" size={20} />
          <Text style={styles.itemText}>About</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable style={styles.item} onPress={handleUnpair}>
          <LogOut color="#d9534f" size={20} />
          <Text style={[styles.itemText, { color: "#d9534f" }]}>Unpair</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    padding: 24,
    paddingTop: 60,
    gap: 12,
    backgroundColor: "#fff",
  },
  couplesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },
  personColumn: { alignItems: "center", gap: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  codeText: { fontSize: 12, color: "#999" },
  avatarPlaceholder: {
    backgroundColor: "#fff5f7",
    justifyContent: "center",
    alignItems: "center",
  },
  personName: { fontSize: 13, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  itemText: { fontSize: 16, fontWeight: "600" },
});
