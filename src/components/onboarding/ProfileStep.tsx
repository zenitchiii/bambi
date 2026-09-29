import { useOnboarding } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";
import { COUPLE_ID_KEY, ensureSignedIn, isMemberA } from "@/lib/pairing";
import { syncProfile } from "@/lib/profileSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
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

type Props = { onNext: () => void };
type PickerTarget = "birthday" | "anniversary" | null;

export default function ProfileStep(_: Props) {
  const { refreshStatus } = useOnboarding();
  const { refreshProfile } = useProfile();

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [anniversary, setAnniversary] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!name.trim()) {
      setError("Enter a name so your partner knows it's you.");
      return;
    }
    if (!birthday || !anniversary) {
      setError("Pick both your birthday and your anniversary date.");
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
        }),
      );
      if (coupleId) {
        const memberA = await isMemberA(coupleId, uid);
        await syncProfile(coupleId, memberA, {
          name: name.trim(),
          birthday: birthday.toISOString(),
          anniversary: anniversary.toISOString(),
        });
      }
      await refreshStatus(); // flips status to "onboarded" — root layout swaps to tabs automatically
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
});
