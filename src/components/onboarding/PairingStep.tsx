import { useOnboarding } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";
import { db } from "@/lib/firebase";
import {
  COUPLE_ID_KEY,
  createCoupleCode,
  ensureSignedIn,
  joinCoupleCode,
  REJOIN_PREFILL_KEY,
  rejoinSlot,
  watchCouple,
  type RejoinSlot,
} from "@/lib/pairing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Gender } from "@/lib/profileSync";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Mode = "choose" | "host" | "join" | "rejoin";
type Props = { onNext: () => void };

// One side of an already-paired couple, for the rejoin picker.
type SlotInfo = {
  slot: RejoinSlot;
  uid: string;
  name: string;
  birthday: string;
  anniversary: string;
  gender: Gender | null;
};

export default function PairingStep({ onNext }: Props) {
  const { refreshProfile } = useProfile();
  const { refreshStatus } = useOnboarding();
  const [mode, setMode] = useState<Mode>("choose");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejoinInfo, setRejoinInfo] = useState<{
    code: string;
    slots: [SlotInfo, SlotInfo];
  } | null>(null);
  const [rejoinPick, setRejoinPick] = useState<RejoinSlot | null>(null);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  // Stop listening for a partner if this screen goes away before they join
  useEffect(() => {
    return () => unsubscribeRef.current?.();
  }, []);

  // A stale prefill (backed out of a previous rejoin) must not leak into
  // the next Profile step.
  useEffect(() => {
    AsyncStorage.removeItem(REJOIN_PREFILL_KEY).catch(() => {});
  }, []);

  function handleBack() {
    unsubscribeRef.current?.(); // stop watching for a partner if we were hosting
    unsubscribeRef.current = undefined;
    setError(null);
    setMode("choose");
  }

  async function handleDevSkip() {
    const uid = await ensureSignedIn();
    const devCoupleId = `DEV-${uid.slice(0, 8)}`;
    const coupleRef = doc(db, "couples", devCoupleId);
    const snap = await getDoc(coupleRef);
    if (!snap.exists()) {
      // Step 1: create with memberB still empty — satisfies the rules'
      // "create" branch, same as real pairing does
      await setDoc(coupleRef, { memberA: uid, memberB: null });
    }
    // Step 2: join as your own memberB — satisfies the rules' separate
    // "join" branch (memberB was null, now becomes your uid)
    await setDoc(coupleRef, { memberB: uid }, { merge: true });
    await AsyncStorage.multiSet([
      [COUPLE_ID_KEY, "DEV000"],
      [COUPLE_ID_KEY, devCoupleId],
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
    await refreshProfile();
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
      if (success) {
        await AsyncStorage.setItem(COUPLE_ID_KEY, joinInput.trim());
        onNext();
        return;
      }
      // Join failed — find out why: missing code, already a member
      // (retry), or a full couple this uid doesn't belong to (rejoin?).
      const snap = await getDoc(doc(db, "couples", joinInput.trim()));
      if (!snap.exists()) {
        setError("That code doesn't exist — check it and try again.");
        return;
      }
      const data = snap.data();
      if (data.memberA === uid || data.memberB === uid) {
        await AsyncStorage.setItem(COUPLE_ID_KEY, joinInput.trim());
        onNext();
        return;
      }
      const toSlot = (slot: RejoinSlot): SlotInfo | null => {
        const memberUid = data[slot];
        const prof = slot === "memberA" ? data.profileA : data.profileB;
        if (typeof memberUid !== "string" || !memberUid) return null;
        return {
          slot,
          uid: memberUid,
          name:
            typeof prof?.name === "string" && prof.name.trim()
              ? prof.name.trim()
              : slot === "memberA"
                ? "Partner 1"
                : "Partner 2",
          birthday: typeof prof?.birthday === "string" ? prof.birthday : "",
          anniversary:
            typeof prof?.anniversary === "string" ? prof.anniversary : "",
          gender: prof?.gender === "woman" || prof?.gender === "man" ? prof.gender : null,
        };
      };
      const a = toSlot("memberA");
      const b = toSlot("memberB");
      if (a && b) {
        setRejoinInfo({ code: joinInput.trim(), slots: [a, b] });
        setRejoinPick(null);
        setMode("rejoin");
        return;
      }
      setError("That code doesn't exist or is already taken.");
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejoin() {
    if (!rejoinInfo || !rejoinPick) return;
    const picked = rejoinInfo.slots.find((s) => s.slot === rejoinPick);
    if (!picked) return;
    setLoading(true);
    setError(null);
    try {
      const uid = await ensureSignedIn();
      const result = await rejoinSlot(
        rejoinInfo.code,
        picked.slot,
        picked.uid,
        uid,
      );
      if (result === "missing") {
        setError("That code no longer exists.");
        return;
      }
      if (result === "claimed") {
        setError("Someone just claimed that spot — try again.");
        return;
      }
      // Stash the slot's profile so the next step prefills name/birthday
      // and locks gender; shared history loads from the existing doc.
      await AsyncStorage.multiSet([
        [COUPLE_ID_KEY, rejoinInfo.code],
        [
          REJOIN_PREFILL_KEY,
          JSON.stringify({
            name: picked.name,
            birthday: picked.birthday,
            anniversary: picked.anniversary,
            gender: picked.gender,
          }),
        ],
      ]);
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

  if (mode === "rejoin" && rejoinInfo) {
    const picked = rejoinInfo.slots.find((s) => s.slot === rejoinPick) ?? null;
    const other =
      rejoinPick === null
        ? null
        : (rejoinInfo.slots.find((s) => s.slot !== rejoinPick)?.name ??
          "your partner");
    return (
      <View style={styles.page}>
        <Text style={styles.title}>That code is already paired</Text>
        <Text style={styles.hint}>Which one is you?</Text>
        {rejoinInfo.slots.map((s) => (
          <Pressable
            key={s.slot}
            style={[
              styles.button,
              rejoinPick !== s.slot && styles.secondaryButton,
            ]}
            onPress={() => setRejoinPick(s.slot)}
          >
            <Text style={styles.buttonText}>{s.name}</Text>
          </Pressable>
        ))}
        {picked && other && (
          <Text style={styles.hint}>
            Rejoining as {picked.name} — {other}&apos;s data stays untouched.
          </Text>
        )}
        <Pressable
          style={[styles.button, !picked && styles.secondaryButton]}
          onPress={handleRejoin}
          disabled={loading || !picked}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Rejoin</Text>
          )}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={handleBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Enter your partner&apos;s code</Text>
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
