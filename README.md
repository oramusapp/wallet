# Oramus Wallet

Natywny portfel kryptowalut (non-custodial) na Androida, React Native + Expo SDK 58.
Klucz powstaje na telefonie i zostaje w bezpiecznym magazynie (Android Keystore + biometria).

**Stan: faza 3, tylko testnet.**
- Tworzenie i przywracanie 24 słów, adresy grup A, B, C (zgodne z Trust Wallet).
- Salda: ETH (Sepolia, Arbitrum Sepolia, Base Sepolia), konto Hyperliquid testnet (USDC), BTC testnet4, SOL devnet, SUI, APT, NEAR, XLM, ALGO testnet.
- Wysyłka z podglądem opłaty i potwierdzeniem odciskiem palca: ETH (3 sieci testowe), BTC testnet4, SOL devnet.
- Ochrona przed pomyłką: nowy adres → wpisz 4 ostatnie znaki, ostrzeżenie przed podobnym adresem, minimum i opłata widoczne przed wysyłką.
- Odbiór z kodem QR. LTC, DOGE, DASH, ZEC: na razie tylko adres.
Zasady bezpieczeństwa: [SECURITY.md](SECURITY.md). Sieci i coiny: [CHAINS.md](CHAINS.md).

## Instalacja na telefonie (Android)
1. GitHub → zakładka **Actions** → ostatni udany przebieg „Android APK” → sekcja **Artifacts** → `oramus-wallet-testnet-apk`.
2. Rozpakuj zip, porównaj SHA-256 pliku z `apk.sha256`.
3. Przenieś `app-release.apk` na telefon i zainstaluj (Android zapyta o zgodę na instalację z tego źródła).
4. Telefon musi mieć blokadę ekranu i odcisk palca albo twarz — bez tego portfel nie wystartuje.

## Rozwój
```bash
npm ci
npm test          # wektory adresów (Trust Wallet), SLIP-0010, BIP39, kwoty, podpis EVM i BTC
LIVE=1 NODE_USE_ENV_PROXY=1 npx vitest run   # salda i podgląd opłat na prawdziwych węzłach testnet
npm run typecheck
npx expo prebuild --platform android && cd android && ./gradlew assembleRelease   # wymaga Android SDK + JDK 17
```

## Struktura
```
App.tsx                 nawigacja: start, blokada, zakładki Portfel / Odbierz / Wyślij / Ustawienia
src/ui/                 ekrany (kit.tsx = wspólny wygląd, QR.tsx = kod QR bez dodatkowych modułów natywnych)
src/net/assets.ts       aktywa, sieci testowe, węzły
src/net/balances.ts     salda
src/net/send/evm.ts     przelew ETH (EIP-1559), podpis @noble
src/net/send/btc.ts     przelew BTC (P2WPKH) przez @scure/btc-signer
src/net/send/sol.ts     przelew SOL (System Program, sprawdzony bajt w bajt z @solana/web3.js)
src/net/limits.ts       minimum, rezerwy i opłaty na żywo z sieci
src/net/recipients.ts   znane adresy, podobne adresy, grupy po 4 znaki
src/vault.ts            jedyne miejsce z dostępem do słów (SecureStore + biometria)
src/wallet/mnemonic.ts  BIP39
src/wallet/slip10.ts    SLIP-0010 (ed25519)
src/wallet/derive.ts    klucze → adresy (EVM, P2WPKH, P2PKH, Solana, Sui, Aptos, NEAR, Stellar, Algorand)
src/wallet/chains.ts    sieci, ścieżki, coiny
.github/workflows/android.yml   testy → APK (artefakt)
```
