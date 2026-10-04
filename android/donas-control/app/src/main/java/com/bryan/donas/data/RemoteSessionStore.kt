package com.bryan.donas.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Only the renewable session is persisted; the operator password is never stored. */
interface SessionTokens {
    fun save(refreshToken: String)
    fun refreshToken(): String?
    fun hasSession(): Boolean
    fun clear()
}
class RemoteSessionStore(context: Context) : SessionTokens {
    private val prefs = context.applicationContext.getSharedPreferences("remote_session", Context.MODE_PRIVATE)
    private val alias = "donas_remote_session_v1"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build())
        }.generateKey()
    }

    @android.annotation.SuppressLint("UseKtx") // KTX edit discards commit's success flag; rotated tokens must be durably saved.
    @Synchronized override fun save(refreshToken: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val bytes = cipher.doFinal(refreshToken.toByteArray(Charsets.UTF_8))
        check(prefs.edit().apply {
            putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            putString("token", Base64.encodeToString(bytes, Base64.NO_WRAP))
        }.commit()) { "No se pudo conservar la sesión en este dispositivo." }
    }

    override fun refreshToken(): String? = try {
        val iv = prefs.getString("iv", null) ?: return null
        val token = prefs.getString("token", null) ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
        String(cipher.doFinal(Base64.decode(token, Base64.NO_WRAP)), Charsets.UTF_8)
    } catch (_: Exception) {
        clear()
        null
    }

    override fun hasSession() = prefs.contains("token")
    override fun clear() = prefs.edit { clear() }
}
