const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Google ML Kit ships static frameworks without an arm64-simulator slice and
// pins EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64 in its podspecs. Xcode 26
// removed Rosetta simulator support, so an x86_64 simulator app can no longer
// install; without this fix Xcode offers no usable simulator destination at all.
//
// The hook injected below runs at the end of every `pod install`:
//   1. strips the EXCLUDED_ARCHS override from all generated xcconfigs, and
//   2. deletes LC_BUILD_VERSION from the arm64 objects of every ML Kit framework
//      that carries one, so those objects link for device and simulator alike
//      (Google already ships some ML Kit frameworks that way).
//
// Origin: the same fix used by Nadir Wallet's face-liveness and code-scanner
// plugins; generalized here to patch every MLKit* and MLImage framework.
// CocoaPods writes the aggregate Pods-<App> xcconfigs after post_install, so
// the strip must run in post_integrate, when every xcconfig is final.
const POST_INTEGRATE_SNIPPET = `
  # ML Kit arm64-simulator fix (injected by plugins/withMlkitSimulatorFix.js)
  post_integrate do |installer|
    Dir.glob(File.join(installer.sandbox.root, 'Target Support Files', '**', '*.xcconfig')).each do |f|
      txt = File.read(f)
      out = txt.gsub(/^EXCLUDED_ARCHS\\[sdk=iphonesimulator\\*\\] = arm64\\n/, '')
      File.write(f, out) if out != txt
    end
    mlkit_patch = File.expand_path('../plugins/mlkit-sim-patch.py', installer.sandbox.root.dirname)
    Dir.glob(File.join(installer.sandbox.root, '{MLKit*,MLImage}', 'Frameworks', '*.framework')).each do |fw|
      bin = File.join(fw, File.basename(fw, '.framework'))
      system('python3', mlkit_patch, bin, '0') if File.exist?(bin)
    end
  end

`;

module.exports = function withMlkitSimulatorFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('ML Kit arm64-simulator fix')) {
        const anchor = /(  post_install do \|installer\|\n)/;
        if (!anchor.test(contents)) {
          throw new Error('withMlkitSimulatorFix: no post_install block found in Podfile');
        }
        contents = contents.replace(anchor, `${POST_INTEGRATE_SNIPPET}$1`);
        fs.writeFileSync(podfile, contents);
      }
      return config;
    },
  ]);
};
