package expo.modules.vault

import android.content.Context
import android.content.SharedPreferences
import java.io.File
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.SecretKey

/**
 * Vault entry naming rules, path containment, legacy IV lookup and Keystore key access.
 */
internal class VaultEntryStore(
    private val contextProvider: () -> Context,
    private val keyAlias: String,
    private val keystoreProvider: String,
) {
    private val ivPreferences: SharedPreferences by lazy {
        contextProvider().getSharedPreferences("ExpoVault_IVs", Context.MODE_PRIVATE)
    }

    /**
     * Vault entries share the app's files directory with other libraries'
     * files (the dev client's bundle, profile markers), so only names the
     * vault itself writes count: document files, thumbnails, pages, and the
     * underscore-prefixed metadata entries.
     */
    fun isVaultEntryName(name: String): Boolean =
        name.startsWith("file_") || name.startsWith("thumb_") || name.startsWith("page_") ||
            (name.startsWith("_") && name != "ExpoVault_IVs.xml")

    /**
     * Approved key grammar: one path component, no separators or "..", with
     * one of the vault's own prefixes. Checked before any path is built.
     */
    fun isVaultKey(key: String): Boolean =
        key.isNotEmpty() && !key.contains('/') && !key.contains('\\') && !key.contains("..") &&
            isVaultEntryName(key)

    /**
     * Restore entries: the index extra is exactly "database"; string and file
     * entries are vault keys; the check entry is "_check".
     */
    fun isRestoreKeyAllowed(meta: BackupContainer.Meta): Boolean = when (meta.kind) {
        "x" -> meta.key == "database"
        "s", "f" -> isVaultKey(meta.key)
        "c" -> meta.key == "_check"
        else -> false
    }

    /**
     * Every backup carries one "database" extra and a "_database_key" string entry;
     * refusing backups without them here avoids clearing the vault first.
     */
    fun hasIndex(metas: List<BackupContainer.Meta>): Boolean =
        metas.count { it.kind == "x" && it.key == "database" } == 1 &&
            metas.any { it.kind == "s" && it.key == "_database_key" }

    /** The vault file for [key], after the grammar check and a containment check on the resolved path. */
    fun vaultFile(key: String): File {
        if (!isVaultKey(key)) throw ExpoVaultModule.InvalidKeyException(key)
        val filesDir = contextProvider().filesDir
        return contained(File(filesDir, key), filesDir)
    }

    /** Second line of defence after the grammar: the resolved path must stay inside [directory]. */
    fun contained(target: File, directory: File): File {
        val base = directory.canonicalPath.trimEnd(File.separatorChar) + File.separator
        if (!target.canonicalPath.startsWith(base)) throw ExpoVaultModule.InvalidKeyException(target.name)
        return target
    }

    /**
     * Regular files that are vault entries, in a stable order. A directory that
     * cannot be read throws: an empty list would read as "no entries".
     */
    fun vaultEntryFiles(): List<File> {
        val dir = contextProvider().filesDir
        val files = dir.listFiles() ?: throw IOException("Could not list ${dir.name}")
        return files.filter { it.isFile && isVaultEntryName(it.name) }.sortedBy { it.name }
    }

    /**
     * Decrypts one entry with the device key into [plain]: a chunked file, a
     * string entry, or a legacy single GCM box whose IV is in preferences.
     */
    fun decryptEntry(source: File, plain: File, key: SecretKey) {
        if (VaultCrypto.isChunked(source)) {
            VaultCrypto.decryptFile(source, plain, key, null)
            return
        }
        val bytes = StringEntry.read(source, key, legacyIv(source.name))
        try {
            plain.parentFile?.mkdirs()
            plain.writeBytes(bytes)
        } catch (e: Throwable) {
            plain.delete()
            throw e
        }
    }

    /** The IV a prototype-era entry keeps in preferences, or null. */
    fun legacyIv(key: String): ByteArray? =
        ivPreferences.getString(key, null)?.let {
            android.util.Base64.decode(it, android.util.Base64.DEFAULT)
        }

    fun removeLegacyIv(key: String, synchronous: Boolean = false) {
        val editor = ivPreferences.edit().remove(key)
        if (synchronous) editor.commit() else editor.apply()
    }

    fun clearLegacyIvs() {
        ivPreferences.edit().clear().apply()
    }

    /**
     * The Keystore only reports a lapsed authentication window or an invalidated key
     * when the key is used; probing here makes that failure arrive with nothing removed.
     */
    fun probeKey(key: SecretKey) {
        Cipher.getInstance("AES/GCM/NoPadding").init(Cipher.ENCRYPT_MODE, key)
    }

    fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(keystoreProvider)
        keyStore.load(null)
        return keyStore.getKey(keyAlias, null) as? SecretKey
            ?: throw IllegalStateException("Vault key not found. Create the vault first.")
    }
}
