// scripts/migrate-on-build.mjs — apply pending db/migrations during the Vercel
// PRODUCTION build only, before `next build` prerenders the house pages.
// Preview/dev builds skip it, so they never touch the production database.
// A failing migration fails the build: nothing half-migrated gets deployed.
import { migrate } from './migrate.mjs'

const url = process.env.DATABASE_URL_UNPOOLED
if (process.env.VERCEL_ENV !== 'production') {
  console.log('migrate-on-build: skipped (not a Vercel production build)')
} else if (!url) {
  console.error('migrate-on-build: DATABASE_URL_UNPOOLED missing in the production build')
  process.exit(1)
} else {
  await migrate(url).catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
