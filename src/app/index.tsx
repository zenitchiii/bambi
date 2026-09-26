import ScreenContainer from "@/components/ScreenContainer";
import {
  ANNIVERSARY_DATE,
  APP_START_DATE,
  PARTNER_BIRTHDAY,
  YOUR_BIRTHDAY,
} from "@/constants/date";
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
import { useFocusEffect } from "expo-router";
import { CalendarHeart, HandHeart, Heart } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const DATE_NIGHT_STORAGE_KEY = "nextDateNight";
const CUSTOM_EVENTS_STORAGE_KEY = "customEvents";
const MEMORIES_KEY = "memories";
const POKE_KEY = "lastPoke";
const UPCOMING_WINDOW_DAYS = 30;
const [START_YEAR] = APP_START_DATE.split("-").map(Number);

export default function HomeScreen() {
  const [dateNight, setDateNight] = useState<string | null>(null);
  const [customEvents, setCustomEvents] = useState<Record<string, string>>({});
  const [lastPoke, setLastPoke] = useState<number | null>(null);
  const [onThisDay, setOnThisDay] = useState<{ uri: string; date: string }[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(DATE_NIGHT_STORAGE_KEY).then((saved) => {
        setDateNight(saved ?? null);
      });
      AsyncStorage.getItem(CUSTOM_EVENTS_STORAGE_KEY).then((saved) => {
        setCustomEvents(saved ? JSON.parse(saved) : {});
      });
      AsyncStorage.getItem(POKE_KEY).then((saved) =>
        setLastPoke(saved ? Number(saved) : null),
      );
      AsyncStorage.getItem(MEMORIES_KEY).then((saved) => {
        if (!saved) return setOnThisDay([]);
        const all = JSON.parse(saved);
        const [, todayM, todayD] = formatDateISO(new Date()).split("-");
        const matches = all.filter((m: any) => {
          const [y, mo, d] = m.date.split("-");
          return (
            mo === todayM &&
            d === todayD &&
            y !== new Date().getFullYear().toString()
          );
        });
        setOnThisDay(matches);
      });
    }, []),
  );

  const { years, months, days } = getMonthsAndDays(ANNIVERSARY_DATE);

  const nextMonthsary = getNextOccurrence(
    getMonthsaryOccurrences(ANNIVERSARY_DATE).filter(
      (d) => d >= APP_START_DATE,
    ),
  );
  const nextYourBirthday = getNextOccurrence(
    getYearlyOccurrences(YOUR_BIRTHDAY).filter((d) => d >= APP_START_DATE),
  );
  const nextPartnerBirthday = getNextOccurrence(
    getYearlyOccurrences(PARTNER_BIRTHDAY).filter((d) => d >= APP_START_DATE),
  );

  const customEventItems = Object.entries(customEvents)
    .map(([monthDay, label]) => {
      const next = getNextOccurrence(
        getYearlyOccurrencesFromMonthDay(monthDay, START_YEAR, 5).filter(
          (d) => d >= APP_START_DATE,
        ),
      );
      return next ? { label, days: daysUntil(next) } : null;
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
      !!item && item.days >= 0 && item.days <= UPCOMING_WINDOW_DAYS,
  );

  const pokeScale = useSharedValue(1);
  const pokeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pokeScale.value }],
  }));

  const sendPoke = async () => {
    pokeScale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    const now = Date.now();
    setLastPoke(now);
    await AsyncStorage.setItem(POKE_KEY, String(now));
    // TODO: once backend/push notifications exist, actually notify her phone here
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
    <ScreenContainer>
      <View style={styles.card}>
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
            .map((item) => (
              <Text key={item.label} style={styles.upcomingRow}>
                {item.label} —{" "}
                {item.days === 0
                  ? "today"
                  : `${item.days} day${item.days === 1 ? "" : "s"}`}
              </Text>
            ))
        )}
      </View>

      <View style={styles.card}>
        <Pressable onPress={sendPoke} style={{ alignSelf: "flex-start" }}>
          <Animated.View style={pokeAnimStyle}>
            <HandHeart color="#e75480" size={28} />
          </Animated.View>
        </Pressable>
        <Text style={styles.cardTitle}>Miss you button</Text>
        <Text style={styles.cardBig}>
          {lastPoke
            ? `Poked ${formatPokeTime(lastPoke)}`
            : "Tap the icon to poke her"}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: "#fff5f7", borderRadius: 16, padding: 20, gap: 4 },
  cardTitle: { fontSize: 14, color: "#888", marginTop: 8 },
  cardBig: { fontSize: 20, fontWeight: "600" },
  cardHint: { fontSize: 12, color: "#aaa" },
  upcomingRow: { fontSize: 15, fontWeight: "600", marginTop: 2 },
});
