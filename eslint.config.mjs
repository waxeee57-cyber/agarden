import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Belt-and-suspenders to the build-time secret-guard.mjs: forbid importing the
  // service_role admin client from UI code. The hard guarantee is `server-only`
  // in lib/supabase-admin.ts + secret-guard.mjs; this rule just fails lint early.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase-admin",
              message:
                "service_role client is server-only — never import it from client/shared UI. Use a server action or route handler.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
