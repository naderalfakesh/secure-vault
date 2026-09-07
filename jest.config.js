module.exports = {
  preset: 'jest-expo',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.tsx', '!app/**/_layout.tsx'],
  moduleNameMapper: {
    '^@/data/database$': '<rootDir>/src/data/database.jest.ts',
  },
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/dist/'],
};
