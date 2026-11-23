# Oramus Wallet

Natywny portfel kryptowalut (non-custodial) na Androida, React Native + Expo SDK 58.
Klucz powstaje na telefonie i zostaje w bezpiecznym magazynie (Android Keystore + biometria).

**Stan: faza 1, tylko testnet.** Tworzenie i import 24 słów, adresy dla grup A, B i C. Salda i wysyłka — kolejne fazy.
Zasady bezpieczeństwa: [SECURITY.md](SECURITY.md). Sieci i coiny: [CHAINS.md](CHAINS.md).

## Instalacja na telefonie (Android)
1. GitHub → zakładka **Actions** → ostatni udany przebieg „Android APK” → sekcja **Artifacts** → `oramus-wallet-testnet-apk`.
2. Rozpakuj zip, porównaj SHA-256 pliku z `apk.sha256`.
3. Przenieś `app-release.apk` na telefon i zainstaluj (Android zapyta o zgodę na instalację z tego źródła).
4. Telefon musi mieć blokadę ekranu i odcisk palca albo twarz — bez tego portfel nie wystartuje.

## Rozwój
```bash
npm ci
npm test          # wektory adresów (zgodność z Trust Wallet), SLIP-0010, BIP39
npm run typecheck
npx expo prebuild --platform android && cd android && ./gradlew assembleRelease   # wymaga Android SDK + JDK 17
```

## Struktura
```
App.tsx                 ekrany: start, tworzenie/sprawdzenie/import słów, blokada, adresy, podgląd słów
src/vault.ts            jedyne miejsce z dostępem do słów (SecureStore + biometria)
src/wallet/mnemonic.ts  BIP39
src/wallet/slip10.ts    SLIP-0010 (ed25519)
src/wallet/derive.ts    klucze → adresy (EVM, P2WPKH, P2PKH, Solana, Sui, Aptos, NEAR, Stellar, Algorand)
src/wallet/chains.ts    sieci, ścieżki, coiny
.github/workflows/android.yml   testy → APK (artefakt)
```
