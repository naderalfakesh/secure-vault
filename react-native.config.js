// iOS reads document text with Apple Vision (ADR 0011), so the ML Kit text
// recognition pods are not linked there; Android keeps ML Kit.
module.exports = {
  dependencies: {
    '@react-native-ml-kit/text-recognition': {
      platforms: { ios: null },
    },
  },
};
