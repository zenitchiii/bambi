import ScreenContainer from "@/components/ScreenContainer";
import {
  ANNIVERSARY_DATE,
  APP_START_DATE,
  PARTNER_BIRTHDAY,
  YOUR_BIRTHDAY,
} from "@/constants/date";
import {
  daysUntil,
  getAge,
  getMonthsAndDays,
  getMonthsaryOccurrences,
  getNextOccurrence,
  getYearlyOccurrences,
} from "@/utils/dateMath";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cake, CalendarHeart, Heart } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const DATE_NIGHT_STORAGE_KEY = "nextDateNight";

export default function HomeScreen() {
  const [dateNight, setDateNight] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DATE_NIGHT_STORAGE_KEY).then((saved) => {
      if (saved) setDateNight(saved);
    });
  }, []);

  const { months, days } = getMonthsAndDays(ANNIVERSARY_DATE);
  const yourAge = getAge(YOUR_BIRTHDAY);
  const partnerAge = getAge(PARTNER_BIRTHDAY);

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

  const upcoming = [
    dateNight && {
      label: "Date night",
      days: daysUntil(dateNight),
    },
    nextMonthsary && {
      label: "Next monthsary",
      days: daysUntil(nextMonthsary),
    },
    nextYourBirthday && {
      label: "Your birthday",
      days: daysUntil(nextYourBirthday),
    },
    nextPartnerBirthday && {
      label: "Her birthday",
      days: daysUntil(nextPartnerBirthday),
    },
  ].filter(
    (item): item is { label: string; days: number } => !!item && item.days >= 0,
  );

  return (
    <ScreenContainer>
      <Text style={styles.greeting}>Hi babe 💕</Text>

      <View style={styles.card}>
        <CalendarHeart color="#e75480" size={28} />
        <Text style={styles.cardTitle}>Together for</Text>
        <Text style={styles.cardBig}>
          {months} months, {days} days
        </Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.card, styles.half]}>
          <Cake color="#e75480" size={24} />
          <Text style={styles.cardTitle}>You</Text>
          <Text style={styles.cardBig}>{yourAge} years old</Text>
        </View>
        <View style={[styles.card, styles.half]}>
          <Cake color="#e75480" size={24} />
          <Text style={styles.cardTitle}>Her</Text>
          <Text style={styles.cardBig}>{partnerAge} years old</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Heart color="#e75480" size={28} />
        <Text style={styles.cardTitle}>Coming up</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.cardHint}>Nothing scheduled yet</Text>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", gap: 16 },
  half: { flex: 1 },
  card: { backgroundColor: "#fff5f7", borderRadius: 16, padding: 20, gap: 4 },
  cardTitle: { fontSize: 14, color: "#888", marginTop: 8 },
  cardBig: { fontSize: 20, fontWeight: "600" },
  cardHint: { fontSize: 12, color: "#aaa" },
  upcomingRow: { fontSize: 15, fontWeight: "600", marginTop: 2 },
});
