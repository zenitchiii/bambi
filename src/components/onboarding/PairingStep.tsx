import { useOnboarding } from "@/context/OnboardingContext";
import {
  COUPLE_ID_KEY,
  createCoupleCode,
  ensureSignedIn,
  joinCoupleCode,
  watchCouple,
} from "@/lib/pairing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Mode = "choose" | "host" | "join";
type Props = { onNext: () => void };

export default function PairingStep({ onNext }: Props) {
  const { refreshStatus } = useOnboarding();
  const [mode, setMode] = useState<Mode>("choose");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  // Stop listening for a partner if this screen goes away before they join
  useEffect(() => {
    return () => unsubscribeRef.current?.();
  }, []);

  function handleBack() {
    unsubscribeRef.current?.(); // stop watching for a partner if we were hosting
    unsubscribeRef.current = undefined;
    setError(null);
    setMode("choose");
  }

  async function handleDevSkip() {
    await AsyncStorage.multiSet([
      [COUPLE_ID_KEY, "DEV000"],
      [
        "userProfile",
        JSON.stringify({
          name: "Dev Tester",
          photoUri: null,
          birthday: new Date(2000, 0, 1).toISOString(),
          anniversary: new Date(2022, 11, 16).toISOString(),
        }),
      ],
    ]);
    await refreshStatus();
  }

  async function handleHost() {
    setMode("host");
    setLoading(true);
    setError(null);
    try {
      const uid = await ensureSignedIn();
      const newCode = await createCoupleCode(uid);
      setCode(newCode);
      unsubscribeRef.current = watchCouple(newCode, async (couple) => {
        if (couple.memberB) {
          await AsyncStorage.setItem(COUPLE_ID_KEY, newCode);
          onNext();
        }
      });
    } catch {
      setError("Couldn't create a code — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (joinInput.trim().length !== 6) {
      setError("Enter the 6-digit code your partner shared.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const uid = await ensureSignedIn();
      const success = await joinCoupleCode(joinInput.trim(), uid);
      if (!success) {
        setError("That code doesn't exist or is already taken.");
        return;
      }
      await AsyncStorage.setItem(COUPLE_ID_KEY, joinInput.trim());
      onNext();
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "choose") {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Let's connect you two</Text>
        <Pressable style={styles.button} onPress={handleHost}>
          <Text style={styles.buttonText}>Create a code</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => setMode("join")}
        >
          <Text style={styles.buttonText}>Enter a code</Text>
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
        {__DEV__ && (
          <Pressable onPress={handleDevSkip}>
            <Text style={styles.backText}>Skip onboarding (dev)</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (mode === "host") {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Share this code</Text>
        {loading ? (
          <ActivityIndicator color="#e75480" />
        ) : (
          <>
            <Text style={styles.code}>{code}</Text>
            <Text style={styles.hint}>
              Waiting for your partner to enter it…
            </Text>
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={handleBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Enter your partner's code</Text>
      <TextInput
        style={styles.input}
        value={joinInput}
        onChangeText={setJoinInput}
        placeholder="123456"
        placeholderTextColor="#a19898"
        keyboardType="number-pad"
        maxLength={6}
      />
      <Pressable style={styles.button} onPress={handleJoin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Join</Text>
        )}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={handleBack}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  button: {
    backgroundColor: "#e75480",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  secondaryButton: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  code: { fontSize: 40, fontWeight: "700", letterSpacing: 4, color: "#e75480" },
  hint: { color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    minWidth: 200,
  },
  error: { color: "#c0392b", textAlign: "center" },
  backText: { color: "#999", fontWeight: "600", marginTop: 8 },
});
