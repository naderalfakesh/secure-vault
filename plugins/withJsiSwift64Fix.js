const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-modules-jsi builds its xcframework locally and strips C++ declarations
// from the public .swiftinterface. The SDK 57 strip only knows Swift 6.3's
// spelling, so with Xcode 27.1 (Swift 6.4) every importer of ExpoModulesJSI
// fails with "cannot find type '__ObjC::expo' in scope". SDK 58 fixed the strip;
// plugins/jsi-interface-patch.py backports that one line.
//
// The hook runs at every `pod install`, so a fresh `npm install` is patched
// again. The package's slice cache does not hash its build script, so a patch
// also clears that cache to make the next build regenerate the interfaces.
// Prebuilt Expo xcframeworks are built with one Swift version too, which is why
// app.json sets expo-build-properties ios.usePrecompiledModules to false.
const PRE_INSTALL_SNIPPET = `
  # ExpoModulesJSI Swift 6.4 interface fix (injected by plugins/withJsiSwift64Fix.js)
  pre_install do |installer|
    project_root = installer.sandbox.root.dirname.dirname
    jsi_dir = File.join(File.dirname(\`node --print "require.resolve('expo-modules-jsi/package.json')"\`.strip), 'apple')
    result = \`python3 "#{File.join(project_root, 'plugins', 'jsi-interface-patch.py')}" "#{jsi_dir}"\`.strip
    raise 'ExpoModulesJSI interface patch failed' unless $?.success?
    system('bash', File.join(jsi_dir, 'scripts', 'clear-caches.sh')) if result == 'patched'
  end

`;

module.exports = function withJsiSwift64Fix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('ExpoModulesJSI Swift 6.4 interface fix')) {
        const anchor = /(  post_install do \|installer\|\n)/;
        if (!anchor.test(contents)) {
          throw new Error('withJsiSwift64Fix: no post_install block found in Podfile');
        }
        contents = contents.replace(anchor, `${PRE_INSTALL_SNIPPET}$1`);
        fs.writeFileSync(podfile, contents);
      }
      return config;
    },
  ]);
};
