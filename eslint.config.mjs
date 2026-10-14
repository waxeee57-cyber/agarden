import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Backup to the build-time scripts/secret-guard.mjs: UI code must never import
// the DB client or server-only libraries directly. The hard guarantee is
// `import 'server-only'` + secret-guard; this just fails lint early.
const serverOnly = [
  { name: "@/lib/db", message: "DB access is server-only. Use a Server Component or a route handler." },
  { name: "pg", message: "pg is server-only (lib/db.ts)." },
  { name: "@vercel/blob", message: "Blob writes are server-only (lib/photos.ts)." },
  { name: "@/lib/admin/auth", message: "Auth is server-only." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { paths: serverOnly }] },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "assets/**"]),
]);

export default eslintConfig;
