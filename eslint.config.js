// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  {
    ignores: ['android/**', 'coverage/**', 'dist/**', 'ios/**', 'reports/**', 'expo-env.d.ts'],
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
    },
  },
  {
    // expo-image caches to disk by default; decrypted content goes through DocumentImage.
    files: ['app/**/*.tsx', 'src/**/*.{ts,tsx}'],
    ignores: [
      'src/features/documents/DocumentImage.tsx',
      'src/services/DocumentService.ts',
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
  prettierConfig,
]);
