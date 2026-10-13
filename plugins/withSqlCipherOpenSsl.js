const { withAppBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-sqlite builds SQLCipher against the OpenSSL prefab package
// (io.github.ronickg:openssl) as a compileOnly dependency and leaves packaging
// libcrypto.so to the Android Gradle Plugin, which copies the shared libraries
// it finds on the CMake link line. AGP 8.12 keeps a link fragment only when it
// ends with ".so", and CMake quotes fragments whose path contains a space, so a
// project or Gradle home under a path such as "/Volumes/Samsung SSD 990 2TB"
// ships an APK without libcrypto.so and libexpo-sqlite.so fails to load.
//
// This plugin packages libcrypto.so explicitly from the artifact expo-sqlite
// links against (the coordinate is read from its build.gradle so the two stay
// in step). Where AGP packages the library itself the duplicate is identical
// and pickFirst keeps one copy.
const MARKER = 'SQLCipher OpenSSL packaging (plugins/withSqlCipherOpenSsl.js)';

function readOpenSslCoordinate(projectRoot) {
  const buildGradle = path.join(
    path.dirname(require.resolve('expo-sqlite/package.json', { paths: [projectRoot] })),
    'android',
    'build.gradle',
  );
  const match = fs
    .readFileSync(buildGradle, 'utf8')
    .match(/['"](io\.github\.ronickg:openssl:[^'"]+)['"]/);
  if (!match) {
    throw new Error(`withSqlCipherOpenSsl: no OpenSSL dependency found in ${buildGradle}`);
  }
  return match[1];
}

function gradleSnippet(coordinate) {
  return `
// ${MARKER}
if (findProperty('expo.sqlite.useSQLCipher') == 'true') {
    configurations.create('sqlCipherOpenSsl') {
        canBeConsumed = false
        transitive = false
    }
    dependencies.add('sqlCipherOpenSsl', '${coordinate}')
    def sqlCipherOpenSslJniLibs = tasks.register('extractSqlCipherOpenSslJniLibs', Sync) {
        from(configurations.sqlCipherOpenSsl.elements.map { files -> files.collect { zipTree(it.asFile) } })
        include 'prefab/modules/crypto/libs/android.*/libcrypto.so'
        includeEmptyDirs = false
        eachFile { it.path = it.path.replaceFirst(~/^prefab\\/modules\\/crypto\\/libs\\/android\\./, '') }
        into layout.buildDirectory.dir('generated/sqlCipherOpenSsl/jniLibs')
    }
    android.sourceSets.main.jniLibs.srcDir(sqlCipherOpenSslJniLibs)
    android.packagingOptions.jniLibs.pickFirsts += ['**/libcrypto.so']
    tasks.named('preBuild') { dependsOn(sqlCipherOpenSslJniLibs) }
}
`;
}

module.exports = function withSqlCipherOpenSsl(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(MARKER)) {
      const coordinate = readOpenSslCoordinate(config.modRequest.projectRoot);
      config.modResults.contents += gradleSnippet(coordinate);
    }
    return config;
  });
};
