package expo.modules.vault

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

/**
 * The shared vectors in modules/expo-vault/tests/fixtures, written by
 * make-fixtures.mjs. The Swift suite reads the same files.
 */
object Fixtures {
    val directory: File = File(
        System.getProperty("vault.fixtures") ?: error("vault.fixtures is not set; run through Gradle"),
    )

    val vectors: JSONObject by lazy { JSONObject(file("vectors.json").readText()) }

    val key: SecretKey by lazy { SecretKeySpec(hex(vectors.getString("key")), "AES") }

    fun file(name: String) = File(directory, name)

    fun bytes(name: String) = file(name).readBytes()

    fun list(name: String): List<JSONObject> = vectors.getJSONArray(name).objects()

    fun hex(text: String) = ByteArray(text.length / 2) { text.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
}

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
