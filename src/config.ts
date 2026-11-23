// Build-time flags. EXPO_PUBLIC_* values are baked into the app bundle when the APK is built.
// RELEASE_SIGNED is set to "1" by CI only when the APK is signed with the private release key from GitHub Secrets;
// the public debug key of a testnet build must never guard real money.
export const RELEASE_SIGNED = process.env.EXPO_PUBLIC_RELEASE_SIGNED === '1';
export const APP_VERSION = '0.6.0';
