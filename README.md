# Oramus Wallet

Mobilny portfel kryptowalut (web app, mobile-first) z cenami **na żywo z Hyperliquid**.

Monety: BTC, ETH, SOL, HYPE, USDC, USDT, ZEC, XMR, LINK, XRP, SUI, DOGE, PEPE.

## Uruchomienie

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testy jednostkowe (vitest)
npm run build      # build produkcyjny do dist/
```

## Publikacja i automatyczne aktualizacje

- Każdy push do `main` uruchamia workflow `.github/workflows/deploy.yml`: testy → build → deploy na **GitHub Pages**
  (adres: `https://oramusapp.github.io/wallet/`).
- Pull requesty przechodzą te same testy i build (bez deployu).
- Każdy build zapisuje `version.json` (SHA commita). Otwarta aplikacja sprawdza go co minutę i przy powrocie do karty;
  gdy wykryje nową wersję, pokazuje pasek „New version available” i sama przeładowuje się, kiedy przejdzie w tło.
- Aplikację można dodać do ekranu głównego telefonu (manifest PWA).

Wymagane jednorazowo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Funkcje

- **Home**: saldo konta, zmiana 24h ($ i %), Send / Deposit, Cash (USDC), lista tokenów, Explore Markets.
- **Tokens**: pełna lista posiadanych tokenów, **Manage Tokens** (ukrywanie tokenów przełącznikami).
- **Markets**: wszystkie monety z ceną, MC i zmianą 24h; filtry (ulubione, Majors, Stables, Memes, Privacy) i sortowanie.
- **Szczegóły tokena**: wykres świecowy z Hyperliquid (1H/1D/1W/1M/1Y, przeciąganie po wykresie), saldo, wolumen 24h, open interest, funding.
- **Send**: wybór aktywa (filtr sieci), kwota, adres odbiorcy z walidacją formatu, podsumowanie.
- **Deposit**: Add Cash (USDC) / Receive Crypto.
- **Trade (Swap)**: wymiana między tokenami po bieżącej cenie z Hyperliquid.
- **Konta**: wiele kont, tworzenie, zmiana nazwy, usuwanie; menu boczne z historią transakcji.
- Stan zapisywany w `localStorage`.

## Źródło cen (Hyperliquid)

| Moneta | Rynek Hyperliquid |
| --- | --- |
| BTC, ETH, SOL, HYPE, ZEC, XMR, LINK, XRP, SUI, DOGE | perp (mid price) |
| PEPE | perp `kPEPE` ÷ 1000 |
| USDT | spot `@166` (USDT0/USDC) |
| USDC | stałe $1 (waluta kwotowania na Hyperliquid) |

- Ceny na żywo: WebSocket `allMids` (`wss://api.hyperliquid.xyz/ws`), przy rozłączeniu REST polling co 5 s.
- Zmiana 24h, wolumen, OI, funding: `metaAndAssetCtxs` + `spotMetaAndAssetCtxs`, odświeżane co 60 s.
- Wykresy: `candleSnapshot`.

**Market cap jest szacunkowy**: Hyperliquid nie publikuje kapitalizacji, więc MC = cena z Hyperliquid × przybliżona podaż w obiegu wpisana w `src/config/coins.ts` (`approxSupply`). Wartości podaży można tam edytować.

## Tryb demo — ważne

To **nie jest portfel on-chain**. Nie generuje kluczy prywatnych ani adresów i niczego nie wysyła do blockchainów.
Send / Deposit / Swap zmieniają wyłącznie lokalne salda zapisane w przeglądarce (ceny są prawdziwe, z Hyperliquid).
Nie wysyłaj prawdziwych środków na podstawie tej aplikacji.

## Struktura

```
src/config/coins.ts      lista monet, mapowanie na rynki Hyperliquid, podaż do MC
src/lib/hyperliquid.ts   klient API (REST + WebSocket + świece)
src/lib/format.ts        formatowanie cen/kwot jak w makietach
src/state/               ceny (PricesProvider), portfel (reducer + localStorage), nawigacja
src/screens/             Home, Markets, Trade + arkusze (sheets)
public/coins/            ikony monet
```
