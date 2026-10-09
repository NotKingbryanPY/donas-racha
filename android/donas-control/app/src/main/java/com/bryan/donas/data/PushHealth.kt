package com.bryan.donas.data

import android.content.Context
import androidx.core.content.edit
import com.bryan.donas.BuildConfig
import org.json.JSONObject

/** Diagnostic metadata only; no push token or server credential. */
object PushHealth {
    private fun preferences(context: Context) = context.getSharedPreferences("push_health", Context.MODE_PRIVATE)
    fun registrationDue(context: Context): Boolean {
        val state = preferences(context)
        return state.getString("version", "") != BuildConfig.VERSION_NAME ||
            System.currentTimeMillis() - state.getLong("registeredAt", 0) >= 24 * 60 * 60 * 1000L ||
            state.getString("registration", "") != "REGISTERED"
    }
    fun registered(context: Context, response: JSONObject) {
        preferences(context).edit(commit = true) {
            putString("registration", "REGISTERED"); putLong("registeredAt", System.currentTimeMillis())
            putString("version", BuildConfig.VERSION_NAME); remove("error")
        }
        metadata(context, response)
    }
    private fun metadata(context: Context, response: JSONObject) = preferences(context).edit(commit = true) {
        response.optJSONObject("configured")?.let {
            putBoolean("serverKnown", true); putBoolean("serverConfigured", it.optBoolean("android"))
        }
        if (response.has("retryConfigured")) {
            putBoolean("retryKnown", true); putBoolean("retryConfigured", response.optBoolean("retryConfigured"))
        }
    }
    fun checked(context: Context, response: JSONObject) {
        metadata(context, response)
        preferences(context).edit(commit = true) {
            putString("check", response.optJSONObject("check")?.optString("status") ?: "STATUS_UNAVAILABLE")
            putLong("checkedAt", System.currentTimeMillis())
        }
    }
    fun failed(context: Context, code: String) = preferences(context).edit(commit = true) {
        putString("registration", "ERROR"); putString("error", code.take(64))
    }
    fun received(context: Context, highPriority: Boolean) = preferences(context).edit(commit = true) {
        putLong("receivedAt", System.currentTimeMillis()); putBoolean("highPriority", highPriority)
    }
    fun clear(context: Context) = preferences(context).edit(commit = true) { clear() }
    private fun checkDescription(code: String): String = when (code) {
        "FCM_AUTH_FAILED", "FCM_KEY_INVALID" -> "el servidor no pudo autorizarse en Firebase ($code)."
        "FCM_PERMISSION_DENIED" -> "el emisor no tiene permiso para enviar avisos ($code)."
        "FCM_SENDER_ID_MISMATCH" -> "el emisor y el teléfono usan proyectos Firebase distintos ($code)."
        "FCM_UNREGISTERED", "DEVICE_NOT_REGISTERED" -> "el registro del teléfono necesita renovarse ($code)."
        "STATUS_UNAVAILABLE" -> "actualiza la API del servidor para comprobar los avisos."
        "PROVIDER_UNAVAILABLE" -> "Firebase no respondió; se reintentará la comprobación."
        else -> "revisión del emisor: $code."
    }
    fun summary(context: Context, signedIn: Boolean, firebaseConfigured: Boolean = PushRegistration.configured): String {
        if (!signedIn) return "Avisos externos: autoriza este dispositivo."
        if (!firebaseConfigured) return "Avisos externos: falta la configuración Firebase de este APK."
        if (!OrderNotifications.enabled(context)) return "Avisos externos: Android bloquea las notificaciones o el canal Pedidos nuevos."
        val state = preferences(context)
        val status = when {
            state.getBoolean("serverKnown", false) && !state.getBoolean("serverConfigured", false) ->
                "el servidor no tiene configurado el emisor FCM."
            state.getString("registration", "") == "ERROR" ->
                "no se pudo registrar/comprobar el teléfono (${state.getString("error", "NETWORK_ERROR")})."
            state.getString("registration", "") != "REGISTERED" -> "registro del teléfono pendiente."
            !state.getBoolean("serverKnown", false) -> "teléfono registrado; falta comprobar el emisor del servidor."
            state.getString("check", "") == "FCM_VALIDATED" -> "configuración FCM validada."
            state.getString("check", "").orEmpty().isNotBlank() -> checkDescription(state.getString("check", "").orEmpty())
            else -> "teléfono registrado; pulsa Comprobar avisos para verificar FCM."
        }
        val retry = if (state.getBoolean("retryKnown", false) && !state.getBoolean("retryConfigured", false))
            " Reintentos del servidor sin configurar." else ""
        val received = state.getLong("receivedAt", 0)
        val lastPush = if (received > 0) " Último push recibido: ${java.text.DateFormat.getDateTimeInstance().format(java.util.Date(received))}." else ""
        return "Avisos externos: $status$retry$lastPush"
    }
}
