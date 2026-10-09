import { useOnboarding } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";
import { ensureSignedIn, isMemberA } from "@/lib/pairing";
import { syncProfile, type Gender } from "@/lib/profileSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import GenderPicker from "@/components/GenderPicker";

type Props = { visible: boolean; onClose: () => void };
type PickerTarget = "birthday" | "anniversary" | null;

export default function EditProfileModal({ visible, onClose }: Props) {
  const { profile, refreshProfile } = useProfile();
  const { coupleId } = useOnboarding();

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [anniversary, setAnniversary] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form to the current saved profile every time the modal opens —
  // otherwise a cancelled edit would leave stale draft values sitting around
  // for next time
  useEffect(() => {
    if (visible && profile) {
      setName(profile.name);
      setPhotoUri(profile.photoUri);
      setBirthday(new Date(profile.birthday));
      setAnniversary(new Date(profile.anniversary));
      setGender(profile.gender ?? null);
    }
  }, [visible, profile]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const pickedUri = result.assets[0].uri;
    const extension = pickedUri.split(".").pop()?.split("?")[0] ?? "jpg";
    const destination = `${FileSystem.documentDirectory}profile-photo.${extension}`;
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.copyAsync({ from: pickedUri, to: destination });
    // The file path is reused on every upload, so the image component would
    // keep showing the cached old photo — bust the cache with a timestamp
    // and update state immediately so the new photo shows right away.
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
    if (!name.trim() || !birthday || !anniversary) return;
    // Gender locks once set (roles depend on it); keep the saved one when
    // the picker is hidden so an edit can never drop it.
    const finalGender = gender ?? profile?.gender ?? null;
    setSaving(true);

    try {
      await AsyncStorage.setItem(
        "userProfile",
        JSON.stringify({
          name: name.trim(),
          photoUri,
          birthday: birthday.toISOString(),
          anniversary: anniversary.toISOString(),
          ...(finalGender ? { gender: finalGender } : {}),
        }),
      );
      await refreshProfile();
      if (coupleId) {
        const uid = await ensureSignedIn();
        const memberA = await isMemberA(coupleId, uid);
        await syncProfile(coupleId, memberA, {
          name: name.trim(),
          birthday: birthday.toISOString(),
          anniversary: anniversary.toISOString(),
          ...(finalGender ? { gender: finalGender } : {}),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Edit Profile</Text>

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
                : "Set birthday"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.dateButton}
            onPress={() => setActivePicker("anniversary")}
          >
            <Text style={styles.dateButtonText}>
              {anniversary
                ? `Anniversary: ${anniversary.toLocaleDateString()}`
                : "Set anniversary"}
            </Text>
          </Pressable>

          {/* Gender locks once set — roles and cycle visibility depend on
              it, so it can't be changed here. New profiles still choose. */}
          {profile?.gender ? (
            <Text style={styles.lockedText}>
              {profile.gender === "woman" ? "Woman" : "Man"} · locked
            </Text>
          ) : (
            <>
              {profile && !profile.gender && (
                <Text style={styles.genderPrompt}>
                  Choose an option to unlock the cycle tracker.
                </Text>
              )}
              <GenderPicker value={gender} onChange={setGender} />
            </>
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

          <Pressable
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 12,
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  photoCircle: {
    alignSelf: "center",
    width: 90,
    height: 90,
    borderRadius: 45,
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
    paddingHorizontal: 16,
    fontSize: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dateButtonText: { fontSize: 15, color: "#333" },
  genderPrompt: {
    fontSize: 13,
    color: "#e75480",
    textAlign: "center",
    backgroundColor: "#fff5f7",
    borderRadius: 12,
    padding: 10,
  },
  lockedText: { color: "#999", fontWeight: "600" },
  saveButton: {
    backgroundColor: "#e75480",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  cancelButton: { paddingVertical: 8, alignItems: "center" },
  cancelText: { color: "#999" },
});
