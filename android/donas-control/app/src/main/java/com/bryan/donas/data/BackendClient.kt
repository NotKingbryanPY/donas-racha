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

class BackendClient(context: Context,
    private val baseUrl: String = "https://www.dracha.store",
    tokenStore: SessionTokens? = null) {
    private val appContext = context.applicationContext
    private val sessions = tokenStore ?: RemoteSessionStore(appContext)
    private val devicePrefs = appContext.getSharedPreferences("remote_device", Context.MODE_PRIVATE)
    private var accessToken: String? = null
    private var expiresAt = 0L

    val signedIn: Boolean get() = sessions.hasSession()
    val usesFirebaseAccount: Boolean get() = sessions.refreshToken()?.startsWith("firebase:") == true
    val role: String get() = devicePrefs.getString("role", "ADMIN") ?: "ADMIN"
    val canUpload: Boolean get() = role == "ADMIN" && !devicePrefs.getBoolean("restoreNeedsIdentity", false)

    // Keep the recovered identity and upload guard atomic, and require commit's success result.
    @android.annotation.SuppressLint("UseKtx")
    suspend fun recoverRestoredDevice(proof: SyncOutboxEntity?) = withContext(Dispatchers.IO) {
        if (!devicePrefs.getBoolean("restoreNeedsIdentity", false)) return@withContext
        check(role == "ADMIN") { "Conecta la misma cuenta administradora que usaba la copia." }
        var recoveredId: String? = null
        if (proof != null) {
            val restored = request("/api/sync", "POST", JSONObject().put("action", "restore-device")
                .put("clientOperationId", proof.clientOperationId)
                .put("serverSequence", proof.serverSequence ?: JSONObject.NULL), token())
            check(restored.has("deviceId")) { "El servidor debe actualizarse para trasladar esta copia sin duplicar inventario." }
            if (!restored.isNull("deviceId")) {
                recoveredId = UUID.fromString(restored.getString("deviceId")).toString()
            } else error("Sincroniza los registros en el piloto y vuelve a exportar su copia antes de trasladarlos.")
        }
        val identityUpdate = devicePrefs.edit().putBoolean("restoreNeedsIdentity", false)
        recoveredId?.let { identityUpdate.putString("id", it) }
        check(identityUpdate.commit()) { "No se pudo guardar la identidad de la copia. Vuelve a sincronizar antes de registrar ventas." }
    }

    private fun request(path: String, method: String = "GET", body: JSONObject? = null, bearer: String? = null,
                        retryAuth: Boolean = true, url: URL = URL(baseUrl + path), redirects: Int = 0): JSONObject {
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            instanceFollowRedirects = false
            useCaches = false
            connectTimeout = 15_000
            readTimeout = 20_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
            if (bearer != null) setRequestProperty("Authorization", "Bearer $bearer")
            if (bearer != null) setRequestProperty("X-Donas-Device", deviceId())
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status == 307 || status == 308) {
                val destination = connection.getHeaderField("Location")?.let { URL(url, it) }
                val aliases = setOf("dracha.store", "www.dracha.store")
                val sameOrigin = destination != null && destination.protocol == url.protocol &&
                    destination.host.equals(url.host, ignoreCase = true) && effectivePort(destination) == effectivePort(url)
                val canonicalAlias = destination != null && url.protocol == "https" && destination.protocol == "https" &&
                    effectivePort(url) == 443 && effectivePort(destination) == 443 &&
                    url.host.lowercase(Locale.US) in aliases && destination.host.lowercase(Locale.US) in aliases &&
                    destination.path == url.path && destination.query == url.query
                if (destination == null || destination.userInfo != null || destination.ref != null ||
                    !(sameOrigin || canonicalAlias) || redirects >= 2) {
                    throw BackendException(status, "El servidor redirigió la conexión a una dirección no válida. Tus datos siguen guardados.", "UNSAFE_REDIRECT")
                }
                // 307/308 preserve the method and JSON body; never send credentials to another origin.
                connection.disconnect()
                return request(path, method, body, bearer, retryAuth, destination, redirects + 1)
            }
            val content = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val response = try { JSONObject(content) } catch (_: Exception) { JSONObject() }
            if (status !in 200..299 || !response.optBoolean("ok")) {
                if (status == 401 && (bearer?.startsWith("drd.") == true ||
                        (response.optJSONObject("error")?.optString("code") == "DEVICE_REVOKED" && sessions.refreshToken()?.startsWith("firebase:") == true))) {
                    logout()
                    throw BackendException(401, "El dispositivo perdió autorización. Solicita otra invitación.", "DEVICE_REVOKED")
                }
                if (status == 401 && bearer != null && retryAuth) {
                    return request(path, method, body, token(rejectedToken = bearer), false)
                }
                val detail = response.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
                val fallback = if (status == 304) "El servidor devolvió una respuesta de caché sin datos (304). Vuelve a intentar; tus registros siguen guardados."
                    else "Error de conexión con el servidor ($status)."
                throw BackendException(status, detail ?: fallback,
                    response.optJSONObject("error")?.optString("code"))
            }
            return response.getJSONObject("data")
        } finally { connection.disconnect() }
    }

    private fun effectivePort(url: URL): Int = if (url.port >= 0) url.port else url.defaultPort

    suspend fun login(email: String, password: String) = withContext(Dispatchers.IO) {
        val data = request("/api/auth/session", "POST", JSONObject()
            .put("grantType", "password").put("email", email.trim()).put("password", password))
        synchronized(this@BackendClient) { saveSession(data) }
    }

    private fun saveSession(data: JSONObject) {
        sessions.save(data.getString("refreshToken"))
        devicePrefs.edit { putString("role", data.optString("role", "ADMIN")) }
        accessToken = data.getString("accessToken")
        expiresAt = requireNotNull(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.parse(data.getString("expiresAt"))).time
    }

    @Synchronized private fun token(rejectedToken: String? = null): String {
        val firebaseSession = sessions.refreshToken()?.takeIf { it.startsWith("firebase:") }
        if (firebaseSession != null) {
            if (!PushRegistration.initialize(appContext)) throw BackendException(503, "Firebase no está disponible en este APK.")
            val user = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
            if (user == null || user.uid != firebaseSession.removePrefix("firebase:")) {
                logout(); throw BackendException(401, "Inicia sesión con la cuenta vinculada al dispositivo.", "DEVICE_REVOKED")
            }
            return try {
                com.google.android.gms.tasks.Tasks.await(user.getIdToken(rejectedToken != null), 20, java.util.concurrent.TimeUnit.SECONDS).token
                    ?: throw BackendException(503, "No se pudo renovar la sesión Firebase.")
            } catch (e: java.util.concurrent.ExecutionException) {
                if (e.cause is com.google.firebase.auth.FirebaseAuthInvalidUserException) {
                    logout(); throw BackendException(401, "La cuenta Firebase perdió acceso.", "DEVICE_REVOKED")
                }
                throw BackendException(503, "No se pudo renovar la sesión. Los datos locales siguen guardados.")
            } catch (e: java.util.concurrent.TimeoutException) {
                throw BackendException(503, "La renovación tardó demasiado. Vuelve a intentar con conexión.")
            }
        }
        if (rejectedToken != null && rejectedToken == accessToken) expiresAt = 0
        if (accessToken != null && System.currentTimeMillis() < expiresAt - 60_000) return accessToken!!
        val refresh = sessions.refreshToken() ?: throw BackendException(401, "Inicia sesión para sincronizar.")
        if (refresh.startsWith("drd.")) return refresh
        val data = try {
            request("/api/auth/session", "POST", JSONObject().put("grantType", "refresh_token").put("refreshToken", refresh))
        } catch (e: BackendException) {
            if (e.status == 401 || e.status == 403) logout()
            throw e
        }
        saveSession(data)
        return accessToken!!
    }

    @Synchronized fun logout() {
        val wasFirebase = sessions.refreshToken()?.startsWith("firebase:") == true
        sessions.clear()
        if (wasFirebase && PushRegistration.initialize(appContext)) FirebaseCredentialState.signOut(appContext)
        accessToken = null
        expiresAt = 0
    }

    @android.annotation.SuppressLint("UseKtx")
    @Synchronized fun deviceId(): String {
        devicePrefs.getString("id", null)?.let { return it }
        return UUID.randomUUID().toString().also { id -> check(devicePrefs.edit().putString("id", id).commit()) { "No se pudo guardar la identidad del dispositivo." } }
    }

    suspend fun provision(invitation: String) = withContext(Dispatchers.IO) {
        check(!devicePrefs.getBoolean("restoreNeedsIdentity", false)) { "Verifica la copia con su cuenta original antes de autorizar este dispositivo." }
        val data = request("/api/admin/customers/provisioning", "POST", JSONObject()
            .put("action", "claim").put("deviceId", deviceId()).put("invitation", invitation.trim()))
        synchronized(this@BackendClient) {
            sessions.save(data.getString("credential"))
            devicePrefs.edit { putString("role", data.getString("role")) }
            accessToken = null; expiresAt = 0
        }
    }

    suspend fun linkFirebaseAccount(idToken: String, uid: String) = withContext(Dispatchers.IO) {
        val data = request("/api/admin/customers/firebase-identity", "POST", JSONObject()
            .put("deviceId", deviceId()).put("firebaseIdToken", idToken), token())
        check(data.optBoolean("linked") && data.getString("firebaseUid") == uid) { "No se pudo verificar el vínculo de la cuenta." }
        synchronized(this@BackendClient) {
            sessions.save("firebase:$uid")
            devicePrefs.edit { putString("role", data.getString("role")) }
            accessToken = null; expiresAt = 0
        }
    }

    suspend fun useLinkedFirebaseAccount(idToken: String, uid: String) = withContext(Dispatchers.IO) {
        val data = request("/api/admin/customers/firebase-identity", bearer = idToken, retryAuth = false)
        check(data.getString("deviceId") == deviceId()) { "Autoriza primero este dispositivo." }
        synchronized(this@BackendClient) {
            sessions.save("firebase:$uid")
            devicePrefs.edit { putString("role", data.getString("role")) }
            accessToken = null; expiresAt = 0
        }
    }

    suspend fun catalog(): List<com.bryan.donas.data.db.FlavorEntity> = withContext(Dispatchers.IO) {
        val rows = request("/api/admin/customers/catalog", bearer = token()).getJSONArray("flavors")
        (0 until rows.length()).map { i -> rows.getJSONObject(i).let { row ->
            com.bryan.donas.data.db.FlavorEntity(row.getString("id"), row.getString("sku"), row.getString("name"),
                row.getBoolean("available"), row.getBoolean("active"), row.getString("updated_at"))
        } }
    }

    suspend fun updateFlavor(item: com.bryan.donas.data.db.CatalogOperationEntity) = withContext(Dispatchers.IO) {
        request("/api/admin/customers/catalog", "POST", JSONObject().put("operationId", item.operationId)
            .put("variantId", item.variantId).put("name", item.name).put("available", item.available)
            .put("expectedUpdatedAt", item.expectedUpdatedAt), token())
    }

    suspend fun inventory(): JSONObject = withContext(Dispatchers.IO) {
        request("/api/admin/customers/inventory", bearer = token())
    }

    suspend fun saveInventory(counts: JSONObject, revision: Long): JSONObject = withContext(Dispatchers.IO) {
        request("/api/admin/customers/inventory", "POST", JSONObject().put("counts", counts)
            .put("expectedRevision", revision), token())
    }

    suspend fun pushStatus() = withContext(Dispatchers.IO) {
        request("/api/admin/customers/devices?deviceId=${deviceId()}&check=android", bearer = token())
    }

    suspend fun registerPush(pushToken: String) = withContext(Dispatchers.IO) {
        request("/api/admin/customers/devices", "POST", JSONObject().put("deviceId", deviceId())
            .put("platform", "ANDROID").put("token", pushToken).put("appVersion", BuildConfig.VERSION_NAME), token())
    }

    suspend fun unregisterPush() = withContext(Dispatchers.IO) {
        request("/api/admin/customers/devices", "DELETE", JSONObject().put("deviceId", deviceId()), token())
    }

    suspend fun push(items: List<SyncOutboxEntity>): JSONArray = withContext(Dispatchers.IO) {
        check(canUpload) { "Verifica la identidad de la copia antes de sincronizar su inventario." }
        val operations = JSONArray()
        items.forEach { operations.put(JSONObject().put("clientOperationId", it.clientOperationId)
            .put("type", it.type).put("occurredAt", it.occurredAt).put("payload", JSONObject(it.payloadJson))) }
        request("/api/sync", "POST", JSONObject().put("deviceId", deviceId())
            .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".take(80))
            .put("appVersion", BuildConfig.VERSION_NAME + if (BuildConfig.BUILD_TYPE == "official") "-official" else "")
            .put("operations", operations), token())
            .getJSONArray("acknowledgements")
    }

    suspend fun pull(cursor: String?): JSONObject = withContext(Dispatchers.IO) {
        val query = if (cursor == null) "" else "&cursor=${java.net.URLEncoder.encode(cursor, "UTF-8")}"
        request("/api/sync?limit=100$query", bearer = token())
    }

    suspend fun recentOrders(orderId: String? = null): JSONArray = withContext(Dispatchers.IO) {
        val query = if (orderId == null) "limit=100" else "limit=1&orderId=${UUID.fromString(orderId)}"
        request("/api/admin/orders?$query", bearer = token()).getJSONArray("orders")
    }

    suspend fun customerProfile(publicId: String): CustomerPurchaseProfile = withContext(Dispatchers.IO) {
        val id = java.net.URLEncoder.encode(publicId, "UTF-8")
        val data = request("/api/backend?action=getCliente&id=$id", bearer = token())
        CustomerPurchaseProfile.from(data.getJSONObject("client"))
    }

    suspend fun registerCustomerPurchase(publicId: String, idempotencyKey: String): CustomerPurchaseResult = withContext(Dispatchers.IO) {
        val data = request("/api/backend", "POST", JSONObject()
            .put("action", "registrarCompra")
            .put("clientId", publicId)
            .put("idempotencyKey", idempotencyKey), token())
        CustomerPurchaseResult(
            profile = CustomerPurchaseProfile.from(data.getJSONObject("client")),
            pointsEarned = data.optInt("pointsEarned"),
            replayed = data.optBoolean("replayed")
        )
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

    suspend fun completeDelivery(orderId: String, paymentMethod: String) = withContext(Dispatchers.IO) {
        request("/api/admin/orders/$orderId/status", "POST", JSONObject()
            .put("status", "COMPLETED").put("paymentReceived", true)
            .put("paymentMethod", paymentMethod), token())
    }
}

data class CustomerPurchaseProfile(
    val id: String,
    val name: String,
    val phone: String,
    val purchasesToday: Int,
    val dailyPurchaseLimit: Int,
    val nextPurchasePoints: Int
) {
    companion object {
        fun from(json: JSONObject) = CustomerPurchaseProfile(
            id = json.getString("id"),
            name = json.optString("name", "Cliente"),
            phone = json.optString("whatsapp"),
            purchasesToday = json.optInt("purchasesToday"),
            dailyPurchaseLimit = json.optInt("dailyPurchaseLimit", 3),
            nextPurchasePoints = json.optInt("nextPurchasePoints")
        )
    }
}

data class CustomerPurchaseResult(val profile: CustomerPurchaseProfile, val pointsEarned: Int, val replayed: Boolean)

class BackendException(val status: Int, message: String, val code: String? = null) : Exception(message)
