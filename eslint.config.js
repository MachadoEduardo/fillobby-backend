import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.nodeBuiltin,
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-duplicate-imports": "error",
      "no-unused-vars": [
        "error",
        {
          args: "none",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
]);
