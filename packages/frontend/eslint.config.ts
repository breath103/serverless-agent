import type { Linter, Rule } from "eslint";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import eslint from "@eslint/js";
import stylistic, { type RuleOptions as StylisticRuleOptions } from "@stylistic/eslint-plugin";

function createMaxLinesRule(max: number, message: string): { plugin: { rules: Record<string, Rule.RuleModule> }; rule: Linter.RuleEntry } {
  const rule: Rule.RuleModule = {
    meta: { type: "suggestion", schema: [] },
    create(context) {
      return {
        "Program:exit"(node) {
          const lines = context.sourceCode.lines.filter(l => l.trim().length > 0 && !l.trim().startsWith("//"));
          if (lines.length > max) {
            context.report({ node, message: `${message} (${lines.length}/${max} lines)` });
          }
        },
      };
    },
  };
  return {
    plugin: { rules: { "max-lines": rule } },
    rule: ["error"],
  };
}

export default [
  { ignores: ["dist/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    arrowParens: false,
    commaDangle: "only-multiline",
    braceStyle: "1tbs",
  }),
  {
    rules: {
      "@stylistic/operator-linebreak": "off",
      "@stylistic/arrow-parens": "off",
      "@stylistic/multiline-ternary": "off",
      "@stylistic/jsx-one-expression-per-line": "off",
      "@stylistic/jsx-closing-bracket-location": "off",
      "@stylistic/member-delimiter-style": ["error", {
        multiline: {
          delimiter: "semi",
          requireLast: true,
        },
        singleline: {
          delimiter: "semi",
          requireLast: false,
        },
        multilineDetection: "brackets",
      }],
    } satisfies { [K in keyof StylisticRuleOptions]?: Linter.RuleSeverity | [Linter.RuleSeverity, ...StylisticRuleOptions[K]]; },
  },
  {
    ...betterTailwindcss.configs.recommended,
    settings: {
      "better-tailwindcss": {
        entryPoint: "./src/global.css",
      },
    },
    rules: {
      ...betterTailwindcss.configs.recommended.rules,

      // Tailwind CSS
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": ["warn", { detectComponentClasses: true }],
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
      "unicorn": unicorn,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "quotes": ["error", "double", { avoidEscape: true }],
      "comma-spacing": ["error", { before: false, after: true }],
      "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-restricted-types": ["error", {
        types: {
          unknown: { message: "Use a specific type. Add an eslint-disable comment if unknown is intentional." },
        },
      }],
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/require-await": "warn",
      "simple-import-sort/imports": ["error", {
        groups: [
          ["^node:"],
          ["^[a-z]"],
          ["^@(?!/)"],
          ["^@/"],
          ["^\\."],
        ],
      }],
      "simple-import-sort/exports": "error",
      "unicorn/prefer-node-protocol": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
      // Explicit return type on switches over discriminated unions makes TS
      // prove exhaustiveness; ESLint's syntactic `no-fallthrough` adds no
      // safety on top of that and just forces noise (assertNever/throw/etc).
      "no-fallthrough": "off",
      "no-restricted-syntax": ["error", {
        selector: "ExpressionStatement > Literal[value='use client']",
        message: "\"use client\" is not needed — this is not a Next.js project.",
      }, {
        selector: "ExpressionStatement > Literal[value='use server']",
        message: "\"use server\" is not needed — this is not a Next.js project.",
      }],

      // Custom rule for @backend import
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [{
          name: "@backend",
          message: "Use 'import type' for @backend imports. Runtime imports from backend are not allowed in frontend.",
          allowTypeImports: true,
        }],
        patterns: [{
          regex: "^@backend/",
          message: "Use 'import type' for @backend imports. Runtime imports from backend are not allowed in frontend.",
          allowTypeImports: true,
        }],
      }],
    },
  },
  (() => {
    const { plugin, rule } = createMaxLinesRule(100, "Route file must be under 100 lines. Anything beyond that should be broken down into separate component files.");
    return {
      files: ["src/routes/**/_route.tsx"],
      plugins: { local: plugin },
      rules: { "local/max-lines": rule },
    };
  })(),
];
