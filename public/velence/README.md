# Velence fotók

Dobd ide a ház fotóit — **automatikusan megjelennek** a /velence galériában.
Nincs fix darabszám: ahány fotó itt van, pontosan annyi csempe jelenik meg.

- `velence-hero.jpg` → teljes szélességű hero háttér (opcionális)
- `velence-*.jpg` → galéria-fotók (pl. `velence-01.jpg`, `velence-02.jpg`, `velence-terasz.webp`)

A beolvasás bármilyen `velence-…` nevű képet felvesz, **kis/nagybetűt és**
**ezeket a kiterjesztéseket** tolerálva: `jpg`, `jpeg`, `png`, `webp`, `avif`.
A fotók névsorrendben (természetes, számhelyes) jelennek meg; a `velence-hero.*`
mindig a főkép és nem kerül a galériába. Ha nincs galéria-fotó, a galéria szekció
elrejtőzik (nem mutat üres helyőrzőt).
