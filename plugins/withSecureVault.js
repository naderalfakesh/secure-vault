const {
  withPlugins,
  withInfoPlist,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSecureVault = (config) => {
  return withPlugins(config, [
    // iOS
    (config) => {
      return withInfoPlist(config, (config) => {
        config.modResults.NSFaceIDUsageDescription =
          'SecureVault uses Face ID to unlock your documents.';
        return config;
      });
    },
    // Android
    (config) => {
      return withAndroidManifest(config, (config) => {
        config.modResults.manifest['uses-permission'] = [
          ...(config.modResults.manifest['uses-permission'] || []),
          { $: { 'android:name': 'android.permission.USE_BIOMETRIC' } },
        ];
        return config;
      });
    },
    (config) => {
      return withDangerousMod(config, [
        'android',
        async (config) => {
          const proguardRulesPath = path.join(
            config.modRequest.platformProjectRoot,
            'app',
            'proguard-rules.pro',
          );
          const proguardRules = `
-keep class expo.modules.vault.** { *; }
# ML Kit's registrars are created by reflection from manifest names.
-keep class * implements com.google.firebase.components.ComponentRegistrar { void <init>(); }
-keep,allowshrinking interface com.google.firebase.components.ComponentRegistrar
`;
          await fs.promises.appendFile(proguardRulesPath, proguardRules);
          return config;
        },
      ]);
    },
  ]);
};

module.exports = withSecureVault;
