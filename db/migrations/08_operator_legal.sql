-- ============================================================
-- 08_operator_legal — operator / legal data the owner fills in from the admin
-- ("Adatok" tab). The ÁSZF and the privacy notice read it; anything still empty
-- stays a visible "pótlásra vár" marker (never invented).
--
-- Shape (all keys optional): operator_name, operator_address, tax_number,
-- payment_terms, cancellation, retention (text; multi-line = one point per
-- line), processors_confirmed (boolean).
-- ============================================================

alter table listings add column if not exists legal jsonb not null default '{}'::jsonb;

-- Napsugár: the payment terms already published in its ÁSZF (stated by the
-- owner, previously hard-coded in app/[site]/aszf/page.tsx) move into the
-- editable field so the owner can change them.
update listings
   set legal = legal || jsonb_build_object('payment_terms',
     'A teljes összeg legkésőbb az érkezés napján esedékes, forintban vagy euróban.' || chr(10) ||
     'Érkezéskor 80 000 Ft kaució fizetendő, amely károkozás hiányában maradéktalanul visszajár.' || chr(10) ||
     'Idegenforgalmi adó: 18 éves kor felett 800 Ft / fő / éj, a szálláshelyen fizetendő.' || chr(10) ||
     'A medence használata külön díjas lehet; fűtés és klíma használatakor fogyasztás szerinti energiadíj kerülhet felszámításra.')
 where slug = 'napsugar' and not (legal ? 'payment_terms');
