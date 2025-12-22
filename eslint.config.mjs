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
      "@typescript-eslint/no-explicit-any": "warn", // Allow 'any' but warn
      "@typescript-eslint/no-unused-vars": [
        "warn", // Change to warn instead of error
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-require-imports": "warn", // Allow require() but warn (needed for optional deps)
      "@typescript-eslint/ban-ts-comment": "off", // Allow @ts-nocheck, @ts-ignore, etc.
    },
  },
];

export default eslintConfig;
