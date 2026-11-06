# Élesítési checklist – Garden Vendégház Velence & Napsugár Vendégház Velence

A rendszer havi működési költsége 0 Ft (a már meglévő Vercel Pro előfizetésen felül nincs új díj):
Vercel (tárhely), Neon Postgres ingyenes csomag (adatbázis), Gmail SMTP (e-mail), OpenStreetMap (térkép), iCal (naptár-szinkron).
Az alábbi lépéseket csak a tulajdonos (vagy Roli) tudja elvégezni, mert fiókhoz/jelszóhoz kötöttek.

## Állapot (2026-11-06)

| Elem | Állapot |
|---|---|
| Tárhely, adatbázis, migrációk (1–17), deploy | ✅ automatikusan kész, élesben |
| `CRON_SECRET` + 3 óránkénti naptár-szinkron | ✅ beállítva a Vercelben (Production); titok nélkül is biztonságosan fut (10 perces globális korlát) |
| Adatvédelmi oldal: Google (Gmail) adatfeldolgozó, Resend nincs | ✅ élesben ellenőrizve mindkét házon |
| E-mail küldés | ⏳ kód kész (kezelt Resend relay, tulajdonosi fiók nélkül); a küldő kulcs elkészült, **a Vercelbe beírás egy kattintás** (`RESEND_API_KEY`, `EMAIL_FROM=foglalas@drivecostasol.com`, `EMAIL_ENABLED=true`, majd Redeploy) — az automatikus beírást a jogosultsági rendszer letiltotta |
| Árak, szezonok | ⏳ **a tulaj számai kellenek** (3. lépés) – sehol nincs nyilvános listaár; kitalált ár nem kerül ki (a vendég felé ajánlatnak minősülne). Addig a foglaló „egyedi ajánlatot” mutat, foglalni így is lehet |
| Adatfeldolgozói jóváhagyás | ⏳ **a tulaj nyilatkozata** (4. lépés) – adatkezelői jognyilatkozat, más nem teheti meg helyette; addig az oldalon „pótlásra vár” |

E-mail két ingyenes út közül választható (bármelyik elég, a kód mindkettőt kezeli):
- **Gmail** – a ház fiókjában 2FA + alkalmazásjelszó (1. lépés), vagy
- **Brevo** (napi 300 levél, 2FA nélkül) – Brevo-fiók, a feladó e-mail megerősítése egy kattintással, majd
  `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`/`SMTP_PASSWORD` = Brevo SMTP adatok, `EMAIL_ENABLED=true`.

## 1. Gmail: kétlépcsős azonosítás + alkalmazásjelszó (≈5 perc)

A levelek a ház saját Gmail-fiókjából mennek ki (gardenvendeghazvelence@gmail.com).

1. Jelentkezz be a fiókba → https://myaccount.google.com → **Biztonság**.
2. Kapcsold be a **Kétlépcsős azonosítást** (telefonszám vagy hitelesítő app).
3. Nyisd meg: https://myaccount.google.com/apppasswords → név: `vendeghaz-web` → **Létrehozás**.
4. Másold ki a 16 karakteres jelszót (csak egyszer látszik). Ez kerül a `SMTP_PASSWORD` mezőbe.
5. **Napsugár:** két lehetőség
   - ugyanez a Gmail küld mindkét háznak (nincs további teendő), vagy
   - a Napsugárnak saját Gmail-fiók: ott is 1–4. lépés, és az értékek a `SMTP_USER_NAPSUGAR` / `SMTP_PASSWORD_NAPSUGAR` mezőkbe mennek.
   - Az adminban (Szövegek → kapcsolati e-mail) a Napsugárnál add meg a ház e-mail címét is: ide érkeznek a foglalási értesítők.

## 2. Vercel környezeti változók (≈5 perc)

Vercel → `agarden` projekt → **Settings → Environment Variables** → környezet: **Production**.

