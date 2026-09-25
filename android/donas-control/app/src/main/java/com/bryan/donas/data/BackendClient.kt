package com.bryan.donas.data

import android.content.Context
import android.os.Build
import androidx.core.content.edit
import com.bryan.donas.BuildConfig
import com.bryan.donas.data.db.SyncOutboxEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.Locale
import java.util.TimeZone
import java.text.SimpleDateFormat

class BackendClient(context: Context) {
    private val appContext = context.applicationContext
    private val sessions = RemoteSessionStore(appContext)
    private val devicePrefs = appContext.getSharedPreferences("remote_device", Context.MODE_PRIVATE)
    private var accessToken: String? = null
    private var expiresAt = 0L
    private val baseUrl = "https://donas-racha.vercel.app"

    val signedIn: Boolean get() = sessions.hasSession()

    private fun request(path: String, method: String = "GET", body: JSONObject? = null, bearer: String? = null): JSONObject {
        val connection = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 20_000
            setRequestProperty("Accept", "application/json")
            if (bearer != null) setRequestProperty("Authorization", "Bearer $bearer")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val content = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val response = try { JSONObject(content) } catch (_: Exception) { JSONObject() }
            if (status !in 200..299 || !response.optBoolean("ok")) {
                val detail = response.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
                throw BackendException(status, detail ?: "Error de conexión con el servidor ($status).")
            }
            return response.getJSONObject("data")
        } finally { connection.disconnect() }
    }

    suspend fun login(email: String, password: String) = withContext(Dispatchers.IO) {
        val data = request("/api/auth/session", "POST", JSONObject()
            .put("grantType", "password").put("email", email.trim()).put("password", password))
        saveSession(data)
    }

    private fun saveSession(data: JSONObject) {
        sessions.save(data.getString("refreshToken"))
        accessToken = data.getString("accessToken")
        expiresAt = requireNotNull(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.parse(data.getString("expiresAt"))).time
    }

    @Synchronized private fun token(): String {
        if (accessToken != null && System.currentTimeMillis() < expiresAt - 60_000) return accessToken!!
        val refresh = sessions.refreshToken() ?: throw BackendException(401, "Inicia sesión para sincronizar.")
        val data = try {
            request("/api/auth/session", "POST", JSONObject().put("grantType", "refresh_token").put("refreshToken", refresh))
        } catch (e: BackendException) {
            if (e.status == 401 || e.status == 403) logout()
            throw e
        }
        saveSession(data)
        return accessToken!!
    }

    fun logout() {
        sessions.clear()
        accessToken = null
        expiresAt = 0
    }

    private fun deviceId(): String {
        devicePrefs.getString("id", null)?.let { return it }
        return UUID.randomUUID().toString().also { id -> devicePrefs.edit { putString("id", id) } }
    }

    suspend fun push(items: List<SyncOutboxEntity>): JSONArray = withContext(Dispatchers.IO) {
        val operations = JSONArray()
        items.forEach { operations.put(JSONObject().put("clientOperationId", it.clientOperationId)
            .put("type", it.type).put("occurredAt", it.occurredAt).put("payload", JSONObject(it.payloadJson))) }
        request("/api/sync", "POST", JSONObject().put("deviceId", deviceId())
            .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".take(80))
            .put("appVersion", BuildConfig.VERSION_NAME).put("operations", operations), token())
            .getJSONArray("acknowledgements")
    }

    suspend fun pull(cursor: String?): JSONObject = withContext(Dispatchers.IO) {
        val query = if (cursor == null) "" else "&cursor=${java.net.URLEncoder.encode(cursor, "UTF-8")}"
        request("/api/sync?limit=100$query", bearer = token())
    }

    suspend fun transition(orderId: String, status: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().put("status", status)
        if (status == "COMPLETED") body.put("idempotencyKey", UUID.nameUUIDFromBytes("$orderId:COMPLETED".toByteArray()).toString())
        request("/api/admin/orders/$orderId/status", "POST", body, token())
    }

    suspend fun confirmPayment(orderId: String, idempotencyKey: String) = withContext(Dispatchers.IO) {
        request("/api/admin/orders/$orderId/payment", "POST", JSONObject()
            .put("status", "CONFIRMED").put("idempotencyKey", idempotencyKey), token())
    }
}

class BackendException(val status: Int, message: String) : Exception(message)
