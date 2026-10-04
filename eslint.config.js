import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import ts from "typescript-eslint";

const prettierOptions = {
  semi: true,
  useTabs: false,
  tabWidth: 2,
  singleQuote: false,
  printWidth: 100,
  trailingComma: "es5",
  endOfLine: "lf",
  quoteProps: "as-needed",
};

export default defineConfig(
  globalIgnores(["**/node_modules", "**/build", "**/dist", ".rollup.cache"]),
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  js.configs.recommended,
  pluginPrettierRecommended,
  ts.configs.recommended,
  {
    // declaration files need `var` to land on globalThis
    files: ["**/*.d.ts"],
    rules: {
      "no-var": "off",
    },
  },
  {
    rules: {
      "prettier/prettier": ["error", prettierOptions],
      "prefer-const": [
        "error",
        {
          destructuring: "all",
          ignoreReadBeforeAssign: false,
        },
      ],
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "all",
        },
      ],
    },
  }
);
