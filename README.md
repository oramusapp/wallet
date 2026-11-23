# Oramus Wallet

Natywny portfel kryptowalut (non-custodial) na Androida, React Native + Expo SDK 58.
Klucz powstaje na telefonie i zostaje w bezpiecznym magazynie (Android Keystore + biometria).
Te same 24 słowa działają w Trust Wallet (zgodne ścieżki, sprawdzone testami).

## Co działa (wersja 0.6.0)
- **Dwie sieci:** testowa (domyślna) i główna — prawdziwe środki. Sieć główną odblokowuje tylko APK podpisany
  Twoim prywatnym kluczem ([SIGNING.md](SIGNING.md)); przełączenie wymaga wpisania „PRAWDZIWE”.
- **Wysyłka i odbiór (z kodem QR):**

| Sieć główna | Testnet |
| --- | --- |
| ETH: Ethereum, Arbitrum, Base, Optimism · BNB (BNB Chain) · AVAX (Avalanche) · HYPE (HyperEVM) | ETH: Sepolia, Arbitrum Sepolia, Base Sepolia |
| USDC: Ethereum, Arbitrum, Base, Avalanche, HyperEVM (adresy z dokumentacji Circle) | USDC: Arbitrum Sepolia, Base Sepolia |
| Dowolny token ERC-20 dodany po adresie kontraktu (np. PEPE, LINK, UNI…) | to samo |
| BTC, LTC (SegWit) · DOGE, DASH (P2PKH, przez BlockCypher) | BTC testnet4, LTC testnet |
| SOL, SUI, APT, NEAR, XLM (z memo), ALGO | to samo w sieciach testowych |

- **Tylko saldo:** konto Hyperliquid (USDC: perpy + spot). **Tylko adres:** ZEC.
- **Ochrona przed pomyłką:** nowy adres → wpisz 4 ostatnie znaki; ostrzeżenie przed podobnym adresem (address poisoning);
  adres w grupach po 4 znaki; podgląd (odbiorca dostanie, opłata maks./zwykle, razem, saldo po); podgląd wygasa po 60 s;
  minimum i rezerwy kont czytane na żywo z każdej sieci; odcisk palca przed podpisem.
- **Weryfikacja:** każda transakcja jest bajt w bajt zgodna z oficjalnymi bibliotekami (viem, @solana/web3.js,
  @mysten/sui, @aptos-labs/ts-sdk, @near-js, @stellar/stellar-sdk, algosdk, bitcoinjs-lib) — 43 testy.
  Prawdziwe wysyłki potwierdzone na testnecie: XLM, ALGO, APT.

Zasady bezpieczeństwa: [SECURITY.md](SECURITY.md). Sieci i coiny: [CHAINS.md](CHAINS.md). Klucz podpisu: [SIGNING.md](SIGNING.md).

## Instalacja na telefonie (Android)
1. GitHub → **Actions** → ostatni udany przebieg „Android APK” → **Artifacts**:
   `oramus-wallet-testnet-apk` (klucz testowy, tylko testnet) albo `oramus-wallet-release-apk` (Twój klucz, sieć główna dostępna).
2. Rozpakuj zip, porównaj SHA-256 pliku z `apk.sha256` (tam też odcisk certyfikatu).
3. Zainstaluj `app-release.apk` (Android zapyta o zgodę na instalację z tego źródła).
4. Telefon musi mieć blokadę ekranu i odcisk palca albo twarz — bez tego portfel nie wystartuje.

## Rozwój
```bash
npm ci
npm test                                          # 43 testy: adresy, podpisy, zgodność z oficjalnymi SDK
npm run typecheck
LIVE=1 NODE_USE_ENV_PROXY=1 npx vitest run        # odczyt na żywo: salda, opłaty, minimum (testnet + mainnet)
LIVE=1 BROADCAST=1 NODE_USE_ENV_PROXY=1 npx vitest run scripts/live/broadcast.test.ts   # prawdziwe wysyłki testnet (publiczny portfel testowy)
```

## Struktura
```
App.tsx                  nawigacja, sieć, własne tokeny, blokada
src/config.ts            RELEASE_SIGNED (ustawiane przez CI tylko z prywatnym kluczem)
src/vault.ts             jedyne miejsce z dostępem do słów (SecureStore + biometria)
src/wallet/              BIP39, SLIP-0010, ścieżki i adresy
src/net/assets.ts        aktywa obu sieci, węzły, eksploratory
src/net/balances.ts      salda · src/net/limits.ts minimum, rezerwy, opłaty na żywo
src/net/recipients.ts    znane / podobne adresy · src/net/tokens.ts własne tokeny ERC-20
src/net/send/            evm, utxo (BTC/LTC/DOGE/DASH), sol, sui, apt, near, xlm, algo
src/ui/                  ekrany
scripts/ci/              podpis release w CI · scripts/live/ testy na prawdziwych węzłach
```
