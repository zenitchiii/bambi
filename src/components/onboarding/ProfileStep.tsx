import { useOnboarding } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";
import { COUPLE_ID_KEY, ensureSignedIn, isMemberA, REJOIN_PREFILL_KEY } from "@/lib/pairing";
import { syncProfile, type Gender } from "@/lib/profileSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import GenderPicker from "@/components/GenderPicker";

type Props = { onNext: () => void };
type PickerTarget = "birthday" | "anniversary" | null;

export default function ProfileStep(_: Props) {
  const { refreshStatus } = useOnboarding();
  const { refreshProfile } = useProfile();

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [anniversary, setAnniversary] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  // Rejoin: gender comes from the claimed slot and stays read-only (role
  // and cycle visibility depend on it). Null = free choice as before.
  const [lockedGender, setLockedGender] = useState<Gender | null>(null);
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time prefill from a rejoin claim: name/birthday editable, gender
  // locked. Runs unconditionally; no-ops without a stash.
  useEffect(() => {
    AsyncStorage.getItem(REJOIN_PREFILL_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw);
          if (typeof saved?.name === "string" && saved.name.trim()) {
            setName(saved.name.trim());
          }
          const birthdayDate =
            typeof saved?.birthday === "string"
              ? new Date(saved.birthday)
              : null;
          if (birthdayDate && !Number.isNaN(birthdayDate.getTime())) {
            setBirthday(birthdayDate);
          }
          const anniversaryDate =
            typeof saved?.anniversary === "string"
              ? new Date(saved.anniversary)
              : null;
          if (anniversaryDate && !Number.isNaN(anniversaryDate.getTime())) {
            setAnniversary(anniversaryDate);
          }
          if (saved?.gender === "woman" || saved?.gender === "man") {
            setGender(saved.gender);
            setLockedGender(saved.gender);
          }
        } catch {
          // Corrupt stash: fall back to blank fields.
        }
      })
      .catch(() => {});
  }, []);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo access is needed to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    // Copy into the app's own document directory so it persists reliably —
    // same reasoning as how Memories stores photos rather than the picker's temp URI
    const pickedUri = result.assets[0].uri;
    const extension = pickedUri.split(".").pop()?.split("?")[0] ?? "jpg";
    const destination = `${FileSystem.documentDirectory}profile-photo.${extension}`;
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.copyAsync({ from: pickedUri, to: destination });
    // Same path is reused on every upload — bust the image cache so the new
    // photo renders immediately instead of the stale cached one.
    setPhotoUri(`${destination}?t=${Date.now()}`);
  }

  function handleDateChange(selectedDate: Date) {
    if (activePicker === "birthday") setBirthday(selectedDate);
    if (activePicker === "anniversary") setAnniversary(selectedDate);
    if (Platform.OS !== "ios") setActivePicker(null); // Android's picker closes itself after picking
  }

  function handleDateDismiss() {
    setActivePicker(null);
  }

  async function handleSave() {
    // Locked gender (rejoin) wins over the picker; syncProfile writes only
    // this device's own slot, never the partner's.
    const finalGender = lockedGender ?? gender;
    if (!name.trim()) {
      setError("Enter a name so your partner knows it's you.");
      return;
    }
    if (!birthday || !anniversary) {
      setError("Pick both your birthday and your anniversary date.");
      return;
    }
    if (!finalGender) {
      setError("Choose an option so cycle tracking knows who logs.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const coupleId = await AsyncStorage.getItem(COUPLE_ID_KEY);
      const uid = await ensureSignedIn();
      let photoURL: string | null = null;

      await AsyncStorage.setItem(
        "userProfile",
        JSON.stringify({
          name: name.trim(),
          photoUri,
          birthday: birthday.toISOString(),
          anniversary: anniversary.toISOString(),
          gender: finalGender,
        }),
      );
      if (coupleId) {
        const memberA = await isMemberA(coupleId, uid);
        await syncProfile(coupleId, memberA, {
          name: name.trim(),
          birthday: birthday.toISOString(),
          anniversary: anniversary.toISOString(),
          gender: finalGender,
        });
      }
      // Prefill served its purpose — drop it so a later edit starts clean.
      await AsyncStorage.removeItem(REJOIN_PREFILL_KEY).catch(() => {});
      await refreshStatus(); // flips status to "tabs" — root layout swaps automatically
      await refreshProfile(); // loads the profile we just saved into context immediately
    } catch {
      setError("Couldn't save your profile — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Tell us about you</Text>

      <Pressable style={styles.photoCircle} onPress={pickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <Text style={styles.photoPlaceholder}>Add photo</Text>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
      />

      <Pressable
        style={styles.dateButton}
        onPress={() => setActivePicker("birthday")}
      >
        <Text style={styles.dateButtonText}>
          {birthday
            ? `Birthday: ${birthday.toLocaleDateString()}`
            : "Set your birthday"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.dateButton}
        onPress={() => setActivePicker("anniversary")}
      >
        <Text style={styles.dateButtonText}>
          {anniversary
            ? `Anniversary: ${anniversary.toLocaleDateString()}`
            : "Set your anniversary"}
        </Text>
      </Pressable>

      {lockedGender ? (
        <Text style={styles.lockedText}>
          {lockedGender === "woman" ? "Woman" : "Man"} · locked
        </Text>
      ) : (
        <GenderPicker value={gender} onChange={setGender} />
      )}

      {activePicker && (
        <DateTimePicker
          value={
            (activePicker === "birthday" ? birthday : anniversary) ??
            new Date(2000, 0, 1)
          }
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onValueChange={(_, selectedDate) =>
            selectedDate && handleDateChange(selectedDate)
          }
          onDismiss={handleDateDismiss}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Finish</Text>
        )}
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
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: "600" },
  photoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: { color: "#999", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    width: "100%",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
  },
  dateButtonText: { fontSize: 16, color: "#333" },
  button: {
    backgroundColor: "#e75480",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#c0392b", textAlign: "center" },
  lockedText: { color: "#999", fontWeight: "600" },
});
