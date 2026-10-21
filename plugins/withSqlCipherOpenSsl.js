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
//
// The block sits between begin and end markers. A prebuild without --clean
// keeps the generated build.gradle, so the block is rewritten whenever it
// differs from this version's, and the unmarked AGP 8 block earlier versions
// appended is replaced as well.
const MARKER = 'SQLCipher OpenSSL packaging (plugins/withSqlCipherOpenSsl.js)';
const BEGIN = `// @begin ${MARKER}`;
const END = `// @end ${MARKER}`;

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
${BEGIN}
if (findProperty('expo.sqlite.useSQLCipher') == 'true') {
    configurations.create('sqlCipherOpenSsl') {
        canBeConsumed = false
        transitive = false
    }
    dependencies.add('sqlCipherOpenSsl', '${coordinate}')
    def sqlCipherOpenSslJniLibsDir = layout.buildDirectory.dir('generated/sqlCipherOpenSsl/jniLibs').get().asFile
    def sqlCipherOpenSslJniLibs = tasks.register('extractSqlCipherOpenSslJniLibs', Sync) {
        from(configurations.sqlCipherOpenSsl.elements.map { files -> files.collect { zipTree(it.asFile) } })
        include 'prefab/modules/crypto/libs/android.*/libcrypto.so'
        includeEmptyDirs = false
        eachFile { it.path = it.path.replaceFirst(~/^prefab\\/modules\\/crypto\\/libs\\/android\\./, '') }
        into sqlCipherOpenSslJniLibsDir
    }
    // AGP 9 rejects a task provider here; preBuild below runs the extract first.
    android.sourceSets.main.jniLibs.srcDir(sqlCipherOpenSslJniLibsDir)
    android.packaging.jniLibs.pickFirsts += ['**/libcrypto.so']
    tasks.named('preBuild') { dependsOn(sqlCipherOpenSslJniLibs) }
}
${END}
`;
}

/** Removes the marked block of any version, with the newline written before it. */
function removeMarkedBlock(contents) {
  const begin = contents.indexOf(BEGIN);
  if (begin === -1) return contents;
  const end = contents.indexOf(END, begin);
  if (end === -1) throw new Error('withSqlCipherOpenSsl: the packaging block has no end marker');
  const start = contents[begin - 1] === '\n' ? begin - 1 : begin;
  const stop = contents[end + END.length] === '\n' ? end + END.length + 1 : end + END.length;
  return contents.slice(0, start) + contents.slice(stop);
}

/**
 * Removes the unmarked block earlier versions appended: the marker comment and
 * the `if` block after it, found by matching braces (the block has none in
 * strings or comments).
 */
function removeLegacyBlock(contents) {
  const comment = `// ${MARKER}\n`;
  const begin = contents.indexOf(comment);
  if (begin === -1) return contents;
  let depth = 0;
  let stop = -1;
  for (let index = begin + comment.length; index < contents.length; index += 1) {
    if (contents[index] === '{') depth += 1;
    if (contents[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        stop = index + 1;
        break;
      }
    }
  }
  if (stop === -1) throw new Error('withSqlCipherOpenSsl: the old packaging block is not closed');
  if (contents[stop] === '\n') stop += 1;
  const start = contents[begin - 1] === '\n' ? begin - 1 : begin;
  return contents.slice(0, start) + contents.slice(stop);
}

/** The app build.gradle with exactly one current packaging block. */
function applySqlCipherOpenSsl(contents, coordinate) {
  const snippet = gradleSnippet(coordinate);
  if (contents.includes(snippet) && !contents.includes(`// ${MARKER}\n`)) return contents;
  return removeLegacyBlock(removeMarkedBlock(contents)) + snippet;
}

module.exports = function withSqlCipherOpenSsl(config) {
  return withAppBuildGradle(config, (config) => {
    const coordinate = readOpenSslCoordinate(config.modRequest.projectRoot);
    config.modResults.contents = applySqlCipherOpenSsl(config.modResults.contents, coordinate);
    return config;
  });
};

module.exports.applySqlCipherOpenSsl = applySqlCipherOpenSsl;
