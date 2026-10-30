// Rebuilds db/migrations/09_unified.sql from db/source/09_unified.sql.tpl +
// the verbatim webnode capture (scripts/webnode-to-md.mjs). Run only before
// 09 is applied anywhere; afterwards the migration file is frozen.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

// core.autocrlf may check the template out with CRLF
let t = readFileSync('db/source/09_unified.sql.tpl', 'utf8').split('\r\n').join('\n')
for (const k of ['hazirend', 'aszf', 'adatvedelem', 'kornyek']) {
  const md = execFileSync('node', ['scripts/webnode-to-md.mjs', k], { encoding: 'utf8' }).trim()
  if (md.includes('$md$')) throw new Error(`${k}: contains the dollar-quote tag`)
  const slot = `$md$\n{{${k}}}$md$`
  if (!t.includes(slot)) throw new Error(`slot ${k} missing`)
  t = t.split(slot).join(`$md$${md}$md$`)
}
if (t.includes('{{')) throw new Error('unfilled placeholder')
writeFileSync('db/migrations/09_unified.sql', t)
console.log('built db/migrations/09_unified.sql')
