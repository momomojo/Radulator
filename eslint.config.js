import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const appFiles = ['src/**/*.{js,jsx,mjs}']
const nodeFiles = [
  '*.config.js',
  'playwright*.config.js',
  'scripts/**/*.{js,mjs}',
]
const testFiles = ['tests/**/*.js']

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', '.claude']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: testFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'src/components/calculators/**/*.jsx',
      'src/components/ui/**/*.jsx',
      'src/context/**/*.jsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: appFiles,
    ignores: [
      'src/components/calculators/**/*.jsx',
      'src/components/ui/**/*.jsx',
      'src/context/**/*.jsx',
    ],
  },
])
