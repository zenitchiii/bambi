// firebase/auth ships its React Native entry (with
// getReactNativePersistence) at runtime via the bundler's react-native
// condition, but its default typings only cover the shared surface —
// hence "has no exported member". This adds back just the missing
// function with its real signature (mirrored from
// @firebase/auth's ReactNativeAsyncStorage). Types only: no runtime
// code, no ts-ignore, no any-casts.
import "firebase/auth";

declare module "firebase/auth" {
  import type { Persistence } from "firebase/auth";
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
