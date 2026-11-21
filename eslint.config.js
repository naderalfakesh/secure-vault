// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  {
    ignores: [
      '.claude/**',
      'android/**',
      'coverage/**',
      'dist/**',
      'ios/**',
      'reports/**',
      'expo-env.d.ts',
    ],
  },
  expoConfig,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Packages, then app aliases, then the file's own neighbours.
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@{,modules}/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
  {
    // expo-image caches to disk by default; decrypted content goes through DocumentImage.
    files: ['app/**/*.tsx', 'src/**/*.{ts,tsx}'],
    ignores: [
      'src/features/documents/DocumentImage.tsx',
      'src/services/document/residue.ts',
      '**/__tests__/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-image',
              importNames: ['Image', 'ImageBackground'],
              message: 'Use DocumentImage so decrypted images stay out of the disk cache.',
            },
          ],
        },
      ],
    },
  },
  {
    // ADR 0010: files stay small, and styles live in a sibling *.styles.ts.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx'],
    ignores: ['**/__tests__/**', '**/*.test.tsx'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
          message: 'Put styles in a sibling Name.styles.ts file (ADR 0010).',
        },
      ],
    },
  },
  prettierConfig,
]);