| Kulcs | Érték | Típus |
|---|---|---|
| `EMAIL_ENABLED` | `true` | Plain |
| `SMTP_USER` | `gardenvendeghazvelence@gmail.com` | Plain |
| `SMTP_PASSWORD` | az 1. lépés alkalmazásjelszava | **Sensitive** |
| `SMTP_USER_NAPSUGAR` / `SMTP_PASSWORD_NAPSUGAR` | csak ha a Napsugárnak külön fiókja van | Plain / **Sensitive** |
| `CRON_SECRET` | ✅ már beállítva | **Sensitive** |

A régi `RESEND_API_KEY` és `EMAIL_FROM` törölhető (a rendszer már nem használja).
Mentés után: **Deployments → legutóbbi Production → Redeploy** (a változók csak új deployban élnek).

**Ellenőrzés:** tegyél egy próbafoglalást távoli dátumra → a vendég-címre és a ház-címre is megjön a levél
→ az adminban mondd le a próbafoglalást.

## 3. Árak (admin → Árak) (≈10 perc)

Amíg nincs ár, a foglaló „egyedi ajánlatot” mutat (foglalni így is lehet).
- **Éjszakai díj:** az egész ház alapára / éj.
- **Szezonális árak:** pl. „Főszezon” 07.01. – 08.31. (utolsó éjszaka), saját ár és min. éjszaka. Az időszakok nem fedhetik egymást.
- **Létszámfelár:** „ennyi fő felett” + Ft/fő/éj (üresen hagyva nincs).
- **Felárak:** 1 éjszakás, kisállat, rendezvény – csak a bekapcsoltak számítanak.

Mindkét házban külön (a Napsugár adminja a napsugar domainen érhető el).

## 4. Adatvédelem újrajóváhagyása (≈1 perc)

Admin → **Adatok** → az adatfeldolgozói lista megváltozott (Resend helyett Google Gmail küldi a leveleket).
Olvasd el, és **pipáld be újra** a jóváhagyást, majd ments. Mindkét házban.

## 5. Naptár-szinkron Airbnb / Booking.com / Szállás.hu (opcionális, ≈5 perc platformonként)

Admin → **Naptár** → lent „Naptár-szinkron”.
1. **A mi naptárunk kifelé:** „Link másolása” → a platform „Naptár importálása / Calendar sync” mezőjébe.
2. **Az ő naptáruk befelé:** a platform „Naptár exportálása” linkjét (https://…ics) illeszd be → Hozzáadás.
   3 óránként frissül (ehhez kell a `CRON_SECRET`), azonnal: „Szinkronizálás most”.

## 6. Nagyobb felbontású Garden-fotók (Roli, egyszeri, ≈5 perc)

Az éles fotók 1200 px-esek (a régi feltöltési korlát), ezért nagy kijelzőn lágyak lehetnek.
A feltöltés mostantól 2400 px / WebP 86. A Garden eredeti, 1920 px-es képei a repóban vannak, újratöltés:

```bash
vercel env pull .env.local          # DATABASE_URL_UNPOOLED + BLOB_READ_WRITE_TOKEN
pnpm photos:import --site velence --dir db/source/garden-webnode/img \
  --manifest db/photo-manifests/velence.json --replace
```

A `--replace` előbb feltölti az új készletet, és csak utána törli a régit (hiba esetén a galéria nem ürül ki).
A manifest a mostani borítóképet és kategóriákat tartalmazza. Napsugár: új, nagyobb felbontású fotók
az adminban (Képek) tölthetők fel; a jelenlegi források 1200 px-esek.

## 7. Később: saját domain

Domain hozzáadása a Vercelben → a `SITE_HOST_MAP` első host-ja legyen az új domain → Redeploy.

---
Hibánál a foglalás akkor is mentődik, ha az e-mail nem megy ki; az admin kezdőlapja jelzi, ha az e-mail ki van kapcsolva.
