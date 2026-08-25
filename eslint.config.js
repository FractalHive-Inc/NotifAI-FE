import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettierPlugin from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig,
    ],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Prettier as an ESLint rule
      'prettier/prettier': 'error',

      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },
  {
    /**
     * The registry boundary.
     *
     * Everything under src/shared/components/ui/ is a mirror of the FractalHive
     * registry and is overwritten wholesale on refresh, so a page that reaches
     * into it couples itself to a file nobody here owns — that is how onRowClick
     * and emptyState were silently lost in an earlier pull. Pages go through the
     * app-owned wrapper, which is the one place that absorbs upstream churn.
     *
     * Scoped to pages on purpose: features still use the raw table primitives
     * (see LineItemsTable) and the ColumnDef type directly, which is fine —
     * those are stable re-exports, not app behaviour parked in vendored files.
     */
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/components/ui/table', '@/shared/components/ui/table/*'],
              message:
                'Import { DataTable } from @/shared/components/data-table instead — ui/table is vendored from the registry and is replaced on every refresh.',
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * Vendored FractalHive registry components.
     *
     * These files are overwritten wholesale by `npx shadcn add`, so any rule we
     * enforce here has to be hand-re-applied on every refresh. The repo used to
     * split each cva block into a `<name>-variants.ts` to satisfy fast refresh;
     * that is what made every pull a manual reorganisation. Fast-refresh
     * granularity inside a design system we do not edit is not worth that cost.
     */
    files: [
      'src/shared/components/ui/**/*.{ts,tsx}',
      'src/shared/lib/utils.ts',
      'src/shared/lib/utils/**/*.{ts,tsx}',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
      /**
       * The registry ships semicolons; this repo's Prettier config does not
       * want them. Enforcing our formatting here meant ~1,600 lint errors the
       * moment anything was pulled, which trains everyone to run lint with a
       * blindfold on. check-registry-drift.mjs already normalises both sides
       * through Prettier before comparing, so on-disk formatting of vendored
       * files is not load-bearing.
       */
      'prettier/prettier': 'off',
    },
  },
])
