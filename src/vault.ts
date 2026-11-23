// The only place that touches the 24 words at rest.
// Android: expo-secure-store encrypts with a key kept in the Android Keystore; with
// requireAuthentication the key can be used only right after a fingerprint/face check.
// If new biometrics are enrolled, Android invalidates that key: the words must then be restored from paper.
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { deriveAll, deriveEdPrivateKey, deriveSecpPrivateKey, type DerivedAccount } from './wallet/derive';
import { CHAINS } from './wallet/chains';
import { isValidMnemonic, normalizeMnemonic, seedFromMnemonic } from './wallet/mnemonic';

const K_MNEMONIC = 'wallet.mnemonic.v1';
const K_ACCOUNTS = 'wallet.accounts.v1';

const SECRET_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Potwierdź, aby użyć klucza portfela',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY
};
const PUBLIC_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export interface DeviceCheck { ok: boolean; reason?: string }

/** The wallet refuses to start without a screen lock and enrolled biometrics. */
export async function checkDevice(): Promise<DeviceCheck> {
  if (!(await LocalAuthentication.hasHardwareAsync())) return { ok: false, reason: 'Telefon nie ma czytnika biometrycznego.' };
  if (!(await LocalAuthentication.isEnrolledAsync())) return { ok: false, reason: 'Ustaw blokadę ekranu i odcisk palca (albo twarz) w ustawieniach telefonu.' };
  if (!SecureStore.canUseBiometricAuthentication()) return { ok: false, reason: 'Bezpieczny magazyn kluczy z biometrią jest niedostępny na tym telefonie.' };
  return { ok: true };
}

export async function hasWallet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K_ACCOUNTS, PUBLIC_OPTS)) != null;
}

export async function loadAccounts(): Promise<DerivedAccount[]> {
  const raw = await SecureStore.getItemAsync(K_ACCOUNTS, PUBLIC_OPTS);
  return raw ? (JSON.parse(raw) as DerivedAccount[]) : [];
}

/** Saves the words (biometric-protected), reads them back to prove it works, then stores public addresses. */
export async function saveWallet(mnemonic: string): Promise<DerivedAccount[]> {
  const m = normalizeMnemonic(mnemonic);
  if (!isValidMnemonic(m)) throw new Error('Nieprawidłowe słowa (suma kontrolna się nie zgadza).');
  const seed = seedFromMnemonic(m);
  const accounts = [...deriveAll(seed, 'testnet'), ...deriveAll(seed, 'mainnet')];
  seed.fill(0);
  await SecureStore.setItemAsync(K_MNEMONIC, m, SECRET_OPTS);
  const back = await SecureStore.getItemAsync(K_MNEMONIC, SECRET_OPTS);
  if (back !== m) {
    await SecureStore.deleteItemAsync(K_MNEMONIC, SECRET_OPTS).catch(() => {});
    throw new Error('Zapis w bezpiecznym magazynie nie przeszedł weryfikacji. Nic nie zostało zapisane.');
  }
  await SecureStore.setItemAsync(K_ACCOUNTS, JSON.stringify(accounts), PUBLIC_OPTS);
  return accounts;
}

/** Shows a biometric prompt; returns the words or throws. Caller must drop them from memory quickly. */
export async function revealMnemonic(): Promise<string> {
  const m = await SecureStore.getItemAsync(K_MNEMONIC, SECRET_OPTS);
  if (!m) throw new Error('Brak klucza na tym telefonie (mógł zostać unieważniony po zmianie biometrii). Odtwórz portfel z kartki.');
  return m;
}

export async function unlockApp(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Odblokuj Oramus Wallet', disableDeviceFallback: false, cancelLabel: 'Anuluj' });
  return r.success;
}

/** Removes the wallet from this phone. Funds stay on the blockchains; the 24 words restore them. */
export async function wipeWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(K_MNEMONIC, SECRET_OPTS);
  await SecureStore.deleteItemAsync(K_ACCOUNTS, PUBLIC_OPTS);
  for (const k of ['wallet.recipients.v1', 'wallet.network.v1', 'wallet.tokens.v1']) await SecureStore.deleteItemAsync(k, PUBLIC_OPTS).catch(() => {});
}

/**
 * Signing: one biometric prompt -> seed -> secp256k1 key for `chainId` -> fn(key) -> everything wiped.
 * The words themselves are a JS string and cannot be wiped; they are dropped right away.
 */
export async function withSecpKey<T>(chainId: string, network: 'testnet' | 'mainnet', fn: (key: Uint8Array) => T | Promise<T>): Promise<T> {
  const chain = CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error('Nieznana sieć');
  let m: string | null = await revealMnemonic();
  const seed = seedFromMnemonic(m);
  m = null;
  const key = deriveSecpPrivateKey(seed, chain, network);
  seed.fill(0);
  try { return await fn(key); }
  finally { key.fill(0); }
}

/** Same as withSecpKey, for ed25519 chains (Solana and others). */
export async function withEdKey<T>(chainId: string, network: 'testnet' | 'mainnet', fn: (key: Uint8Array) => T | Promise<T>): Promise<T> {
  const chain = CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error('Nieznana sieć');
  let m: string | null = await revealMnemonic();
  const seed = seedFromMnemonic(m);
  m = null;
  const key = deriveEdPrivateKey(seed, chain, network);
  seed.fill(0);
  try { return await fn(key); }
  finally { key.fill(0); }
}

// ---------- recipients you already sent to (public data, used for "new address" checks) ----------
const K_RECIPIENTS = 'wallet.recipients.v1';
export async function loadRecipients(): Promise<Record<string, string[]>> {
  try { return JSON.parse((await SecureStore.getItemAsync(K_RECIPIENTS, PUBLIC_OPTS)) || '{}'); } catch { return {}; }
}
export async function rememberRecipient(assetId: string, address: string): Promise<void> {
  const all = await loadRecipients();
  const list = all[assetId] ?? [];
  if (!list.includes(address)) all[assetId] = [address, ...list].slice(0, 50);
  await SecureStore.setItemAsync(K_RECIPIENTS, JSON.stringify(all), PUBLIC_OPTS);
}

// ---------- settings that are not secret ----------
const K_NETWORK = 'wallet.network.v1';
const K_TOKENS = 'wallet.tokens.v1';
export async function loadNetwork(): Promise<'testnet' | 'mainnet'> {
  return (await SecureStore.getItemAsync(K_NETWORK, PUBLIC_OPTS)) === 'mainnet' ? 'mainnet' : 'testnet';
}
export async function saveNetwork(n: 'testnet' | 'mainnet'): Promise<void> {
  await SecureStore.setItemAsync(K_NETWORK, n, PUBLIC_OPTS);
}
export async function loadTokens<T>(): Promise<T[]> {
  try { return JSON.parse((await SecureStore.getItemAsync(K_TOKENS, PUBLIC_OPTS)) || '[]'); } catch { return []; }
}
export async function saveTokens<T>(list: T[]): Promise<void> {
  await SecureStore.setItemAsync(K_TOKENS, JSON.stringify(list), PUBLIC_OPTS);
}
