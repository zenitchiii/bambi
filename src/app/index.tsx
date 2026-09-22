import ScreenContainer from "@/components/ScreenContainer";
import { CalendarHeart, Heart } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

const ANNIVERSARY_DATE = new Date("2023-06-15");

function getMonthsAndDays(from: Date) {
  const now = new Date();
  let months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth());
  let days = now.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    ).getDate();
    days += daysInPrevMonth;
  }
  return { months, days };
}

export default function HomeScreen() {
  const { months, days } = getMonthsAndDays(ANNIVERSARY_DATE);

  return (
    <ScreenContainer>
      <View style={styles.card}>
        <CalendarHeart color="#e75480" size={28} />
        <Text style={styles.cardTitle}>Together for</Text>
        <Text style={styles.cardBig}>
          {months} months, {days} days
        </Text>
      </View>

      <View style={styles.card}>
        <Heart color="#e75480" size={28} />
        <Text style={styles.cardTitle}>Next date night</Text>
        <Text style={styles.cardBig}>Not scheduled yet</Text>
        <Text style={styles.cardHint}>Set one in the Calendar tab</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  card: {
    backgroundColor: "#fff5f7",
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  cardTitle: { fontSize: 14, color: "#888", marginTop: 8 },
  cardBig: { fontSize: 20, fontWeight: "600" },
  cardHint: { fontSize: 12, color: "#aaa" },
});
