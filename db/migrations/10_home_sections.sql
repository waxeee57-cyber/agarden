-- ============================================================
-- 10_home_sections — homepage blocks after the reference structure the owner
-- picked (velenceviolavilla.hu, 2026-10-30): hero kicker, a 6-item feature
-- grid with icons, and "Jó tudni" practical notes. Every line is a fact
-- already published by the owner (Garden: webnode main page + house rules;
-- Napsugár: szallas.hu listing, see 05). Runs once; admin edits are kept.
-- ============================================================

update listings set content = content || jsonb_build_object(
  'hero_kicker', 'Egyben bérelhető ház · 10+2 fő',
  'features', jsonb_build_array(
    jsonb_build_object('i', 'tub', 't', '6 fős jakuzzi', 'd', 'A fedett terasz wellness sarkában, a teljes feltöltődéshez.'),
    jsonb_build_object('i', 'heat', 't', '2 fős szauna', 'd', 'Közvetlenül a jakuzzi mellett, a fedett teraszon.'),
    jsonb_build_object('i', 'fire', 't', 'Grill és bogrács', 'd', 'Bekerített kert grillezési és bográcsozási lehetőséggel.'),
    jsonb_build_object('i', 'car', 't', 'Ingyenes parkolás', 'd', '3 személyautó részére, a zárt udvarban és a ház előtt.'),
    jsonb_build_object('i', 'bed', 't', '4 hálószoba', 'd', 'Az emeleten erkéllyel, fürdőszobával és külön WC-vel.'),
    jsonb_build_object('i', 'paw', 't', 'Kisállat is jöhet', 'd', 'Kistestű házi kedvenc felár ellenében, előzetes egyeztetéssel.')),
  'good_to_know', jsonb_build_array(
    'Érkezés 14:00-tól, távozás 10:00-ig. Korábbi érkezés vagy későbbi távozás előzetes egyeztetéssel lehetséges.',
    'Babaágyat díjmentesen biztosítunk: kérjük, legkésőbb 3 nappal érkezés előtt jelezd.',
    'Igény esetén a tulajdonos az érkezés és a távozás időpontjában a helyszínen van.'))
where slug = 'velence';

update listings set content = content || jsonb_build_object(
  'hero_kicker', 'Egyben bérelhető családi ház · 6+2 fő',
  'features', jsonb_build_array(
    jsonb_build_object('i', 'sun', 't', 'Kültéri medence', 'd', 'Szezonálisan, 25–28 °C, 70–85 cm mély.'),
    jsonb_build_object('i', 'tub', 't', 'Jakuzzi egész évben', 'd', 'Kültéri jakuzzi a fedett, fa burkolatú teraszon.'),
    jsonb_build_object('i', 'fire', 't', '200 m² udvar', 'd', 'Grill, bogrács és szalonnasütés az árnyas udvaron.'),
    jsonb_build_object('i', 'car', 't', 'Zárt parkoló', 'd', '3 zárt parkolóhely, mellette ingyenes utcai parkolás.'),
    jsonb_build_object('i', 'snow', 't', 'Saját klíma', 'd', 'Mindkét hálószobában fűtő-hűtő klíma, lent padlófűtés.'),
    jsonb_build_object('i', 'baby', 't', 'Gyerekbarát', 'd', 'Etetőszék, kiságy és bébiétel-melegítés.')),
  'good_to_know', jsonb_build_array(
    'Érkezés 14:00 és 18:00 között, távozás 10:00-ig. Ha később érkeztek, jelezzétek előre.',
    'Érkezéskor 80 000 Ft kauciót kérünk, amely károkozás hiányában maradéktalanul visszajár.',
    'Idegenforgalmi adó: 18 éves kor felett 800 Ft / fő / éj, a szálláshelyen fizetendő.'))
where slug = 'napsugar';
