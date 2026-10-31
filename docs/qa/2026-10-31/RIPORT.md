# Finomítás a referencia szintjére — riport (2026-10-31)

Kérés: „az apró részletekre figyelj, minden legyen a legletisztultabb, legmodernebb”.
Jelölés: **[REPO]** = kódból mérve, **[DEPLOY]** = élesben mérve.

## Mit hasonlítottam össze

Mindkét oldalt képernyőnként, 1440 px széles nézetben vetettem össze: a velenceviolavilla.hu-t és a Garden-főoldalt (képek: `prod/`). Az eltérések, amelyek miatt a referencia letisztultabbnak hatott:

| # | Részlet | Referencia | Nálunk volt | Most [REPO][DEPLOY] |
|---|---|---|---|---|
| 1 | Címsor-betű | vékony didone (Prata) | vastag Young Serif, 3 soros hero-cím | **Gilda Display**, a Prata legközelebbi rokona. A Prata ő/ű nélküli (nincs latin-ext), ezért a mi szövegünkhöz nem használható. A hero-cím desktopon egy sorban fut. |
| 2 | Szövegtörzs | Open Sans, könnyed | Schibsted, tömörebb | **Hanken Grotesk** változó vágás, 1.6–1.75 sorköz |
| 3 | Gombok | kicsi, nagybetűs, ritkított | vastag pirulák | 4 px lekerekítés, nagybetű, 0.14em ritkítás, fehér hero-gomb |
| 4 | Ikonok | vékony vonalas, sötét | vastagabb, színes | 1.15–1.25 vonalvastagság, tinta szín |
| 5 | Tény-sáv | fotó + fehér kártya | tömör olíva blokk | kerti fotó + fehér kártya finom árnyékkal |
| 6 | Színes blokk | tompa mély tónus | telített akcentus | házanként egy tompa „deep” tónus (Garden `#3E4534`, Napsugár `#31505A`); az akcentus csak a gombokon |
| 7 | Lábléc | középre zárt név + kör alakú kontakt-ikonok | 3 oszlop | középre zárt: név, cím, NTAK, telefon/e-mail körökkel, social, testvérház, jogi sor |
| 8 | Konténerek | egységes | 6xl és 7xl keverve, ezért az aloldalak címe elcsúszott | mindenhol `max-w-6xl`, lekerekítés 10/14 px |
| 9 | Apró hibák | — | e-mail törés „…gmail.co / m”; a „6+2 fő” mellett ház-ikon | javítva (a `\b` nem működik ékezet után) |

A sorszámokat a „Jó tudni” blokkból kivettem: nem sorrendet jelölnek, és a sorszámozás sablonos hatású.

## Mérések [DEPLOY]

Lighthouse 12.8.2, mobil (JSON: `lighthouse/`):

| oldal | Teljesítmény (futások) | medián | A11y / BP / SEO |
|---|---|---|---|
| Garden `/` (hero preload után, 6 futás) | 88 / 90 / 95 / 97 / 96 / 95 | **95** | 100 / 100 / 100 |
| Garden `/foglalas` | 99 / 99 / 99 | **99** | 100 / 100 / 100 |
| Napsugár `/` (hero preload után, 6 futás) | 87 / 96 / 95 / 95 / 95 / 95 | **95** | 100 / 100 / 100 |
| Napsugár `/foglalas` | 98 / 100 / 98 | **98** | 100 / 100 / 100 |

- A hero-kép mobilon 31–39 KB. Az LCP fő része a renderelési késleltetés (1,2–1,5 s), a kiugró futásokban a hálózati TTFB.
- A hero-képet most `<head>` preload indítja (`preload` prop, Next 16).
- Képernyőképek: `prod/`, 1440 és 390 px, mindkét domain, 9 oldal + nyitott menü. Konzolhiba: 0, vízszintes görgetés: 0.
- Tesztek [REPO]: DB 16/16, app 22/22. Lint: 0 hiba, 4 figyelmeztetés a meglévő `window.location` mintákra.

## Változatlanul nyitott tulajdonosi teendők

Lásd a `../2026-10-30/RIPORT.md` 4. pontját: bankszámlaszám, domrol.com DNS az e-mailhez, üzemeltetői adatok, a GDPR-szöveg átnézése, az élő admin-próba.
