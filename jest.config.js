module.exports = {
  preset: 'jest-expo',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.tsx', '!app/**/_layout.tsx'],
  moduleNameMapper: {
    '^@/data/database$': '<rootDir>/src/data/database.jest.ts',
  },
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // jest-expo's default list plus the ESM-only noble packages used for PIN hashing.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/dist/'],
};
