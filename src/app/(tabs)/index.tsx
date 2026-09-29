import AboutModal from "@/components/AboutModal";
import BucketListModal from "@/components/BucketListModal";
import EditProfileModal from "@/components/EditProfileModal";
import FutureFeaturesModal from "@/components/FutureFeaturesModal";
import PhotoSlideshow from "@/components/home/PhotoSlideshow";
import ScreenContainer from "@/components/ScreenContainer";
import Sidebar from "@/components/Sidebar";
import TabSwipeable from "@/components/TabSwipeable";
import { APP_START_DATE } from "@/constants/date";
import { useProfile } from "@/context/ProfileContext";
import { usePartnerProfile } from "@/hooks/usePartnerProfile";
import { useSharedCoupleData } from "@/hooks/useSharedCoupleData";
import {
  daysUntil,
  formatDateISO,
  getMonthsAndDays,
  getMonthsaryOccurrences,
  getNextOccurrence,
  getYearlyOccurrences,
  getYearlyOccurrencesFromMonthDay,
} from "@/utils/dateMath";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import {
  CalendarHeart,
  HandHeart,
  Heart,
  HeartHandshake,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const MEMORIES_KEY = "memories";
const UPCOMING_WINDOW_DAYS = 30;
const SIDEBAR_EDGE_WIDTH = 40;
const [START_YEAR] = APP_START_DATE.split("-").map(Number);

const HERO_HEIGHT = Dimensions.get("window").width;

export default function HomeScreen() {
  const { profile } = useProfile();
  const partner = usePartnerProfile();

  const { data: shared, update: updateShared } = useSharedCoupleData();
  const { dateNight, customEvents, lastPoke, bucketList } = shared;
  const bucketItems = bucketList ?? [];
  const bucketDone = bucketItems.filter((i) => i.completed).length;
  const [onThisDay, setOnThisDay] = useState<{ uri: string; date: string }[]>(
    [],
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [futureFeaturesOpen, setFutureFeaturesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [bucketOpen, setBucketOpen] = useState(false);

  // The drawer edge swipe lives inside TabSwipeable (onEdgeSwipe) sharing
  // the pager's single gesture — a separate PanResponder overlay starved
  // (and was starved by) the pager at the native level, which is why the
  // drawer stopped opening.

  const pokeScale = useSharedValue(1);
  const pokeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pokeScale.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(MEMORIES_KEY)
        .then((saved) => {
          if (!active) return;
          if (!saved) return setOnThisDay([]);
          const parsed: unknown = JSON.parse(saved);
          if (!Array.isArray(parsed)) return setOnThisDay([]);
          const [, todayM, todayD] = formatDateISO(new Date()).split("-");
          const matches = parsed.filter((m: any) => {
            // Corrupt entries (missing/malformed date) previously crashed
            // this filter with "cannot read property split of undefined".
            if (typeof m?.date !== "string") return false;
            const [y, mo, d] = m.date.split("-");
            return (
              mo === todayM &&
              d === todayD &&
              y !== new Date().getFullYear().toString()
            );
          });
          setOnThisDay(matches);
        })
        .catch((e) => console.warn("[home] failed to load memories", e));
      return () => {
        active = false;
      };
    }, []),
  );

  if (!profile) return null;

  const yourBirthday = formatDateISO(new Date(profile.birthday));
  const anniversaryDate = formatDateISO(new Date(profile.anniversary));

  const { years, months, days } = getMonthsAndDays(anniversaryDate);

  const nextMonthsary = getNextOccurrence(
    getMonthsaryOccurrences(anniversaryDate).filter((d) => d >= APP_START_DATE),
  );
  const nextYourBirthday = getNextOccurrence(
    getYearlyOccurrences(yourBirthday).filter((d) => d >= APP_START_DATE),
  );
  const nextPartnerBirthday = partner
    ? getNextOccurrence(
        getYearlyOccurrences(formatDateISO(new Date(partner.birthday))).filter(
          (d) => d >= APP_START_DATE,
        ),
      )
    : null;
  const customEventItems = Object.entries(customEvents)
    .map(([monthDay, label]) => {
      if (typeof label !== "string" || label.trim() === "") return null;
      const next = getNextOccurrence(
        getYearlyOccurrencesFromMonthDay(monthDay, START_YEAR, 5).filter(
          (d) => d >= APP_START_DATE,
        ),
      );
      return next ? { label: label.trim(), days: daysUntil(next) } : null;
    })
    .filter((item): item is { label: string; days: number } => !!item);

  const upcoming = [
    dateNight && { label: "Next Date", days: daysUntil(dateNight) },
    nextMonthsary && {
      label: "Next Monthsary",
      days: daysUntil(nextMonthsary),
    },
    nextYourBirthday && {
      label: "Your Birthday",
      days: daysUntil(nextYourBirthday),
    },
    nextPartnerBirthday && {
      label: "Her Birthday",
      days: daysUntil(nextPartnerBirthday),
    },
    ...customEventItems,
  ].filter(
    (item): item is { label: string; days: number } =>
      !!item &&
      typeof item.label === "string" &&
      item.label.trim() !== "" &&
      item.days >= 0 &&
      item.days <= UPCOMING_WINDOW_DAYS,
  );

  const sendPoke = () => {
    pokeScale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    updateShared({ lastPoke: Date.now() });
  };

  function formatPokeTime(ts: number): string {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  return (
    <View style={{ flex: 1 }}>
      <TabSwipeable
        onSwipeLeft={() => router.push("/calendar")}
        rightLabel="Calendar"
        onEdgeSwipe={() => setSidebarOpen(true)}
        edgeWidth={SIDEBAR_EDGE_WIDTH}
        enabled={
          !sidebarOpen &&
          !editProfileOpen &&
          !futureFeaturesOpen &&
          !aboutOpen &&
          !bucketOpen
        }
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.hero, { height: HERO_HEIGHT }]}>
            <PhotoSlideshow
              height={HERO_HEIGHT}
              rounded={false}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["transparent", "#fff"]}
              style={styles.heroFade}
              pointerEvents="none"
            />
          </View>

          <ScreenContainer>
          <View style={[styles.card, styles.topCard]}>
            <CalendarHeart color="#e75480" size={28} />
            <Text style={styles.cardTitle}>Together for</Text>
            <Text style={styles.cardBig}>
              {years > 0 ? `${years} year${years === 1 ? "" : "s"}, ` : ""}
              {months} month{months === 1 ? "" : "s"}, {days} day
              {days === 1 ? "" : "s"}
            </Text>
          </View>

          {onThisDay.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>On this day</Text>
              <Image
                source={{ uri: onThisDay[0].uri }}
                style={{ width: "100%", height: 160, borderRadius: 12 }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          )}

          <View style={styles.card}>
            <Heart color="#e75480" size={28} />
            <Text style={styles.cardTitle}>Coming up this month</Text>
            {upcoming.length === 0 ? (
              <Text style={styles.cardHint}>
                Nothing in the next {UPCOMING_WINDOW_DAYS} days
              </Text>
            ) : (
              upcoming
                .sort((a, b) => a.days - b.days)
                .map((item) => {
                  if (!item.label?.trim()) return null;
                  return (
                    <Text
                      key={`${item.label}-${item.days}`}
                      style={styles.upcomingRow}
                    >
                      {item.label} —{" "}
                      {item.days === 0
                        ? "today"
                        : `${item.days} day${item.days === 1 ? "" : "s"}`}
                    </Text>
                  );
                })
            )}
          </View>

          <View style={styles.card}>
            <HeartHandshake color="#e75480" size={28} />
            <Text style={styles.cardTitle}>Bucket List</Text>
            <Text style={styles.cardBig}>
              {bucketItems.length === 0
                ? "Do something later together!"
                : `${bucketDone} of ${bucketItems.length} completed`}
            </Text>
            {bucketItems.length > 0 && (
              <View style={styles.bucketTrack}>
                <View
                  style={[
                    styles.bucketFill,
                    { flex: bucketDone / bucketItems.length },
                  ]}
                />
              </View>
            )}
            <Pressable
              style={[styles.cardButton, { alignSelf: "flex-end" }]}
              onPress={() => setBucketOpen(true)}
            >
              <Text style={styles.cardButtonText}>
                {bucketItems.length === 0 ? "Add a dream" : "Open list"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.pokeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Miss you button</Text>
                <Text style={styles.cardBig}>
                  {lastPoke
                    ? `Missed you ${formatPokeTime(lastPoke)}`
                    : "Tap if you miss them"}
                </Text>
              </View>

              <Pressable onPress={sendPoke}>
                <Animated.View style={[styles.pokeButton, pokeAnimStyle]}>
                  <HandHeart color="#fff" size={16} />
                  <Text style={styles.pokeButtonText}>I Miss You!</Text>
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </ScreenContainer>
        </View>
      </TabSwipeable>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onEditProfile={() => {
          setSidebarOpen(false);
          setEditProfileOpen(true);
        }}
        onFutureFeatures={() => {
          setSidebarOpen(false);
          setFutureFeaturesOpen(true);
        }}
        onAbout={() => {
          setSidebarOpen(false);
          setAboutOpen(true);
        }}
      />
      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
      <FutureFeaturesModal
        visible={futureFeaturesOpen}
        onClose={() => setFutureFeaturesOpen(false)}
      />
      <BucketListModal
        visible={bucketOpen}
        onClose={() => setBucketOpen(false)}
      />
      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: "#fff5f7", borderRadius: 16, padding: 20, gap: 4 },
  topCard: { marginTop: -20 },
  cardTitle: { fontSize: 14, color: "#888" },
  cardBig: { fontSize: 20, fontWeight: "600", marginTop: 2 },
  cardHint: { fontSize: 12, color: "#aaa" },
  upcomingRow: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  bucketTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f3dde4",
    marginTop: 8,
  },
  bucketFill: { backgroundColor: "#e75480" },
  bucketRest: { backgroundColor: "transparent" },
  menuButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
    padding: 8,
  },
  hero: { width: "100%" },
  heroFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 30 },
  pokeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pokeButton: {
    backgroundColor: "#e75480",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pokeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  cardButton: {
    marginTop: 10,
    backgroundColor: "#e75480",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  cardButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
