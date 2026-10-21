const { describe, expect, it } = require('@jest/globals');

const { applySqlCipherOpenSsl } = require('../withSqlCipherOpenSsl');

const COORDINATE = 'io.github.ronickg:openssl:3.3.2';
const TEMPLATE = "android {\n    namespace 'com.naderalfakesh.securevault'\n}\n";

// What the plugin appended before it was versioned: AGP 8's task provider and packagingOptions.
const AGP8_BLOCK = `
// SQLCipher OpenSSL packaging (plugins/withSqlCipherOpenSsl.js)
if (findProperty('expo.sqlite.useSQLCipher') == 'true') {
    configurations.create('sqlCipherOpenSsl') {
        canBeConsumed = false
        transitive = false
    }
    dependencies.add('sqlCipherOpenSsl', '${COORDINATE}')
    def sqlCipherOpenSslJniLibs = tasks.register('extractSqlCipherOpenSslJniLibs', Sync) {
        from(configurations.sqlCipherOpenSsl.elements.map { files -> files.collect { zipTree(it.asFile) } })
        into layout.buildDirectory.dir('generated/sqlCipherOpenSsl/jniLibs')
    }
    android.sourceSets.main.jniLibs.srcDir(sqlCipherOpenSslJniLibs)
    android.packagingOptions.jniLibs.pickFirsts += ['**/libcrypto.so']
    tasks.named('preBuild') { dependsOn(sqlCipherOpenSslJniLibs) }
}
`;

describe('withSqlCipherOpenSsl', () => {
  it('appends the packaging block once', () => {
    const once = applySqlCipherOpenSsl(TEMPLATE, COORDINATE);
    expect(once.startsWith(TEMPLATE)).toBe(true);
    expect(once).toContain('android.packaging.jniLibs.pickFirsts');
    expect(applySqlCipherOpenSsl(once, COORDINATE)).toBe(once);
  });

  it('replaces the AGP 8 block a prebuild without --clean left behind', () => {
    const after = `${TEMPLATE}${AGP8_BLOCK}\n// another plugin\napply plugin: 'x'\n`;

    const updated = applySqlCipherOpenSsl(after, COORDINATE);

    expect(updated).not.toContain('android.packagingOptions');
    expect(updated).not.toContain('jniLibs.srcDir(sqlCipherOpenSslJniLibs)');
    expect(updated).toContain('android.packaging.jniLibs.pickFirsts');
    expect(updated).toContain("// another plugin\napply plugin: 'x'\n");
    expect(updated.match(/extractSqlCipherOpenSslJniLibs/g)).toHaveLength(1);
    expect(applySqlCipherOpenSsl(updated, COORDINATE)).toBe(updated);
  });

  it('replaces a block written for another OpenSSL version', () => {
    const old = applySqlCipherOpenSsl(TEMPLATE, 'io.github.ronickg:openssl:3.0.0');

    const updated = applySqlCipherOpenSsl(old, COORDINATE);

    expect(updated).toContain(COORDINATE);
    expect(updated).not.toContain('openssl:3.0.0');
  });
});
