package com.bryan.donas.orders

import android.content.Context
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Upsert
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendClient
import com.bryan.donas.data.BackendException
import androidx.core.content.edit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Independent owner-scoped cache. Legacy remote_orders and all business records remain intact. */
@Entity(tableName = "staff_order_cache")
data class StaffOrderCache(@PrimaryKey val ownerId: String, val json: String, val receivedAt: Long)
@Dao
interface StaffOrderDao {
    @Upsert suspend fun save(cache: StaffOrderCache)
    @Query("SELECT * FROM staff_order_cache WHERE ownerId=:owner") suspend fun cache(owner: String): StaffOrderCache?
    @Query("SELECT * FROM staff_order_cache WHERE ownerId=:owner") fun observe(owner: String): Flow<StaffOrderCache?>
}
interface StaffOrderTransport {
    val dailyOwner: String?
    suspend fun staffOrderPage(owner: String, status: String? = null, cursor: JSONObject? = null, orderId: String? = null): JSONObject
}
class StaffInbox(private val dao: StaffOrderDao, private val client: StaffOrderTransport) {
    suspend fun refresh(owner: String): List<JSONObject> {
        require(client.dailyOwner == owner) { "La cuenta cambió." }
        val active = linkedMapOf<String, JSONObject>()
        var cursor: JSONObject? = null
        var complete = false
        for (page in 0 until 20) {
            val response = client.staffOrderPage(owner, "ACTIVE", cursor)
            val rows = response.getJSONArray("orders")
            for (i in 0 until rows.length()) active[rows.getJSONObject(i).getString("id")] = rows.getJSONObject(i)
            if (!response.optBoolean("hasMore")) { complete = true; break }
            val next = response.optJSONObject("nextCursor") ?: error("No se pudo completar la página de pedidos.")
            require(next.toString() != cursor?.toString()) { "El cursor de pedidos no avanzó." }
            cursor = next
        }
        require(complete) { "Hay más de 2000 pedidos activos. Revisa el Dashboard para completar la consulta." }
        val recent = client.staffOrderPage(owner).getJSONArray("orders")
        require(client.dailyOwner == owner) { "La cuenta cambió durante la consulta." }
        val payload = JSONObject().put("active", JSONArray(active.values.toList())).put("recent", recent)
        dao.save(StaffOrderCache(owner, payload.toString(), System.currentTimeMillis()))
        return active.values.filter { it.optString("status") == "PENDING" }
    }
    suspend fun detail(owner: String, id: String): JSONObject {
        val rows = client.staffOrderPage(owner, orderId = id).getJSONArray("orders")
        require(client.dailyOwner == owner) { "La cuenta cambió." }
        if (rows.length() != 1) throw BackendException(404, "El pedido no está disponible.", "ORDER_NOT_FOUND")
        return rows.getJSONObject(0).also { require(it.getString("id") == id) }
    }
}
class StaffInboxWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object { private val gate = Mutex() }
    override suspend fun doWork(): Result = gate.withLock {
        val app = applicationContext as DonasApp
        val owner = app.backendClient.dailyOwner ?: return@withLock Result.success()
        val diagnostics = applicationContext.getSharedPreferences("staff_inbox_status", Context.MODE_PRIVATE)
        try {
            val pending = app.staffInbox.refresh(owner)
            if (app.backendClient.dailyOwner != owner) return@withLock Result.success()
            pending.forEach { order -> StaffOrderNotifications.showOrder(app, owner, order.getString("id")) }
            diagnostics.edit { remove("error:$owner"); putLong("updated:$owner", System.currentTimeMillis()) }
            Result.success()
        } catch (e: CancellationException) { throw e
        } catch (e: BackendException) {
            diagnostics.edit { putString("error:$owner", e.message) }
            if (e.status in listOf(401, 403) && app.backendClient.dailyOwner == owner) app.backendClient.logout()
            if (e.status in listOf(401, 403)) Result.failure() else Result.retry()
        } catch (e: Exception) {
            diagnostics.edit { putString("error:$owner", e.message ?: "No se pudo actualizar; conserva la copia anterior.") }
            Result.retry()
        }
    }
}
object StaffInboxSync {
    fun request(context: Context, highPriority: Boolean = false) {
        val owner = (context.applicationContext as DonasApp).backendClient.dailyOwner ?: return
        val work = OneTimeWorkRequestBuilder<StaffInboxWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        if (highPriority && android.os.Build.VERSION.SDK_INT >= 31)
            work.setExpedited(androidx.work.OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        WorkManager.getInstance(context).enqueueUniqueWork("staff-order-inbox-$owner", ExistingWorkPolicy.APPEND_OR_REPLACE, work.build())
    }
    fun schedule(context: Context) {
        val owner = (context.applicationContext as DonasApp).backendClient.dailyOwner ?: return
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("staff-order-backup-$owner", ExistingPeriodicWorkPolicy.UPDATE,
            PeriodicWorkRequestBuilder<StaffInboxWorker>(30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
        request(context)
    }
    fun stop(context: Context, owner: String) {
        WorkManager.getInstance(context).cancelUniqueWork("staff-order-inbox-$owner")
        WorkManager.getInstance(context).cancelUniqueWork("staff-order-backup-$owner")
    }
}
