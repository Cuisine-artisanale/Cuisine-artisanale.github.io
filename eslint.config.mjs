import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Le code manipule beaucoup de données Firestore non typées : on signale sans bloquer.
      "@typescript-eslint/no-explicit-any": "warn",
      // Apostrophes françaises dans le JSX : règle non pertinente ici.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "next-env.d.ts",
      "functions/**",
      "public/sw.js",
    ],
  },
];

export default eslintConfig;
