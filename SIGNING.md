# Prywatny klucz podpisu — jednorazowo, przed prawdziwymi środkami

Bez tego klucza aplikacja działa tylko w sieci testowej. Klucz sprawia, że tylko Ty możesz wydać aktualizację,
którą Android zainstaluje na miejscu Twojej aplikacji.

Repozytorium jest publiczne, więc klucz **nigdy** nie trafia do kodu — tylko do GitHub Secrets (zaszyfrowane,
niewidoczne dla innych, niedostępne dla pull requestów z cudzych forków).

## 1. Wygeneruj klucz (w przeglądarce, bez instalowania czegokolwiek)
1. Wejdź na https://github.com/oramusapp/wallet → zielony przycisk **Code** → zakładka **Codespaces** → **Create codespace**.
   (Codespace to Twój prywatny komputer w chmurze GitHuba; darmowy limit wystarcza.)
2. W terminalu na dole wklej (zamień `TWOJE_HASLO` na długie hasło z menedżera haseł):
   ```bash
   keytool -genkeypair -v -keystore oramus.keystore -alias oramus -keyalg RSA -keysize 4096 -validity 10000 \
     -storepass 'TWOJE_HASLO' -keypass 'TWOJE_HASLO' -dname "CN=Oramus Wallet"
   base64 -w0 oramus.keystore > keystore.txt
   ```
3. Kliknij prawym na `oramus.keystore` → **Download** i zapisz w menedżerze haseł / bezpiecznym miejscu
   (bez kopii nie wydasz aktualizacji — musiałbyś zainstalować aplikację od nowa i przywrócić portfel z 24 słów).
4. Otwórz `keystore.txt`, zaznacz całą zawartość i skopiuj.

## 2. Wpisz klucz w GitHub Secrets
Repozytorium → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Dodaj cztery:

| Nazwa | Wartość |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | zawartość `keystore.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | Twoje hasło |
| `ANDROID_KEY_ALIAS` | `oramus` |
| `ANDROID_KEY_PASSWORD` | Twoje hasło |

## 3. Posprzątaj
W Codespace usuń pliki: `rm oramus.keystore keystore.txt`, a potem usuń sam codespace
(https://github.com/codespaces → … → Delete).

## 4. Nowy APK
Przy następnym pushu (albo **Actions → Android APK → Run workflow**) GitHub zbuduje artefakt
`oramus-wallet-release-apk`. W pliku `apk.sha256` jest odcisk certyfikatu (SHA-256) — zapisz go;
każda kolejna wersja musi mieć ten sam.

Ponieważ podpis się zmienia, Android nie zainstaluje nowej wersji na starej: **odinstaluj wersję testową**,
zainstaluj nową i **przywróć portfel z 24 słów**. Dopiero ta wersja pozwala włączyć sieć główną
(Ustawienia → Sieć → wpisz „PRAWDZIWE”).
