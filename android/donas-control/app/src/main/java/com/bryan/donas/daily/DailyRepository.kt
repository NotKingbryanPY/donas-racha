package com.bryan.donas.daily

import androidx.room.withTransaction
import com.bryan.donas.data.db.AppDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

object DailyRules {
    fun watermark(snapshot: JSONObject): Long {
        val remote = snapshot.optJSONArray("operations") ?: JSONArray()
        return (0 until remote.length()).maxOfOrNull { remote.getJSONObject(it).getLong("server_sequence") } ?: 0L
    }
    fun money(text: String): Long {
        val value = text.trim().replace(',', '.')
        require(Regex("[0-9]{1,7}(\\.[0-9]{1,2})?").matches(value)) { "Escribe un importe válido con hasta dos decimales." }
        return java.math.BigDecimal(value).movePointRight(2).longValueExact().also {
            require(it in 0..100_000_000) { "El importe es demasiado grande." }
        }
    }
    fun time(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
    fun projected(snapshot: JSONObject, operations: List<DailyOperation>): Map<String, Long> {
        val inventory = snapshot.optJSONObject("inventory")?.optJSONArray("flavors") ?: JSONArray()
        val result = mutableMapOf<String, Long>()
        for (i in 0 until inventory.length()) {
            val row = inventory.getJSONObject(i)
            result[row.getString("variant_id")] = row.getLong("opening_quantity") + row.getLong("purchased_quantity") -
                row.getLong("sold_quantity") - row.getLong("reserved_quantity")
        }
        val remote = snapshot.optJSONArray("operations") ?: JSONArray()
        val ids = (0 until remote.length()).map { remote.getJSONObject(it).getString("id") }.toSet()
        val lastSequence = watermark(snapshot)
        for (operation in operations) {
            if (operation.state in listOf("CONFLICT", "CANCELLED") || operation.id in ids ||
                (operation.state == "ACKED" && (operation.sequence ?: 0) <= lastSequence)) continue
            val body = JSONObject(operation.payload)
            val items = body.optJSONArray("items") ?: continue
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                val quantity = item.getLong("quantity")
                val delta = when (operation.kind) {
                    "PURCHASE" -> quantity * body.getLong("boxes")
                    "SALE", "CONSUMPTION" -> -quantity
                    "CORRECTION" -> quantity
                    else -> 0
                }
                val id = item.getString("variantId")
                result[id] = (result[id] ?: 0) + delta
            }
        }
        return result
    }
}

interface DailyTransport {
    val dailyOwner: String?
    suspend fun dailySnapshot(beforeSequence: Long? = null): JSONObject
    suspend fun dailyApply(payload: JSONObject, expectedOwner: String): JSONObject
}
class DailyRepository(private val db: AppDatabase, private val client: DailyTransport) {
    val dao get() = db.dailyDao()
    suspend fun enqueue(body: JSONObject, operationId: String): DailyOperation = db.withTransaction {
        val owner = client.dailyOwner ?: error("Conecta la cuenta del Dashboard antes de registrar operaciones.")
        dao.operation(operationId)?.let {
            require(it.ownerId == owner) { "El registro pertenece a otra cuenta." }
            return@withTransaction it // UI recovery after a commit followed by process death.
        }
        val saved = dao.cache(owner) ?: error("Actualiza una vez con Internet antes de trabajar sin conexión.")
        require(System.currentTimeMillis() - saved.receivedAt < 24 * 60 * 60 * 1000L) {
            "La última autorización tiene más de 24 horas. Conecta y actualiza para seguir registrando."
        }
        val snapshot = JSONObject(saved.json)
        val session = snapshot.getJSONObject("session").getString("id")
        require(body.getString("sessionId") == session) { "La jornada cambió. Revisa el formulario." }
        val all = dao.projecting(owner, DailyRules.watermark(snapshot))
        require(all.none { it.state == "CONFLICT" }) { "Revisa los registros con conflicto antes de añadir operaciones dependientes." }
        val kind = body.getString("kind")
        val items = body.optJSONArray("items") ?: JSONArray()
        if (kind in listOf("CORRECTION", "CLOSE")) {
            require(all.isEmpty()) { "Sincroniza todos los registros y actualiza su confirmación antes de corregir o cerrar." }
        }
        if (kind in listOf("SALE", "CONSUMPTION")) {
            val stock = DailyRules.projected(snapshot, all)
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                require(item.getLong("quantity") <= (stock[item.getString("variantId")] ?: 0)) { "No hay suficientes unidades en la copia local. Revisa inventario." }
            }
        }
        DailyOperation(operationId, owner, session, kind, body.put("operationId", operationId).toString(), System.currentTimeMillis()).also { dao.enqueue(it) }
    }
    suspend fun refresh(owner: String, beforeSequence: Long? = null): JSONObject {
        require(client.dailyOwner == owner) { "La cuenta cambió." }
        val result = client.dailySnapshot(beforeSequence)
        require(result.optInt("schemaVersion") == 2 && result.has("inventory") && result.has("session")) { "El servidor debe activar el registro diario versión 2." }
        require(client.dailyOwner == owner) { "La cuenta cambió durante la consulta." }
        if (beforeSequence == null) dao.cache(DailyCache(owner, result.toString(), System.currentTimeMillis()))
        return result
    }
    fun body(snapshot: JSONObject, kind: String) = JSONObject().put("sessionId", snapshot.getJSONObject("session").getString("id"))
        .put("kind", kind).put("occurredAt", DailyRules.time())
    fun id(): String = UUID.randomUUID().toString()
}
