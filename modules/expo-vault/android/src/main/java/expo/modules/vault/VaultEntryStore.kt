package expo.modules.vault

import android.content.Context
import android.content.SharedPreferences
import java.io.File
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.SecretKey

internal class VaultEntryStore(
    private val contextProvider: () -> Context,
    private val keyAlias: String,
    private val keystoreProvider: String,
) {
    private val ivPreferences: SharedPreferences by lazy {
        contextProvider().getSharedPreferences("ExpoVault_IVs", Context.MODE_PRIVATE)
    }

    /** Vault entries share filesDir with other libraries; match only vault-owned prefixes. */
    fun isVaultEntryName(name: String): Boolean =
        name.startsWith("file_") || name.startsWith("thumb_") || name.startsWith("page_") ||
            (name.startsWith("_") && name != "ExpoVault_IVs.xml")

    fun isVaultKey(key: String): Boolean =
        key.isNotEmpty() && !key.contains('/') && !key.contains('\\') && !key.contains("..") &&
            isVaultEntryName(key)

    fun isRestoreKeyAllowed(meta: BackupContainer.Meta): Boolean = when (meta.kind) {
        "x" -> meta.key == "database"
        "s", "f" -> isVaultKey(meta.key)
        "c" -> meta.key == "_check"
        else -> false
    }

    fun hasIndex(metas: List<BackupContainer.Meta>): Boolean =
        metas.count { it.kind == "x" && it.key == "database" } == 1 &&
            metas.any { it.kind == "s" && it.key == "_database_key" }

    fun vaultFile(key: String): File {
        if (!isVaultKey(key)) throw ExpoVaultModule.InvalidKeyException(key)
        val filesDir = contextProvider().filesDir
        return contained(File(filesDir, key), filesDir)
    }

    fun contained(target: File, directory: File): File {
        val base = directory.canonicalPath.trimEnd(File.separatorChar) + File.separator
        if (!target.canonicalPath.startsWith(base)) throw ExpoVaultModule.InvalidKeyException(target.name)
        return target
    }

    fun vaultEntryFiles(): List<File> {
        val dir = contextProvider().filesDir
        val files = dir.listFiles() ?: throw IOException("Could not list ${dir.name}")
        return files.filter { it.isFile && isVaultEntryName(it.name) }.sortedBy { it.name }
    }

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

    /** Keystore only surfaces lapsed auth or key invalidation on use; probe before wiping. */
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
