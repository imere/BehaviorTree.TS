import js from "@eslint/js";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import ts from "typescript-eslint";

export default ts.config(
  {
    ignores: ["**/node_modules", "**/dist"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },

      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  js.configs.recommended,
  pluginPrettierRecommended,
  ...ts.configs.recommended,
  {
    rules: {
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
