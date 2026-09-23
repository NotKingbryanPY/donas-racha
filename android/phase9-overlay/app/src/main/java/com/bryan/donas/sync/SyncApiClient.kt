package com.bryan.donas.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

fun interface AuthTokenProvider { suspend fun accessToken(): String }

data class SyncAcknowledgement(val clientOperationId: String, val serverSequence: Long)

class SyncApiClient(
    private val baseUrl: String,
    private val tokenProvider: AuthTokenProvider,
    private val devicePublicId: String,
    private val deviceName: String,
    private val appVersion: String
) {
    suspend fun push(operations: List<SyncOperationEntity>): List<SyncAcknowledgement> = withContext(Dispatchers.IO) {
        require(operations.isNotEmpty() && operations.size <= 50)
        val items = JSONArray()
        operations.forEach { operation ->
            items.put(JSONObject().apply {
                put("clientOperationId", operation.clientOperationId)
                put("type", operation.operationType)
                put("requestHash", operation.requestHash)
                put("payload", JSONObject(operation.payloadJson))
                put("occurredAt", operation.occurredAtIso)
            })
        }
        val body = JSONObject().apply {
            put("deviceId", devicePublicId)
            put("deviceName", deviceName)
            put("appVersion", appVersion)
            put("operations", items)
        }.toString()

        val connection = (URL("${baseUrl.trimEnd('/')}/api/sync").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Authorization", "Bearer ${tokenProvider.accessToken()}")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body) }
            val responseBody = (if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (connection.responseCode !in 200..299) throw SyncHttpException(connection.responseCode, responseBody.take(500))
            val acknowledgements = JSONObject(responseBody).getJSONArray("acknowledgements")
            List(acknowledgements.length()) { index ->
                val item = acknowledgements.getJSONObject(index)
                SyncAcknowledgement(item.getString("clientOperationId"), item.getLong("serverSequence"))
            }
        } finally {
            connection.disconnect()
        }
    }
}

class SyncHttpException(val statusCode: Int, message: String) : Exception(message)
