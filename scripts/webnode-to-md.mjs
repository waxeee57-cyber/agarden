// scripts/webnode-to-md.mjs — one-off converter used to build
// db/migrations/09_unified.sql (template: db/source/09_unified.sql.tpl) from the verbatim webnode capture in
// db/source/garden-webnode/*.md. Wording is kept as-is; only layout changes:
//   known section titles / numbered section titles -> "## " headings,
//   runs of blank lines collapsed, webnode chrome lines dropped.
//
//   node scripts/webnode-to-md.mjs hazirend|aszf|adatvedelem|kornyek

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'source', 'garden-webnode')
const read = (f) => readFileSync(join(src, f), 'utf8').split('\n').slice(2) // drop provenance comment + title

const HAZIREND_HEADS = new Set([
  'Szállásfoglalás', 'Bejelentkezés / Kijelentkezés', 'Szállás', 'Fizetés', 'Felelősségvállalás', 'Dohányzás',
  'Tűzrakás, bográcsozás', 'Háziállatok', 'Parkolás', 'Elektromos autó töltése', 'Berendezési tárgyak és a kert használata',
  'A jakuzzi használatának szabályzata', 'Infraszauna használatának szabályzata', 'Általános biztonsági szabályok',
  'Takarítás', 'Hulladék elhelyezése', 'Fűtés/klíma', 'Biztonság',
])

function tidy(lines) {
  const out = []
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, '').replace(/^\s+/, '')
    if (!l) { if (out.length && out[out.length - 1] !== '') out.push(''); continue }
    out.push(l)
  }
  while (out[0] === '') out.shift()
  while (out[out.length - 1] === '') out.pop()
  return out
}

function hazirend() {
  let lines = tidy(read('hazirend.md'))
  // drop the page's own title block ("Garden Vendégház Velence" / "Házirendje!")
  const start = lines.indexOf('Kérjük, figyelmesen olvassa el!')
  lines = lines.slice(start)
  return lines.map((l) => (HAZIREND_HEADS.has(l) ? `## ${l}` : l))
}

function aszf() {
  let lines = tidy(read('altalanos-szerzodesi-feltetelek.md'))
  if (lines[0] === 'Általános szerződési feltételek') lines = lines.slice(1)
  // numbered section titles; numbers must increase (list items like "4. A Vendég …" are not titles)
  let last = 0
  return lines.map((l) => {
    const m = /^(\d{1,2})\. [A-ZÁÉÍÓÖŐÚÜŰ][^.]{2,70}[:.]?$/.exec(l)
    if (!m || Number(m[1]) <= last) return l
    last = Number(m[1])
    return `## ${l.replace(/[:.]$/, '')}`
  })
}

function adatvedelem() {
  const lines = tidy(read('kapcsolat.md'))
  const from = lines.indexOf('Általános adatvédelmi rendelet (GDPR)')
  return lines.slice(from + 1).map((l) => (/^[IVX]+\. \S/.test(l) && l.length < 80 ? `## ${l}` : l))
}

function kornyek() {
  const lines = tidy(read('programok.md'))
  return tidy(lines.slice(1)).map((l) => (/^https?:\/\//.test(l) ? `- ${l}` : l))
}

const which = process.argv[2]
const fn = { hazirend, aszf, adatvedelem, kornyek }[which]
if (!fn) { console.error('usage: hazirend|aszf|adatvedelem|kornyek'); process.exit(1) }
process.stdout.write(fn().join('\n') + '\n')
