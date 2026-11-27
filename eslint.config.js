// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// expo-image caches to disk by default; decrypted content goes through DocumentImage.
const DISK_CACHED_IMAGE = {
  name: 'expo-image',
  importNames: ['Image', 'ImageBackground'],
  message: 'Use DocumentImage so decrypted images stay out of the disk cache.',
};

// Screens and features build on the design system, not on the raw primitives.
const RAW_PRIMITIVE_NAMES = [
  'Text',
  'Button',
  'Switch',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
];
const RAW_PRIMITIVES = {
  name: 'react-native',
  importNames: [...RAW_PRIMITIVE_NAMES, 'Alert'],
  message:
    'Use the primitives in @/components/ui. Native alerts are for destructive confirmations only.',
};

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
  // Two import bans, combined per file because a later block replaces the rule.
  {
    files: ['app/**/*.tsx', 'src/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'src/testing/**'],
    rules: { 'no-restricted-imports': ['error', { paths: [DISK_CACHED_IMAGE, RAW_PRIMITIVES] }] },
  },
  {
    // The design system is where the raw primitives are wrapped.
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: { 'no-restricted-imports': ['error', { paths: [DISK_CACHED_IMAGE] }] },
  },
  {
    // The image wrapper itself, and the sweep that clears expo-image's cache.
    files: ['src/features/documents/DocumentImage.tsx', 'src/services/document/residue.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [RAW_PRIMITIVES] }] },
  },
  {
    // "Delete everything" is the one destructive confirmation: a native alert.
    files: ['src/features/session/eraseEverything.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [DISK_CACHED_IMAGE, { ...RAW_PRIMITIVES, importNames: RAW_PRIMITIVE_NAMES }] },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', 'modules/*/src/**/*.ts'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.mock.ts', 'src/testing/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // ADR 0010: files stay small, and styles live in a sibling *.styles.ts.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', 'modules/*/src/**/*.ts'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.mock.ts'],
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
