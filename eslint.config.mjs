import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "functions/lib/", "**/node_modules/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  {
    // AGENTS rule 8: the live layer is seeded and driven by round time.
    files: ["web/lib/renderer/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use p5 random() seeded from round.seed." },
        { object: "Date", property: "now", message: "Use t = serverNow() - startsAt." },
      ],
    },
  },
);
