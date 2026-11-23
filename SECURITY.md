# Bezpieczeństwo — Oramus Wallet

Portfel non-custodial na Androida (później iPhone). Klucz powstaje i zostaje na telefonie.
Na start jeden użytkownik (autor), bez sklepu. Faza 1: tylko testnet.

## Co chronimy
24 słowa (BIP39) — z nich wynikają wszystkie klucze prywatne. Kto je ma, ma środki.

## Zasady (obowiązują każdą zmianę w kodzie)
1. **Bez własnej kryptografii.** Tylko biblioteki @noble / @scure (kryptografia, BIP39/BIP32, kodowania).
   Jedyny własny kawałek to SLIP-0010 dla ed25519 (kilkanaście linii HMAC-SHA512), sprawdzony oficjalnym wektorem testowym.
2. **Zgodność z Trust Wallet.** Ścieżki i adresy są takie jak w Trust Wallet Core, sprawdzone testami na wektorach
   wyliczonych niezależnie (`src/wallet/__tests__`). Jeśli aplikacja kiedyś zawiedzie, te same 24 słowa odtworzą środki w Trust Wallet.
3. **Słowa tylko w bezpiecznym magazynie.** `expo-secure-store` z `requireAuthentication`: klucz szyfrujący w Android Keystore,
   użycie tylko po biometrii. `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`. Po zapisie odczyt kontrolny; jeśli się nie zgadza, nic nie zostaje.
   Zmiana biometrii w telefonie unieważnia klucz — wtedy portfel odtwarza się z kartki.
4. **Bez kopii zapasowej Androida** (`allowBackup=false`, reguły wykluczające magazyn), dane nie trafiają do chmury Google.
5. **Bez zrzutów ekranu i nagrywania** w całej aplikacji (FLAG_SECURE), podgląd w przełączniku aplikacji jest zasłonięty.
6. **Blokada aplikacji** biometrią przy starcie i po 30 s w tle. Ekran z 24 słowami zamyka się po 60 s i przy wyjściu z aplikacji.
7. **Losowość** do nowego portfela: `expo-crypto` (SecureRandom systemu), 256 bitów, z odrzuceniem oczywiście zepsutych wyników.
8. **Telefon bez blokady ekranu i biometrii — portfel nie startuje.**
9. **Minimum uprawnień.** Zablokowane: aparat, mikrofon, pamięć, nakładki. Internet tylko do węzłów sieci (salda, opłaty, wysyłka).
10. **Brak analityki, logów i serwera.** Aplikacja łączy się tylko z węzłami sieci blockchain.
11. **Zależności:** dokładne wersje (bez `^`), `package-lock.json`, nowe wersje dopiero po 14 dniach od publikacji
    (`npm install --before=<data>`), żeby nie złapać świeżo przejętej paczki.
12. **Podpis APK i sieć główna.** Bez prywatnego klucza w GitHub Secrets APK jest podpisany publicznym kluczem debug
    i aplikacja **nie pozwala** włączyć sieci głównej (flaga `EXPO_PUBLIC_RELEASE_SIGNED` ustawiana przez CI tylko
    przy podpisie prywatnym kluczem). Instrukcja: SIGNING.md. Odcisk certyfikatu jest w `apk.sha256` każdego buildu.
13. **Sieć główna:** przełączenie wymaga wpisania „PRAWDZIWE”; na ekranie potwierdzenia czerwony pasek „SIEĆ GŁÓWNA”.
    Build podpisany kluczem debug zawsze startuje w sieci testowej, nawet jeśli wcześniej wybrano główną.
14. **Własne tokeny:** dane (symbol, nazwa, miejsca po przecinku) czytane z kontraktu; brak kontraktu pod adresem = odmowa;
    ostrzeżenie, że adres trzeba wziąć z oficjalnej strony projektu.

## Wysyłka (faza 2)
- Podgląd przed podpisem: odbiorca, kwota, opłata maksymalna, razem. Podgląd wygasa po 60 s.
- Adres EVM sprawdzany z sumą kontrolną EIP-55; adres BTC dekodowany dla właściwej sieci (testnet nie przyjmie adresu mainnet).
- Węzeł EVM musi zwrócić oczekiwany chainId, inaczej przerywamy.
- Klucz prywatny: odcisk palca → seed → klucz tylko dla tej sieci → podpis → wyczyszczenie. Wysyłka do sieci po wyczyszczeniu klucza.
- BTC: plan transakcji liczony ponownie przy podpisie; jeśli opłata różni się od podglądu, podpis jest odrzucany.
- Kwoty jako liczby całkowite (bigint), bez ułamków zmiennoprzecinkowych.
- Słów nie da się wkleić ze schowka przy przywracaniu (inne aplikacje mogą czytać schowek).

## Ochrona przed pomyłką (faza 3)
- **Nowy adres:** przy pierwszej wysyłce na adres trzeba wpisać jego 4 ostatnie znaki (z miejsca, skąd adres pochodzi). Bez tego przycisk jest nieaktywny.
- **Podobny adres (address poisoning):** jeśli adres ma ten sam początek i koniec co adres, na który już wysyłałeś, ale inny środek — czerwone ostrzeżenie i osobne potwierdzenie.
- **Adres w grupach po 4 znaki**, pierwsze i ostatnie grupy wyróżnione.
- **Podsumowanie:** odbiorca otrzyma, opłata (maks. i zwykle), razem, saldo po wysłaniu. Ostrzeżenie, gdy opłata ≥ 10% kwoty albo wysyłka ≥ 50% salda.
- **Minimum i rezerwy czytane na żywo z sieci:** BTC 546 sat, Solana — rezerwa konta (`getMinimumBalanceForRentExemption`), Stellar — 2 × base reserve, Algorand — `min-balance` konta, Hyperliquid — wpłata min. 5 USDC (dokumentacja). Kwota poniżej minimum blokuje przycisk.
- **Opłata (gas):** liczona z bieżącego bloku; na Base (OP stack) doliczana opłata L1 z kontraktu GasPriceOracle.
- Lista odbiorców (adresy publiczne) zapisuje się na telefonie dopiero po udanej wysyłce.

## Zanim wejdą prawdziwe środki (mainnet)
- Prywatny klucz podpisu APK (pkt 12, SIGNING.md) — bez niego sieć główna jest zablokowana.
- Pierwsza wysyłka w każdej sieci: mała kwota, sprawdzona w eksploratorze.
- Mały limit na start; większe kwoty dopiero po tygodniach bez problemów.
- Przed udostępnieniem komukolwiek innemu: zewnętrzny audyt.

## Lista zagrożeń (skrót)
| Zagrożenie | Obrona |
| --- | --- |
| Złośliwa aplikacja robi zrzut ekranu ze słowami | FLAG_SECURE |
| Kopia zapasowa telefonu w chmurze | allowBackup=false |
| Ktoś bierze odblokowany telefon | blokada aplikacji, słowa tylko po biometrii |
| Zepsuta lub przejęta paczka npm | wąska lista zależności, dokładne wersje, 14 dni karencji |
| Błąd w wyliczaniu adresów | testy na niezależnych wektorach (Trust Wallet Core) |
| Podmiana aplikacji przy aktualizacji | przed mainnetem prywatny klucz podpisu i sprawdzanie SHA-256 APK |
| Phishing (prośba o słowa) | ostrzeżenia w aplikacji; słów nie podaje się nigdzie poza importem w tej aplikacji |
