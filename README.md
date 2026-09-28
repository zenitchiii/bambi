# 🐰 Bambi

A private, two-person couple's app built as a birthday gift. Bambi keeps a shared calendar, a "together for" counter, a memories album and a little poke button in one soft pink app, synced live between two paired phones.

> Built with React Native (Expo) for Android.

## Features

- **Pairing:** one person hosts a 6-digit code, the other enters it. Pairing is required to use the app.
- **Onboarding:** swipeable carousel with animated dots (pairing, then name, photo, birthday and anniversary).
- **Home:** photo slideshow from your memories, a "Together for" counter, "On this day", "Coming up" (including your partner's birthday) and a "Miss you" poke card.
- **Calendar:** Philippine holidays, both birthdays, anniversary and monthsaries, date night, notes and yearly custom events. Shared between both phones in real time.
- **Memories:** photos and videos organised by Month, Day and Item, with favorites, covers, captions, multi-select and a custom video player. Stored locally on each phone.
- **Sidebar:** both partners' names and avatars, invite code, edit profile, about, future features and unpair.
- **Startup screen:** animated splash with a floating bunny and a loading bar on a pink gradient.

## Tech Stack

| Area | Tools |
| --- | --- |
| Framework | React Native, Expo (SDK managed workflow) |
| Language | TypeScript |
| Navigation | Expo Router (file-based routing, typed routes) |
| Backend | Firebase: Firestore (live sync) and Anonymous Authentication |
| Local storage | `@react-native-async-storage/async-storage`, `expo-file-system` |
| Animation | `react-native-reanimated` |
| UI and media | `expo-image`, `expo-video`, `expo-linear-gradient`, `expo-image-picker`, `lucide-react-native` |
| Calendar and dates | `react-native-calendars`, `date-holidays`, `@react-native-community/datetimepicker` |
| Splash | `expo-splash-screen` |
| Build and delivery | EAS Build (Android APK) |

## Project Structure

```
src/
  app/          Screens and routes (root layout, onboarding, (tabs)/)
  components/   Reusable UI (Sidebar, modals, PhotoSlideshow, onboarding steps)
  context/      OnboardingContext, ProfileContext
  hooks/        useSharedCoupleData, usePartnerProfile
  lib/          firebase.ts, pairing.ts, profileSync.ts
  constants/    Shared constants
  utils/        Date helpers
  assets/       Images
```

## How It Works

- Each phone signs in anonymously to Firebase.
- Pairing creates a `couples/{code}` document in Firestore holding both members, shared calendar data, the poke timestamp and each partner's basic profile (name, birthday, anniversary).
- Both phones listen to that document with `onSnapshot`, so changes appear on the other phone straight away.
- Firestore security rules allow only the two members to read or write their couple document.
- Profile photos and Memories never leave the device.

## Getting Started

**Prerequisites:** Node.js, an Android phone with Expo Go, and a Firebase project with Firestore and Anonymous Auth enabled.

```bash
npm install
```

Create a `.env` file in the project root (it is gitignored):

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Start the dev server and scan the QR code with Expo Go:

```bash
npx expo start
```

In development builds, a "Skip onboarding" button on the pairing screen lets you test without a second phone.

## Building an APK

```bash
eas build -p android --profile preview
```

The `preview` profile in `eas.json` produces an installable `.apk`. The Firebase values must also be set in that profile's `env` block, since `.env` is not uploaded to EAS.

## Known Limitations

- Memories and profile photos are local to each phone (cross-device photo sync would need Firebase Storage's paid plan).
- No push notifications yet (needs a development build). The poke is seen the next time the partner opens the app.
- Unpairing only clears the current phone.
- Reinstalling the app or clearing its data creates a new anonymous identity and locks that phone out of the couple.
- The host must keep the pairing screen open until the partner joins.

## Roadmap

Push notifications, shared photo sync, dark mode, an AI daily couples quiz, shared mini-games, a shared bucket list and a UI polish pass.

## Author

Made with love by Zenitchi.
