import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["build/**", ".react-router/**", "node_modules/**", "drizzle/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Legitimate here: post-mount localStorage reads (SSR parity) and
      // resetting dialog state when it opens.
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["app/server/**", "app/routes/api/**", "*.config.ts", "drizzle.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
